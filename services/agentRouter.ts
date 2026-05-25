/**
 * Agent Router - Routes messages to appropriate sub-agents based on content analysis
 */

import type { ChatMode } from '../types';

export interface SubAgent {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  systemPrompt: string;
  icon?: string;
}

export const SUB_AGENTS: Map<string, SubAgent> = new Map([
  ['generalChat', {
    id: 'generalChat',
    name: 'General Chat Agent',
    description: 'Handles ordinary conversation, short follow-ups, and broad scripture questions without forcing a specialist mode.',
    capabilities: ['conversation', 'clarification', 'scripture_search'],
    systemPrompt: 'You are a helpful LDS scripture scholar assistant. Keep ordinary chat natural, concise, and grounded in scripture when relevant. When asked about recent events, conference talks, or current Church information, ALWAYS use searchLdsWeb or searchWeb tools to get the most up-to-date information from ChurchofJesusChrist.org rather than relying on your training data. Your search tools are LDS-specific and query official Church sources. Today is {{TODAYS_DATE}}.',
    icon: '💬',
  }],
  ['research', {
    id: 'research',
    name: 'Research Agent',
    description: 'Searches scriptures, finds cross-references, and provides detailed scripture analysis',
    capabilities: ['scripture_search', 'cross_references', 'web_search'],
    systemPrompt: 'You are a knowledgeable LDS scripture scholar. Search and analyze scriptures with precision. When researching current information, ALWAYS use searchLdsWeb or searchWeb tools first — these query official Church sources including ChurchofJesusChrist.org, General Conference archives, and Church magazines. For recent conference talks, news, or time-sensitive topics, always search before answering. Today is {{TODAYS_DATE}}.',
    icon: '📖',
  }],
  ['studyPlanner', {
    id: 'studyPlanner',
    name: 'Study Planner',
    description: 'Creates structured study plans with daily sessions and goals',
    capabilities: ['study_planning', 'scripture_search'],
    systemPrompt: 'You are a study planning assistant. Create organized, achievable study plans grounded in LDS scripture. Use search tools to find relevant talks and resources for the plan. Today is {{TODAYS_DATE}}.',
    icon: '📚',
  }],
  ['quizMaster', {
    id: 'quizMaster',
    name: 'Quiz Master',
    description: 'Generates interactive quizzes to test scripture knowledge',
    capabilities: ['quiz_generation', 'scripture_search'],
    systemPrompt: 'You are a quiz master. Create engaging multiple-choice quizzes about LDS scriptures. Verify answers against scripture text using search tools when available. Today is {{TODAYS_DATE}}.',
    icon: '🎯',
  }],
  ['lessonPrep', {
    id: 'lessonPrep',
    name: 'Lesson Prep',
    description: 'Prepares lesson outlines with discussion questions and key points',
    capabilities: ['lesson_prep', 'scripture_search', 'web_search'],
    systemPrompt: 'You are a lesson preparation assistant. Create clear, inspiring lesson outlines. Use searchLdsWeb and searchWeb tools to find relevant General Conference talks, scripture references, and current Church resources from ChurchofJesusChrist.org. For recent talks or current events, always search for the latest information from official Church sources. Today is {{TODAYS_DATE}}.',
    icon: '📝',
  }],
]);

// Routes to sub-agents based on message content and mode
export function routeToAgent(message: string, mode: ChatMode): SubAgent | null {
  const lower = message.toLowerCase();
  const slashCommand = lower.match(/^\s*\/([a-z-]+)/)?.[1] || '';

  if (/^\s*(hi|hello|hey|howdy|thanks|thank you|good morning|good afternoon|good evening)\b/i.test(lower)) {
    return SUB_AGENTS.get('generalChat') || null;
  }

  if (mode === 'study-plan' || slashCommand === 'plan' || /study\s*plan|create\s*plan|schedule/i.test(lower)) {
    return SUB_AGENTS.get('studyPlanner') || null;
  }
  if (mode === 'multi-quiz' || slashCommand === 'quiz' || /quiz|test\s*me|exam/i.test(lower)) {
    return SUB_AGENTS.get('quizMaster') || null;
  }
  if (mode === 'lesson-prep' || slashCommand === 'lesson' || slashCommand === 'fhe' || /lesson|prepare\s*teach|preach|family home evening/i.test(lower)) {
    return SUB_AGENTS.get('lessonPrep') || null;
  }
  if (slashCommand === 'study' || slashCommand === 'explain' || slashCommand === 'cross-ref' || slashCommand === 'search' || slashCommand === 'image' || /(scripture|verse|cross-?reference|book of mormon|doctrine and covenants|pearl of great price|old testament|new testament|1 nephi|2 nephi|alma|moroni|moses|abraham|joseph smith|gospel doctrine)/i.test(lower)) {
    return SUB_AGENTS.get('research') || null;
  }

  return SUB_AGENTS.get('generalChat') || null;
}
