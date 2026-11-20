(() => {
  'use strict';

  const CACHE_KEY = 'czech-currency-converter-rates-v1';
  const MAX_RATE_AGE = 24 * 60 * 60 * 1000;
  const REFRESH_INTERVAL = 15 * 60 * 1000;
  const fields = Object.fromEntries(['CZK', 'USD', 'EUR'].map(code => [code, document.getElementById(code.toLowerCase())]));
  const status = document.getElementById('status');
  const detail = document.getElementById('detail');
  const dot = document.getElementById('dot');
  const refresh = document.getElementById('refresh');
  const offlineReadiness = document.getElementById('offline-readiness');
  const fmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  let rates = null;
  let rateInfo = null;
  let active = 'CZK';
  let offlineAssetsReady = false;
  let lastRefreshFailed = false;

  const plain = value => String(value).replace(/,/g, '').replace(/\s/g, '').trim();
  const validNumber = value => /^\d*(?:\.\d*)?$/.test(value) && value !== '' && value !== '.';
  const validTimestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value));

  function validRates(value) {
    return value && ['USD', 'CZK', 'EUR'].every(code => Number.isFinite(value[code]) && value[code] > 0);
  }

  function validRateRecord(value) {
    return value && validRates(value.rates) && typeof value.source === 'string' && value.source.trim() !== '' &&
      validTimestamp(value.rateTimestamp) && validTimestamp(value.fetchedAt);
  }

  function formatDateTime(value) {
    const date = value ? new Date(value) : null;
    return date && !isNaN(date) ? date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'not provided';
  }

  function ratesAreStale() {
    return !validTimestamp(rateInfo?.rateTimestamp) || Date.now() - Date.parse(rateInfo.rateTimestamp) > MAX_RATE_AGE;
  }

  function updateOfflineReadiness() {
    if (offlineAssetsReady && validRateRecord(rateInfo)) {
      offlineReadiness.className = '';
      offlineReadiness.textContent = 'Ready for offline use';
    } else if (!navigator.onLine && !validRateRecord(rateInfo)) {
      offlineReadiness.className = 'warn';
      offlineReadiness.textContent = 'Connect once to finish offline setup';
    } else if (!('serviceWorker' in navigator)) {
      offlineReadiness.className = 'warn';
      offlineReadiness.textContent = 'Offline app caching is unavailable in this browser';
    } else {
      offlineReadiness.className = 'pending';
      offlineReadiness.textContent = 'Preparing offline access…';
    }
  }

  function renderRateStatus() {
    if (!validRateRecord(rateInfo)) {
      dot.className = `dot ${navigator.onLine ? 'warn' : 'bad'}`;
      status.textContent = navigator.onLine ? 'Loading current rates…' : 'Internet required for first setup';
      detail.textContent = navigator.onLine
        ? 'One successful rate update is required before offline conversion is available.'
        : 'Connect once to download and save current exchange rates.';
      updateOfflineReadiness();
      return;
    }

    const stale = ratesAreStale();
    if (stale) {
      dot.className = 'dot warn';
      status.textContent = 'Rates outdated';
    } else if (!navigator.onLine) {
      dot.className = 'dot warn';
      status.textContent = 'Offline — using saved rates';
    } else {
      dot.className = 'dot';
      status.textContent = 'Updated';
    }

    const connectionNote = !navigator.onLine ? ' Offline — using saved rates.' : '';
    const failureNote = lastRefreshFailed && navigator.onLine ? ' The latest refresh failed; saved rates remain active.' : '';
    detail.textContent = `Saved rates: ${formatDateTime(rateInfo.rateTimestamp)}. Source: ${rateInfo.source}. Last successful fetch: ${formatDateTime(rateInfo.fetchedAt)}.${connectionNote}${failureNote}`;
    updateOfflineReadiness();
  }

  function recalc() {
    const raw = plain(fields[active].value);
    if (!validNumber(raw)) {
      for (const code of Object.keys(fields)) if (code !== active) fields[code].value = '';
      return;
    }
    if (!rates) return;
    const amount = Number(raw);
    const inUSD = amount / rates[active];
    for (const code of Object.keys(fields)) {
      if (code !== active) fields[code].value = Number.isFinite(inUSD * rates[code]) ? fmt.format(inUSD * rates[code]) : '';
    }
  }

  for (const [code, element] of Object.entries(fields)) {
    element.addEventListener('input', () => { active = code; recalc(); });
    element.addEventListener('focus', () => { active = code; });
  }

  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (validRateRecord(cached)) {
      rates = cached.rates;
      rateInfo = cached;
    }
  } catch (_) { /* Invalid or unavailable local storage is treated as an uninitialized first launch. */ }

  async function loadRates() {
    if (!navigator.onLine) {
      lastRefreshFailed = true;
      renderRateStatus();
      return;
    }

    refresh.disabled = true;
    if (!rates) renderRateStatus();
    try {
      const response = await fetch('/api/rates', { cache: 'no-store' });
      if (!response.ok) throw new Error('Could not load rates');
      const data = await response.json();
      const candidate = {
        rates: data?.rates,
        source: data?.source,
        rateTimestamp: data?.rateTimestamp,
        fetchedAt: data?.fetchedAt
      };
      if (!validRateRecord(candidate)) throw new Error('Invalid or incomplete rates');

      rates = candidate.rates;
      rateInfo = candidate;
      lastRefreshFailed = false;
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(candidate)); } catch (_) { /* Current-session conversion still works. */ }
      recalc();
    } catch (_) {
      lastRefreshFailed = true;
    } finally {
      refresh.disabled = false;
      renderRateStatus();
    }
  }

  function confirmOfflineCache(registration) {
    return new Promise(resolve => {
      const worker = registration.active || navigator.serviceWorker.controller;
      if (!worker) return resolve(false);
      const channel = new MessageChannel();
      const timeout = setTimeout(() => resolve(false), 5000);
      channel.port1.onmessage = event => {
        clearTimeout(timeout);
        resolve(event.data?.type === 'OFFLINE_CACHE_STATUS' && event.data.ready === true);
      };
      worker.postMessage({ type: 'CHECK_OFFLINE_CACHE' }, [channel.port2]);
    });
  }

  async function prepareOfflineApp() {
    if (!('serviceWorker' in navigator)) {
      updateOfflineReadiness();
      return;
    }
    try {
      await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
      const registration = await navigator.serviceWorker.ready;
      offlineAssetsReady = await confirmOfflineCache(registration);
    } catch (_) {
      offlineAssetsReady = false;
    }
    updateOfflineReadiness();
  }

  refresh.addEventListener('click', loadRates);
  window.addEventListener('online', loadRates);
  window.addEventListener('offline', renderRateStatus);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadRates(); });

  renderRateStatus();
  prepareOfflineApp();
  loadRates();
  setInterval(() => { if (!document.hidden) loadRates(); }, REFRESH_INTERVAL);
})();
