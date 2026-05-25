import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { SearchResult } from '../types';
import { searchConversations } from '../services/search';

interface ConversationSearchProps {
  onNavigate: (chatId: string) => void;
  onClose: () => void;
}

const ConversationSearch: React.FC<ConversationSearchProps> = ({ onNavigate, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchRequestIdRef = useRef(0);
  const isMountedRef = useRef(true);

  const closeSearch = useCallback(() => {
    searchRequestIdRef.current++;
    setQuery('');
    setResults([]);
    setIsSearching(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleSearch = useCallback(async (q: string) => {
    setQuery(q);
    if (q.length < 3) {
      searchRequestIdRef.current++;
      setResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const requestId = ++searchRequestIdRef.current;
    try {
      const found = await searchConversations(q);
      if (!isMountedRef.current || requestId !== searchRequestIdRef.current) return;
      setResults(found);
    } catch (e) {
      if (isMountedRef.current && requestId === searchRequestIdRef.current) {
        console.error('Search failed:', e);
      }
    } finally {
      if (isMountedRef.current && requestId === searchRequestIdRef.current) {
        setIsSearching(false);
      }
    }
  }, []);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 pt-20 p-4" onClick={closeSearch}>
      <div className="bg-gray-800 rounded-xl max-w-lg w-full max-h-[70vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-gray-400" aria-hidden="true">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            </span>
            <input
              type="text"
              value={query}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search conversations..."
              className="flex-1 bg-transparent text-white outline-none placeholder-gray-400"
              autoFocus
            />
            <button onClick={closeSearch} className="text-gray-400 hover:text-white">&times;</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isSearching && <p className="p-4 text-gray-400 text-sm">Searching...</p>}
          {!isSearching && results.length === 0 && query.length >= 3 && (
            <p className="p-4 text-gray-400 text-sm">No results found.</p>
          )}
          {results.map((result, i) => (
            <button
              key={`${result.chatId}-${result.messageId}-${i}`}
              onClick={() => { onNavigate(result.chatId); closeSearch(); }}
              className="w-full p-3 text-left hover:bg-gray-700 border-b border-gray-700/50 transition-colors"
            >
              <p className="text-sm text-white">{result.snippet}</p>
              <p className="text-xs text-gray-400 mt-1">{result.sender === 'user' ? 'You' : 'Scholar'}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ConversationSearch;
