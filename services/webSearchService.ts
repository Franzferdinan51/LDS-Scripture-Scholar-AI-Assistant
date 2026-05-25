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
): Promise<{ results: WebSearchResult[]; source: string }> {
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
): Promise<{ results: WebSearchResult[]; source: string }> {
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
): Promise<{ results: WebSearchResult[]; source: string }> {
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
async function searchBrave(query: string, apiKey: string, limit: number): Promise<{ results: WebSearchResult[]; source: string }> {
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
async function searchSearXNG(query: string, baseUrl: string, limit: number): Promise<{ results: WebSearchResult[]; source: string }> {
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
async function searchGoogle(query: string, apiKey: string, cx: string, limit: number): Promise<{ results: WebSearchResult[]; source: string }> {
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
async function searchTavily(query: string, apiKey: string, limit: number): Promise<{ results: WebSearchResult[]; source: string }> {
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
async function searchWikipedia(query: string, limit: number): Promise<{ results: WebSearchResult[]; source: string }> {
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
): Promise<{ results: WebSearchResult[]; source: string }> {
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
): Promise<{ results: WebSearchResult[]; source: string }> {
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
): Promise<{ results: WebSearchResult[]; source: string }> {
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
