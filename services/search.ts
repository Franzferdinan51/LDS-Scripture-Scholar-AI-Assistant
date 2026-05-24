import type { Message } from '../types';
import { getAllChats } from './storage';
import { rankBySemanticSimilarity } from './semanticSearch';

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

  const candidates: Array<SearchResult & { sourceText: string }> = [];
  for (const [chatId, messages] of Object.entries(allChats)) {
    for (const msg of messages) {
      if (msg.isSuggestion || msg.id === 'initial-message') continue;
      candidates.push({
        chatId,
        messageId: msg.id,
        text: msg.text,
        sender: msg.sender,
        timestamp: parseInt(msg.id.replace(/\D/g, '')) || Date.now(),
        snippet: msg.text,
        relevance: 0,
        sourceText: msg.text,
      });
    }
  }

  const ranked = await rankBySemanticSimilarity(query, candidates, {
    getText: item => item.sourceText,
    limit: 50,
    keywordWeight: 0.45,
    semanticWeight: 0.55,
  });

  return ranked.map(({ sourceText, score, ...item }) => {
    const textLower = item.text.toLowerCase();
    const queryLower = query.toLowerCase();
    const matchIndex = textLower.indexOf(queryLower);
    const start = Math.max(0, matchIndex >= 0 ? matchIndex - 50 : 0);
    const end = Math.min(item.text.length, matchIndex >= 0 ? matchIndex + query.length + 50 : Math.min(item.text.length, 120));
    const snippet = (start > 0 ? '...' : '') + item.text.slice(start, end) + (end < item.text.length ? '...' : '');
    return {
      ...item,
      snippet,
      relevance: score,
    };
  });
}
