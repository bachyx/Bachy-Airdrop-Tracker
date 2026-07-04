// Vercel Serverless — Scrape Cryptorank for project logo, cost, status, reward type
const https = require('https');
const urlMod = require('url');

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
    const pathParts = url.split('/');
    const slug = pathParts[pathParts.length - 1].split('?')[0]; // e.g. "world-xyz-activity1230"

    // Title -> project name
    const tm = html.match(/<title>([^<]+?)\s*Airdrop/i);
    result.project = tm ? tm[1].trim() : '';

    // Logo: find actual coin image from cryptorank.io/coins/
    const coinImg = html.match(/<img[^>]*src="(https:\/\/images\.cryptorank\.io\/coins\/[^"]+)"[^>]*>/i);
    if (coinImg) {
      result.logoUrl = coinImg[1];
    }
    // Fallback: og:image
    if (!result.logoUrl) {
      const og = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
      if (og) result.logoUrl = og[1];
    }

    // Cost: find the JSON block that has the matching slug key
    // Looking for: "key":"{slug}","name":"...","cost":N
    const slugEscaped = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const costRegex = new RegExp('"key"\\s*:\\s*"' + slugEscaped + '"[^}]*?"cost"\\s*:\\s*(\\d+)', 'i');
    const costMatch = html.match(costRegex);
    if (costMatch) {
      result.cost = '$ ' + costMatch[1];
    }

    // Fallback: try broad cost match from the activity list JSON
    if (!result.cost) {
      const allCosts = html.match(/"cost"\s*:\s*(\d+)/g);
      if (allCosts && allCosts.length > 0) {
        // Try to find which one is ours by proximity to our slug
        const idx = html.indexOf(`"${slug}"`);
        if (idx > 0) {
          const before = html.substring(Math.max(0, idx - 500), idx + 500);
          const nearCost = before.match(/"cost"\s*:\s*(\d+)/);
          if (nearCost) result.cost = '$ ' + nearCost[1];
        }
      }
    }

    if (!result.cost) {
      // Last resort: raised amount
      const rm = html.match(/Raised[^$]*\$([^<]+)/i);
      result.cost = rm ? '$ ' + rm[1].trim() : 'N/A';
    }

    // Task Types from __NEXT_DATA__ JSON (most reliable)
    const nextDataMatch = html.match(/__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const activity = nextData?.props?.pageProps?.drophuntingActivity;
        if (activity?.tasks?.length > 0) {
          result.taskType = activity.tasks[0].type || activity.tasks[0].types?.[0] || '';
        }
      } catch(e) { /* ignore parse errors */ }
    }

    // Fallback: meta description
    if (!result.taskType) {
      const descMatch = html.match(/Available tasks:\s*([^.<]+)/i);
      if (descMatch) {
        const tasks = descMatch[1].split(',').map(s => s.trim()).filter(Boolean);
        if (tasks.length > 0) result.taskType = tasks[0];
      }
    }

    // Reward Type
    const rt = html.match(/Reward\s*Type[^:]*:?\s*([^<]{2,40})</i);
    result.rewardType = rt ? rt[1].trim() : '';

    // Status from info card
    const st = html.match(/Status[^:]*:?\s*([A-Za-z]+)</i);
    result.status = st ? st[1].trim() : '';
    if (!result.status) {
      const simg = html.match(/<img[^>]*alt="(Confirmed|Ended|Ongoing|Active|Upcoming)"/i);
      if (simg) result.status = simg[1];
    }

    // Reward Date
    const rd = html.match(/Reward\s*Date[^:]*:?\s*([^<]{2,30})</i);
    result.rewardDate = rd ? rd[1].trim() : '';

    // Deadline / Available from
    const avail = html.match(/Available from[^<]*<[^>]*>([^<]+)/i);
    if (avail) result.availableFrom = avail[1].trim();

    if (!result.project)
      return res.status(404).json({ error: 'Could not parse airdrop data' });

    res.setHeader('Cache-Control', 's-maxage=3600');
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: 'Failed: ' + err.message });
  }
};