/**
 * LDS Search Service
 *
 * Provides LDS-focused web search across multiple provider backends.
 * All searches are restricted to Latter-day Saint relevant domains.
 *
 * Providers:
 * - churchofjesuschrist (default, no API key needed)
 * - searxng (self-hosted)
 * - tavily (API key needed)
 * - brave (API key needed)
 * - google (Custom Search API key + engine ID needed)
 * - none (disables web search)
 */

export type SearchProvider = 'none' | 'searxng' | 'tavily' | 'brave' | 'google' | 'churchofjesuschrist';

export interface SearchProviderConfig {
  provider: SearchProvider;
  searxngUrl?: string;
  searxngApiKey?: string;
  tavilyApiKey?: string;
  braveApiKey?: string;
  googleSearchApiKey?: string;
  googleSearchEngineId?: string;
}

export interface LDSSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string; // e.g., 'churchofjesuschrist.org', 'byu.edu'
}

// Authoritative LDS domains for search restriction
const LDS_DOMAINS = [
  'churchofjesuschrist.org',
  'lds.org',
  'scriptures.churchofjesuschrist.org',
  'newsroom.churchofjesuschrist.org',
  'byu.edu',
  'rsc.byu.edu',
  'bookofmormoncentral.org',
  'fairlatterdaysaints.org',
  'deseret.com',
  'meridianmagazine.com',
  'ldsliving.com',
  'churchnews.com',
  'scholarsarchive.byu.edu',
  'journalofdiscourses.com',
  'eom.byu.edu', // Encyclopedia of Mormonism
];

// Domains to include in Tavily include_domains
const TAVILY_LDS_DOMAINS = [
  'churchofjesuschrist.org',
  'byu.edu',
  'rsc.byu.edu',
  'bookofmormoncentral.org',
  'fairlatterdaysaints.org',
  'deseret.com',
  'meridianmagazine.com',
  'ldsliving.com',
  'churchnews.com',
  'scholarsarchive.byu.edu',
  'eom.byu.edu',
];

/**
 * Main entry point: search LDS-focused sources using the configured provider.
 * Falls back through providers if the primary fails.
 */
export async function searchLDS(
  query: string,
  config: SearchProviderConfig,
  limit: number = 8
): Promise<LDSSearchResult[]> {
  if (config.provider === 'none') {
    return [];
  }

  // Try the configured provider first
  try {
    switch (config.provider) {
      case 'churchofjesuschrist':
        return await searchChurchofJesusChrist(query, limit);
      case 'tavily':
        if (config.tavilyApiKey) {
          return await searchTavily(query, config.tavilyApiKey, limit);
        }
        break;
      case 'brave':
        if (config.braveApiKey) {
          return await searchBrave(query, config.braveApiKey, limit);
        }
        break;
      case 'searxng':
        if (config.searxngUrl) {
          return await searchSearXNG(query, config.searxngUrl, config.searxngApiKey, limit);
        }
        break;
      case 'google':
        if (config.googleSearchApiKey && config.googleSearchEngineId) {
          return await searchGoogle(query, config.googleSearchApiKey, config.googleSearchEngineId, limit);
        }
        break;
    }
  } catch (err) {
    console.warn(`LDS search provider '${config.provider}' failed:`, err);
  }

  // Fallback chain: ChurchofJesusChrist.org -> Wikipedia LDS
  if (config.provider !== 'churchofjesuschrist') {
    try {
      return await searchChurchofJesusChrist(query, limit);
    } catch {
      // ignore, fall through
    }
  }

  // Final fallback: Wikipedia with LDS query
  try {
    return await searchWikipediaLDS(query, limit);
  } catch {
    return [{
      title: 'Search Unavailable',
      url: '',
      snippet: 'Could not connect to any search provider. Consider configuring a search provider (SearXNG, Tavily, Brave, or Google Custom Search) in Settings for reliable LDS web search.',
      source: 'system',
    }];
  }
}

/**
 * Convert SearchProviderConfig from ApiProviderSettings.
 * Maps the flat settings properties to the structured config.
 */
export function getSearchConfig(settings: Record<string, any>): SearchProviderConfig {
  return {
    provider: (settings.webSearchProvider as SearchProvider) || 'churchofjesuschrist',
    searxngUrl: settings.searxngUrl || 'http://localhost:8080',
    searxngApiKey: settings.searxngApiKey || '',
    tavilyApiKey: settings.tavilyApiKey || '',
    braveApiKey: settings.braveSearchApiKey || '',
    googleSearchApiKey: settings.googleSearchApiKey || '',
    googleSearchEngineId: settings.googleSearchCx || '',
  };
}

// --- ChurchofJesusChrist.org Search (default, no API key) ---

