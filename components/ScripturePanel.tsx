import React, { useState, useEffect, useMemo, useCallback } from 'react';
import LoadingDots from './LoadingDots';
import {
  loadScriptureVolume,
  type ScriptureData,
  type ScriptureVolume,
} from '../services/scriptureCorpus';

interface ScripturePanelProps {
  setReadingContext: (context: string) => void;
  onAskAboutVerse: (verse: { book: string; chapter: number; verse: number; text: string }) => void;
  isScriptureAgentOpen: boolean;
  onToggleScriptureAgent: () => void;
}

interface Verse {
  verse: number;
  text: string;
}

interface Chapter {
  chapter: number;
  reference?: string;
  verses: Verse[];
}

const ScripturePanel: React.FC<ScripturePanelProps> = ({ setReadingContext, onAskAboutVerse, isScriptureAgentOpen, onToggleScriptureAgent }) => {
  const [scriptureData, setScriptureData] = useState<ScriptureData | null>(null);
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);
  const [selectedVolume, setSelectedVolume] = useState<ScriptureVolume>('book-of-mormon');
  const [selectedBook, setSelectedBook] = useState<string>('1 Nephi');
  const [selectedChapter, setSelectedChapter] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchRequestIdRef = React.useRef(0);
  const isMountedRef = React.useRef(true);

  const fetchScriptureData = useCallback(async (volume: ScriptureVolume) => {
    const requestId = ++fetchRequestIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const data = await loadScriptureVolume(volume);
      if (!isMountedRef.current || requestId !== fetchRequestIdRef.current) return;
      setScriptureData(data);
    } catch (err) {
      if (!isMountedRef.current || requestId !== fetchRequestIdRef.current) return;
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred loading scriptures.');
      setScriptureData(null);
    } finally {
      if (isMountedRef.current && requestId === fetchRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      fetchRequestIdRef.current++;
    };
  }, []);

  useEffect(() => {
    void fetchScriptureData(selectedVolume);
  }, [selectedVolume, fetchScriptureData]);

  useEffect(() => {
    if (!scriptureData || scriptureData.books.length === 0) return;

    const currentBookExists = scriptureData.books.some(book => book.book === selectedBook);
    if (!currentBookExists) {
      setSelectedBook(scriptureData.books[0].book);
      setSelectedChapter(1);
    }
  }, [scriptureData, selectedBook]);

  useEffect(() => {
    if (!scriptureData || !selectedBook || !selectedChapter) return;

    const bookData = scriptureData.books.find(book => book.book === selectedBook);
    const chapterData = bookData?.chapters.find(chapter => chapter.chapter === selectedChapter);

    if (chapterData) {
      setActiveChapter(chapterData);
      setReadingContext(chapterData.reference || `${selectedBook} ${selectedChapter}`);
      setError(null);
    } else {
      setActiveChapter(null);
      setError(`Could not find ${selectedBook} ${selectedChapter}.`);
    }
  }, [scriptureData, selectedBook, selectedChapter, setReadingContext]);

  const currentBookData = useMemo(
    () => scriptureData?.books.find(book => book.book === selectedBook),
    [scriptureData, selectedBook]
  );

  const handleBookChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedBook(e.target.value);
    setSelectedChapter(1);
  };

  const handleChapterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedChapter(Number(e.target.value));
  };

  const handleVerseClick = (verse: Verse) => {
    if (activeChapter) {
      onAskAboutVerse({
        book: selectedBook,
        chapter: activeChapter.chapter,
        verse: verse.verse,
        text: verse.text,
      });
    }
  };

  const volumes: { id: ScriptureVolume; name: string }[] = [
    { id: 'book-of-mormon', name: 'Book of Mormon' },
    { id: 'doctrine-and-covenants', name: 'D&C' },
    { id: 'pearl-of-great-price', name: 'Pearl of Great Price' },
    { id: 'old-testament', name: 'Old Testament' },
    { id: 'new-testament', name: 'New Testament' },
  ];

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-1 items-center justify-center">
          <LoadingDots />
        </div>
      );
    }

    if (error) {
      return <div className="flex-1 p-4 text-center text-red-400">{error}</div>;
    }

    if (!activeChapter) {
      return (
        <div className="flex-1 p-4 text-center text-gray-400">
          Select a book and chapter to begin reading.
        </div>
      );
    }

    return (
      <article className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
        <h3 className="mb-4 text-2xl font-bold">
          {activeChapter.reference || `${selectedBook} ${selectedChapter}`}
        </h3>
        <div className="text-lg leading-loose font-serif">
          {activeChapter.verses.map(verse => (
            <p key={verse.verse} className="mb-2">
              <sup className="mr-1 select-none font-sans font-bold text-blue-400">
                {verse.verse}
              </sup>
              <span
                className="cursor-pointer rounded p-1 transition-colors hover:bg-slate-700/50"
                onClick={() => handleVerseClick(verse)}
                title={`Ask about verse ${verse.verse}`}
              >
                {verse.text}
              </span>
            </p>
          ))}
        </div>
      </article>
    );
  };

  return (
    <div className="flex h-full flex-col bg-slate-900/40 text-gray-200">
      <header className="border-b border-white/10 bg-slate-800/60 p-4 shadow-md backdrop-blur-sm">
        <div className="mb-4 flex flex-wrap justify-center border-b border-slate-700">
          {volumes.map(volume => (
            <button
              key={volume.id}
              onClick={() => setSelectedVolume(volume.id)}
              className={`whitespace-nowrap px-2 py-2 text-xs font-medium transition-colors sm:px-4 sm:text-sm ${
                selectedVolume === volume.id
                  ? 'border-b-2 border-blue-400 text-blue-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {volume.name}
            </button>
          ))}
        </div>

        {scriptureData ? (
          <div className="flex gap-2 sm:gap-4 items-center">
            <div className="flex-1">
              <label htmlFor="book-select" className="sr-only">
                Book
              </label>
              <select
                id="book-select"
                value={selectedBook}
                onChange={handleBookChange}
                className="w-full rounded-md border border-slate-600 bg-slate-700 p-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {scriptureData.books.map(book => (
                  <option key={book.book} value={book.book}>
                    {book.book}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label htmlFor="chapter-select" className="sr-only">
                Chapter
              </label>
              <select
                id="chapter-select"
                value={selectedChapter}
                onChange={handleChapterChange}
                className="w-full rounded-md border border-slate-600 bg-slate-700 p-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {currentBookData?.chapters.map(chapter => (
                  <option key={chapter.chapter} value={chapter.chapter}>
                    {chapter.reference ? chapter.reference.split(' ').slice(-1)[0] : `Chapter ${chapter.chapter}`}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={onToggleScriptureAgent}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                isScriptureAgentOpen
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700/80 text-gray-300 hover:bg-slate-600/80'
              }`}
              title="Toggle Scripture Assistant sidebar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
              AI Assistant
            </button>
          </div>
        ) : (
          <div className="flex justify-center">
            <LoadingDots />
          </div>
        )}
      </header>
      {renderContent()}
    </div>
  );
};

export default ScripturePanel;
