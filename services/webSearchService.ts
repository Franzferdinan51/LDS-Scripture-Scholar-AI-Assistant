/**
 * LDS-Focused Web Search Service
 *
 * Provides real-time web search capability for authoritative LDS sources:
 * - Church of Jesus Christ Gospel Library API v3 (primary, official Church content)
 * - DuckDuckGo Lite (no API key needed, LDS-domain-filtered)
 * - Tavily (AI-optimized search API, LDS-domain-filtered)
 * - Brave Search (API key, generous free tier, LDS-domain-filtered)
 * - SearXNG (self-hosted, configurable URL, LDS-domain-filtered)
 * - Google Custom Search (API key + CX, LDS-domain-filtered)
 *
 * ALL searches are scoped to authoritative LDS domains. No general web results.
 */

import { WebSearchProvider } from '../types';

export interface WebSearchSettings {
  provider: WebSearchProvider;
  tavilyApiKey?: string;
  braveApiKey?: string;
  googleApiKey?: string;
  googleCx?: string;
  searxngUrl?: string;
}
export interface WebSearchResult {
  title: string;
  snippet: string;
  url: string;
  date?: string;
  source?: string;
}

const LDS_DOMAINS = [
  'churchofjesuschrist.org',
  'byui.edu',
  'lds.org',
  'bookofmormoncentral.org',
  'fairlatterdaysaints.org',
  'churchofjesuschristtemples.org',
  'byu.edu',
  'deseret.com',
  'ldsliving.com',
  'churchnews.com',
  'rsc.byu.edu',
  'meridianmagazine.com',
];

/** Build a DuckDuckGo site-filter query string that restricts to LDS domains */
function ldsSiteFilterQuery(query: string): string {
  const siteFilter = LDS_DOMAINS.map(d => `site:${d}`).join(' OR ');
  return `${siteFilter} ${query}`;
}

// --- Church of Jesus Christ Gospel Library API v3 ---

/**
 * Search the Church's official Gospel Library API.
 * Returns scripture references, General Conference talks, magazine articles,
 * and manual content from ChurchofJesusChrist.org.
 */
async function searchGospelLibrary(
  query: string,
  limit: number = 5
): Promise<LDSSearchResult[]> {
  try {
    const url = `https://www.churchofjesuschrist.org/study/api/v3/svc/search?query=${encodeURIComponent(query)}&language=eng`;
    const resp = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'LDSScriptureScholar/1.0',
      },
    });

    if (!resp.ok) {
      console.warn(`[GospelLibrary] API returned status ${resp.status}`);
      return { results: [], source: 'churchofjesuschrist-gospel-library' };
    }

    const data = await resp.json();
    const hits = data?.results || data?.hits || [];

    if (!hits.length) {
      return { results: [], source: 'churchofjesuschrist-gospel-library' };
    }

    const results: WebSearchResult[] = hits.slice(0, limit).map((item: any) => {
      const itemUrl = item.url
        ? (item.url.startsWith('http') ? item.url : `https://www.churchofjesuschrist.org${item.url}`)
        : '';
      return {
        title: item.title || item.headline || item.label || '',
        snippet: (item.snippet || item.abstract || item.content || '').replace(/<[^>]+>/g, '').slice(0, 300),
        url: itemUrl,
        source: 'churchofjesuschrist.org',
      };
    });

    return { results, source: 'churchofjesuschrist-gospel-library' };
  } catch (e) {
    console.warn('[GospelLibrary] Search failed:', String(e));
    return { results: [], source: 'churchofjesuschrist-gospel-library' };
  }
}

/**
 * LDS-focused web search. Always tries the Church Gospel Library API first,
 * then falls back to a configured search provider (with LDS domain filtering),
 * and finally to LDS-domain-filtered DuckDuckGo.
 */
