import React, { useReducer, useCallback, useEffect, useRef } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { getCrossReferencesForSettings } from '../services/crossReferenceService';
import { getProviderKeyLabel, normalizeApiProvider, providerSupportsOpenAIChatCompletions } from '../services/providerCapabilities';
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
  initialScripture?: string;
}

type State = {
  scripture: string;
  result: CrossReferenceResult | null;
  isLoading: boolean;
  error: string | null;
};

type Action =
  | { type: 'SET_SCRIPTURE'; payload: string }
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: CrossReferenceResult }
  | { type: 'FETCH_ERROR'; payload: string }
  | { type: 'RESET' };

const initialState: State = {
  scripture: '',
  result: null,
  isLoading: false,
  error: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_SCRIPTURE':
      return { ...state, scripture: action.payload };
    case 'FETCH_START':
      return { ...state, isLoading: true, error: null, result: null };
    case 'FETCH_SUCCESS':
      return { ...state, isLoading: false, result: action.payload };
    case 'FETCH_ERROR':
      return { ...state, isLoading: false, error: action.payload };
    case 'RESET':
      return { ...state, error: null, result: null };
    default:
      return state;
  }
}

const CrossReferencePanel: React.FC<CrossReferencePanelProps> = ({ onExplainVerse, initialScripture }) => {
  const { settings } = useSettings();
  const [state, dispatch] = useReducer(reducer, initialState);
  const { scripture, result, isLoading, error } = state;
  const provider = normalizeApiProvider(settings.provider);
  const fetchRequestIdRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    if (initialScripture?.trim()) {
      dispatch({ type: 'RESET' });
      dispatch({ type: 'SET_SCRIPTURE', payload: initialScripture.trim() });
    } else {
      dispatch({ type: 'RESET' });
      dispatch({ type: 'SET_SCRIPTURE', payload: '' });
    }
  }, [initialScripture]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      fetchRequestIdRef.current++;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scripture.trim()) return;
    if (provider === 'google' && !settings.googleApiKey) {
        dispatch({ type: 'FETCH_ERROR', payload: `${getProviderKeyLabel(provider)} is required for this feature. Please set it in settings.` });
        return;
    }
    if (provider !== 'google' && !settings.model) {
        dispatch({ type: 'FETCH_ERROR', payload: "Please select a model in settings before using cross-references." });
        return;
    }
    if (provider !== 'google' && !providerSupportsOpenAIChatCompletions(provider)) {
        dispatch({ type: 'FETCH_ERROR', payload: "The selected provider does not support cross-references." });
        return;
    }

    const requestId = ++fetchRequestIdRef.current;
    dispatch({ type: 'FETCH_START' });

    try {
        const data = await getCrossReferencesForSettings(settings, scripture);
        if (!isMountedRef.current || requestId !== fetchRequestIdRef.current) return;
        dispatch({ type: 'FETCH_SUCCESS', payload: data });
    } catch (err) {
        if (!isMountedRef.current || requestId !== fetchRequestIdRef.current) return;
        console.error("Cross-reference error:", err);
        dispatch({ type: 'FETCH_ERROR', payload: err instanceof Error ? err.message : "Sorry, I couldn't find cross-references for that scripture. Please try again." });
    }
  };

  const onScriptureChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'SET_SCRIPTURE', payload: e.target.value });
  }, []);

  return (
    <div className="h-full flex flex-col max-w-4xl mx-auto w-full p-4 text-gray-200">
      <h2 className="text-2xl font-bold mb-4">Scripture Cross-Referencer</h2>
      <p className="mb-4 text-sm text-gray-400">
        Uses the AI provider and model configured in Settings to find related scriptures.
      </p>
      <form onSubmit={handleSubmit} className="mb-4">
        <input
          type="text"
          value={scripture}
          onChange={(e) => dispatch({ type: 'SET_SCRIPTURE', payload: e.target.value })}
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
