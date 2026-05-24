import { rankBySemanticSimilarity } from './semanticSearch';

export type ScriptureVolume =
  | 'old-testament'
  | 'new-testament'
  | 'book-of-mormon'
  | 'doctrine-and-covenants'
  | 'pearl-of-great-price';

export interface ScriptureVerse {
  verse: number;
  text: string;
  reference?: string;
}

export interface ScriptureChapter {
  chapter: number;
  reference?: string;
  verses: ScriptureVerse[];
}

export interface ScriptureBook {
  book: string;
  chapters: ScriptureChapter[];
}

export interface ScriptureData {
  title: string;
  books: ScriptureBook[];
}

export interface ScriptureSearchResult {
  reference: string;
  text: string;
  book: string;
  chapter: number;
  verse: number;
  score: number;
}

const LOCAL_VOLUME_FILES: Record<ScriptureVolume, string[]> = {
  'old-testament': ['old-testament.json'],
  'new-testament': ['new-testament.json'],
  'book-of-mormon': ['book-of-mormon.json', 'book-of-mormon-part1.json', 'book-of-mormon-part2.json'],
  'doctrine-and-covenants': ['doctrine-and-covenants.json'],
  'pearl-of-great-price': ['pearl-of-great-price.json'],
};

const PUBLIC_FALLBACK_URLS: Record<ScriptureVolume, string[]> = {
  'old-testament': ['https://raw.githubusercontent.com/bcbooks/scriptures-json/master/old-testament.json'],
  'new-testament': ['https://raw.githubusercontent.com/bcbooks/scriptures-json/master/new-testament.json'],
  'book-of-mormon': [
    'https://gist.githubusercontent.com/eglenn-dev/fa12b600ef072b78731b17226e9fc791/raw/book_of_mormon.json',
    'https://raw.githubusercontent.com/bcbooks/scriptures-json/master/book-of-mormon.json',
  ],
  'doctrine-and-covenants': ['https://raw.githubusercontent.com/bcbooks/scriptures-json/master/doctrine-and-covenants.json'],
  'pearl-of-great-price': ['https://raw.githubusercontent.com/bcbooks/scriptures-json/master/pearl-of-great-price.json'],
};

const VOLUME_TITLES: Record<ScriptureVolume, string> = {
  'old-testament': 'The Old Testament (KJV)',
  'new-testament': 'The New Testament (KJV)',
  'book-of-mormon': 'The Book of Mormon',
  'doctrine-and-covenants': 'The Doctrine and Covenants',
  'pearl-of-great-price': 'The Pearl of Great Price',
};

const BIBLE_BOOKS = new Set([
  'genesis', 'exodus', 'leviticus', 'numbers', 'deuteronomy', 'joshua', 'judges', 'ruth',
  '1 samuel', '2 samuel', '1 kings', '2 kings', '1 chronicles', '2 chronicles', 'ezra',
  'nehemiah', 'esther', 'job', 'psalms', 'psalm', 'proverbs', 'ecclesiastes', 'song of solomon',
  'isaiah', 'jeremiah', 'lamentations', 'ezekiel', 'daniel', 'hosea', 'joel', 'amos', 'obadiah',
  'jonah', 'micah', 'nahum', 'habakkuk', 'zephaniah', 'haggai', 'zechariah', 'malachi',
  'matthew', 'mark', 'luke', 'john', 'acts', 'romans', '1 corinthians', '2 corinthians',
  'galatians', 'ephesians', 'philippians', 'colossians', '1 thessalonians', '2 thessalonians',
  '1 timothy', '2 timothy', 'titus', 'philemon', 'hebrews', 'james', '1 peter', '2 peter',
  '1 john', '2 john', '3 john', 'jude', 'revelation',
]);

let volumeCache = new Map<ScriptureVolume, Promise<ScriptureData>>();
let dAndCChapterCache: Promise<ScriptureData> | null = null;

function cleanText(text: string): string {
  return text
    .replace(/\u2014/g, '—')
    .replace(/\u2013/g, '-')
    .replace(/\u00a0/g, ' ')
    .trim();
}