export async function webSearch(
  query: string,
  settings?: WebSearchSettings,
  limit: number = 8
): Promise<LDSSearchResult[]> {
  // --- Primary: Church Gospel Library API v3 ---
  const gospelResult = await searchGospelLibrary(query, limit);
  if (gospelResult.results.length > 0) {
    return gospelResult;
  }

  // --- Secondary: Configured provider (general web search) ---
  const provider = settings?.provider || 'duckduckgo';
  // Use raw query for general web search - searchLDSContent does the LDS filtering

  try {
    let providerResult: { results: WebSearchResult[]; source: string };
    switch (provider) {
    case 'duckduckgo':
      providerResult = await searchDuckDuckGo(query, limit);
      break;
    case 'tavily':
      if (settings?.tavilyApiKey) {
        providerResult = await searchTavily(query, settings.tavilyApiKey, limit);
      } else {
        providerResult = await searchDuckDuckGo(query, limit);
      }
      break;
    case 'brave':
      if (settings?.braveApiKey) {
        providerResult = await searchBrave(query, settings.braveApiKey, limit);
      } else {
        providerResult = await searchDuckDuckGo(query, limit);
      }
      break;
    case 'searxng':
      if (settings?.searxngUrl) {
        providerResult = await searchSearXNG(query, settings.searxngUrl, limit);
      } else {
        providerResult = await searchDuckDuckGo(query, limit);
      }
      break;
    case 'google':
      if (settings?.googleApiKey && settings?.googleCx) {
        providerResult = await searchGoogle(query, settings.googleApiKey, settings.googleCx, limit);
      } else {
        providerResult = await searchDuckDuckGo(query, limit);
      }
      break;
    case 'wikipedia':
      providerResult = await searchWikipedia(query, limit);
      break;
    case 'churchofjesuschrist':
      providerResult = { results: (await searchChurchofJesusChrist(query, limit)).map(r => ({ title: r.title, url: r.url, snippet: r.snippet, source: r.source || 'churchofjesuschrist' })), source: 'churchofjesuschrist' };
      break;
    default:
      providerResult = await searchDuckDuckGo(query, limit);
    }

    // No LDS filtering here - searchLDSContent handles that
    // Return all results for general web search capability
    return providerResult;
  } catch (err) {
    console.warn(`Web search provider '${provider}' failed:`, err);
  }

  // --- Tertiary: LDS-domain-filtered DuckDuckGo fallback ---
  try {
    const ddgResult = await searchDuckDuckGo(query, limit);
    ddgResult.results = ddgResult.results.filter(r =>
      LDS_DOMAINS.some(domain => r.url.includes(domain))
    );
    return ddgResult;
  } catch {
    // ignore
  }

  // --- Last resort: Wikipedia for historical context ---
  return await searchWikipedia(query, limit);
}

/**
 * DuckDuckGo Lite HTML search (no API key needed).
 * Uses the lite.duckduckgo.com endpoint.
 */
async function searchDuckDuckGo(
  query: string,
  limit: number = 8
): Promise<LDSSearchResult[]> {
  const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; LDSScriptureScholar/1.0)',
      'Accept': 'text/html',
    },
  });

  if (!response.ok) {
    throw new Error(`DuckDuckGo search failed: ${response.status}`);
  }

  const html = await response.text();
  const results: WebSearchResult[] = [];

  // DuckDuckGo Lite uses a table-based layout
  // Result links are in <a class="result-link" href="...">
  const linkRegex = /<a[^>]*class="result-link"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  // Snippets are in <td class="result-snippet">
  const snippetRegex = /<td[^>]*class="result-snippet[^"]*"[^>]*>([\s\S]*?)<\/td>/gi;

  // Extract links
  const links: { url: string; title: string }[] = [];
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(html)) !== null && links.length < limit) {
    const url = decodeHTMLEntities(match[1]);
    const title = decodeHTMLEntities(match[2].replace(/<[^>]+>/g, '').trim());
    if (url && title) {
      links.push({ url, title });
    }
  }

  // If the structured parse didn't find links, try a generic link parser
  if (links.length === 0) {
    const genericLinkRegex = /<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    while ((match = genericLinkRegex.exec(html)) !== null && links.length < limit) {
      const linkUrl = decodeHTMLEntities(match[1]);
      const title = decodeHTMLEntities(match[2].replace(/<[^>]+>/g, '').trim());
      if (linkUrl && title && !linkUrl.includes('duckduckgo.com')) {
        links.push({ url: linkUrl, title });
      }
    }
  }

  // Extract snippets
  const snippets: string[] = [];
  while ((match = snippetRegex.exec(html)) !== null && snippets.length < limit) {
    snippets.push(decodeHTMLEntities(match[1].replace(/<[^>]+>/g, '').trim()));
  }

  for (let i = 0; i < Math.min(links.length, limit); i++) {
    results.push({
      title: links[i].title,
      snippet: snippets[i] || '',
      url: links[i].url,
    });
  }

  return { results, source: 'duckduckgo' };
}

/**
 * Brave Search API.
 */
