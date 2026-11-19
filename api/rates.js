const PRIMARY = 'https://open.er-api.com/v6/latest/USD';
const BACKUP = 'https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR,CZK';

async function getJSON(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6500);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Rate provider returned ${res.status}`);
    return await res.json();
  } finally { clearTimeout(timer); }
}

function validate(body, provider) {
  const eur = Number(body?.rates?.EUR);
  const czk = Number(body?.rates?.CZK);
  if (!(eur > 0 && czk > 0 && Number.isFinite(eur) && Number.isFinite(czk))) {
    throw new Error('Missing valid EUR/CZK rates');
  }
  const rateTimestamp = provider === 'primary'
    ? new Date(Number(body.time_last_update_unix) * 1000).toISOString()
    : (body.date ? `${body.date}T00:00:00.000Z` : null);
  return { base: 'USD', rates: { USD: 1, EUR: eur, CZK: czk }, rateTimestamp };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=300');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const data = validate(await getJSON(PRIMARY), 'primary');
    return res.status(200).json({ ...data, source: 'ExchangeRate-API (open endpoint)', fetchedAt: new Date().toISOString() });
  } catch (_) {
    try {
      const data = validate(await getJSON(BACKUP), 'backup');
      return res.status(200).json({ ...data, source: 'Frankfurter (reference rates, fallback)', fetchedAt: new Date().toISOString() });
    } catch (_) {
      return res.status(503).json({ error: 'Exchange rates are temporarily unavailable. Try refreshing.' });
    }
  }
};