function normalizeKey(input: string): string {
  return input
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[—–]/g, '-')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeBookName(input: string): string {
  const normalized = normalizeKey(input);
  const aliases: Record<string, string> = {
    'dc': 'Doctrine and Covenants',
    'd c': 'Doctrine and Covenants',
    'd and c': 'Doctrine and Covenants',
    'doctrine and covenants': 'Doctrine and Covenants',
    'official declaration': 'Official Declarations',
    'official declarations': 'Official Declarations',
    'a of f': 'Articles of Faith',
    'articles of faith': 'Articles of Faith',
    'js history': 'Joseph Smith-History',
    'joseph smith history': 'Joseph Smith-History',
    'js matthew': 'Joseph Smith-Matthew',
    'joseph smith matthew': 'Joseph Smith-Matthew',
  };

  if (aliases[normalized]) return aliases[normalized];

  return input
    .replace(/\u2014/g, '-')
    .replace(/\u2013/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

async function loadJson(url: string): Promise<any | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function loadLocalJson(filename: string): Promise<any | null> {
  return loadJson(`/data/${filename}`);
}

function normalizeBook(rawBook: any, fallbackBookName?: string): ScriptureBook | null {
  const bookName = normalizeBookName(
    rawBook?.book || rawBook?.shortName || rawBook?.name || rawBook?.title || fallbackBookName || 'Unknown'
  );

  const rawChapters = rawBook?.chapters || rawBook?.sections || [];
  if (!Array.isArray(rawChapters)) return null;

  const chapters = rawChapters
    .map((chapter: any) => {
      const chapterNumber = chapter?.chapter ?? chapter?.section ?? chapter?.number ?? 0;
      const verses = (chapter?.verses || [])
        .map((verse: any) => ({
          verse: Number(verse?.verse ?? verse?.verse_number ?? 0),
          reference: verse?.reference,
          text: cleanText(String(verse?.text || '')),
        }))
        .filter((verse: ScriptureVerse) => verse.verse > 0 && verse.text.length > 0);

      if (chapterNumber <= 0 || verses.length === 0) return null;

      return {
        chapter: chapterNumber,
        reference: chapter?.reference || `${bookName} ${chapterNumber}`,
        verses,
      } satisfies ScriptureChapter;
    })
    .filter(Boolean) as ScriptureChapter[];

  if (chapters.length === 0) return null;

  return { book: bookName, chapters };
}

function mergeBooks(target: ScriptureBook[], source: ScriptureBook[]): ScriptureBook[] {
  const merged = new Map<string, ScriptureBook>();

  for (const book of target) {
    merged.set(normalizeKey(book.book), {
      book: book.book,
      chapters: book.chapters.map(chapter => ({
        ...chapter,
        verses: [...chapter.verses],
      })),
    });
  }

  for (const book of source) {
    const key = normalizeKey(book.book);
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, {
        book: book.book,
        chapters: book.chapters.map(chapter => ({
          ...chapter,
          verses: [...chapter.verses],
        })),
      });
      continue;
    }

    for (const chapter of book.chapters) {
      const existingChapter = existing.chapters.find(ch => ch.chapter === chapter.chapter);
      if (!existingChapter) {
        existing.chapters.push({
          ...chapter,
          verses: [...chapter.verses],
        });
      } else if ((existingChapter.verses?.length || 0) === 0 && chapter.verses.length > 0) {
        existingChapter.reference = chapter.reference || existingChapter.reference;
        existingChapter.verses = [...chapter.verses];
      }
    }

    existing.chapters.sort((a, b) => a.chapter - b.chapter);
  }

  return [...merged.values()];
}

function normalizeVolumeData(raw: any, fallbackTitle: string): ScriptureData | null {
  if (!raw) return null;

  if (Array.isArray(raw.books)) {
    const books = raw.books
      .map((book: any) => normalizeBook(book))
      .filter(Boolean) as ScriptureBook[];

    if (books.length === 0) return null;
    return { title: raw.title || fallbackTitle, books };
  }

  if (Array.isArray(raw.sections)) {
    const normalizedSectionBook = normalizeBook(
      { book: raw.title || fallbackTitle, sections: raw.sections },
      raw.title || fallbackTitle
    );

    if (!normalizedSectionBook) return null;
    return { title: raw.title || fallbackTitle, books: [normalizedSectionBook] };
  }

  return null;
}

function hasMeaningfulVerseContent(data: ScriptureData | null): boolean {
  return !!data?.books.some(book => book.chapters.some(chapter => (chapter.verses?.length || 0) > 0));
}