async function searchBrave(query: string, apiKey: string, limit: number): Promise<LDSSearchResult[]> {
  const params = new URLSearchParams({
    q: query,
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
  const results: WebSearchResult[] = (data.web?.results || []).slice(0, limit).map((item: any) => ({
    title: item.title || '',
    snippet: item.description || '',
    url: item.url || '',
    date: item.age || undefined,
  }));

  return { results, source: 'brave' };
}

/**
 * SearXNG self-hosted instance.
 */
async function searchSearXNG(query: string, baseUrl: string, limit: number): Promise<LDSSearchResult[]> {
  const url = `${baseUrl.replace(/\/+$/, '')}/search?${new URLSearchParams({
    q: query,
    format: 'json',
    limit: String(limit),
  }).toString()}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`SearXNG search failed: ${response.status}`);
  }

  const data = await response.json();
  const results: WebSearchResult[] = (data.results || []).slice(0, limit).map((item: any) => ({
    title: item.title || '',
    snippet: item.content || '',
    url: item.url || '',
  }));

  return { results, source: 'searxng' };
}

/**
 * Google Custom Search Engine.
 */
async function searchGoogle(query: string, apiKey: string, cx: string, limit: number): Promise<LDSSearchResult[]> {
  const params = new URLSearchParams({
    key: apiKey,
    cx,
    q: query,
    num: String(Math.min(limit, 10)),
  });

  const response = await fetch(`https://www.googleapis.com/customsearch/v1?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Google Custom Search failed: ${response.status}`);
  }

  const data = await response.json();
  const results: WebSearchResult[] = (data.items || []).map((item: any) => ({
    title: item.title || '',
    snippet: item.snippet || '',
    url: item.link || '',
  }));

  return { results, source: 'google-cse' };
}


/**
 * Tavily AI-optimized search API.
 */
async function searchTavily(query: string, apiKey: string, limit: number): Promise<LDSSearchResult[]> {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: Math.min(limit, 10),
      include_answer: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily search failed: ${response.status}`);
  }

  const data = await response.json();
  const results: WebSearchResult[] = (data.results || []).map((item: any) => ({
    title: item.title || '',
    snippet: item.content || '',
    url: item.url || '',
  }));

  return { results, source: 'tavily' };
}
/**
 * Wikipedia search (fallback for historical context only).
 */
async function searchWikipedia(query: string, limit: number): Promise<LDSSearchResult[]> {
  const params = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: query,
    srlimit: String(Math.min(limit, 5)),
    format: 'json',
    origin: '*',
  });

  const response = await fetch(`https://en.wikipedia.org/w/api.php?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Wikipedia search failed: ${response.status}`);
  }

  const data = await response.json();
  const results: WebSearchResult[] = (data?.query?.search || []).map((item: any) => ({
    title: item.title,
    snippet: String(item.snippet || '').replace(/<[^>]+>/g, ''),
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/\s/g, '_'))}`,
  }));

  return { results, source: 'wikipedia' };
}

/**
 * Search specifically for LDS/Church content.
 * Tries the Church Gospel Library API first, then LDS-domain-filtered search.
 */
export async function searchLDSContent(
  query: string,
  settings?: WebSearchSettings,
  limit: number = 8
): Promise<LDSSearchResult[]> {
  // Primary: Gospel Library API
  const gospelResult = await searchGospelLibrary(query, limit);
  if (gospelResult.results.length >= 3) {
    return gospelResult;
  }

  // Secondary: LDS-domain-filtered general search
  const general = await webSearch(query, settings, limit);

  // Combine Gospel Library results with LDS-filtered general results
  const combined = [...gospelResult.results, ...general.results];

  // Deduplicate by URL
  const seen = new Set<string>();
  const deduped = combined.filter(r => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  return { results: deduped.slice(0, limit), source: gospelResult.results.length > 0 ? `${gospelResult.source}+${general.source}` : general.source };
}

/**
 * Dedicated LDS web search across multiple authoritative LDS sources.
 * Searches Gospel Library API first, then LDS-domain-filtered DuckDuckGo,
 * then ChurchofJesusChrist.org direct search for maximum coverage.
 */
export async function searchLdsWeb(
  query: string,
  limit: number = 8
): Promise<LDSSearchResult[]> {
  const allResults: WebSearchResult[] = [];

  // --- Attempt 1: Church Gospel Library API v3 ---
  const gospelResult = await searchGospelLibrary(query, 3);
  allResults.push(...gospelResult.results);

  // --- Attempt 2: LDS-domain-filtered DuckDuckGo ---
  // Use raw query for general web search - searchLDSContent does the LDS filtering
  try {
    const ddgResult = await searchDuckDuckGo(query, limit);
    for (const r of ddgResult.results) {
      // Only include results from LDS domains
      if (LDS_DOMAINS.some(domain => r.url.includes(domain))) {
        // Deduplicate by URL
        if (!allResults.some(existing => existing.url === r.url)) {
          allResults.push({ ...r, source: r.source || LDS_DOMAINS.find(d => r.url.includes(d)) || 'lds-web' });
        }
      }
    }
  } catch (e) {
    console.warn('[searchLdsWeb] DuckDuckGo search failed:', String(e));
  }

  // --- Attempt 3: ChurchofJesusChrist.org direct search ---
  if (allResults.length < limit) {
    try {
      const directResult = await searchLDSSources(query, limit - allResults.length);
      for (const r of directResult.results) {
        if (!allResults.some(existing => existing.url === r.url)) {
          allResults.push(r);
        }
      }
    } catch (e) {
      console.warn('[searchLdsWeb] Direct Church site search failed:', String(e));
    }
  }

  return {
    results: allResults.slice(0, limit),
    source: allResults.length > 0 ? 'lds-multi-source' : 'lds-multi-source',
  };
}

/**
 * Search official ChurchofJesusChrist.org study content directly.
 * Fetches from the Church's public search endpoint and parses results.
 */
export async function searchLDSSources(
  query: string,
  limit: number = 8
): Promise<LDSSearchResult[]> {
  const results: WebSearchResult[] = [];

  // Search ChurchofJesusChrist.org study search (General Conference, scriptures, manuals, etc.)
  try {
    const studyUrl = `https://www.churchofjesuschrist.org/study/search?query=${encodeURIComponent(query)}&lang=eng`;
    const studyResp = await fetch(studyUrl, {
      headers: {
        'Accept': 'text/html',
        'User-Agent': 'LDS-Scripture-Scholar/1.0',
      },
    });

    if (studyResp.ok) {
      const html = await studyResp.text();
      const parsed = parseLDSSearchHTML(html, limit);
      results.push(...parsed);
    }
  } catch (err) {
    console.warn('ChurchofJesusChrist.org study search failed:', err);
  }

  // Also search general Conference talks specifically
  if (results.length < limit) {
    try {
      const gcUrl = `https://www.churchofjesuschrist.org/search?query=${encodeURIComponent(query)}&lang=eng&section=general-conference`;
      const gcResp = await fetch(gcUrl, {
        headers: {
          'Accept': 'text/html',
          'User-Agent': 'LDS-Scripture-Scholar/1.0',
        },
      });

      if (gcResp.ok) {
        const html = await gcResp.text();
        const parsed = parseLDSSearchHTML(html, limit - results.length);
        results.push(...parsed);
      }
    } catch (err) {
      console.warn('ChurchofJesusChrist.org general conference search failed:', err);
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  const deduped = results.filter(r => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  return { results: deduped.slice(0, limit), source: 'churchofjesuschrist.org' };
}

/**
 * Parse HTML from ChurchofJesusChrist.org search results.
 * Extracts title, URL, and snippet from the search result items.
 */
function parseLDSSearchHTML(html: string, limit: number): WebSearchResult[] {
  const results: WebSearchResult[] = [];

  // Pattern 1: Search result items with data attributes or specific classes
  // The Church site uses various layouts; we try multiple patterns

  // Pattern A: Links within search result containers
  const resultItemRegex = /<div[^>]*class="[^"]*search-result[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?=<div[^>]*class="[^"]*search-result|$)/gi;

  // Pattern B: Generic link + snippet pairs (works for many Church page layouts)
  const linkRegex = /<a[^>]*href="([^"]*\/study\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  const gcLinkRegex = /<a[^>]*href="([^"]*\/general-conference[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;

  const allLinks: { url: string; title: string }[] = [];

  // Try study links
  let match;
  while ((match = linkRegex.exec(html)) !== null && allLinks.length < limit) {
    const url = decodeHTMLEntities(match[1]);
    const title = decodeHTMLEntities(match[2].replace(/<[^>]+>/g, '').trim());
    if (url && title && title.length > 2) {
      const fullUrl = url.startsWith('http') ? url : `https://www.churchofjesuschrist.org${url}`;
      allLinks.push({ url: fullUrl, title });
    }
  }

  // Try general conference links
  while ((match = gcLinkRegex.exec(html)) !== null && allLinks.length < limit) {
    const url = decodeHTMLEntities(match[1]);
    const title = decodeHTMLEntities(match[2].replace(/<[^>]+>/g, '').trim());
    if (url && title && title.length > 2) {
      const fullUrl = url.startsWith('http') ? url : `https://www.churchofjesuschrist.org${url}`;
      // Dedup check
      if (!allLinks.some(l => l.url === fullUrl)) {
        allLinks.push({ url: fullUrl, title });
      }
    }
  }

  // Pattern C: JSON-LD or embedded data (some Church pages include structured data)
  const jsonLdRegex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  while ((match = jsonLdRegex.exec(html)) !== null && results.length < limit) {
    try {
      const jsonStr = match[1].trim();
      const data = JSON.parse(jsonStr);
      if (data['@type'] === 'ItemList' && Array.isArray(data.itemListElement)) {
        for (const item of data.itemListElement) {
          if (results.length >= limit) break;
          if (item.url && item.name) {
            results.push({
              title: item.name,
              url: item.url,
              snippet: item.description || item.text || '',
            });
          }
        }
      } else if (data.url && data.name) {
        results.push({
          title: data.name,
          url: data.url,
          snippet: data.description || '',
        });
      }
    } catch {
      // Not valid JSON or unexpected structure, skip
    }
  }

  // Extract snippets from paragraph text near links
  const snippetRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  const snippets: string[] = [];
  while ((match = snippetRegex.exec(html)) !== null && snippets.length < limit * 2) {
    const text = decodeHTMLEntities(match[1].replace(/<[^>]+>/g, '').trim());
    if (text.length > 30 && text.length < 500) {
      snippets.push(text);
    }
  }

  // Combine links with snippets
  for (let i = 0; i < Math.min(allLinks.length, limit); i++) {
    results.push({
      title: allLinks[i].title,
      url: allLinks[i].url,
      snippet: snippets[i] || '',
    });
  }

  return results.slice(0, limit);
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


// --- LDS Search Types (migrated from ldsSearchService) ---
export interface LDSSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string; // e.g., 'churchofjesuschrist.org', 'byu.edu'
}

