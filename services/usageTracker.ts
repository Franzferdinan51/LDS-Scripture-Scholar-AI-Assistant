import { normalizeApiProvider } from './providerCapabilities';
import { openDB } from 'idb';

interface UsageEntry {
  key: string;
  value: {
    sessionTokens: number;
    totalTokens: number;
    messageCount: number;
    provider: string;
    date: string;
  };
}

interface UsageDB {
  usage: {
    key: string;
    value: {
      sessionTokens: number;
      totalTokens: number;
      messageCount: number;
      provider: string;
      date: string;
    };
    indexes: { 'by-date': string };
  };
}

let dbPromise: Promise<any> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB('scripture-scholar-usage', 1, {
      upgrade(db) {
        const store = db.createObjectStore('usage', { keyPath: 'key' });
        store.createIndex('by-date', 'date');
      },
    });
  }
  return dbPromise;
}

export async function getUsageTracker() {
  const db = await getDB();
  const today = new Date().toISOString().split('T')[0];
  const entry = await db.get('usage', today) || {
    sessionTokens: 0,
    totalTokens: 0,
    messageCount: 0,
    provider: '',
    date: today,
  };
  return {
    ...entry,
    provider: normalizeApiProvider(entry.provider),
  };
}

export async function addUsage(provider: string, tokens: number, messages: number = 1) {
  const db = await getDB();
  const today = new Date().toISOString().split('T')[0];
  const normalizedProvider = normalizeApiProvider(provider);
  const entry = await db.get('usage', today) || {
    sessionTokens: 0,
    totalTokens: 0,
    messageCount: 0,
    provider: normalizedProvider,
    date: today,
  };
  entry.sessionTokens += tokens;
  entry.totalTokens += tokens;
  entry.messageCount += messages;
  entry.provider = normalizedProvider;
  entry.key = today;
  await db.put('usage', entry);
  return entry;
}

export async function getUsageByDateRange(startDate: string, endDate: string) {
  const db = await getDB();
  const all = await db.getAll('usage');
  return all.filter(e => e.date >= startDate && e.date <= endDate);
}

export async function getAllUsage() {
  const db = await getDB();
  return db.getAll('usage');
}

export function estimateCost(provider: string, tokens: number): string {
  const rawProvider = provider.toLowerCase();
  if (rawProvider === 'openai' || rawProvider === 'openai-native') {
    return `~$${(tokens / 1_000_000 * 1.5).toFixed(4)}`;
  }

  const normalizedProvider = normalizeApiProvider(provider);
  if (normalizedProvider === 'google') {
    // Gemini pricing ~$0.125-$0.50/million tokens for input, $0.50-$1.50/million for output
    return `~$${(tokens / 1_000_000 * 0.50).toFixed(4)}`;
  }
  if (normalizedProvider === 'minimax') {
    return `~$${(tokens / 1_000_000 * 0.1).toFixed(4)}`;
  }
  return 'unknown';
}
