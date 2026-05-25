import type { ApiProviderSettings, ToolResult } from '../types';
import {
  getScriptureText as lookupScriptureText,
  searchScriptureCorpus,
} from './scriptureCorpus';
import { searchLDSContent, searchLDSSources, searchLdsWeb, webSearch, type WebSearchSettings } from './webSearchService';
import { searchLDS as searchLDSFromService, getSearchConfig } from './ldsSearchService';
import { getCrossReferencesForSettings } from './crossReferenceService';

// --- Wikimedia helper (inlined to avoid circular dependency) ---

async function getWikimediaImageUrl(filename: string): Promise<string> {
  const params = new URLSearchParams({
    action: 'query',
    prop: 'imageinfo',
    titles: filename,
    iiprop: 'url',
    format: 'json',
    origin: '*',
  });
  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`);
  if (!response.ok) throw new Error(`Wikimedia API error: ${response.statusText}`);
  const data = await response.json();
  const pages = data.query.pages;
  const pageId = Object.keys(pages)[0];
  if (pageId === '-1' || !pages[pageId].imageinfo) throw new Error('Image not found on Wikimedia Commons.');
  return pages[pageId].imageinfo[0].url;
}

// --- Scripture Search ---

async function searchScriptures(params: { query: string; books?: string; limit?: number }): Promise<ToolResult> {
  const { query, books, limit = 10 } = params;

  const exactMatch = await lookupScriptureText(query).catch(() => null);
  if (exactMatch?.text) {
    return {
      success: true,
      data: {
        query,
        resultCount: 1,
        results: [
          {
            reference: exactMatch.reference,
            text: exactMatch.text,
          },
        ],
      },
      source: 'local-scripture-data',
    };
  }

  if (exactMatch?.verses?.length) {
    return {
      success: true,
      data: {
        query,
        resultCount: exactMatch.verses.length,
        results: exactMatch.verses.map(verse => ({
          reference: `${exactMatch.book} ${exactMatch.chapter}:${verse.verse}`,
          text: verse.text,
        })),
      },
      source: 'local-scripture-data',
    };
  }

  const results = await searchScriptureCorpus(query, { books, limit });

  return {
    success: true,
    data: {
      query,
      resultCount: results.length,
      results: results.map(result => ({
        reference: result.reference,
        text: result.text,
      })),
    },
    source: 'local-scripture-data',
  };
}

// --- Get Scripture Text ---

async function getScriptureText(params: { reference: string }): Promise<ToolResult> {
  const { reference } = params;
  const result = await lookupScriptureText(reference).catch(() => null);

  if (result?.text) {
    return {
      success: true,
      data: {
        reference,
        text: result.text,
        book: result.book,
        chapter: result.chapter,
        verse: result.verse,
      },
      source: 'local-scripture-data',
    };
  }

  if (result?.verses?.length) {
    return {
      success: true,
      data: {
        reference,
        book: result.book,
        chapter: result.chapter,
        verses: result.verses.map(verse => ({
          verse: verse.verse,
          text: verse.text,
        })),
      },
      source: 'local-scripture-data',
    };
  }

  return {
    success: false,
    data: null,
    error: `Scripture not found: ${reference}. Try a more specific reference.`,
  };
}

async function handleCrossReferences(
  params: { scripture: string },
  settings?: ApiProviderSettings
): Promise<ToolResult> {
  if (!settings) {
    return { success: false, data: null, error: 'Cross-references require configured provider settings.' };
  }
  try {
    const data = await getCrossReferencesForSettings(settings, params.scripture);
    return { success: true, data, source: settings.provider === 'google' ? 'google-genai' : settings.provider };
  } catch (e) {
    return { success: false, data: null, error: String(e) };
  }
}

// --- Wikimedia Image Search ---

async function searchWikimediaImage(params: { query: string }): Promise<ToolResult> {
  try {
    const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(params.query)}&srnamespace=6&format=json&origin=*`;
    const resp = await fetch(searchUrl);
    if (!resp.ok) return { success: false, data: null, error: 'Wikimedia search failed' };
    const data = await resp.json();
    const results = data.query?.search || [];
    if (results.length === 0) return { success: false, data: null, error: 'No images found' };
    const filename = `File:${results[0].title.replace('File:', '')}`;
    const imageUrl = await getWikimediaImageUrl(filename);
    return { success: true, data: { filename, url: imageUrl, title: results[0].title }, source: 'wikimedia-commons' };
  } catch (e) {
    return { success: false, data: null, error: String(e) };
  }
}

// --- LDS-Focused Web Search ---

