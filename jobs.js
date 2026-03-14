/**
 * Vercel Serverless Function — /api/jobs
 *
 * Acts as a CORS proxy for Greenhouse and Lever,
 * which block direct browser requests.
 *
 * Usage from your frontend:
 *   GET /api/jobs?ats=greenhouse&boardId=stripe
 *   GET /api/jobs?ats=lever&boardId=brex
 *   GET /api/jobs?ats=ashby&boardId=linear   (works direct too)
 *
 * Deploy: just put this file at /api/jobs.js in your repo.
 * Vercel auto-detects it as a serverless function.
 */

export default async function handler(req, res) {
  // Allow all origins (your site, previews, local dev)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=300'); // cache 5 mins on CDN

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { ats, boardId } = req.query;

  if (!ats || !boardId) {
    return res.status(400).json({ error: 'Missing ?ats= and ?boardId= params' });
  }

  const URLS = {
    ashby:      `https://api.ashbyhq.com/posting-api/job-board/${boardId}?includeCompensation=true`,
    greenhouse: `https://boards-api.greenhouse.io/v1/boards/${boardId}/jobs?content=true`,
    lever:      `https://api.lever.co/v0/postings/${boardId}?mode=json`,
  };

  const url = URLS[ats];
  if (!url) {
    return res.status(400).json({ error: `Unknown ATS: ${ats}. Must be ashby, greenhouse, or lever.` });
  }

  try {
    const upstream = await fetch(url, {
      headers: {
        'User-Agent': 'Launched.life/1.0 (jobs aggregator)',
        'Accept': 'application/json',
      },
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: `Upstream ${ats} returned ${upstream.status} for boardId="${boardId}"`,
      });
    }

    const data = await upstream.json();
    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
