import type { ApiProviderSettings, ToolResult } from '../types';
import {
  getScriptureText as lookupScriptureText,
  searchScriptureCorpus,
} from './scriptureCorpus';
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

// --- Web Search ---

async function searchWeb(params: { query: string }): Promise<ToolResult> {
  const query = params?.query?.trim();
  if (!query) {
    return {
      success: false,
      data: null,
      error: 'A search query is required.',
    };
  }

  const searchUrl = new URL('https://en.wikipedia.org/w/api.php');
  searchUrl.search = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: query,
    srlimit: '5',
    format: 'json',
    origin: '*',
  }).toString();

  const resp = await fetch(searchUrl.toString());
  if (!resp.ok) {
    return {
      success: false,
      data: null,
      error: `Public search failed with status ${resp.status}`,
    };
  }

  const data = await resp.json();
  const results = (data?.query?.search || []).map((item: any) => ({
    title: item.title,
    snippet: String(item.snippet || '').replace(/<[^>]+>/g, ''),
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/\s/g, '_'))}`,
  }));

  return {
    success: true,
    data: {
      query,
      results,
      message: results.length > 0
        ? 'Returned public search results from Wikipedia.'
        : 'No public search results were found.',
    },
    source: 'wikipedia',
  };
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
      return searchWeb(parameters as any);
    default:
      return { success: false, data: null, error: `Unknown tool: ${name}` };
  }
}
