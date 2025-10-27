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


export type ApiProvider = 'google' | 'lmstudio' | 'openrouter' | 'mcp';
export type ChatMode = 'chat' | 'thinking' | 'study-plan' | 'multi-quiz' | 'lesson-prep' | 'fhe-planner';
export type ViewMode = 'chat' | 'notes' | 'journal' | 'cross-reference' | 'scripture-reader';

export interface ApiProviderSettings {
  provider: ApiProvider;
  googleApiKey: string;
  openRouterApiKey: string;
  lmStudioBaseUrl: string;
  openRouterBaseUrl: string;
  mcpBaseUrl: string;
  model: string;
}

export interface Model {
  id: string;
  name?: string; // Optional name property
  isFree?: boolean;
}