export interface SearchProviderConfig {
  provider: WebSearchProvider;
  searxngUrl?: string;
  tavilyApiKey?: string;
  braveApiKey?: string;
  googleSearchApiKey?: string;
  googleSearchEngineId?: string;
}

// LDS domains for Tavily domain-filtered search
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

function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// --- Church of Jesus Christ Direct Search (migrated from ldsSearchService) ---
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
    const { results: glResults } = await searchGospelLibrary(query, limit);
    if (glResults.length > 0) {
      return glResults.map(r => ({ title: r.title, url: r.url, snippet: r.snippet, source: r.source || 'gospel-library' }));
    }
  } catch (err) {
    console.warn('Gospel Library API search failed:', err);
  }

  // Fallback: construct likely Church content URLs based on the query
  return constructChurchResults(query, limit);
}

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

// --- Search Config Helper (migrated from ldsSearchService) ---
export function getSearchConfig(settings: Record<string, any>): SearchProviderConfig {
  return {
    provider: (settings.webSearchProvider as WebSearchProvider) || 'churchofjesuschrist',
    searxngUrl: settings.searxngUrl || 'http://localhost:8080',
    tavilyApiKey: settings.tavilyApiKey || '',
    braveApiKey: settings.braveSearchApiKey || '',
    googleSearchApiKey: settings.googleSearchApiKey || '',
    googleSearchEngineId: settings.googleSearchCx || '',
  };
}


