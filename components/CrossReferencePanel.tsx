import React, { useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { getCrossReferences } from '../services/geminiService';
import LoadingDots from './LoadingDots';

interface CrossReferenceResult {
    mainScripture: string;
    references: {
        scripture: string;
        explanation: string;
    }[];
}

interface CrossReferencePanelProps {
  onExplainVerse: (verse: string) => void;
}


const CrossReferencePanel: React.FC<CrossReferencePanelProps> = ({ onExplainVerse }) => {
  const { settings } = useSettings();
  const [scripture, setScripture] = useState('');
  const [result, setResult] = useState<CrossReferenceResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scripture.trim()) return;
    if (!settings.googleApiKey) {
        setError("Google API Key is required for this feature. Please set it in settings.");
        return;
    }
    
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
        const data = await getCrossReferences(settings.googleApiKey, scripture);
        setResult(data);
    } catch (err) {
        console.error("Cross-reference error:", err);
        setError("Sorry, I couldn't find cross-references for that scripture. Please try again.");
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col max-w-4xl mx-auto w-full p-4 text-gray-200">
      <h2 className="text-2xl font-bold mb-4">Scripture Cross-Referencer</h2>
      <form onSubmit={handleSubmit} className="mb-4">
        <input
          type="text"
          value={scripture}
          onChange={(e) => setScripture(e.target.value)}
          placeholder="Enter a scripture reference (e.g., Alma 32:21)"
          className="w-full px-4 py-3 rounded-full bg-slate-800/60 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-200 placeholder:text-gray-400"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !scripture.trim()}
          className="w-full mt-2 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isLoading ? 'Searching...' : 'Find References'}
        </button>
      </form>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
            <div className="flex justify-center mt-8">
                <LoadingDots />
            </div>
        )}
        {error && <p className="text-center text-red-400 mt-8">{error}</p>}
        {result && (
            <div className="bg-slate-800/40 p-4 rounded-lg">
                <h3 className="text-xl font-bold mb-3">References for {result.mainScripture}</h3>
                <div className="space-y-4">
                    {result.references.map((ref, index) => (
                        <div key={index} className="border-t border-slate-700 pt-3">
                           <a 
                                href="#"
                                onClick={(e) => { e.preventDefault(); onExplainVerse(ref.scripture); }}
                                className="font-semibold text-lg text-blue-400 hover:underline"
                            >
                                {ref.scripture}
                            </a>
                            <p className="mt-1 text-gray-300">{ref.explanation}</p>
                        </div>
                    ))}
                </div>
            </div>
        )}
         {!result && !isLoading && !error && (
            <p className="text-center text-gray-400 mt-8">
                Enter a scripture above to discover related verses and deepen your understanding.
            </p>
         )}
      </div>
    </div>
  );
};

export default CrossReferencePanel;