async function loadWithFallback(
  volume: ScriptureVolume,
  title: string,
  localFiles: string[],
  fallbackUrls: string[]
): Promise<ScriptureData> {
  const localDatas: ScriptureData[] = [];

  for (const file of localFiles) {
    const raw = await loadLocalJson(file);
    const normalized = normalizeVolumeData(raw, title);
    if (normalized) localDatas.push(normalized);
  }

  if (volume === 'book-of-mormon') {
    const mergedLocal = localDatas.length > 0
      ? { title, books: mergeBooks([], localDatas.flatMap(data => data.books)) }
      : null;

    const hasCompleteBookOfMormon = !!mergedLocal && mergedLocal.books.length >= 15 && mergedLocal.books.reduce((count, book) => count + book.chapters.length, 0) >= 239;
    if (hasCompleteBookOfMormon) return mergedLocal;
  } else if (volume !== 'doctrine-and-covenants') {
    const local = localDatas.find(hasMeaningfulVerseContent);
    if (local) return local;
  }

  for (const url of fallbackUrls) {
    const raw = await loadJson(url);
    const normalized = normalizeVolumeData(raw, title);
    if (normalized && hasMeaningfulVerseContent(normalized)) {
      return normalized;
    }
  }

  if (volume === 'book-of-mormon' && localDatas.length > 0) {
    return { title, books: mergeBooks([], localDatas.flatMap(data => data.books)) };
  }

  const fallback = localDatas[0];
  if (fallback) return fallback;

  throw new Error(`Unable to load ${title}.`);
}

async function loadDoctrineAndCovenants(): Promise<ScriptureData> {
  if (dAndCChapterCache) return dAndCChapterCache;

  dAndCChapterCache = (async () => {
    const local = await loadLocalJson('doctrine-and-covenants.json');
    const normalizedLocal = normalizeVolumeData(local, VOLUME_TITLES['doctrine-and-covenants']);

    if (normalizedLocal && hasMeaningfulVerseContent(normalizedLocal)) {
      return normalizedLocal;
    }

    const remote = await loadJson(PUBLIC_FALLBACK_URLS['doctrine-and-covenants'][0]);
    const normalizedRemote = normalizeVolumeData(remote, VOLUME_TITLES['doctrine-and-covenants']);
    if (normalizedRemote && hasMeaningfulVerseContent(normalizedRemote)) {
      return normalizedRemote;
    }

    if (normalizedLocal) return normalizedLocal;
    throw new Error('Unable to load The Doctrine and Covenants.');
  })();

  return dAndCChapterCache;
}

export async function loadScriptureVolume(volume: ScriptureVolume): Promise<ScriptureData> {
  if (!volumeCache.has(volume)) {
    volumeCache.set(volume, (async () => {
      switch (volume) {
        case 'old-testament':
        case 'new-testament':
        case 'pearl-of-great-price':
          return loadWithFallback(volume, VOLUME_TITLES[volume], LOCAL_VOLUME_FILES[volume], PUBLIC_FALLBACK_URLS[volume]);
        case 'book-of-mormon':
          return loadWithFallback(volume, VOLUME_TITLES[volume], LOCAL_VOLUME_FILES[volume], PUBLIC_FALLBACK_URLS[volume]);
        case 'doctrine-and-covenants':
          return loadDoctrineAndCovenants();
      }
    })());
  }

  return volumeCache.get(volume)!;
}

export async function loadAllScriptureVolumes(): Promise<ScriptureData[]> {
  return Promise.all([
    loadScriptureVolume('book-of-mormon'),
    loadScriptureVolume('doctrine-and-covenants'),
    loadScriptureVolume('pearl-of-great-price'),
    loadScriptureVolume('old-testament'),
    loadScriptureVolume('new-testament'),
  ]);
}

export function flattenScriptureData(data: ScriptureData): ScriptureSearchResult[] {
  const results: ScriptureSearchResult[] = [];

  for (const book of data.books) {
    for (const chapter of book.chapters) {
      for (const verse of chapter.verses) {
        results.push({
          reference: verse.reference || `${book.book} ${chapter.chapter}:${verse.verse}`,
          text: verse.text,
          book: book.book,
          chapter: chapter.chapter,
          verse: verse.verse,
          score: 0,
        });
      }
    }
  }

  return results;
}

export function getVolumeTitle(volume: ScriptureVolume): string {
  return VOLUME_TITLES[volume];
}

