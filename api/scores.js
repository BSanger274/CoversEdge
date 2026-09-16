// Vercel serverless proxy for The Odds API /scores endpoint — final scores of recent
// games, used to grade your tracked picks against your pool line. Same env var as
// api/odds.js (ODDS_API_KEY). Cached a bit longer since scores change slowly.
// Cost: the /scores endpoint with daysFrom costs ~2 credits per call, so grading is a
// deliberate button, not automatic.

module.exports = async (req, res) => {
  const key = process.env.ODDS_API_KEY;
  const q = req.query || {};
  if (q.probe) { res.status(200).json({ hasKey: !!key }); return; }
  if (!key) { res.status(501).json({ error: 'Server API key not configured' }); return; }

  const daysFrom = Math.min(3, Math.max(1, parseInt(q.daysFrom || '3', 10) || 3));
  const url = 'https://api.the-odds-api.com/v4/sports/basketball_ncaab/scores'
    + '?daysFrom=' + daysFrom
    + '&apiKey=' + encodeURIComponent(key);

  try {
    const r = await fetch(url, { cache: 'no-store' });
    const rem = r.headers.get('x-requests-remaining');
    const used = r.headers.get('x-requests-used');
    const body = await r.text();
    if (rem != null) res.setHeader('x-requests-remaining', rem);
    if (used != null) res.setHeader('x-requests-used', used);
    res.setHeader('Access-Control-Expose-Headers', 'x-requests-remaining, x-requests-used');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=120');
    res.setHeader('Content-Type', 'application/json');
    res.status(r.status).send(body);
  } catch (e) {
    res.status(502).json({ error: String((e && e.message) || e) });
  }
};
