import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Memory, UserProfile, Skill, StudySession, Note, JournalEntry, Reminder, ApiProviderSettings, Message } from '../types';

// --- Database Schema ---

interface ScriptureScholarDB extends DBSchema {
  chatHistory: {
    key: string;
    value: { chatId: string; messages: Message[]; timestamp: number; title?: string };
    indexes: { 'by-timestamp': number };
  };
  memories: {
    key: string;
    value: Memory;
    indexes: { 'by-type': string; 'by-timestamp': number; 'by-relevance': number };
  };
  userProfile: {
    key: string;
    value: UserProfile;
  };
  skills: {
    key: string;
    value: Skill;
  };
  studyHistory: {
    key: string;
    value: StudySession;
    indexes: { 'by-date': string; 'by-book': string };
  };
  notes: {
    key: string;
    value: Note;
    indexes: { 'by-timestamp': number };
  };
  journalEntries: {
    key: string;
    value: JournalEntry;
    indexes: { 'by-timestamp': number };
  };
  reminders: {
    key: string;
    value: Reminder;
    indexes: { 'by-type': string };
  };
  settings: {
    key: string;
    value: { key: string; value: any };
  };
}

// --- Database Instance ---

let dbPromise: Promise<IDBPDatabase<ScriptureScholarDB>> | null = null;

function getDB(): Promise<IDBPDatabase<ScriptureScholarDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ScriptureScholarDB>('scripture-scholar-db', 1, {
      upgrade(db) {
        // Chat History
        const chatStore = db.createObjectStore('chatHistory', { keyPath: 'chatId' });
        chatStore.createIndex('by-timestamp', 'timestamp');

        // Memories
        const memStore = db.createObjectStore('memories', { keyPath: 'id' });
        memStore.createIndex('by-type', 'type');
        memStore.createIndex('by-timestamp', 'timestamp');
        memStore.createIndex('by-relevance', 'relevance');

        // User Profile
        db.createObjectStore('userProfile', { keyPath: 'id' });

        // Skills
        db.createObjectStore('skills', { keyPath: 'id' });

        // Study History
        const studyStore = db.createObjectStore('studyHistory', { keyPath: 'id' });
        studyStore.createIndex('by-date', 'date');
        studyStore.createIndex('by-book', 'book');

        // Notes
        const noteStore = db.createObjectStore('notes', { keyPath: 'id' });
        noteStore.createIndex('by-timestamp', 'timestamp');

        // Journal Entries
        const journalStore = db.createObjectStore('journalEntries', { keyPath: 'id' });
        journalStore.createIndex('by-timestamp', 'timestamp');

        // Reminders
        const reminderStore = db.createObjectStore('reminders', { keyPath: 'id' });
        reminderStore.createIndex('by-type', 'type');

        // Settings
        db.createObjectStore('settings', { keyPath: 'key' });
      },
    });
  }
  return dbPromise;
}

// --- Migration from localStorage ---

export async function migrateFromLocalStorage(): Promise<void> {
  const db = await getDB();

  const migrations = [
    { lsKey: 'chatHistory', store: 'chatHistory' as const, transform: (data: any) => {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      return Object.entries(parsed).map(([chatId, messages]) => ({
        chatId,
        messages: messages as Message[],
        timestamp: Date.now(),
      }));
    }},
    { lsKey: 'notes', store: 'notes' as const, transform: (data: any) => {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      return Array.isArray(parsed) ? parsed : [];
    }},
    { lsKey: 'journalEntries', store: 'journalEntries' as const, transform: (data: any) => {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      return Array.isArray(parsed) ? parsed : [];
    }},
    { lsKey: 'apiProviderSettings', store: 'settings' as const, transform: (data: any) => {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      return [{ key: 'apiProviderSettings', value: parsed }];
    }},
  ];

  for (const { lsKey, store, transform } of migrations) {
    try {
      const lsData = localStorage.getItem(lsKey);
      if (!lsData) continue;

      // Check if IndexedDB store is empty (don't overwrite)
      const count = await db.count(store);
      if (count > 0) continue;

      const items = transform(lsData);
      if (Array.isArray(items)) {
        const tx = db.transaction(store, 'readwrite');
        for (const item of items) {
          await tx.store.put(item);
        }
        await tx.done;
      }
    } catch (e) {
      console.warn(`Migration failed for ${lsKey}:`, e);
    }
  }

  // Migrate simple localStorage keys to settings store
  const simpleKeys = ['pinnedChatIds', 'activeChatId', 'hasSeenDisclaimer'];
  for (const key of simpleKeys) {
    try {
      const val = localStorage.getItem(key);
      if (val) {
        const existing = await db.get('settings', key);
        if (!existing) {
          await db.put('settings', { key, value: JSON.parse(val) });
        }
      }
    } catch (e) {
      // Ignore parse errors
    }
  }
}

