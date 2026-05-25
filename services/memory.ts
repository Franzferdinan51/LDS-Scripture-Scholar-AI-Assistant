import type { ApiProviderSettings, Memory, UserProfile, Message } from '../types';
import { getAllMemories, saveMemory, deleteMemory, getUserProfile, saveUserProfile } from './storage';
import { generateJsonWithSettings } from './llmService';
import { embedText, cosineSimilarity } from './semanticSearch';

const MEMORY_EXTRACTION_PROMPT = `You are a memory extraction system. Analyze the following conversation and extract key facts about the user that would be useful for future interactions as a scripture study assistant.

Extract facts in these categories:
- **episodic**: Specific events or actions (e.g., "User asked about 2 Nephi 2 for seminary assignment")
- **semantic**: Knowledge patterns or preferences (e.g., "User prefers historical context over doctrinal analysis")
- **preference**: User preferences for how the assistant should behave (e.g., "User wants concise answers")

Respond with ONLY a JSON array of objects with these fields:
- type: "episodic" | "semantic" | "preference"
- content: The fact (one sentence, clear and specific)

If no meaningful facts are found, return an empty array: []
Do NOT include generic facts. Only extract specific, actionable information.`;

const PROFILE_UPDATE_PROMPT = `You are a user profile analyzer for a scripture study assistant. Based on the conversation, determine if any profile fields should be updated.

Current profile:
{{CURRENT_PROFILE}}

Respond with ONLY a JSON object with ONLY the fields that should change. If no changes needed, return: {}
Fields:
- studyLevel: "beginner" | "intermediate" | "advanced" (based on depth of questions)
- preferredBooks: string[] (scripture books frequently referenced)
- interests: string[] (gospel topics the user explores)
- studyFrequency: "daily" | "weekly" | "occasional" (based on interaction patterns)`;

// --- Memory Extraction ---