async function searchChurchofJesusChrist(query: string, limit: number): Promise<LDSSearchResult[]> {
  // Try the Church's public search page first
  try {
    const searchUrl = `https://www.churchofjesuschrist.org/search?lang=eng&query=${encodeURIComponent(query)}`;
    const response = await fetch(searchUrl, {
      headers: {
        'Accept': 'text/html',
        'User-Agent': 'LDS-Scripture-Scholar/1.0 (Study Assistant)',
      },
    });

    if (response.ok) {
      const html = await response.text();
      const results = parseChurchSearchHTML(html, limit);
      if (results.length > 0) {
        return results;
      }
    }
  } catch (err) {
    console.warn('ChurchofJesusChrist.org HTML search failed:', err);
  }

  // Try the Gospel Library content API (public study content)
  try {
    const results = await searchGospelLibrary(query, limit);
    if (results.length > 0) {
      return results;
    }
  } catch (err) {
    console.warn('Gospel Library API search failed:', err);
  }

  // Fallback: construct likely Church content URLs based on the query
  return constructChurchResults(query, limit);
}

/**
 * Parse the Church's search results page HTML.
 * The page renders search results with title links and snippets.
 */
function parseChurchSearchHTML(html: string, limit: number): LDSSearchResult[] {
  const results: LDSSearchResult[] = [];

  // Try to find search result items in the HTML
  // The Church site uses various patterns; try multiple selectors
  const patterns = [
    // Pattern 1: data-testid="search-result" or similar structured results
    /<a[^>]*href="\/study\/([^"]*)"[^>]*>(.*?)<\/a>/gi,
    // Pattern 2: General link pattern within search result containers
    /<a[^>]*href="(https?:\/\/(?:www\.)?churchofjesuschrist\.org\/[^"]*)"[^>]*>(.*?)<\/a>/gi,
  ];

  const seen = new Set<string>();

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null && results.length < limit) {
      const urlPath = match[1];
      const titleRaw = match[2].replace(/<[^>]+>/g, '').trim();
      const fullUrl = urlPath.startsWith('http') ? urlPath : `https://www.churchofjesuschrist.org${urlPath}`;

      if (seen.has(fullUrl) || !titleRaw || titleRaw.length < 3) continue;
      seen.add(fullUrl);

      // Extract snippet from nearby content
      const snippetStart = html.indexOf(match[0]) + match[0].length;
      const snippetText = html.substring(snippetStart, snippetStart + 300)
        .replace(/<[^>]+>/g, '')
        .trim()
        .substring(0, 200);

      const source = extractDomain(fullUrl);

      results.push({
        title: decodeHTMLEntities(titleRaw),
        url: fullUrl,
        snippet: decodeHTMLEntities(snippetText),
        source,
      });
    }

    if (results.length >= limit) break;
  }

  return results;
}

/**
 * Search the Church's Gospel Library API for study content.
 * This uses the public-facing endpoints that the Gospel Library app uses.
 */
async function searchGospelLibrary(query: string, limit: number): Promise<LDSSearchResult[]> {
  // The Church's study content is accessible at /study/scriptures/..., /study/general-conference/...
  // Try to query the content API
  const apiUrl = `https://www.churchofjesuschrist.org/study/api/v1/search?query=${encodeURIComponent(query)}&lang=eng&limit=${limit}`;

  try {
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'LDS-Scripture-Scholar/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Gospel Library API returned ${response.status}`);
    }

    const data = await response.json();

    if (data?.results && Array.isArray(data.results)) {
      return data.results.slice(0, limit).map((item: any) => ({
        title: item.title || item.name || 'Church Content',
        url: item.url || `https://www.churchofjesuschrist.org/study${item.path || ''}`,
        snippet: item.snippet || item.description || item.highlight || '',
        source: 'churchofjesuschrist.org',
      }));
    }

    // Handle alternative response formats
    if (data?.hits?.hits) {
      return data.hits.hits.slice(0, limit).map((item: any) => ({
        title: item._source?.title || 'Church Content',
        url: item._source?.url || `https://www.churchofjesuschrist.org/study/${item._source?.path || ''}`,
        snippet: item.highlight?.content?.[0] || item._source?.description || '',
        source: 'churchofjesuschrist.org',
      }));
    }
  } catch (err) {
    // API might not be publicly accessible; this is expected
    console.warn('Gospel Library API not accessible:', err);
  }

  return [];
}

/**
 * Construct likely Church content URLs based on common query patterns.
 * This is a best-effort fallback when API/HTML parsing fails.
 */
