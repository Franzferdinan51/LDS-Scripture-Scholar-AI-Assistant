

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import LoadingDots from './LoadingDots';

type ScriptureVolume = 'old-testament' | 'new-testament' | 'book-of-mormon' | 'doctrine-and-covenants' | 'pearl-of-great-price';

interface Verse {
    verse: number;
    text: string;
}

interface Chapter {
    chapter: number;
    reference?: string; 
    verses: Verse[];
}

interface Book {
    book: string;
    chapters: Chapter[];
}

interface ScriptureData {
    title: string;
    books: Book[];
}

interface ScripturePanelProps {
    setReadingContext: (context: string) => void;
    onAskAboutVerse: (verse: { book: string, chapter: number, verse: number, text: string }) => void;
}

// Simple cache in memory for manifests
const scriptureCache = new Map<ScriptureVolume, ScriptureData>();

const ScripturePanel: React.FC<ScripturePanelProps> = ({ setReadingContext, onAskAboutVerse }) => {
    const [scriptureData, setScriptureData] = useState<ScriptureData | null>(null);
    const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);
    const [selectedVolume, setSelectedVolume] = useState<ScriptureVolume>('old-testament');
    const [selectedBook, setSelectedBook] = useState<string>('');
    const [selectedChapter, setSelectedChapter] = useState<number>(1);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchScriptureManifest = useCallback(async (volume: ScriptureVolume) => {
        if (scriptureCache.has(volume)) {
            const data = scriptureCache.get(volume)!;
            setScriptureData(data);
            if (data.books.length > 0 && data.books[0].book !== selectedBook) {
                setSelectedBook(data.books[0].book);
                setSelectedChapter(1);
            }
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`/data/${volume}.json`);
            if (!response.ok) throw new Error(`Failed to load scripture data: ${response.status} ${response.statusText}`);
            const data: ScriptureData = await response.json();

            scriptureCache.set(volume, data);
            setScriptureData(data);
            if (data.books.length > 0) {
                setSelectedBook(data.books[0].book);
                setSelectedChapter(1);
            } else {
                 setSelectedBook('');
                 setSelectedChapter(1);
            }
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "An unknown error occurred loading the scriptures.");
            setScriptureData(null);
        } finally {
            // Loading is turned off by the content fetcher
        }
    }, [selectedBook]);

    useEffect(() => {
        fetchScriptureManifest(selectedVolume);
    }, [selectedVolume, fetchScriptureManifest]);
    
    useEffect(() => {
        const fetchContent = async () => {
            if (!selectedBook || !selectedChapter) {
                setActiveChapter(null);
                return;
            };

            setIsLoading(true);
            setError(null);
            setActiveChapter(null);

            try {
                if (selectedVolume === 'old-testament' || selectedVolume === 'new-testament') {
                    const bookQuery = selectedBook.replace(/\s/g, '+');
                    const response = await fetch(`https://bible-api.com/${bookQuery}+${selectedChapter}`);
                    if (!response.ok) {
                        const errorData = await response.json().catch(() => null);
                        throw new Error(errorData?.error || `Could not find ${selectedBook} ${selectedChapter}.`);
                    }
                    const data = await response.json();

                    if (!data.verses) throw new Error(`Invalid response for ${selectedBook} ${selectedChapter}.`);
                    
                    const newChapter: Chapter = {
                        chapter: selectedChapter,
                        reference: data.reference,
                        verses: data.verses.map((v: any) => ({ 
                            verse: v.verse, 
                            text: v.text.replace(/\n/g, ' ').trim() 
                        }))
                    };
                    setActiveChapter(newChapter);

                } else {
                    // Logic for other volumes (BoM, D&C, PGP) which are fully local
                    const bookData = scriptureData?.books.find(b => b.book === selectedBook);
                    const chapterData = bookData?.chapters.find(c => c.chapter === selectedChapter);
                    setActiveChapter(chapterData || null);
                }
            } catch (err) {
                 console.error(err);
                 setError(err instanceof Error ? err.message : "An unknown error occurred.");
                 setActiveChapter(null);
            } finally {
                setIsLoading(false);
            }
        };

        if (scriptureData) { // Only fetch content once the manifest is loaded
            fetchContent();
        }
    }, [selectedVolume, selectedBook, selectedChapter, scriptureData]);


    useEffect(() => {
        if (selectedBook && selectedChapter) {
            setReadingContext(`${selectedBook} chapter ${selectedChapter}`);
        }
    }, [selectedBook, selectedChapter, setReadingContext]);

    const currentBookData = useMemo(() => scriptureData?.books.find(b => b.book === selectedBook), [scriptureData, selectedBook]);
    
    const handleBookChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedBook(e.target.value);
        setSelectedChapter(1);
    };

    const handleChapterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedChapter(Number(e.target.value));
    };
    
    const handleVerseClick = (verse: Verse) => {
        onAskAboutVerse({ book: selectedBook, chapter: selectedChapter, verse: verse.verse, text: verse.text });
    }
    
    const volumes: { id: ScriptureVolume, name: string }[] = [
        { id: 'old-testament', name: 'Old Testament' },
        { id: 'new-testament', name: 'New Testament' },
        { id: 'book-of-mormon', name: 'Book of Mormon' },
        { id: 'doctrine-and-covenants', name: 'D&C' },
        { id: 'pearl-of-great-price', name: 'Pearl of Great Price' },
    ];

    const renderContent = () => {
        if (isLoading) return <div className="flex justify-center items-center h-full"><LoadingDots /></div>;
        if (error) return <div className="p-4 text-center text-red-400">{error}</div>;
        if (!activeChapter) return (
             <div className="p-4 text-center text-gray-400">
                Scripture text is not available. The data file might be empty or missing.
             </div>
        );

        return (
            <article className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
                <h3 className="text-2xl font-bold mb-4">{activeChapter?.reference || `${selectedBook} ${selectedChapter}`}</h3>
                <div className="text-lg leading-loose font-serif">
                    {activeChapter.verses.length > 0 ? activeChapter?.verses.map(verse => (
                        <p key={verse.verse} className="mb-2">
                            <sup className="font-sans font-bold text-blue-400 mr-1">{verse.verse}</sup>
                             <span className="cursor-pointer hover:bg-slate-700/50 rounded p-1 transition-colors" onClick={() => handleVerseClick(verse)} title={`Ask about verse ${verse.verse}`}>
                                {verse.text}
                            </span>
                        </p>
                    )) : <p>This chapter is empty.</p>}
                </div>
            </article>
        );
    };

    return (
        <div className="h-full flex flex-col text-gray-200 bg-slate-900/40">
            <header className="p-4 bg-slate-800/60 backdrop-blur-sm border-b border-white/10 shadow-md sticky top-0 z-10">
                <div className="flex justify-center mb-4 border-b border-slate-700 flex-wrap">
                    {volumes.map(vol => (
                        <button key={vol.id} onClick={() => setSelectedVolume(vol.id)} className={`px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${selectedVolume === vol.id ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}>
                            {vol.name}
                        </button>
                    ))}
                </div>
                {scriptureData && (
                    <div className="flex gap-2 sm:gap-4">
                        <div className="flex-1">
                            <label htmlFor="book-select" className="sr-only">Book</label>
                            <select id="book-select" value={selectedBook} onChange={handleBookChange} className="w-full p-2 rounded-md bg-slate-700 border border-slate-600 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500">
                                {scriptureData?.books.map(book => <option key={book.book} value={book.book}>{book.book}</option>)}
                            </select>
                        </div>
                        <div className="flex-1">
                            <label htmlFor="chapter-select" className="sr-only">Chapter</label>
                            <select id="chapter-select" value={selectedChapter} onChange={handleChapterChange} className="w-full p-2 rounded-md bg-slate-700 border border-slate-600 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500">
                                {currentBookData?.chapters.map(chap => <option key={chap.chapter} value={chap.chapter}>{chap.reference ? chap.reference.split(' ').slice(-1)[0] : `Chapter ${chap.chapter}`}</option>)}
                            </select>
                        </div>
                    </div>
                )}
            </header>
            {renderContent()}
        </div>
    );
};

export default ScripturePanel;