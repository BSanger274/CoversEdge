// Vercel serverless proxy for The Odds API.
//
// Why: fetching odds server-side means (1) the API key lives in a Vercel env var
// instead of being typed into the browser and routed through public CORS proxies,
// (2) no flaky proxy chain, and (3) edge caching so refreshes within ~45s share one
// upstream call — saving the monthly credit budget.
//
// Setup (one time): in Vercel → Project → Settings → Environment Variables, add
//   ODDS_API_KEY = <your the-odds-api.com key>
// Until that's set this returns { hasKey:false } and the client falls back to its
// existing in-browser fetch path, so deploying this is safe with or without the key.

module.exports = async (req, res) => {
  const key = process.env.ODDS_API_KEY;
  const q = req.query || {};

  // Lightweight probe the client uses on load to decide whether to use the proxy.
  if (q.probe) { res.status(200).json({ hasKey: !!key }); return; }

  if (!key) { res.status(501).json({ error: 'Server API key not configured' }); return; }

  const regions = String(q.regions || 'us,us2,us_ex');
  const markets = String(q.markets || 'spreads,h2h,totals');
  const from = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const to = new Date(Date.now() + 7 * 86400000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const url = 'https://api.the-odds-api.com/v4/sports/basketball_ncaab/odds'
    + '?regions=' + encodeURIComponent(regions)
    + '&markets=' + encodeURIComponent(markets)
    + '&oddsFormat=american'
    + '&commenceTimeFrom=' + encodeURIComponent(from)
    + '&commenceTimeTo=' + encodeURIComponent(to)
    + '&apiKey=' + encodeURIComponent(key);

  try {
    const r = await fetch(url, { cache: 'no-store' });
    const rem = r.headers.get('x-requests-remaining');
    const used = r.headers.get('x-requests-used');
    const body = await r.text();
    if (rem != null) res.setHeader('x-requests-remaining', rem);
    if (used != null) res.setHeader('x-requests-used', used);
    res.setHeader('Access-Control-Expose-Headers', 'x-requests-remaining, x-requests-used');
    // Share one upstream call across refreshes/visitors within the window (saves credits).
    res.setHeader('Cache-Control', 's-maxage=45, stale-while-revalidate=30');
    res.setHeader('Content-Type', 'application/json');
    res.status(r.status).send(body);
  } catch (e) {
    res.status(502).json({ error: String((e && e.message) || e) });
  }
};
