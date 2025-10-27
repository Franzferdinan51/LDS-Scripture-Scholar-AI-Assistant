
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

// Simple cache in memory for scripture data
const scriptureCache = new Map<ScriptureVolume, ScriptureData>();

const ScripturePanel: React.FC<ScripturePanelProps> = ({ setReadingContext, onAskAboutVerse }) => {
    const [scriptureData, setScriptureData] = useState<ScriptureData | null>(null);
    const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);
    const [selectedVolume, setSelectedVolume] = useState<ScriptureVolume>('book-of-mormon');
    const [selectedBook, setSelectedBook] = useState<string>('1 Nephi');
    const [selectedChapter, setSelectedChapter] = useState<number>(1);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchScriptureData = useCallback(async (volume: ScriptureVolume) => {
        setIsLoading(true);
        setError(null);

        if (scriptureCache.has(volume)) {
            setScriptureData(scriptureCache.get(volume)!);
            // No setIsLoading(false) here, as chapter loading will handle it
            return;
        }

        try {
            const response = await fetch(`/data/${volume}.json`);
            if (!response.ok) throw new Error(`Failed to load scripture data: ${response.status} ${response.statusText}`);
            const data: ScriptureData = await response.json();

            scriptureCache.set(volume, data);
            setScriptureData(data);
        } catch (err) {
            console.error(err);
            let errorMessage = `An unknown error occurred loading scriptures for ${volume}.`;
            if (err instanceof TypeError && err.message === 'Failed to fetch') {
                errorMessage = `Network Error: Could not load local scripture data for ${volume}. The file might be missing or corrupted.`;
            } else if (err instanceof Error) {
                errorMessage = err.message;
            }
            setError(errorMessage);
            setScriptureData(null);
            setIsLoading(false);
        }
    }, []);

    // Effect for loading the volume's book/chapter structure when the selection changes
    useEffect(() => {
        setScriptureData(null);
        setActiveChapter(null);
        fetchScriptureData(selectedVolume);
    }, [selectedVolume, fetchScriptureData]);

    // Effect to reset book/chapter selection when a new volume's data is loaded.
    useEffect(() => {
        if (scriptureData && scriptureData.books.length > 0) {
            const currentBookExists = scriptureData.books.some(b => b.book === selectedBook);
            if (!currentBookExists) {
                setSelectedBook(scriptureData.books[0].book);
                setSelectedChapter(1);
            }
        }
    }, [scriptureData, selectedBook]);
    
    // Effect for fetching and displaying the active chapter's content
    useEffect(() => {
        if (!scriptureData || !selectedBook || !selectedChapter) {
            return;
        }

        const isBible = selectedVolume === 'old-testament' || selectedVolume === 'new-testament';

        const loadChapter = async () => {
            setIsLoading(true);
            setError(null);
            setActiveChapter(null);

            if (isBible) {
                try {
                    const response = await fetch(`https://bible-api.com/${encodeURIComponent(selectedBook)} ${selectedChapter}?translation=kjv`);
                    if (!response.ok) {
                        throw new Error(`Could not find ${selectedBook} ${selectedChapter}. Please try another chapter or book.`);
                    }
                    const data = await response.json();
                    if (!data.verses || data.verses.length === 0) {
                        throw new Error(`No verses returned for ${selectedBook} ${selectedChapter}.`);
                    }

                    const chapterContent: Chapter = {
                        chapter: data.verses[0].chapter,
                        reference: data.reference,
                        verses: data.verses.map((v: any) => ({ verse: v.verse, text: v.text.trim() }))
                    };
                    setActiveChapter(chapterContent);
                    setReadingContext(data.reference);

                } catch (err) {
                    console.error("Bible API fetch error:", err);
                    setError(err instanceof Error ? err.message : "An unknown error occurred while fetching chapter data.");
                    setActiveChapter(null);
                } finally {
                    setIsLoading(false);
                }
            } else { // Handle local data for BoM, D&C, PGP
                const bookData = scriptureData.books.find(b => b.book === selectedBook);
                const chapterData = bookData?.chapters.find(c => c.chapter === selectedChapter);

                if (chapterData) {
                    setActiveChapter(chapterData);
                    setReadingContext(chapterData.reference || `${selectedBook} ${selectedChapter}`);
                } else {
                    setError(`Could not find ${selectedBook} ${selectedChapter} in local data.`);
                    setActiveChapter(null);
                }
                setIsLoading(false);
            }
        };

        loadChapter();
    }, [scriptureData, selectedBook, selectedChapter, selectedVolume, setReadingContext]);


    const currentBookData = useMemo(() => scriptureData?.books.find(b => b.book === selectedBook), [scriptureData, selectedBook]);
    
    const handleBookChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedBook(e.target.value);
        setSelectedChapter(1); // Reset to first chapter on book change
    };

    const handleChapterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedChapter(Number(e.target.value));
    };
    
    const handleVerseClick = (verse: Verse) => {
        if (activeChapter) {
            onAskAboutVerse({ book: selectedBook, chapter: activeChapter.chapter, verse: verse.verse, text: verse.text });
        }
    }
    
    const volumes: { id: ScriptureVolume, name: string }[] = [
        { id: 'book-of-mormon', name: 'Book of Mormon' },
        { id: 'doctrine-and-covenants', name: 'D&C' },
        { id: 'pearl-of-great-price', name: 'Pearl of Great Price' },
        { id: 'old-testament', name: 'Old Testament' },
        { id: 'new-testament', name: 'New Testament' },
    ];

    const renderContent = () => {
        if (isLoading) return <div className="flex justify-center items-center flex-1"><LoadingDots /></div>;
        if (error) return <div className="p-4 text-center text-red-400 flex-1">{error}</div>;
        if (!activeChapter) return (
             <div className="p-4 text-center text-gray-400 flex-1">
                Select a book and chapter to begin reading.
             </div>
        );

        return (
            <article className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
                <h3 className="text-2xl font-bold mb-4">{activeChapter.reference || `${selectedBook} ${selectedChapter}`}</h3>
                <div className="text-lg leading-loose font-serif">
                    {activeChapter.verses.map(verse => (
                        <p key={verse.verse} className="mb-2">
                            <sup className="font-sans font-bold text-blue-400 mr-1 select-none">{verse.verse}</sup>
                             <span className="cursor-pointer hover:bg-slate-700/50 rounded p-1 transition-colors" onClick={() => handleVerseClick(verse)} title={`Ask about verse ${verse.verse}`}>
                                {verse.text}
                            </span>
                        </p>
                    ))}
                </div>
            </article>
        );
    };

    return (
        <div className="h-full flex flex-col text-gray-200 bg-slate-900/40">
            <header className="p-4 bg-slate-800/60 backdrop-blur-sm border-b border-white/10 shadow-md">
                <div className="flex justify-center mb-4 border-b border-slate-700 flex-wrap">
                    {volumes.map(vol => (
                        <button key={vol.id} onClick={() => setSelectedVolume(vol.id)} className={`px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${selectedVolume === vol.id ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}>
                            {vol.name}
                        </button>
                    ))}
                </div>
                {scriptureData ? (
                    <div className="flex gap-2 sm:gap-4">
                        <div className="flex-1">
                            <label htmlFor="book-select" className="sr-only">Book</label>
                            <select id="book-select" value={selectedBook} onChange={handleBookChange} className="w-full p-2 rounded-md bg-slate-700 border border-slate-600 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500">
                                {scriptureData.books.map(book => <option key={book.book} value={book.book}>{book.book}</option>)}
                            </select>
                        </div>
                        <div className="flex-1">
                            <label htmlFor="chapter-select" className="sr-only">Chapter</label>
                            <select id="chapter-select" value={selectedChapter} onChange={handleChapterChange} className="w-full p-2 rounded-md bg-slate-700 border border-slate-600 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500">
                                {currentBookData?.chapters.map(chap => <option key={chap.chapter} value={chap.chapter}>{chap.reference ? chap.reference.split(' ').slice(-1)[0] : `Chapter ${chap.chapter}`}</option>)}
                            </select>
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-center"><LoadingDots/></div>
                )}
            </header>
            {renderContent()}
        </div>
    );
};

export default ScripturePanel;
