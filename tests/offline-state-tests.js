const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const cacheKey = 'czech-currency-converter-rates-v1';

function makeStorage(initial) {
  const data = new Map(Object.entries(initial || {}));
  return {
    getItem: key => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    snapshot: () => Object.fromEntries(data)
  };
}

async function runScenario({ online, cached, response, reject = false, manual = false }) {
  const ids = ['czk', 'usd', 'eur', 'status', 'detail', 'dot', 'refresh', 'offline-readiness'];
  const elements = Object.fromEntries(ids.map(id => [id, {
    id,
    value: '',
    textContent: '',
    className: '',
    disabled: false,
    listeners: {},
    addEventListener(type, handler) { this.listeners[type] = handler; }
  }]));
  const storage = makeStorage(cached ? { [cacheKey]: JSON.stringify(cached) } : {});
  let fetchCalls = 0;
  const requestedUrls = [];
  const context = {
    console,
    localStorage: storage,
    navigator: { onLine: online },
    document: {
      hidden: false,
      getElementById: id => elements[id],
      addEventListener() {}
    },
    window: { addEventListener() {} },
    fetch: async url => {
      fetchCalls += 1;
      requestedUrls.push(url);
      if (reject) throw new Error('Request failed');
      return { ok: true, json: async () => response };
    },
    setInterval() {},
    setTimeout,
    clearTimeout,
    MessageChannel
  };

  vm.createContext(context);
  vm.runInContext(source, context);
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  if (manual) {
    await elements.refresh.listeners.click();
    await new Promise(resolve => setImmediate(resolve));
  }
  return { elements, storage: storage.snapshot(), fetchCalls, requestedUrls };
}

function check(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  const now = new Date().toISOString();
  const valid = {
    rates: { USD: 1, CZK: 22.2, EUR: 0.91 },
    source: 'Verified source',
    rateTimestamp: now,
    fetchedAt: now
  };

  const online = await runScenario({ online: true, response: valid });
  check(online.elements.status.textContent === 'Updated', 'Online data should show Updated');
  check(online.fetchCalls === 1, 'Online launch should fetch rates');
  check(JSON.parse(online.storage[cacheKey]).source === valid.source, 'Valid online rates should be persisted');

  const manual = await runScenario({ online: true, cached: valid, response: valid, manual: true });
  check(manual.fetchCalls === 2, 'Manual refresh should make a new request');
  check(manual.requestedUrls[1].startsWith('/api/rates?manual='), 'Manual refresh should bypass the scheduled cache URL');
  check(manual.elements.detail.textContent.startsWith('Manual refresh completed.'), 'Manual refresh should show completion feedback');
  check(manual.elements.refresh.textContent === 'Refresh rates', 'Manual refresh button should return to its normal label');

  const manualFailure = await runScenario({ online: true, cached: valid, reject: true, manual: true });
  check(manualFailure.elements.detail.textContent.startsWith('Manual refresh failed.'), 'Manual refresh failure should be visible');
  check(manualFailure.elements.refresh.textContent === 'Refresh rates', 'Failed manual refresh should restore the button label');

  const offline = await runScenario({ online: false, cached: valid, reject: true });
  check(offline.elements.status.textContent === 'Offline — using saved rates', 'Offline launch should use saved rates');
  check(offline.fetchCalls === 0, 'Known-offline launch should not attempt a request');

  const staleRecord = { ...valid, rateTimestamp: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() };
  const stale = await runScenario({ online: true, cached: staleRecord, reject: true });
  check(stale.elements.status.textContent === 'Rates outdated', 'Rates older than 24 hours should be marked outdated');

  const invalid = await runScenario({
    online: true,
    cached: valid,
    response: { rates: { USD: 1 }, source: 'Incomplete', rateTimestamp: now, fetchedAt: now }
  });
  check(invalid.storage[cacheKey] === JSON.stringify(valid), 'Invalid responses must not replace valid saved rates');

  const firstLaunchOffline = await runScenario({ online: false, reject: true });
  check(firstLaunchOffline.elements.status.textContent === 'Internet required for first setup', 'First offline launch should require initialization');
  check(firstLaunchOffline.elements['offline-readiness'].textContent === 'Connect once to finish offline setup', 'Offline readiness must not be claimed before initialization');

  console.log('Offline state tests: PASS');
})().catch(error => {
  console.error(`Offline state tests: FAIL\n${error.stack}`);
  process.exitCode = 1;
});
