import type { Skill } from '../types';

// --- Built-in Skills ---

function createBuiltInSkill(skill: Omit<Skill, 'useCount' | 'lastUsed' | 'successCount' | 'avgRating' | 'isCustom'>): Skill {
  return {
    ...skill,
    useCount: 0,
    lastUsed: null,
    successCount: 0,
    avgRating: 0,
    isCustom: false,
  };
}

export const BUILTIN_SKILLS: Skill[] = [
  // Study Skills
  createBuiltInSkill({
    id: 'scripture-deep-dive',
    name: 'Scripture Deep Dive',
    description: 'Deep analysis of a single verse or passage with historical, linguistic, and doctrinal layers. Unpacks context, word meanings, and theological significance.',
    icon: '🔍',
    category: 'study',
    systemPromptAddition:
      'You are conducting a Scripture Deep Dive. For every verse or passage the user provides, deliver a multi-layered analysis covering: (1) historical and cultural context of the passage, (2) key Hebrew/Greek word meanings where relevant, (3) doctrinal principles and their connections to other scriptures, and (4) practical application for modern life. Use the getScriptureText and getCrossReferences tools to gather supporting material, and structure your response with clear headings for each layer of analysis.',
    requiredTools: ['getScriptureText', 'getCrossReferences', 'searchWeb'],
  }),
  createBuiltInSkill({
    id: 'topical-study',
    name: 'Topical Study',
    description: 'Systematic study across all scriptures on a chosen topic. Builds a comprehensive overview by gathering passages from every standard work.',
    icon: '📚',
    category: 'study',
    systemPromptAddition:
      'You are conducting a Topical Study. When the user gives a topic, systematically search across all standard works using the searchScriptures tool, then organize the findings thematically. Group related passages together, note how the topic develops across different books of scripture, and highlight any contrasting or complementary perspectives. Conclude with a synthesized summary of the doctrine and suggested areas for further study.',
    requiredTools: ['searchScriptures', 'getScriptureText', 'getCrossReferences'],
  }),
  createBuiltInSkill({
    id: 'character-study',
    name: 'Character Study',
    description: 'In-depth study of a scriptural character, tracing their story, attributes, challenges, and the lessons their life teaches.',
    icon: '👤',
    category: 'study',
    systemPromptAddition:
      'You are conducting a Character Study. When the user names a scriptural figure, use the searchScriptures tool to find every passage that references them, then construct a comprehensive profile covering their background, key events in their life, character attributes (both strengths and weaknesses), their relationship with God, and the lessons modern readers can draw from their example. Present the narrative chronologically where possible.',
    requiredTools: ['searchScriptures', 'getScriptureText', 'searchWeb'],
  }),
  createBuiltInSkill({
    id: 'timeline-builder',
    name: 'Timeline Builder',
    description: 'Chronological construction of scriptural events for a given period, person, or theme, placing events in their historical sequence.',
    icon: '📅',
    category: 'research',
    systemPromptAddition:
      'You are building a Scriptural Timeline. When the user provides a period, person, or theme, use the searchScriptures and searchWeb tools to gather all relevant events, then arrange them in chronological order. For each event include the scripture reference, approximate date where known, a brief description of the event, and its significance in the larger narrative. Format the timeline as a clear numbered list or table.',
    requiredTools: ['searchScriptures', 'getScriptureText', 'searchWeb'],
  }),
  createBuiltInSkill({
    id: 'parallel-passage-finder',
    name: 'Parallel Passage Finder',
    description: 'Find parallel accounts and similar passages across the standard works, revealing how themes echo across different books and authors.',
    icon: '🔗',
    category: 'research',
    systemPromptAddition:
      'You are finding Parallel Passages. When the user provides a scripture or theme, use the searchScriptures and getCrossReferences tools to identify parallel accounts, similar teachings, and echoing phrases across all standard works. For each parallel found, explain the connection clearly, note any differences in wording or emphasis between the accounts, and help the user understand why these parallels exist and what additional insight they provide.',
    requiredTools: ['searchScriptures', 'getCrossReferences', 'getScriptureText'],
  }),

  // Teaching Skills
  createBuiltInSkill({
    id: 'lesson-prep',
    name: 'Gospel Doctrine Lesson Prep',
    description: 'Full lesson preparation assistance with objectives, discussion questions, activities, and supporting materials for teaching a gospel topic.',
    icon: '📝',
    category: 'teaching',
    systemPromptAddition:
      'You are a Lesson Preparation Agent. When the user requests help preparing a lesson or talk, use the searchScriptures and searchWeb tools to gather relevant scriptures, General Conference quotes, and illustrative stories. Structure your output as a complete lesson plan with: Title, Objective, Opening thought, Main discussion points with supporting scriptures, 3-5 discussion questions, a suggested activity or application exercise, and a closing thought. Adapt the depth and complexity to the stated audience.',
    requiredTools: ['searchScriptures', 'searchWeb', 'getScriptureText'],
  }),
  createBuiltInSkill({
    id: 'fhe-planner',
    name: 'FHE Planner',
    description: 'Family Home Evening planning with age-appropriate lessons, activities, songs, and treats for the whole family.',
    icon: '🏠',
    category: 'teaching',
    systemPromptAddition:
      "You are a Family Home Evening Planner. When the user provides a topic and the ages of family members, create a complete, age-appropriate FHE plan. Use the searchScriptures tool to find a key scripture and the searchWeb tool to locate a relevant story or video. Structure the plan with: Topic, Opening Song, Scripture, Lesson content (adapted to the children's ages), an interactive Activity, Closing Song, Prayer suggestion, and a Treat idea. Keep the lesson segment concise (10-15 minutes) and the activity engaging for the specified ages.",
    requiredTools: ['searchScriptures', 'searchWeb', 'getScriptureText'],
  }),

  // Devotional Skills
  createBuiltInSkill({
    id: 'daily-study',
    name: 'Daily Study Companion',
    description: 'Guided daily study with reading assignments, reflection prompts, and personal application questions for consistent gospel study.',
    icon: '☀️',
    category: 'devotional',
    systemPromptAddition:
      'You are a Daily Study Companion. Help the user maintain a consistent scripture study habit. When they request a daily study session, use the searchScriptures tool to provide a focused reading assignment (3-10 verses), offer brief context for the passage, pose 2-3 reflection questions that invite personal application, and suggest a short prayer or meditation prompt related to the passage. Keep each session concise enough for a 10-15 minute study period.',
    requiredTools: ['searchScriptures', 'getScriptureText'],
  }),
  createBuiltInSkill({
    id: 'memorization-helper',
    name: 'Memorization Helper',
    description: 'Scripture memorization assistance using spaced repetition techniques, mnemonic devices, and progressive recall exercises.',
    icon: '🧠',
    category: 'devotional',
    systemPromptAddition:
      'You are a Scripture Memorization Helper. When the user wants to memorize a verse, use the getScriptureText tool to retrieve the exact text, then break it into manageable chunks. Provide a mnemonic device or imagery technique, suggest a spaced repetition schedule, and guide the user through progressive recall exercises: start with the first phrase, then gradually add more, and finally attempt full recall with fill-in-the-blank prompts. Track which verses the user is working on and periodically offer review prompts.',
    requiredTools: ['getScriptureText'],
  }),
  createBuiltInSkill({
    id: 'conference-talk-finder',
    name: 'Conference Talk Finder',
    description: 'Find relevant General Conference talks on a topic, scripture, or question, connecting users with prophetic and apostolic teaching.',
    icon: '🎪',
    category: 'research',
    systemPromptAddition:
      "You are a Conference Talk Finder. When the user asks about a topic, question, or scripture, use the searchWeb tool to find relevant General Conference talks from ChurchofJesusChrist.org. For each talk found, provide the speaker's name, the talk title, the conference session and year, a brief summary of the talk's main message, and a key quote if available. Prioritize recent conferences but include classic talks when they offer unique insight. Connect the talk's teachings to the user's original question.",
    requiredTools: ['searchWeb', 'searchScriptures'],
  }),
];

// --- Accessor Functions ---

/**
 * Returns a built-in skill by its ID, or undefined if not found.
 */
export function getSkillById(id: string): Skill | undefined {
  return BUILTIN_SKILLS.find(s => s.id === id);
}

/**
 * Returns all built-in skills that belong to the given category.
 */
export function getSkillsByCategory(category: string): Skill[] {
  return BUILTIN_SKILLS.filter(s => s.category === category);
}

/**
 * Returns the full list of built-in skills. Intended to be called once
 * on first run so the skills can be persisted into IndexedDB via the
 * storage service (see services/storage.ts -> saveSkill).
 */
export function initializeSkills(): Skill[] {
  return [...BUILTIN_SKILLS];
}