function constructChurchResults(query: string, limit: number): LDSSearchResult[] {
  const results: LDSSearchResult[] = [];
  const q = query.toLowerCase().trim();

  // Check for General Conference talk patterns
  const gcMatch = q.match(/(?:general\s+conference|conference|gc)\s+(?:talk|session|address)?\s*(.+)/);
  if (gcMatch) {
    results.push({
      title: `General Conference - Search: ${query}`,
      url: `https://www.churchofjesuschrist.org/study/general-conference?lang=eng`,
      snippet: `Search General Conference talks for "${query}" on ChurchofJesusChrist.org. Includes talks from all semiannual conferences since 1971.`,
      source: 'churchofjesuschrist.org',
    });
  }

  // Check for scripture reference patterns
  const scriptureMatch = q.match(/(\d?\s?\w+)\s+(\d+):?(\d+)?/);
  if (scriptureMatch) {
    const book = scriptureMatch[1].toLowerCase().replace(/\s+/g, '-');
    const chapter = scriptureMatch[2];
    const verse = scriptureMatch[3];
    const path = verse
      ? `/study/scriptures/${guessScriptureCollection(book)}/${book}/${chapter}.${verse}`
      : `/study/scriptures/${guessScriptureCollection(book)}/${book}/${chapter}`;
    results.push({
      title: `${scriptureMatch[1]} ${chapter}${verse ? ':' + verse : ''} - Church Scripture Study`,
      url: `https://www.churchofjesuschrist.org${path}?lang=eng`,
      snippet: `Read ${scriptureMatch[1]} ${chapter}${verse ? ':' + verse : ''} in the official Church scripture study tools with footnotes, cross-references, and study helps.`,
      source: 'churchofjesuschrist.org',
    });
  }

  // Add a general Church search link
  results.push({
    title: `Search Church content: "${query}"`,
    url: `https://www.churchofjesuschrist.org/search?lang=eng&query=${encodeURIComponent(query)}`,
    snippet: `Search all official Church of Jesus Christ of Latter-day Saints content, including scriptures, General Conference talks, manuals, and magazines.`,
    source: 'churchofjesuschrist.org',
  });

  // Add Book of Mormon Central
  results.push({
    title: `Book of Mormon Central: "${query}"`,
    url: `https://bookofmormoncentral.org/?s=${encodeURIComponent(query)}`,
    snippet: `Search Book of Mormon Central for scholarly articles, KnoWhys, and evidence-based research on "${query}".`,
    source: 'bookofmormoncentral.org',
  });

  // Add Fair Latter-day Saints if the query sounds apologetic
  if (q.match(/eviden|proof|answer|critic|question|controvers|histor|polygam|temple|translate/)) {
    results.push({
      title: `Fair Latter-day Saints: "${query}"`,
      url: `https://www.fairlatterdaysaints.org/?s=${encodeURIComponent(query)}`,
      snippet: `Search FairLatterDaySaints.org for faithful answers to critical questions about "${query}".`,
      source: 'fairlatterdaysaints.org',
    });
  }

  // BYU Scholarly archive
  results.push({
    title: `BYU Scholars: "${query}"`,
    url: `https://scholarsarchive.byu.edu/search?query=${encodeURIComponent(query)}`,
    snippet: `Search BYU Scholars Archive for academic papers and research on "${query}" from a Latter-day Saint perspective.`,
    source: 'scholarsarchive.byu.edu',
  });

  return results.slice(0, limit);
}

// --- Tavily Search ---

async function searchTavily(query: string, apiKey: string, limit: number): Promise<LDSSearchResult[]> {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      include_domains: TAVILY_LDS_DOMAINS,
      search_depth: 'advanced',
      max_results: limit,
      include_answer: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily search failed: ${response.status}`);
  }

  const data = await response.json();
  const results: LDSSearchResult[] = (data.results || []).slice(0, limit).map((item: any) => ({
    title: item.title || '',
    url: item.url || '',
    snippet: item.content || item.snippet || '',
    source: extractDomain(item.url || ''),
  }));

  return results;
}

// --- Brave Search ---

async function searchBrave(query: string, apiKey: string, limit: number): Promise<LDSSearchResult[]> {
  // Build a site-restricted query for LDS domains
  const siteRestriction = LDS_DOMAINS.slice(0, 5).map(d => `site:${d}`).join(' OR ');
  const ldsQuery = `(${siteRestriction}) ${query}`;

  const params = new URLSearchParams({
    q: ldsQuery,
    count: String(Math.min(limit, 20)),
  });

  const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${params.toString()}`, {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Brave search failed: ${response.status}`);
  }

  const data = await response.json();
  const results: LDSSearchResult[] = (data.web?.results || []).slice(0, limit).map((item: any) => ({
    title: item.title || '',
    url: item.url || '',
    snippet: item.description || '',
    source: extractDomain(item.url || ''),
  }));

  return results;
}

// --- SearXNG ---

async function searchSearXNG(
  query: string,
  baseUrl: string,
  apiKey: string | undefined,
  limit: number
): Promise<LDSSearchResult[]> {
  // Add LDS domain restriction in the query
  const siteRestriction = LDS_DOMAINS.slice(0, 6).map(d => `site:${d}`).join(' OR ');
  const ldsQuery = `(${siteRestriction}) ${query}`;

  const url = `${baseUrl.replace(/\/+$/, '')}/search?${new URLSearchParams({
    q: ldsQuery,
    format: 'json',
  }).toString()}`;

  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`SearXNG search failed: ${response.status}`);
  }

  const data = await response.json();
  const results: LDSSearchResult[] = (data.results || []).slice(0, limit).map((item: any) => ({
    title: item.title || '',
    url: item.url || '',
    snippet: item.content || '',
    source: extractDomain(item.url || ''),
  }));

  return results;
}

// --- Google Custom Search ---

async function searchGoogle(
  query: string,
  apiKey: string,
  engineId: string,
  limit: number
): Promise<LDSSearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    key: apiKey,
    cx: engineId,
    num: String(Math.min(limit, 10)),
  });

  const response = await fetch(`https://www.googleapis.com/customsearch/v1?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Google Custom Search failed: ${response.status}`);
  }

  const data = await response.json();
  const results: LDSSearchResult[] = (data.items || []).slice(0, limit).map((item: any) => ({
    title: item.title || '',
    url: item.link || '',
    snippet: item.snippet || '',
    source: extractDomain(item.link || ''),
  }));

  return results;
}

