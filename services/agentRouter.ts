/**
 * Agent Router - Routes messages to appropriate sub-agents based on content analysis
 */

type AgentCapability = string;

interface RouteContext {
  message: string;
  capabilities: AgentCapability[];
  currentState: 'idle' | 'thinking' | 'responding' | 'error' | 'loading';
}

interface RouterResult {
  agentType: string;
  priority: number;
  reason: string;
}

export class AgentRouter {
  private routes: Map<string, { pattern: RegExp; agentType: string; priority: number }[]> = new Map();

  constructor() {
    this.initializeDefaultRoutes();
  }

  private initializeDefaultRoutes(): void {
    // Scripture analysis routes
    this.registerRoute('scripture_analysis', /bible|scripture|verse|chapter|book of/i, 10);
    this.registerRoute('scripture_analysis', /genesis|exodus|leviticus|numbers|deuteronomy|joshua|judges/i, 9);
    this.registerRoute('scripture_analysis', /psalm|proverb|isaiah|jeremiah|ezekiel|daniel/i, 9);
    this.registerRoute('scripture_analysis', /matthew|mark|luke|john|acts|romans|corinthians|galatians|ephesians/i, 9);
    this.registerRoute('scripture_analysis', /book of mormon|bofm|1 nephi|2 nephi|jacob|enos|jarom|omni|words of mormon/i, 10);
    this.registerRoute('scripture_analysis', /d&c|doctrine and covenants|section|revelation/i, 10);
    this.registerRoute('scripture_analysis', /pearl of great price|mosiah|alma|helaman|3 nephi|4 nephi|ether|moroni/i, 9);

    // General chat routes
    this.registerRoute('general_chat', /^(hi|hello|hey|howdy)/i, 5);
    this.registerRoute('general_chat', /how are you|what's up/i, 6);
    this.registerRoute('general_chat', /thank|thanks/i, 4);

    // Study tracking routes
    this.registerRoute('study_tracking', /track|study session|progress|analytics/i, 7);
    this.registerRoute('study_tracking', /achievement|badge|goal/i, 6);
  }

  private registerRoute(agentType: string, pattern: RegExp, priority: number): void {
    const existing = this.routes.get(agentType) || [];
    existing.push({ pattern, agentType, priority });
    this.routes.set(agentType, existing);
  }

  route(context: RouteContext): RouterResult {
    const { message } = context;
    const scores: Map<string, number> = new Map();

    // Calculate scores for each route based on pattern matching
    this.routes.forEach((routeList, agentType) => {
      for (const route of routeList) {
        if (route.pattern.test(message)) {
          const currentScore = scores.get(agentType) || 0;
          scores.set(agentType, Math.max(currentScore, route.priority));
        }
      }
    });

    // Find the highest scoring agent type
    let bestAgentType = 'general_chat';
    let bestScore = 0;

    scores.forEach((score, agentType) => {
      if (score > bestScore) {
        bestScore = score;
        bestAgentType = agentType;
      }
    });

    return {
      agentType: bestAgentType,
      priority: bestScore,
      reason: `Matched routes with priority ${bestScore}`,
    };
  }

  getRegisteredRoutes(): string[] {
    return Array.from(this.routes.keys());
  }
}

export const createAgentRouter = (): AgentRouter => new AgentRouter();

// Legacy export - routes to sub-agents based on message content and mode
export function routeToAgent(message: string, mode: ChatMode): SubAgent | null {
  const lower = message.toLowerCase();

  if (/^\s*(hi|hello|hey|howdy|thanks|thank you|good morning|good afternoon|good evening)\b/i.test(lower)) {
    return SUB_AGENTS.get('generalChat') || null;
  }

  if (mode === 'study-plan' || /study\s*plan|create\s*plan|schedule/i.test(lower)) {
    return SUB_AGENTS.get('studyPlanner') || null;
  }
  if (mode === 'multi-quiz' || /quiz|test\s*me|exam/i.test(lower)) {
    return SUB_AGENTS.get('quizMaster') || null;
  }
  if (mode === 'lesson-prep' || /lesson|prepare\s*teach|preach/i.test(lower)) {
    return SUB_AGENTS.get('lessonPrep') || null;
  }
  if (/(scripture|verse|cross-?reference|book of mormon|doctrine and covenants|pearl of great price|old testament|new testament|1 nephi|2 nephi|alma|moroni|moses|abraham|joseph smith|gospel doctrine)/i.test(lower)) {
    return SUB_AGENTS.get('research') || null;
  }

  return SUB_AGENTS.get('generalChat') || null;
}

// ============================================================================
// Sub-Agent Definitions
// ============================================================================

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
