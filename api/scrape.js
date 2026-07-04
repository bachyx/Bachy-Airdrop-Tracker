// Vercel Serverless — Scrape Cryptorank for project logo, cost, status, reward type
const https = require('https');

function fetchHTML(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 10000
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('timeout')); });
  });
}

module.exports = async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing ?url=' });
  if (!url.includes('cryptorank.io/drophunting/'))
    return res.status(400).json({ error: 'Must be cryptorank.io/drophunting/...' });

  try {
    const html = await fetchHTML(url);
    const result = {};

    // Title -> project name
    const tm = html.match(/<title>([^<]+?)\s*Airdrop/i);
    result.project = tm ? tm[1].trim() : '';

    // Logo: og:image
    const og = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
    if (og) result.logoUrl = og[1];

    // Try embedded JSON data with cost
    const jm = html.match(/"(?:key|name)":"([^"]+)"[^}]*?cost[":]+(\d+)/i);
    if (!jm) {
      // broader: find any "cost":N block
      const cm = html.match(/"cost"\s*:\s*(\d+)/);
      if (cm) result.cost = '$ ' + cm[1];
    } else {
      result.cost = '$ ' + jm[2];
    }

    // Reward Type
    const rt = html.match(/Reward\s*Type[^:]*:?\s*([^<]{2,40})</i);
    result.rewardType = rt ? rt[1].trim() : '';

    // Status from info card
    const st = html.match(/Status[^:]*:?\s*([A-Za-z]+)</i);
    result.status = st ? st[1].trim() : '';
    // fallback from icon alt
    if (!result.status) {
      const simg = html.match(/<img[^>]*alt="(Confirmed|Ended|Ongoing|Active|Upcoming)"/i);
      if (simg) result.status = simg[1];
    }

    // Reward Date
    const rd = html.match(/Reward\s*Date[^:]*:?\s*([^<]{2,30})</i);
    result.rewardDate = rd ? rd[1].trim() : '';

    // Raised (if no cost found)
    if (!result.cost) {
      const rm = html.match(/Raised[^$]*\$([^<]+)/i);
      if (rm) result.cost = '$ ' + rm[1].trim();
    }
    result.cost = result.cost || 'N/A';

    if (!result.project && !result.rewardType)
      return res.status(404).json({ error: 'Could not parse airdrop data' });

    res.setHeader('Cache-Control', 's-maxage=3600');
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: 'Failed: ' + err.message });
  }
};