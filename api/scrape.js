// Vercel Serverless Function — Scrape Cryptorank Drophunting page
// Deploys automatically when pushed to Vercel

const https = require('https');

function fetchHTML(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function extractMeta(html) {
  const result = {};

  // Logo — find first large project logo
  const logoMatch = html.match(/<img[^>]*alt="(world\.xyz|[^"]+)"[^>]*src="([^"]+)"[^>]*class[^>]*logo/i) ||
                     html.match(/<div[^>]*(?:coin-info|logo)[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[^>]*alt="([^"]+)"/i) ||
                     html.match(/<img[^>]*class="[^"]*logo[^"]*"[^>]*src="([^"]+)"/i) ||
                     html.match(/<img[^>]*alt="([^"]+)"[^>]*src="([^"]+)"[^>]*\/?>\s*(?:<[^>]+>\s*)*<span[^>]*>([^<]+)<\/span>/i);
  if (logoMatch) {
    result.logoUrl = logoMatch[1] || logoMatch[2] || '';
    if (result.logoUrl && !result.logoUrl.startsWith('http')) {
      result.logoUrl = 'https://cryptorank.io' + result.logoUrl;
    }
  }

  // Try to find logo in og:image meta
  const ogMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
  if (ogMatch && !result.logoUrl) {
    result.logoUrl = ogMatch[1];
  }

  // Project name from title
  const titleMatch = html.match(/<title>([^<]+?) Airdrop/i);
  result.project = titleMatch ? titleMatch[1].trim() : '';

  // Token ticker — look for it after project name in heading
  const headingMatch = html.match(/<h1[^>]*>[\s\S]*?<span[^>]*>([A-Z0-9]{2,10})<\/span>/i) ||
                       html.match(/<h1[^>]*>[\s\S]*?<a[^>]*>([A-Z0-9]{2,10})<\/a>/i);
  if (headingMatch) {
    result.token = headingMatch[1];
  }

  // Fallback: try to find token from structured JSON-LD or meta
  if (!result.token) {
    const tokenMatch = html.match(/"ticker"\s*:\s*"([^"]+)"/i) ||
                       html.match(/"symbol"\s*:\s*"([^"]+)"/i);
    if (tokenMatch) result.token = tokenMatch[1];
  }

  // Reward Type
  const rewardMatch = html.match(/Reward\s*Type[^<]*<[^>]*>[^<]*<[^>]*>([^<]+)/i) ||
                      html.match(/Reward\s*Type[^:]*:\s*([^<]+)</i);
  result.rewardType = rewardMatch ? rewardMatch[1].trim() : '';

  // Status
  const statusMatch = html.match(/Status[^<]*<[^>]*>[^<]*<[^>]*>([^<]+)/i) ||
                      html.match(/Status[^:]*:\s*([^<]+)</i);
  result.status = statusMatch ? statusMatch[1].trim() : '';

  // Reward Date
  const dateMatch = html.match(/Reward\s*Date[^<]*<[^>]*>[^<]*<[^>]*>([^<]+)/i) ||
                    html.match(/Reward\s*Date[^:]*:\s*([^<]+)</i);
  result.rewardDate = dateMatch ? dateMatch[1].trim() : '';

  // Time / deadline info
  const timeMatch = html.match(/(?:Available from|Deadline|Start)[^<]*<[^>]*>([^<]+)/i);
  if (timeMatch) {
    result.timeInfo = timeMatch[1].trim();
  }

  return result;
}

module.exports = async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing ?url= parameter' });
  }

  if (!url.includes('cryptorank.io/drophunting/')) {
    return res.status(400).json({ error: 'URL must be a Cryptorank drophunting page' });
  }

  try {
    const html = await fetchHTML(url);
    const data = extractMeta(html);

    if (!data.project && !data.rewardType) {
      return res.status(404).json({ error: 'Could not parse airdrop data from this page' });
    }

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch: ' + err.message });
  }
};