export async function extractMemories(
  messages: Message[],
  settings: ApiProviderSettings
): Promise<Memory[]> {
  if (!settings || messages.length < 2) return [];

  const conversationText = messages
    .filter(m => !m.isSuggestion && m.id !== 'initial-message')
    .slice(-10) // Last 10 messages
    .map(m => `${m.sender === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
    .join('\n');

  if (conversationText.length < 50) return []; // Too short to extract meaning

  try {
    const extracted = await generateJsonWithSettings<any[]>(settings, conversationText, {
      systemInstruction: MEMORY_EXTRACTION_PROMPT,
      temperature: 0.3,
      model: settings.model || undefined,
    });

    if (!Array.isArray(extracted)) return [];

    return extracted.map((item: any) => ({
      id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: item.type || 'episodic',
      content: item.content,
      source: 'conversation',
      relevance: 1.0,
      timestamp: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 0,
    }));
  } catch (e) {
    console.error('Memory extraction failed:', e);
    return [];
  }
}

// --- Memory Storage with Deduplication ---

export async function storeMemories(newMemories: Memory[]): Promise<void> {
  const existing = await getAllMemories();

  for (const mem of newMemories) {
    // Check for duplicates (similar content)
    const isDuplicate = existing.some(e =>
      e.content.toLowerCase().trim() === mem.content.toLowerCase().trim() ||
      similarity(e.content, mem.content) > 0.85
    );

    if (!isDuplicate) {
      const embedding = await embedText(mem.content);
      await saveMemory({ ...mem, embedding: embedding ?? mem.embedding });
    }
  }
}

// --- Memory Retrieval ---

export async function retrieveRelevantMemories(
  query: string,
  limit: number = 5
): Promise<Memory[]> {
  const all = await getAllMemories();
  if (all.length === 0) return [];

  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 3);
  const queryEmbedding = await embedText(query);

  // Score each memory by keyword overlap + recency + relevance
  const scored = await Promise.all(all.map(async mem => {
    const memLower = mem.content.toLowerCase();
    let keywordScore = 0;

    // Direct substring match
    if (memLower.includes(queryLower)) {
      keywordScore += 3;
    }

    // Word overlap
    for (const word of queryWords) {
      if (memLower.includes(word)) keywordScore += 1;
    }

    // Recency score (newer = higher)
    const ageHours = (Date.now() - mem.timestamp) / (1000 * 60 * 60);
    const recencyScore = Math.max(0, 1 - ageHours / (24 * 30)); // Decays over 30 days

    // Access frequency score
    const accessScore = Math.min(1, mem.accessCount / 5);
    const memoryEmbedding = mem.embedding ?? await embedText(mem.content);
    const semanticScore = cosineSimilarity(queryEmbedding, memoryEmbedding);

    const totalScore = (keywordScore * 0.35) + (semanticScore * 2.75) + (recencyScore * 0.2) + (mem.relevance * 0.1) + (accessScore * 0.1);

    if (!mem.embedding && memoryEmbedding) {
      saveMemory({ ...mem, embedding: memoryEmbedding }).catch(() => {});
    }

    return { ...mem, score: totalScore };
  }));

  // Filter out zero-score and sort by score
  return scored
    .filter(m => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score, ...mem }) => {
      // Update access tracking
      saveMemory({ ...mem, lastAccessed: Date.now(), accessCount: mem.accessCount + 1 });
      return mem;
    });
}

// --- Profile Management ---

export async function getOrCreateProfile(): Promise<UserProfile> {
  const existing = await getUserProfile();
  if (existing) return existing;

  const defaultProfile: UserProfile = {
    studyLevel: 'intermediate',
    preferredBooks: [],
    interests: [],
    studyFrequency: 'occasional',
    lastActiveDate: new Date().toISOString().split('T')[0],
    totalStudySessions: 0,
    streakDays: 0,
    longestStreak: 0,
    lastStudyDate: '',
  };

  await saveUserProfile(defaultProfile);
  return defaultProfile;
}

export async function updateProfileFromConversation(
  messages: Message[],
  settings: ApiProviderSettings
): Promise<void> {
  if (!settings || messages.length < 2) return;

  try {
    const profile = await getOrCreateProfile();

    const conversationText = messages
      .filter(m => !m.isSuggestion && m.id !== 'initial-message')
      .slice(-6)
      .map(m => `${m.sender === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
      .join('\n');

    const prompt = PROFILE_UPDATE_PROMPT.replace('{{CURRENT_PROFILE}}', JSON.stringify(profile, null, 2));
    const updates = await generateJsonWithSettings<Record<string, any>>(settings, conversationText, {
      systemInstruction: prompt,
      temperature: 0.2,
      model: settings.model || undefined,
    });

    if (updates && typeof updates === 'object' && Object.keys(updates).length > 0) {
      await saveUserProfile({ ...profile, ...updates, lastActiveDate: new Date().toISOString().split('T')[0] });
    }
  } catch (e) {
    console.error('Profile update failed:', e);
  }
}

// --- Memory Consolidation ---

export async function consolidateMemories(): Promise<void> {
  const memories = await getAllMemories();
  if (memories.length === 0) return;

  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  for (const mem of memories) {
    const ageDays = (now - mem.timestamp) / DAY_MS;

    // Decay relevance over time
    let newRelevance = mem.relevance;
    if (ageDays > 7) newRelevance *= 0.95;
    if (ageDays > 30) newRelevance *= 0.9;
    if (ageDays > 90) newRelevance *= 0.8;

    // Boost relevance if frequently accessed
    if (mem.accessCount > 3) newRelevance = Math.min(1, newRelevance * 1.1);

    if (newRelevance < 0.1) {
      // Remove very low relevance memories
      await deleteMemory(mem.id);
    } else if (newRelevance !== mem.relevance) {
      await saveMemory({ ...mem, relevance: newRelevance });
    }
  }
}

// --- Proactive Memory Extraction (Hermes-inspired B2) ---
// After conversations, check for important user-mentioned facts that weren't captured

const PROACTIVE_EXTRACTION_PROMPT = `You are a proactive memory extraction system for a scripture study assistant.
Your job is to identify IMPORTANT facts the user has mentioned about themselves
that should be remembered for future interactions.

Look for:
- Identity: who the user is (mission call, job, role like "seminary teacher", "bishop", "missionary")
- Goals: what they're working towards (preparing a talk, mission prep, study goals)
- Life events: baptism, marriage, mission, moving, recent experiences
- Relationships: family context ("my wife and I", "teaching my children", "studying with my spouse")
- Study context: specific scriptures they're reading, topics they're exploring

Important: Only capture significant facts that would meaningfully improve future assistance.
Do NOT capture: casual comments, obvious one-off questions, generic statements.

Respond with ONLY a JSON array of objects with these fields:
- type: "episodic" | "semantic" | "preference"
- content: The fact (clear, specific, 1-2 sentences max)
- category: "identity" | "goal" | "life_event" | "relationship" | "study_context"

If no important facts found, return an empty array: []`;

export async function extractProactiveMemories(
  messages: Message[],
  settings: ApiProviderSettings
): Promise<Memory[]> {
  if (!settings || messages.length < 2) return [];

  // Get recent user messages (last 6, excluding suggestions)
  const recentMessages = messages
    .filter(m => !m.isSuggestion && m.id !== 'initial-message')
    .slice(-6);

  if (recentMessages.length < 2) return [];

  // Only look at user messages for proactive capture
  const userMessages = recentMessages.filter(m => m.sender === 'user');
  if (userMessages.length < 1) return [];

  const conversationText = userMessages
    .map(m => `User: ${m.text}`)
    .join('\n');

  if (conversationText.length < 30) return [];

  try {
    const existing = await getAllMemories();
    const existingContents = new Set(existing.map(e => e.content.toLowerCase().trim()));

    const extracted = await generateJsonWithSettings<any[]>(settings, conversationText, {
      systemInstruction: PROACTIVE_EXTRACTION_PROMPT,
      temperature: 0.3,
      model: settings.model || undefined,
    });

    if (!Array.isArray(extracted) || extracted.length === 0) return [];

    const newMemories: Memory[] = [];
    for (const item of extracted) {
      const content = item.content?.trim();
      if (!content) continue;

      // Skip if we already have something similar
      if (existingContents.has(content.toLowerCase())) continue;
      if (existing.some(e => similarity(e.content, content) > 0.8)) continue;

      newMemories.push({
        id: `proactive-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: item.type || 'episodic',
        content,
        source: 'proactive',
        relevance: 0.95, // High relevance for proactive captures
        timestamp: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 0,
        // category stored in content metadata
      });
    }

    if (newMemories.length > 0) {
      for (const mem of newMemories) {
        await saveMemory(mem);
      }
      console.log(`[ProactiveMemory] Captured ${newMemories.length} new facts`);
    }

    return newMemories;
  } catch (e) {
    console.error('Proactive memory extraction failed:', e);
    return [];
  }
}

// --- Utility: Simple string similarity ---

function similarity(a: string, b: string): number {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();
  const aWords = new Set(aLower.split(/\s+/));
  const bWords = new Set(bLower.split(/\s+/));
  const intersection = new Set([...aWords].filter(w => bWords.has(w)));
  const union = new Set([...aWords, ...bWords]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}
