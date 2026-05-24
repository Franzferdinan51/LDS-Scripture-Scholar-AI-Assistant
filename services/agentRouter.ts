import { GoogleGenAI } from "@google/genai";
import type { ChatMode, ApiProviderSettings } from "../types";

// --- Sub-Agent Definitions ---

export interface SubAgent {
  id: string;
  name: string;
  systemPrompt: string;
  tools: string[];
  model: string;
}

export const SUB_AGENTS: Map<string, SubAgent> = new Map([
  [
    "research",
    {
      id: "research",
      name: "Research Agent",
      systemPrompt:
        "You are a specialized LDS scripture research agent. Your purpose is to search across all standard works (Bible, Book of Mormon, Doctrine and Covenants, Pearl of Great Price) and provide thorough, accurate findings. " +
        "When answering: cite specific scripture references (book, chapter, verse), provide the full verse text when relevant, find cross-references and thematic connections, include context from surrounding passages, " +
        "and reference General Conference talks or official sources when helpful. Always be precise with references and faithful to the original text.",
      tools: [
        "searchScriptures",
        "getScriptureText",
        "getCrossReferences",
        "searchWeb",
      ],
      model: "gemini-2.5-flash",
    },
  ],
  [
    "studyPlanner",
    {
      id: "studyPlanner",
      name: "Study Planner Agent",
      systemPrompt:
        "You are a specialized LDS scripture study planning agent. Your purpose is to create structured, thoughtful study plans tailored to the user's needs. " +
        "Organize material into manageable daily sessions with specific scripture readings, reflection questions, and progressive difficulty. " +
        "Incorporate a mix of reading, reflection, and application. Respond with a well-structured study plan in JSON format with a title and an array of day objects, " +
        "each containing: day (number), topic (string), scriptures (array of references), and reflection_question (string).",
      tools: ["searchScriptures", "getScriptureText"],
      model: "gemini-2.5-pro",
    },
  ],
  [
    "quizMaster",
    {
      id: "quizMaster",
      name: "Quiz Master Agent",
      systemPrompt:
        "You are a specialized LDS scripture quiz master agent. Your purpose is to generate engaging, educational quizzes that test and deepen knowledge of the scriptures. " +
        "Write clear, unambiguous questions with 4 multiple-choice options and one correct answer. Draw from a range of difficulty levels covering doctrine, history, narrative, and application. " +
        "For each question provide: the question text, an array of 4 options, and the zero-based index of the correct answer. Respond with a JSON array of question objects.",
      tools: ["searchScriptures", "getScriptureText"],
      model: "gemini-2.5-pro",
    },
  ],
  [
    "lessonPrep",
    {
      id: "lessonPrep",
      name: "Lesson Prep Agent",
      systemPrompt:
        "You are a specialized LDS lesson and talk preparation agent. Your purpose is to help users prepare meaningful lessons, talks, and presentations for church settings. " +
        "Structure material with a clear introduction, body, and conclusion. Suggest relevant scripture references, include discussion questions, provide practical application ideas, " +
        "and offer relevant quotes from General Authorities. Organize the output with clear headings and bullet points.",
      tools: [
        "searchScriptures",
        "getScriptureText",
        "getCrossReferences",
        "searchWeb",
      ],
      model: "gemini-2.5-pro",
    },
  ],
]);

// --- Routing Logic ---

const ROUTE_PATTERNS: { agentId: string; keywords: string[] }[] = [
  {
    agentId: "research",
    keywords: [
      "find scriptures",
      "search for",
      "what does the bible say",
      "what does the book of mormon say",
      "cross-reference",
      "cross reference",
      "related scriptures",
      "where does it say",
      "scripture about",
      "passages about",
      "verses about",
      "references for",
      "look up",
      "study topic",
      "research",
      "find verses",
    ],
  },
  {
    agentId: "studyPlanner",
    keywords: [
      "study plan",
      "create a plan",
      "make a plan",
      "schedule my study",
      "daily reading",
      "reading plan",
      "study schedule",
      "plan for studying",
      "organize my study",
      "how should i study",
      "help me study",
      "week-long study",
      "month-long study",
      "30-day",
      "7-day",
      "study guide",
    ],
  },
  {
    agentId: "quizMaster",
    keywords: [
      "quiz me",
      "quiz",
      "test my knowledge",
      "create a quiz",
      "make a quiz",
      "generate questions",
      "test questions",
      "trivia",
      "flashcards",
      "study questions",
      "practice questions",
      "multiple choice",
      "challenge me",
      "how well do i know",
    ],
  },
  {
    agentId: "lessonPrep",
    keywords: [
      "lesson",
      "talk",
      "prepare a talk",
      "prepare a lesson",
      "sacrament talk",
      "sunday school",
      "relief society",
      "elders quorum",
      "priesthood",
      "young women",
      "young men",
      "primary lesson",
      "youth lesson",
      "discourse",
      "presentation",
      "outline for",
      "help me write",
    ],
  },
];

/**
 * Determines if a sub-agent should handle the request based on keyword
 * matching against the user message. Returns the matching SubAgent or
 * null if the main chat agent should handle it directly.
 *
 * Skips routing when the current mode is already a specialized mode
 * (study-plan, multi-quiz, lesson-prep) since those are handled by
 * the main agent pipeline.
 */
export function routeToAgent(
  userMessage: string,
  currentMode: ChatMode
): SubAgent | null {
  // If already in a specialized mode, let the main agent handle it
  if (
    currentMode === "study-plan" ||
    currentMode === "multi-quiz" ||
    currentMode === "lesson-prep"
  ) {
    return null;
  }

  const lowerMessage = userMessage.toLowerCase();

  // Score each agent based on keyword matches
  let bestAgentId: string | null = null;
  let bestScore = 0;

  for (const { agentId, keywords } of ROUTE_PATTERNS) {
    let score = 0;
    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword)) {
        // Longer keywords are more specific and get higher weight
        score += keyword.length;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestAgentId = agentId;
    }
  }

  if (bestAgentId && bestScore > 0) {
    return SUB_AGENTS.get(bestAgentId) ?? null;
  }

  return null;
}

/**
 * Creates a one-shot chat with a sub-agent using the Gemini API.
 * Sends the user message with the sub-agent's specialized system prompt
 * and returns the complete text response.
 */
export async function createSubAgentChat(
  agent: SubAgent,
  settings: ApiProviderSettings,
  message: string
): Promise<string> {
  if (settings.provider !== "google") {
    throw new Error("Sub-agents currently only support the Google provider.");
  }

  if (!settings.googleApiKey) {
    throw new Error("Google API Key is not set.");
  }

  const ai = new GoogleGenAI({ apiKey: settings.googleApiKey });

  const response = await ai.models.generateContent({
    model: agent.model,
    contents: message,
    config: {
      systemInstruction: agent.systemPrompt,
    },
  });

  return response.text ?? "";
}
