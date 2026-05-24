/**
 * StudyProgress - Tracks study sessions, achievements, and streaks
 */

import { openDB } from 'idb';

interface StudyProgressEntry {
  date: string;
  conversations: number;
  versesRead: number;
  sessionsCompleted: number;
}

interface StudyProgressDB {
  progress: {
    key: string;
    value: StudyProgressEntry;
    indexes: { 'by-date': string };
  };
  achievements: {
    key: string;
    value: { id: string; earnedAt?: string; progress: number };
  };
}

let dbPromise: Promise<any> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB('scripture-scholar-progress', 1, {
      upgrade(db) {
        db.createObjectStore('progress', { keyPath: 'date' });
        db.createObjectStore('achievements', { keyPath: 'id' });
      },
    });
  }
  return dbPromise;
}

// Achievement definitions
export const ACHIEVEMENTS = [
  { id: 'first_steps', name: 'First Steps', icon: '👣', desc: 'Complete your first conversation', threshold: 1 },
  { id: 'week_warrior', name: 'Week Warrior', icon: '⚔️', desc: '7-day study streak', threshold: 7 },
  { id: 'consistent', name: 'Consistent', icon: '📅', desc: '14-day study streak', threshold: 14 },
  { id: 'month_master', name: 'Month Master', icon: '👑', desc: '30-day study streak', threshold: 30 },
  { id: 'scripture_scholar', name: 'Scripture Scholar', icon: '📖', desc: 'Read 1,000 verses', threshold: 1000 },
  { id: 'deep_diver', name: 'Deep Diver', icon: '🏊', desc: 'Read 10,000 verses', threshold: 10000 },
  { id: 'scripture_master', name: 'Scripture Master', icon: '🎓', desc: 'Read 25,000 verses', threshold: 25000 },
  { id: 'first_session', name: 'Session Starter', icon: '🚀', desc: 'Complete your first study session', threshold: 1 },
  { id: 'quiz_master', name: 'Quiz Master', icon: '🎯', desc: 'Complete 10 quizzes', threshold: 10 },
  { id: 'note_taker', name: 'Note Taker', icon: '📝', desc: 'Create 25 notes', threshold: 25 },
] as const;

export type AchievementId = typeof ACHIEVEMENTS[number]['id'];

export async function recordConversation(versesRead: number = 0) {
  const db = await getDB();
  const today = new Date().toISOString().split('T')[0];
  const entry: StudyProgressEntry = await db.get('progress', today) || {
    date: today,
    conversations: 0,
    versesRead: 0,
    sessionsCompleted: 0,
  };
  entry.conversations += 1;
  entry.versesRead += versesRead;
  await db.put('progress', entry);

  // Update achievements
  await updateAchievement('first_steps', entry.conversations);
  if (versesRead > 0) await updateAchievement('scripture_scholar', entry.versesRead);

  return entry;
}

export async function recordStudySession() {
  const db = await getDB();
  const today = new Date().toISOString().split('T')[0];
  const entry: StudyProgressEntry = await db.get('progress', today) || {
    date: today,
    conversations: 0,
    versesRead: 0,
    sessionsCompleted: 0,
  };
  entry.sessionsCompleted += 1;
  await db.put('progress', entry);
  await updateAchievement('first_session', entry.sessionsCompleted);
  return entry;
}

export async function recordQuizComplete() {
  const db = await getDB();
  const ach = await db.get('achievements', 'quiz_master') || { id: 'quiz_master', progress: 0 };
  ach.progress += 1;
  await db.put('achievements', ach);
}

export async function recordNoteCreated() {
  const db = await getDB();
  const ach = await db.get('achievements', 'note_taker') || { id: 'note_taker', progress: 0 };
  ach.progress += 1;
  await db.put('achievements', ach);
}

async function updateAchievement(id: AchievementId, value: number) {
  const ach = ACHIEVEMENTS.find(a => a.id === id);
  if (!ach) return;
  const db = await getDB();
  const entry = await db.get('achievements', id) || { id, progress: 0 };
  entry.progress = value;
  if (value >= ach.threshold && !entry.earnedAt) {
    entry.earnedAt = new Date().toISOString();
  }
  await db.put('achievements', entry);
}

export async function getAchievements() {
  const db = await getDB();
  const allAchs = await db.getAll('achievements');
  return ACHIEVEMENTS.map(ach => {
    const stored = allAchs.find(a => a.id === ach.id);
    return {
      ...ach,
      progress: stored?.progress || 0,
      earned: stored?.progress >= ach.threshold,
      earnedAt: stored?.earnedAt,
    };
  });
}

export async function getStreakDays(): Promise<number> {
  const db = await getDB();
  const all = await db.getAll('progress');
  if (all.length === 0) return 0;

  all.sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  let currentDate = new Date();

  for (const entry of all) {
    const entryDate = new Date(entry.date);
    const diff = Math.floor((currentDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diff <= 1 && entry.conversations > 0) {
      streak++;
      currentDate = entryDate;
    } else if (diff > 1) {
      break;
    }
  }

  return streak;
}

export async function getTotalVersesRead(): Promise<number> {
  const db = await getDB();
  const all = await db.getAll('progress');
  return all.reduce((sum, e) => sum + e.versesRead, 0);
}

export async function getProgressSummary() {
  const [streak, totalVerses, achievements] = await Promise.all([
    getStreakDays(),
    getTotalVersesRead(),
    getAchievements(),
  ]);
  return { streak, totalVerses, achievements };
}