// --- Chat History ---

export async function getAllChats(): Promise<Record<string, Message[]>> {
  const db = await getDB();
  const chats = await db.getAll('chatHistory');
  const result: Record<string, Message[]> = {};
  for (const chat of chats) {
    result[chat.chatId] = chat.messages;
  }
  return result;
}

export async function getChat(chatId: string): Promise<Message[] | undefined> {
  const db = await getDB();
  const chat = await db.get('chatHistory', chatId);
  return chat?.messages;
}

export async function saveChat(chatId: string, messages: Message[], title?: string): Promise<void> {
  const db = await getDB();
  await db.put('chatHistory', { chatId, messages, timestamp: Date.now(), title });
}

export async function deleteChat(chatId: string): Promise<void> {
  const db = await getDB();
  await db.delete('chatHistory', chatId);
}

export async function clearAllChats(): Promise<void> {
  const db = await getDB();
  await db.clear('chatHistory');
}

// --- Memories ---

export async function getAllMemories(): Promise<Memory[]> {
  const db = await getDB();
  return db.getAll('memories');
}

export async function getMemoriesByType(type: string): Promise<Memory[]> {
  const db = await getDB();
  return db.getAllFromIndex('memories', 'by-type', type);
}

export async function saveMemory(memory: Memory): Promise<void> {
  const db = await getDB();
  await db.put('memories', memory);
}

export async function deleteMemory(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('memories', id);
}

export async function clearAllMemories(): Promise<void> {
  const db = await getDB();
  await db.clear('memories');
}

// --- User Profile ---

const USER_PROFILE_ID = 'main';

export async function getUserProfile(): Promise<UserProfile | null> {
  const db = await getDB();
  const profile = await db.get('userProfile', USER_PROFILE_ID);
  return profile || null;
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  const db = await getDB();
  await db.put('userProfile' as any, { ...profile, id: USER_PROFILE_ID } as any);
}

// --- Skills ---

export async function getAllSkills(): Promise<Skill[]> {
  const db = await getDB();
  return db.getAll('skills');
}

export async function saveSkill(skill: Skill): Promise<void> {
  const db = await getDB();
  await db.put('skills', skill);
}

export async function deleteSkill(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('skills', id);
}

// --- Study History ---

export async function getAllStudySessions(): Promise<StudySession[]> {
  const db = await getDB();
  return db.getAll('studyHistory');
}

export async function saveStudySession(session: StudySession): Promise<void> {
  const db = await getDB();
  await db.put('studyHistory', session);
}

export async function getStudySessionsByDate(date: string): Promise<StudySession[]> {
  const db = await getDB();
  return db.getAllFromIndex('studyHistory', 'by-date', date);
}

// --- Notes ---

export async function getAllNotes(): Promise<Note[]> {
  const db = await getDB();
  return db.getAll('notes');
}

export async function saveNote(note: Note): Promise<void> {
  const db = await getDB();
  await db.put('notes', note);
}

export async function deleteNote(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('notes', id);
}

// --- Journal Entries ---

export async function getAllJournalEntries(): Promise<JournalEntry[]> {
  const db = await getDB();
  return db.getAll('journalEntries');
}

export async function saveJournalEntry(entry: JournalEntry): Promise<void> {
  const db = await getDB();
  await db.put('journalEntries', entry);
}

export async function deleteJournalEntry(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('journalEntries', id);
}

// --- Reminders ---

export async function getAllReminders(): Promise<Reminder[]> {
  const db = await getDB();
  return db.getAll('reminders');
}

export async function saveReminder(reminder: Reminder): Promise<void> {
  const db = await getDB();
  await db.put('reminders', reminder);
}

export async function deleteReminder(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('reminders', id);
}

// --- Settings ---

export async function getSetting(key: string): Promise<any> {
  const db = await getDB();
  const entry = await db.get('settings', key);
  return entry?.value;
}

export async function setSetting(key: string, value: any): Promise<void> {
  const db = await getDB();
  await db.put('settings', { key, value });
}

export async function getApiSettings(): Promise<ApiProviderSettings | null> {
  return getSetting('apiProviderSettings');
}

export async function saveApiSettings(settings: ApiProviderSettings): Promise<void> {
  return setSetting('apiProviderSettings', settings);
}