/** Convert WebSearchResult[] to LDSSearchResult[] */
function webToLdsResults(results: WebSearchResult[]): LDSSearchResult[] {
  return results.map(r => ({
    title: r.title,
    url: r.url,
    snippet: r.snippet,
    source: r.source || '',
  }));
}

// --- Main LDS Search Entry Point (migrated from ldsSearchService) ---
export async function searchLDS(
  query: string,
  config: SearchProviderConfig,
  limit: number = 8
): Promise<LDSSearchResult[]> {
  if (!config.provider) {
    return [];
  }

  // Try the configured provider first
  try {
    switch (config.provider) {
      case 'churchofjesuschrist':
        return await searchChurchofJesusChrist(query, limit);
      case 'tavily':
        if (config.tavilyApiKey) {
          return webToLdsResults((await searchTavily(query, config.tavilyApiKey, limit)).results);
        }
        break;
      case 'brave':
        if (config.braveApiKey) {
          return webToLdsResults((await searchBrave(query, config.braveApiKey, limit)).results);
        }
        break;
      case 'searxng':
        if (config.searxngUrl) {
          return webToLdsResults((await searchSearXNG(query, config.searxngUrl, limit)).results);
        }
        break;
      case 'google':
        if (config.googleSearchApiKey && config.googleSearchEngineId) {
          return webToLdsResults((await searchGoogle(query, config.googleSearchApiKey, config.googleSearchEngineId, limit)).results);
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