// --- Wikipedia LDS Fallback ---

async function searchWikipediaLDS(query: string, limit: number): Promise<LDSSearchResult[]> {
  // Add LDS context to the query
  const ldsQuery = `${query} Latter Day Saints Mormon LDS`;

  const params = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: ldsQuery,
    srlimit: String(Math.min(limit, 5)),
    format: 'json',
    origin: '*',
  });

  const response = await fetch(`https://en.wikipedia.org/w/api.php?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Wikipedia search failed: ${response.status}`);
  }

  const data = await response.json();
  const results: LDSSearchResult[] = (data?.query?.search || []).map((item: any) => ({
    title: item.title,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/\s/g, '_'))}`,
    snippet: String(item.snippet || '').replace(/<[^>]+>/g, ''),
    source: 'wikipedia.org',
  }));

  return results;
}

// --- Helpers ---

function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/**
 * Guess which scripture collection a book belongs to.
 */
function guessScriptureCollection(book: string): string {
  const bomBooks = [
    '1-nephi', '2-nephi', 'jacob', 'enos', 'jarom', 'omni',
    'words-of-mormon', 'mosiah', 'alma', 'helaman',
    '3-nephi', '4-nephi', 'mormon', 'ether', 'moroni',
  ];
  const otBooks = [
    'genesis', 'exodus', 'leviticus', 'numbers', 'deuteronomy',
    'joshua', 'judges', 'ruth', '1-samuel', '2-samuel',
    '1-kings', '2-kings', '1-chronicles', '2-chronicles',
    'ezra', 'nehemiah', 'esther', 'job', 'psalms', 'proverbs',
    'ecclesiastes', 'isaiah', 'jeremiah', 'lamentations',
    'ezekiel', 'daniel', 'hosea', 'joel', 'amos', 'obadiah',
    'jonah', 'micah', 'nahum', 'habakkuk', 'zephaniah',
    'haggai', 'zechariah', 'malachi',
  ];
  const ntBooks = [
    'matthew', 'mark', 'luke', 'john', 'acts',
    'romans', '1-corinthians', '2-corinthians', 'galatians',
    'ephesians', 'philippians', 'colossians',
    '1-thessalonians', '2-thessalonians',
    '1-timothy', '2-timothy', 'titus', 'philemon',
    'hebrews', 'james', '1-peter', '2-peter',
    '1-john', '2-john', '3-john', 'jude', 'revelation',
  ];
  const dcBooks = ['dc', 'd&c', 'doctrine-and-covenants', 'doctrine-covenants'];
  const pgpBooks = ['moses', 'abraham', 'joseph-smith-matthew', 'joseph-smith-history', 'articles-of-faith'];

  const normalized = book.toLowerCase().replace(/\s+/g, '-');

  if (bomBooks.includes(normalized)) return 'bofm';
  if (otBooks.includes(normalized)) return 'ot';
  if (ntBooks.includes(normalized)) return 'nt';
  if (dcBooks.some(d => normalized.includes(d))) return 'dc-testament';
  if (pgpBooks.includes(normalized)) return 'pgp';

  return 'bofm'; // default to Book of Mormon
}

/**
 * Default search provider config (ChurchofJesusChrist.org, no key needed).
 */
export const DEFAULT_SEARCH_CONFIG: SearchProviderConfig = {
  provider: 'churchofjesuschrist',
  searxngUrl: 'http://localhost:8080',
  searxngApiKey: '',
  tavilyApiKey: '',
  braveApiKey: '',
  googleSearchApiKey: '',
  googleSearchEngineId: '',
};
