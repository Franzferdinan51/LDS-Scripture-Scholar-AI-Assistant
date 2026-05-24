/**
 * Agent Types - Core type definitions for the LDS Scripture Scholar AI Assistant
 * Enhanced with streaming, tool calling, and state management patterns
 */

// ============================================================================
// Agent State Management
// ============================================================================

export type AgentStatus = 'idle' | 'thinking' | 'responding' | 'error' | 'loading';

export interface AgentState {
  status: AgentStatus;
  error: string | null;
  isStreaming: boolean;
  currentToolCall: ToolCall | null;
  conversationId: string;
  messageCount: number;
}

// ============================================================================
// Message Types
// ============================================================================

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  metadata?: MessageMetadata;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  isStreaming?: boolean;
}

export interface MessageMetadata {
  model?: string;
  tokens?: number;
  duration?: number;
  cached?: boolean;
  error?: boolean;
}

// ============================================================================
// Tool/Function Calling Types
// ============================================================================

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  status: 'pending' | 'executing' | 'completed' | 'error';
  result?: unknown;
  error?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
  required?: string[];
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  enum?: string[];
  required?: boolean;
}

// ============================================================================
// Scripture-Specific Types
// ============================================================================

export interface ScriptureReference {
  book: string;
  chapter: number;
  verseStart: number;
  verseEnd?: number;
  volume?: 'Book of Mormon' | 'Doctrine and Covenants' | 'Pearl of Great Price' | 'Old Testament' | 'New Testament';
}

export interface ScriptureLookupResult {
  reference: ScriptureReference;
  text: string;
  context?: string;
  crossReferences?: ScriptureReference[];
  footnotes?: string[];
}

export interface ScriptureSearchQuery {
  query: string;
  volume?: string;
  book?: string;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Streaming Types
// ============================================================================

export interface StreamChunk {
  type: 'text' | 'tool_call' | 'error' | 'done';
  content?: string;
  toolCall?: ToolCall;
  error?: string;
  metadata?: Partial<MessageMetadata>;
}

export interface StreamingCallbacks {
  onText?: (text: string) => void;
  onToolCall?: (toolCall: ToolCall) => void;
  onComplete?: (message: Message) => void;
  onError?: (error: Error) => void;
}

// ============================================================================
// Conversation Memory Types
// ============================================================================

export interface ConversationMemory {
  id: string;
  messages: Message[];
  context: ConversationContext;
  createdAt: number;
  updatedAt: number;
  tokenCount: number;
}

export interface ConversationContext {
  topics: string[];
  scriptureReferences: ScriptureReference[];
  userPreferences: UserPreferences;
  summary?: string;
}

export interface UserPreferences {
  language?: string;
  translation?: string;
  detailLevel?: 'concise' | 'standard' | 'detailed';
  includeCrossReferences?: boolean;
  includeFootnotes?: boolean;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface ChatRequest {
  messages: Message[];
  tools?: ToolDefinition[];
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
  conversationId?: string;
}

export interface ChatResponse {
  message: Message;
  conversationId: string;
  usage?: TokenUsage;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// ============================================================================
// Error Types
// ============================================================================

export class AgentError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

export class StreamError extends AgentError {
  constructor(message: string, public chunk?: StreamChunk) {
    super(message, 'STREAM_ERROR', undefined, true);
    this.name = 'StreamError';
  }
}

export class ToolExecutionError extends AgentError {
  constructor(
    message: string,
    public toolName: string,
    public toolCallId: string
  ) {
    super(message, 'TOOL_EXECUTION_ERROR', undefined, false);
    this.name = 'ToolExecutionError';
  }
}