export function parseScriptureReference(reference: string): { book: string; chapter: number; verse?: number } | null {
  const normalized = reference
    .replace(/\u2014/g, '-')
    .replace(/\u2013/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  const match = normalized.match(/^(.+?)\s+(\d+)(?::(\d+))?$/i);
  if (!match) return null;

  return {
    book: normalizeBookName(match[1].trim()),
    chapter: Number(match[2]),
    verse: match[3] ? Number(match[3]) : undefined,
  };
}

function isBibleBook(book: string): boolean {
  return BIBLE_BOOKS.has(normalizeKey(book));
}

export async function fetchDoctrineAndCovenantsChapter(chapter: number): Promise<ScriptureChapter | null> {
  const data = await loadDoctrineAndCovenants();
  const book = data.books.find(entry => normalizeKey(entry.book).includes('doctrine and covenants'));
  return book?.chapters.find(entry => entry.chapter === chapter) || null;
}

export async function getScriptureText(reference: string): Promise<{
  reference: string;
  book: string;
  chapter: number;
  verse?: number;
  text?: string;
  verses?: ScriptureVerse[];
} | null> {
  const parsed = parseScriptureReference(reference);
  if (!parsed) return null;

  const normalizedBook = parsed.book;
  const volumeCandidates: ScriptureVolume[] = [
    'book-of-mormon',
    'doctrine-and-covenants',
    'pearl-of-great-price',
    'old-testament',
    'new-testament',
  ];

  for (const volume of volumeCandidates) {
    const data = await loadScriptureVolume(volume);
    for (const book of data.books) {
      const bookKey = normalizeKey(book.book);
      const targetKey = normalizeKey(normalizedBook);
      if (!(bookKey.includes(targetKey) || targetKey.includes(bookKey))) continue;

      const chapter = book.chapters.find(entry => entry.chapter === parsed.chapter);
      if (!chapter) continue;

      if (parsed.verse) {
        const verse = chapter.verses.find(entry => entry.verse === parsed.verse);
        if (verse) {
          return {
            reference,
            book: book.book,
            chapter: parsed.chapter,
            verse: parsed.verse,
            text: verse.text,
          };
        }
      } else {
        return {
          reference,
          book: book.book,
          chapter: parsed.chapter,
          verses: chapter.verses,
        };
      }
    }
  }

  if (isBibleBook(normalizedBook)) {
    try {
      const response = await fetch(`https://bible-api.com/${encodeURIComponent(reference)}?translation=kjv`);
      if (response.ok) {
        const data = await response.json();
        if (data.text) {
          return {
            reference,
            book: normalizedBook,
            chapter: parsed.chapter,
            verse: parsed.verse,
            text: cleanText(String(data.text)),
          };
        }
      }
    } catch {
      // Fall through to null.
    }
  }

  return null;
}

export async function searchScriptureCorpus(
  query: string,
  options?: { books?: string; limit?: number }
): Promise<ScriptureSearchResult[]> {
  const limit = options?.limit ?? 10;
  const queryLower = query.toLowerCase().trim();
  const queryWords = queryLower.split(/\s+/).filter(word => word.length > 2);
  const requestedBooks = options?.books
    ? options.books.split(',').map(book => normalizeKey(book))
    : [];

  const volumes = await loadAllScriptureVolumes();
  const results: ScriptureSearchResult[] = [];

  for (const volume of volumes) {
    for (const book of volume.books) {
      const bookKey = normalizeKey(book.book);
      if (requestedBooks.length > 0 && !requestedBooks.some(requested => bookKey.includes(requested) || requested.includes(bookKey))) {
        continue;
      }

      for (const chapter of book.chapters) {
        for (const verse of chapter.verses) {
          const verseText = verse.text.toLowerCase();
          let score = 0;

          if (verseText.includes(queryLower)) score += 3;
          for (const word of queryWords) {
            if (verseText.includes(word)) score += 1;
          }

          if (score > 0) {
            results.push({
              reference: verse.reference || `${book.book} ${chapter.chapter}:${verse.verse}`,
              text: verse.text,
              book: book.book,
              chapter: chapter.chapter,
              verse: verse.verse,
              score,
            });
          }
        }
      }
    }
  }

  return results
    .length > 0
    ? (await rankBySemanticSimilarity(query, results, {
        getText: result => result.text,
        limit,
        keywordWeight: 0.55,
        semanticWeight: 0.45,
      })).map(({ score, ...result }) => result)
    : [];
}
