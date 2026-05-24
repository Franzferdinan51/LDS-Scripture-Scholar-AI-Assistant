/**
 * Agent TypeScript Types
 * Inspired by hermes-agent and openclaw patterns
 */

export type AgentStatus = 'idle' | 'thinking' | 'responding' | 'error' | 'retrying';

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  isError?: boolean;
  retryCount?: number;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolResult {
  toolCallId: string;
  result: string;
  isError?: boolean;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

export interface AgentConfig {
  apiKey: string;
  model: string;
  maxRetries: number;
  retryDelayMs: number;
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
}

export interface StreamChunk {
  id: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: 'function';
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: string | null;
  }>;
}

export interface ConversationContext {
  messages: AgentMessage[];
  maxMessages: number;
  summarizeThreshold: number;
}

export interface ScriptureReference {
  book: string;
  chapter: number;
  verse?: number;
  endVerse?: number;
  volume?: string;
}

export interface ScriptureLookupResult {
  reference: string;
  text: string;
  volume: string;
  book: string;
  chapter: number;
  verse: number;
}

export interface AgentState {
  status: AgentStatus;
  currentMessage: string;
  error: string | null;
  retryCount: number;
  isStreaming: boolean;
  streamedContent: string;
}

export interface AgentActions {
  sendMessage: (content: string) => Promise<void>;
  cancelStream: () => void;
  clearError: () => void;
  resetConversation: () => void;
  retryLastMessage: () => Promise<void>;
}

export type UseAgentReturn = {
  state: AgentState;
  actions: AgentActions;
  messages: AgentMessage[];
  isProcessing: boolean;
};