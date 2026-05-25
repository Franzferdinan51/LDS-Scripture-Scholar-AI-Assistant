export type Sender = 'user' | 'bot';

// Fix: Made 'uri' and 'title' optional to match the type from the @google/genai library.
export interface WebChunk {
  uri?: string;
  title?: string;
}

// Fix: Made 'uri' and 'title' optional for consistency and to prevent future errors.
export interface MapsChunk {
  uri?: string;
  title?: string;
}

export interface GroundingChunk {
  web?: WebChunk;
  maps?: MapsChunk;
}

export interface QuizOption {
  text: string;
}

// Represents a single question in a quiz
export interface QuizQuestion {
  question: string;
  options: (QuizOption | string)[];
  correctAnswerIndex: number;
  userAnswerIndex?: number;
}

// --- Tool Use Types ---

export interface ToolCall {
  id: string;
  name: string;
  parameters: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'error';
  result?: ToolResult;
}

export interface ToolResult {
  success: boolean;
  data: any;
  error?: string;
  source?: string;
}

// The message can contain a single quiz question
export interface Message {
  id: string;
  text: string;
  sender: Sender;
  thinking?: string; // For model's thought process
  quiz?: QuizQuestion; // For single-question quizzes
  multiQuiz?: MultiQuiz; // For multi-question quizzes
  studyPlan?: StudyPlan; // For interactive study plans
  groundingChunks?: GroundingChunk[];
  isSuggestion?: boolean;
  toolCalls?: ToolCall[]; // Tool invocations in this message
}

export interface StudyDay {
  day: number;
  topic: string;
  scriptures: string[];
  reflection_question: string;
}

export interface StudyPlan {
    title: string;
    days: StudyDay[];
}

export interface MultiQuiz {
    title: string;
    questions: QuizQuestion[];
}

export interface Note {
    id: string;
    content: string;
    timestamp: number;
}

export interface JournalEntry {
    id: string;
    originalText: string;
    summary?: string;
    principles?: string[];
    suggestedScripture?: string;
    timestamp: number;
}


export type ApiProvider = 'google' | 'lmstudio' | 'openrouter' | 'mcp' | 'minimax';
export type WebSearchProvider = 'duckduckgo' | 'tavily' | 'brave' | 'searxng' | 'google' | 'wikipedia' | 'churchofjesuschrist';
export type ChatMode = 'chat' | 'thinking' | 'study-plan' | 'multi-quiz' | 'lesson-prep' | 'fhe-planner';
export type ViewMode = 'chat' | 'notes' | 'journal' | 'cross-reference' | 'scripture-reader' | 'dashboard' | 'reminders' | 'skills';

export interface LmStudioMcpServer {
  server_label: string;
  server_url: string;
  allowed_tools?: string[];
}

export interface ApiProviderSettings {
  provider: ApiProvider;
  googleApiKey: string;
  openRouterApiKey: string;
  lmStudioBaseUrl: string;
  lmStudioApiKey: string;
  openRouterBaseUrl: string;
  mcpBaseUrl: string;
  mcpApiKey?: string;
  minimaxBaseUrl: string;
  minimaxApiKey: string;
  model: string;
  fallbackProvider?: ApiProvider;
  fallbackModel?: string;
  webSearchProvider?: WebSearchProvider;
  searxngUrl?: string;
  braveSearchApiKey?: string;
  googleSearchApiKey?: string;
  googleSearchCx?: string;
  tavilyApiKey?: string;
  lmStudioMcpServers?: LmStudioMcpServer[];
}

export interface Model {
  id: string;
  name?: string; // Optional name property
  isFree?: boolean;
}

// --- Memory System Types ---

export type MemoryType = 'episodic' | 'semantic' | 'preference';

export interface Memory {
  id: string;
  type: MemoryType;
  content: string;
  source: string; // conversation ID or 'system'
  relevance: number; // 0-1, decays over time
  timestamp: number;
  lastAccessed: number;
  accessCount: number;
  embedding?: number[];
}

export interface UserProfile {
  id?: string;
  studyLevel: 'beginner' | 'intermediate' | 'advanced';
  preferredBooks: string[];
  interests: string[];
  studyFrequency: 'daily' | 'weekly' | 'occasional';
  lastActiveDate: string;
  totalStudySessions: number;
  streakDays: number;
  longestStreak: number;
  lastStudyDate: string;
}

// --- Skills System Types ---

export interface Skill {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'study' | 'research' | 'teaching' | 'devotional';
  systemPromptAddition: string;
  requiredTools: string[];
  triggerPatterns?: string[]; // Serialized regex patterns
  // Effectiveness tracking (Hermes-inspired)
  useCount: number; // How many times this skill was used
  lastUsed: string | null; // ISO date of last use
  successCount: number; // How many times user marked it helpful
  avgRating: number; // 0-5 scale, rolling average
  isCustom: boolean; // true if user-created
}

// --- Study Analytics Types ---

export interface StudySession {
  id: string;
  chatId: string;
  date: string; // ISO date
  topic: string;
  book?: string;
  chapter?: number;
  duration?: number; // minutes
  messageCount: number;
  toolsUsed: string[];
  skillsUsed: string[];
}

export interface StudyStreak {
  current: number;
  longest: number;
  lastStudyDate: string;
  studyDates: string[]; // ISO dates of study days
}

// --- Reminder Types ---

export interface Reminder {
  id: string;
  type: 'daily-reading' | 'study-plan' | 'custom';
  title: string;
  message: string;
  schedule: {
    time: string; // HH:MM
    days: string[]; // ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  };
  enabled: boolean;
  lastTriggered?: number;
  createdAt: number;
}

// --- Search Types ---

export interface SearchResult {
  chatId: string;
  messageId: string;
  text: string;
  sender: string;
  timestamp: number;
  snippet: string;
  relevance: number;
}

// --- Thinking Depth ---

export type ThinkingDepth = 'light' | 'medium' | 'deep';

export const THINKING_BUDGETS: Record<ThinkingDepth, number> = {
  light: 1024,
  medium: 4096,
  deep: 16384,
};
