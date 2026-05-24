import type { ToolResult } from '../types';
import { getWikimediaImageUrl } from './geminiService';
import { getCrossReferences } from './geminiService';

// Scripture data cache
const scriptureCache: Record<string, any> = {};

async function loadScriptureData(filename: string): Promise<any> {
  if (scriptureCache[filename]) return scriptureCache[filename];
  try {
    const resp = await fetch(`/data/${filename}`);
    if (!resp.ok) return null;
    const data = await resp.json();
    scriptureCache[filename] = data;
    return data;
  } catch {
    return null;
  }
}

// --- Scripture Search ---

async function searchScriptures(params: { query: string; books?: string; limit?: number }): Promise<ToolResult> {
  const { query, limit = 10 } = params;
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

  const dataFiles = [
    'book-of-mormon.json',
    'book-of-mormon-part1.json',
    'book-of-mormon-part2.json',
    'pearl-of-great-price.json',
  ];

  const results: { book: string; chapter: number; verse: number; text: string; score: number }[] = [];

  for (const file of dataFiles) {
    const data = await loadScriptureData(file);
    if (!data?.books) continue;

    for (const book of data.books) {
      if (!book.chapters) continue;
      for (const chapter of book.chapters) {
        if (!chapter.verses) continue;
        for (const verse of chapter.verses) {
          const verseText = (verse.text || '').toLowerCase();
          let score = 0;
          if (verseText.includes(queryLower)) score += 3;
          for (const word of queryWords) {
            if (verseText.includes(word)) score += 1;
          }
          if (score > 0) {
            results.push({
              book: book.book || book.name || 'Unknown',
              chapter: chapter.chapter || 0,
              verse: verse.verse || 0,
              text: verse.text || '',
              score,
            });
          }
        }
      }
    }
  }

  // Sort by score and limit
  results.sort((a, b) => b.score - a.score);
  const topResults = results.slice(0, limit);

  return {
    success: true,
    data: {
      query,
      resultCount: topResults.length,
      results: topResults.map(r => ({
        reference: `${r.book} ${r.chapter}:${r.verse}`,
        text: r.text,
      })),
    },
    source: 'local-scripture-data',
  };
}

// --- Get Scripture Text ---

