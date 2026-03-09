/**
 * The Substandard — RSS Proxy Worker
 * Deploy to Cloudflare Workers at e.g. api.thesubstandard.uk
 *
 * Usage: GET https://api.thesubstandard.uk/?feed=https://feeds.bbci.co.uk/news/uk/rss.xml
 * Returns: JSON array of { headline, summary, link, source, pubDate }
 */

const ALLOWED_ORIGINS = [
  'https://thesubstandard.uk',
  'http://localhost:8000',
  'http://localhost:3000',
  'http://127.0.0.1:8000',
];

const ALLOWED_FEEDS = [
  'feeds.bbci.co.uk',
  'www.theguardian.com',
  'feeds.skynews.com',
  'feeds.reuters.com',
  'rss.nytimes.com',
  'feeds.feedburner.com',
  'rss.cnn.com',
  'feeds.arstechnica.com',
];

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=300', // 5 min cache
  };
}

function parseRSS(xml, sourceOverride) {
  const items = [];
  const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];

    const title = (block.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1] || '';
    const desc = (block.match(/<description[^>]*>([\s\S]*?)<\/description>/) || [])[1] || '';
    const link = (block.match(/<link[^>]*>([\s\S]*?)<\/link>/) || [])[1] || '';
    const pubDate = (block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/) || [])[1] || '';

    // Clean CDATA and HTML tags
    const clean = (s) => s
      .replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&apos;/g, "'")
      .trim();

    if (clean(title)) {
      items.push({
        headline: clean(title),
        summary: clean(desc),
        link: clean(link),
        source: sourceOverride || '',
        pubDate: pubDate.trim(),
      });
    }
  }

  // Try to extract source from channel title if not overridden
  if (!sourceOverride) {
    const channelTitle = (xml.match(/<channel[\s>][\s\S]*?<title[^>]*>([\s\S]*?)<\/title>/) || [])[1] || '';
    const source = channelTitle.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').trim();
    items.forEach(item => { if (!item.source) item.source = source; });
  }

  return items;
}

export default {
  async fetch(request) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(request) });
    }

    const url = new URL(request.url);
    const feedUrl = url.searchParams.get('feed');
    const source = url.searchParams.get('source') || '';

    if (!feedUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing ?feed= parameter', usage: 'GET /?feed=https://feeds.bbci.co.uk/news/uk/rss.xml' }),
        { status: 400, headers: corsHeaders(request) }
      );
    }

    // Validate feed domain
    try {
      const feedDomain = new URL(feedUrl).hostname;
      if (!ALLOWED_FEEDS.some(d => feedDomain === d || feedDomain.endsWith('.' + d))) {
        return new Response(
          JSON.stringify({ error: 'Feed domain not in allowlist', domain: feedDomain }),
          { status: 403, headers: corsHeaders(request) }
        );
      }
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid feed URL' }),
        { status: 400, headers: corsHeaders(request) }
      );
    }

    try {
      const resp = await fetch(feedUrl, {
        headers: { 'User-Agent': 'TheSubstandard/1.0 (RSS Reader)' },
      });

      if (!resp.ok) {
        return new Response(
          JSON.stringify({ error: `Feed returned ${resp.status}` }),
          { status: 502, headers: corsHeaders(request) }
        );
      }

      const xml = await resp.text();
      const articles = parseRSS(xml, source);

      return new Response(
        JSON.stringify(articles.slice(0, 10)),
        { headers: corsHeaders(request) }
      );

    } catch (err) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch feed', detail: err.message }),
        { status: 502, headers: corsHeaders(request) }
      );
    }
  },
};
