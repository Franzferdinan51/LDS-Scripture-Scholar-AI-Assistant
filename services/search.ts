import type { Message } from '../types';
import { getAllChats } from './storage';

export interface SearchResult {
  chatId: string;
  messageId: string;
  text: string;
  sender: string;
  timestamp: number;
  snippet: string;
  relevance: number;
}

export async function searchConversations(query: string): Promise<SearchResult[]> {
  const allChats = await getAllChats();
  if (!query.trim()) return [];

  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
  const results: SearchResult[] = [];

  for (const [chatId, messages] of Object.entries(allChats)) {
    for (const msg of messages) {
      if (msg.isSuggestion || msg.id === 'initial-message') continue;

      const textLower = msg.text.toLowerCase();
      let relevance = 0;

      if (textLower.includes(queryLower)) relevance += 3;
      for (const word of queryWords) {
        if (textLower.includes(word)) relevance += 1;
      }

      if (relevance > 0) {
        // Create snippet around the match
        const matchIndex = textLower.indexOf(queryLower);
        const start = Math.max(0, matchIndex - 50);
        const end = Math.min(msg.text.length, matchIndex + query.length + 50);
        const snippet = (start > 0 ? '...' : '') + msg.text.slice(start, end) + (end < msg.text.length ? '...' : '');

        results.push({
          chatId,
          messageId: msg.id,
          text: msg.text,
          sender: msg.sender,
          timestamp: parseInt(msg.id.replace(/\D/g, '')) || Date.now(),
          snippet,
          relevance,
        });
      }
    }
  }

  return results.sort((a, b) => b.relevance - a.relevance).slice(0, 50);
}