async function searchWeb(params: { query: string; limit?: number }, settings?: ApiProviderSettings): Promise<ToolResult> {
  const query = params?.query?.trim();
  if (!query) {
    return {
      success: false,
      data: null,
      error: 'A search query is required.',
    };
  }

  const limit = params.limit || 5;

  try {
    // Primary path: use the new LDS search service with user-configured provider
    const searchConfig = getSearchConfig(settings || {});
    const ldsResults = await searchLDSFromService(query, searchConfig, limit);

    if (ldsResults.length > 0) {
      return {
        success: true,
        data: {
          query,
          resultCount: ldsResults.length,
          results: ldsResults,
          message: ldsResults.length > 0
            ? `Found ${ldsResults.length} results from LDS-focused sources (${searchConfig.provider}). Use these for current, authoritative information from official Church and LDS sources.`
            : 'No LDS-specific results found. You may need to rely on your training data.',
        },
        source: `lds-search-${searchConfig.provider}`,
      };
    }

    // Fallback: try the old webSearchService for broader coverage
    const webSettings: WebSearchSettings | undefined = settings?.webSearchProvider
      ? {
          provider: settings.webSearchProvider as any,
          braveApiKey: settings.braveSearchApiKey,
          googleApiKey: settings.googleSearchApiKey,
          googleCx: settings.googleSearchCx,
          searxngUrl: settings.searxngUrl,
        }
      : undefined;

    const { results, source } = await webSearch(query, webSettings, limit);

    // If results are sparse, supplement with direct Church site search
    if (results.length < 3) {
      const directResult = await searchLDSSources(query, 5);
      const combined = [...results, ...directResult.results];
      const seen = new Set<string>();
      const deduped = combined.filter(r => {
        if (seen.has(r.url)) return false;
        seen.add(r.url);
        return true;
      });

      return {
        success: true,
        data: {
          query,
          resultCount: deduped.length,
          results: deduped.slice(0, 12),
          message: deduped.length > 0
            ? `Found ${deduped.length} results from official Church and LDS sources. Use these for current, accurate information.`
            : 'No LDS-specific results found. You may need to rely on your training data.',
        },
        source: `${source}+churchofjesuschrist-direct`,
      };
    }

    return {
      success: true,
      data: {
        query,
        resultCount: results.length,
        results,
        message: results.length > 0
          ? `Found ${results.length} results from ${source}. Use these for current, accurate information from official LDS sources.`
          : 'No LDS-specific web results were found. You may need to rely on your training data.',
      },
      source,
    };
  } catch (err: any) {
    console.error('Web search error:', err);
    return {
      success: false,
      data: null,
      error: `Web search failed: ${err.message || 'Unknown error'}`,
    };
  }
}

// --- Dedicated LDS Web Search (multi-source) ---

async function handleSearchLdsWeb(params: { query: string; limit?: number }, settings?: ApiProviderSettings): Promise<ToolResult> {
  const query = params?.query?.trim();
  if (!query) {
    return {
      success: false,
      data: null,
      error: 'A search query is required.',
    };
  }

  try {
    const limit = params.limit || 8;
    const { results, source } = await searchLdsWeb(query, limit);

    return {
      success: true,
      data: {
        query,
        results,
        message: results.length > 0
          ? `Found ${results.length} results across authoritative LDS sources (${source}). These come from ChurchofJesusChrist.org Gospel Library, General Conference, Book of Mormon Central, FAIR LDS, and other official LDS sites.`
          : 'No LDS-specific results found. Try a different query or use searchWeb for broader results.',
      },
      source,
    };
  } catch (err: any) {
    console.error('LDS web search error:', err);
    return {
      success: false,
      data: null,
      error: `LDS web search failed: ${err.message || 'Unknown error'}`,
    };
  }
}

// --- LDS Sources Search (direct ChurchofJesusChrist.org) ---

async function handleSearchLDSSources(params: { query: string; limit?: number }): Promise<ToolResult> {
  const query = params?.query?.trim();
  if (!query) {
    return {
      success: false,
      data: null,
      error: 'A search query is required.',
    };
  }

  try {
    const limit = params.limit || 8;
    const { results, source } = await searchLDSSources(query, limit);

    return {
      success: true,
      data: {
        query,
        results,
        message: results.length > 0
          ? `Found ${results.length} results from official LDS Church sources (${source}). These are from ChurchofJesusChrist.org, including General Conference talks, scriptures, and Church manuals.`
          : 'No results found on ChurchofJesusChrist.org. Try a different query or use searchWeb for broader results.',
      },
      source,
    };
  } catch (err: any) {
    console.error('LDS sources search error:', err);
    return {
      success: false,
      data: null,
      error: `LDS sources search failed: ${err.message || 'Unknown error'}`,
    };
  }
}

// --- Tool Execution Router ---

export async function executeTool(
  name: string,
  parameters: Record<string, any>,
  settings?: ApiProviderSettings
): Promise<ToolResult> {
  switch (name) {
    case 'searchScriptures':
      return searchScriptures(parameters as any);
    case 'getScriptureText':
      return getScriptureText(parameters as any);
    case 'getCrossReferences':
      return handleCrossReferences(parameters as any, settings);
    case 'searchWikimediaImage':
      return searchWikimediaImage(parameters as any);
    case 'searchWeb':
      return searchWeb(parameters as any, settings);
    case 'searchLdsWeb':
      return handleSearchLdsWeb(parameters as any, settings);
    case 'searchLDSSources':
      return handleSearchLDSSources(parameters as any);
    default:
      return { success: false, data: null, error: `Unknown tool: ${name}` };
  }
}