async function getScriptureText(params: { reference: string }): Promise<ToolResult> {
  const { reference } = params;
  const refLower = reference.toLowerCase().trim();

  // Parse reference: "2 Nephi 2:25" or "Alma 32" or "D&C 76"
  const match = refLower.match(/^([\d\s\w]+?)\s+(\d+)(?::(\d+))?$/);
  if (!match) {
    return { success: false, data: null, error: `Could not parse reference: ${reference}` };
  }

  const bookQuery = match[1].trim();
  const chapterNum = parseInt(match[2]);
  const verseNum = match[3] ? parseInt(match[3]) : null;

  // Map common abbreviations
  const bookAliases: Record<string, string> = {
    'dc': 'doctrine and covenants',
    'd&c': 'doctrine and covenants',
    'morm': 'mormon',
    'moro': 'moroni',
    '1 ne': '1 nephi',
    '2 ne': '2 nephi',
    '3 ne': '3 nephi',
    '4 ne': '4 ne',
    'js—h': 'joseph smith—history',
    'js—m': 'joseph smith—matthew',
    'a of f': 'articles of faith',
  };

  const normalizedBook = bookAliases[bookQuery] || bookQuery;

  const dataFiles = [
    'book-of-mormon.json',
    'book-of-mormon-part1.json',
    'book-of-mormon-part2.json',
    'pearl-of-great-price.json',
  ];

  for (const file of dataFiles) {
    const data = await loadScriptureData(file);
    if (!data?.books) continue;

    for (const book of data.books) {
      const bookName = (book.book || book.name || '').toLowerCase();
      if (bookName.includes(normalizedBook) || normalizedBook.includes(bookName)) {
        if (!book.chapters) continue;
        for (const chapter of book.chapters) {
          if (chapter.chapter === chapterNum) {
            if (verseNum) {
              const verse = chapter.verses?.find((v: any) => v.verse === verseNum);
              if (verse) {
                return {
                  success: true,
                  data: { reference, text: verse.text, book: book.book || book.name, chapter: chapterNum, verse: verseNum },
                  source: 'local-scripture-data',
                };
              }
            } else {
              // Return entire chapter
              return {
                success: true,
                data: {
                  reference,
                  book: book.book || book.name,
                  chapter: chapterNum,
                  verses: (chapter.verses || []).map((v: any) => ({ verse: v.verse, text: v.text })),
                },
                source: 'local-scripture-data',
              };
            }
          }
        }
      }
    }
  }

  // Fallback: Try bible-api.com for Bible references
  if (normalizedBook.includes('testament') || ['genesis','exodus','leviticus','numbers','deuteronomy','joshua','judges','ruth','samuel','kings','chronicles','ezra','nehemiah','esther','job','psalms','psalm','proverbs','ecclesiastes','song','isaiah','jeremiah','lamentations','ezekiel','daniel','hosea','joel','amos','obadiah','jonah','micah','nahum','habakkuk','zephaniah','haggai','zechariah','malachi','matthew','mark','luke','john','acts','romans','corinthians','galatians','ephesians','philippians','colossians','thessalonians','timothy','titus','philemon','hebrews','james','peter','jude','revelation'].some(b => normalizedBook.includes(b))) {
    try {
      const resp = await fetch(`https://bible-api.com/${encodeURIComponent(reference)}?translation=kjv`);
      if (resp.ok) {
        const data = await resp.json();
        if (data.text) {
          return {
            success: true,
            data: { reference, text: data.text.trim(), translation: 'KJV' },
            source: 'bible-api.com',
          };
        }
      }
    } catch { /* ignore */ }
  }

  return { success: false, data: null, error: `Scripture not found: ${reference}. Try a more specific reference.` };
}

// --- Cross References (delegates to existing service) ---

async function handleCrossReferences(params: { scripture: string }, apiKey?: string): Promise<ToolResult> {
  if (!apiKey) {
    return { success: false, data: null, error: 'API key required for cross-references' };
  }
  try {
    const refs = await getCrossReferences(apiKey, params.scripture);
    return { success: true, data: refs, source: 'ai-generated' };
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

    if (results.length === 0) {
      return { success: false, data: null, error: 'No images found' };
    }

    // Get the first result's image URL
    const filename = `File:${results[0].title.replace('File:', '')}`;
    const imageUrl = await getWikimediaImageUrl(filename);

    return {
      success: true,
      data: { filename, url: imageUrl, title: results[0].title },
      source: 'wikimedia-commons',
    };
  } catch (e) {
    return { success: false, data: null, error: String(e) };
  }
}

// --- Web Search (uses Google Search grounding via Gemini) ---

async function searchWeb(params: { query: string }): Promise<ToolResult> {
  // This is handled natively by Gemini's googleSearch tool
  // For non-Google providers, return a message
  return {
    success: true,
    data: { message: 'Web search is performed via Google Search grounding. Results will appear in the response.' },
    source: 'google-search-grounding',
  };
}

// --- Tool Execution Router ---

export async function executeTool(
  name: string,
  parameters: Record<string, any>,
  apiKey?: string
): Promise<ToolResult> {
  switch (name) {
    case 'searchScriptures':
      return searchScriptures(parameters as { query: string; books?: string; limit?: number });
    case 'getScriptureText':
      return getScriptureText(parameters as { reference: string });
    case 'getCrossReferences':
      return handleCrossReferences(parameters as { scripture: string }, apiKey);
    case 'searchWikimediaImage':
      return searchWikimediaImage(parameters as { query: string });
    case 'searchWeb':
      return searchWeb(parameters as { query: string });
    default:
      return { success: false, data: null, error: `Unknown tool: ${name}` };
  }
}
