import { GoogleGenAI, Chat, Session, LiveServerMessage, Modality, Type, GenerateContentResponse, Content, FunctionCall, FunctionResponse } from "@google/genai";
import { ApiProviderSettings, ChatMode, Model, Message, ThinkingDepth, THINKING_BUDGETS, UserProfile, Memory, Skill, ToolCall } from "../types";
import { buildSystemPrompt } from "./promptBuilder";
import { SCRIPTURE_TOOLS, getGeminiToolDeclarations, getOpenAIToolDeclarations } from "./tools";
import { executeTool } from "./toolExecutor";
import { getCrossReferences as getCrossReferencesCompat } from './crossReferenceService';
import { generateTextWithSettings, generateJsonWithSettings } from './llmService';
import { parseJSON } from "../utils/jsonRepair";
import { ToolCallManager } from './toolCallManager';
import { convertGeminiParamsToOpenAI } from './tools';
import { getProviderDefaultModel } from './providerCapabilities';

// ============================================================================
// HERMES/OPENCLAW ENHANCED AGENT PATTERNS
// ============================================================================

// --- Agent Instruction System ---
export interface AgentInstruction {
  id: string;
  name: string;
  description: string;
  instruction: string;
  triggerKeywords?: string[];
  priority: 'high' | 'medium' | 'low';
}

export interface ToolSchema {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, { type: string; description: string; default?: any }>;
    required?: string[];
  };
  resultSchema?: {
    success: { type: string; description: string };
    data: { type: string; description: string };
    error?: { type: string; description: string };
  };
}

// --- Enhanced Error Types ---
export class AgentError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoverable: boolean = true,
    public fallback?: string
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

export class ToolExecutionError extends AgentError {
  constructor(
    public toolName: string,
    message: string,
    public originalError?: unknown,
    recoverable: boolean = true
  ) {
    super(message, 'TOOL_EXECUTION_ERROR', recoverable);
    this.name = 'ToolExecutionError';
  }
}

export class ToolTimeoutError extends ToolExecutionError {
  constructor(toolName: string, timeout: number) {
    super(toolName, `Tool '${toolName}' execution timed out after ${timeout}ms`, undefined, true);
    this.code = 'TOOL_TIMEOUT';
    this.name = 'ToolTimeoutError';
  }
}

// --- Slash Command System ---
export interface SlashCommand {
  name: string;
  description: string;
  usage: string;
  example?: string;
  agentMode?: ChatMode; // Which chat mode this command activates
  instruction?: string; // Additional instruction when command is triggered
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    name: 'study',
    description: 'Start a deep study session on a topic or scripture',
    usage: '/study <topic or scripture>',
    example: '/study Alma 32',
    agentMode: 'chat'
  },
  {
    name: 'quiz',
    description: 'Start an interactive quiz on scripture knowledge',
    usage: '/quiz',
    example: '/quiz',
    agentMode: 'multi-quiz'
  },
  {
    name: 'explain',
    description: 'Get a detailed explanation of a verse or concept',
    usage: '/explain <verse or concept>',
    example: '/explain John 3:16',
    agentMode: 'chat'
  },
  {
    name: 'cross-ref',
    description: 'Find cross-references for a scripture',
    usage: '/cross-ref <scripture>',
    example: '/cross-ref 2 Nephi 2:25',
    agentMode: 'chat'
  },
  {
    name: 'search',
    description: 'Search scriptures for a topic or phrase',
    usage: '/search <query>',
    example: '/search faith',
    agentMode: 'chat'
  },
  {
    name: 'image',
    description: 'Find historical images related to a topic',
    usage: '/image <query>',
    example: '/image Salt Lake Temple',
    agentMode: 'chat'
  },
  {
    name: 'think',
    description: 'Use deep thinking mode for complex analysis',
    usage: '/think <question>',
    example: '/think Why do we need the Atonement?',
    agentMode: 'thinking'
  },
  {
    name: 'lesson',
    description: 'Prepare a lesson on a topic',
    usage: '/lesson <topic>',
    example: '/lesson faith',
    agentMode: 'lesson-prep'
  },
  {
    name: 'fhe',
    description: 'Plan a family home evening lesson',
    usage: '/fhe <topic>',
    example: '/fhe temple covenants',
    agentMode: 'fhe-planner'
  },
  {
    name: 'plan',
    description: 'Create a study plan for a topic',
    usage: '/plan <topic>',
    example: '/plan Book of Mormon',
    agentMode: 'study-plan'
  },
];

// Parse slash command from message
export function parseSlashCommand(message: string): { command: SlashCommand; args: string } | null {
  const trimmed = message.trim();
  if (!trimmed.startsWith('/')) return null;

  const spaceIdx = trimmed.indexOf(' ');
  const cmdName = spaceIdx === -1 ? trimmed.slice(1).toLowerCase() : trimmed.slice(1, spaceIdx).toLowerCase();
  const args = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1);

  const command = SLASH_COMMANDS.find(c => c.name === cmdName);
  return command ? { command, args } : null;
}

// --- Agent Instructions for different scenarios ---
const AGENT_INSTRUCTIONS: AgentInstruction[] = [
  {
    id: 'tool-use-guidance',
    name: 'Tool Use Guidance',
    description: 'Guidelines for when and how to use tools',
    instruction: `When handling tool calls:
1. Execute tools in order of dependency (tools that others depend on first)
2. If a tool fails, report the error clearly and suggest alternatives
3. Wait for all tool results before formulating final response
4. For multi-tool requests, acknowledge each tool call as it starts
5. Combine tool results into a coherent response`,
    triggerKeywords: ['search', 'find', 'look up', 'get scripture', 'cross-reference'],
    priority: 'high'
  },
  {
    id: 'scripture-context',
    name: 'Scripture Study Guidance',
    description: 'How to present scripture information',
    instruction: `When presenting scripture:
1. Always cite the complete reference (Book, Chapter:Verse)
2. Provide context about who wrote it and when
3. Connect to doctrinal principles
4. If multiple verses, explain the relationship between them
5. Suggest related topics for further study`,
    triggerKeywords: ['scripture', 'verse', 'chapter', 'book of mormon', 'bible', 'd&c'],
    priority: 'medium'
  },
  {
    id: 'error-recovery',
    name: 'Error Recovery',
    description: 'How to handle and recover from errors',
    instruction: `When an error occurs:
1. Acknowledge the error honestly
2. Explain what went wrong in user-friendly terms
3. Provide an alternative approach if possible
4. If tool failed, suggest manual alternatives
5. Never blame the user or external systems`,
    triggerKeywords: ['error', 'failed', 'cannot', 'unable', 'timeout'],
    priority: 'high'
  }
];

// --- Tool Schema Builder (Hermes/OpenClaw pattern) ---
export function buildToolSchemas(): ToolSchema[] {
  return SCRIPTURE_TOOLS.map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: {
      type: 'object',
      properties: tool.parameters.properties
        ? Object.entries(tool.parameters.properties).reduce((acc, [key, prop]: [string, any]) => {
            acc[key] = {
              type: geminiTypeToString(prop.type),
              description: prop.description || '',
              default: prop.default
            };
            return acc;
          }, {} as Record<string, { type: string; description: string; default?: any }>)
        : {},
      required: tool.parameters.required || []
    },
    resultSchema: {
      success: { type: 'boolean', description: 'Whether the tool executed successfully' },
      data: { type: 'object', description: 'The data returned by the tool' },
      error: { type: 'string', description: 'Error message if tool failed' }
    }
  }));
}

function geminiTypeToString(type: any): string {
  if (type === Type.STRING || type === 'STRING') return 'string';
  if (type === Type.NUMBER || type === 'NUMBER') return 'number';
  if (type === Type.BOOLEAN || type === 'BOOLEAN') return 'boolean';
  if (type === Type.OBJECT || type === 'OBJECT') return 'object';
  if (type === Type.ARRAY || type === 'ARRAY') return 'array';
  return 'string';
}

// --- Tool Execution with Retry and Error Handling ---
export interface ToolExecutionOptions {
  maxRetries?: number;
  timeout?: number;
  onStart?: (toolName: string) => void;
  onComplete?: (toolName: string, result: any) => void;
  onError?: (toolName: string, error: Error) => void;
}

const DEFAULT_TOOL_TIMEOUT = 30000; // 30 seconds
const DEFAULT_MAX_RETRIES = 2;

export async function executeToolWithRetry(
  toolName: string,
  args: Record<string, unknown>,
  settings: ApiProviderSettings,
  options: ToolExecutionOptions = {}
): Promise<{ success: boolean; data: any; error?: string }> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const timeout = options.timeout ?? DEFAULT_TOOL_TIMEOUT;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Track tool start
      options.onStart?.(toolName);

      // Execute with timeout
      const result = await Promise.race([
        executeTool(toolName, args, settings),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new ToolTimeoutError(toolName, timeout)), timeout)
        )
      ]);

      // Track completion
      options.onComplete?.(toolName, result);

      return result;
    } catch (e) {
      lastError = e as Error;

      // Track error
      options.onError?.(toolName, lastError);

      // Don't retry if it's a timeout or non-recoverable error
      if (lastError instanceof ToolTimeoutError || !isRetryableError(lastError)) {
        break;
      }

      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  // All retries exhausted
  return {
    success: false,
    data: null,
    error: lastError?.message || 'Tool execution failed after multiple retries'
  };
}

function isRetryableError(error: Error): boolean {
  // Network errors and temporary failures are retryable
  const retryableCodes = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'];
  const retryableMessages = ['network', 'timeout', 'connection', 'temporarily unavailable'];

  const msg = error.message.toLowerCase();
  return retryableCodes.some(code => msg.includes(code.toLowerCase())) ||
         retryableMessages.some(m => msg.includes(m));
}

// ============================================================================
// SYSTEM INSTRUCTIONS
// ============================================================================

const JOURNAL_SUMMARY_SYSTEM_INSTRUCTION = `You are an insightful and gentle gospel assistant. A user has just finished a voice journal entry. Your task is to analyze their transcribed thoughts and provide helpful insights. You must respond with ONLY a valid JSON object. Do not add any other text. The JSON response must follow this schema:
{
  "summary": "A concise, one-paragraph summary of the user's main thoughts.",
  "principles": ["A list of 2-3 key gospel principles or themes identified in the entry."],
  "suggestedScripture": "A single, relevant scripture reference (e.g., 'Alma 32:21') that relates to their journal entry, for their further study."
}`;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const toGeminiHistory = (history: Message[]): Content[] => {
    const relevantMessages = history.filter(m => !m.isSuggestion && m.id !== 'initial-message');
    return relevantMessages.map(msg => {
        const parts: any[] = [{ text: msg.text }];
        // If message has tool calls with results, include them (Hermes pattern)
        if (msg.toolCalls && msg.toolCalls.length > 0) {
            for (const tc of msg.toolCalls) {
                if (tc.status === 'completed' && tc.result) {
                    parts.push({
                        functionResponse: {
                            name: tc.name,
                            response: tc.result,
                        }
                    });
                }
            }
        }
        return {
            role: msg.sender === 'user' ? 'user' : 'model',
            parts,
        };
    }).filter(c => c.parts[0].text);
};

// --- Enhanced Chat Service with Function Calling ---

export interface ChatServiceOptions {
  profile?: UserProfile | null;
  memories?: Memory[];
  activeSkill?: Skill | null;
  readingContext?: string;
  thinkingDepth?: ThinkingDepth;
  verbose?: boolean;
  persona?: string;
  toolCallManager?: ToolCallManager;
  enableSlashCommands?: boolean;
  agentSystemPrompt?: string;
}

// --- Build Enhanced System Instruction with Agent Guidance ---
function buildEnhancedSystemInstruction(
  chatMode: ChatMode,
  profile: UserProfile | null,
  memories: Memory[] | undefined,
  activeSkill: Skill | null | undefined,
  readingContext: string | undefined,
  options: { verbose?: boolean; persona?: string; agentSystemPrompt?: string }
): string {
  let baseInstruction = buildSystemPrompt(chatMode, profile, memories, activeSkill, readingContext, options);

  // Add agent instruction guidance for chat mode
  if (chatMode === 'chat' || chatMode === 'thinking') {
    const instructionGuidance = AGENT_INSTRUCTIONS
      .filter(i => i.priority === 'high')
      .map(i => i.instruction)
      .join('\n\n');

    baseInstruction += `\n\n=== AGENT GUIDELINES ===\n${instructionGuidance}`;
  }

  // Inject sub-agent specific system prompt if provided
  if (options.agentSystemPrompt) {
    baseInstruction += `\n\n=== ACTIVE AGENT ROLE ===\n${options.agentSystemPrompt}`;
  }

  return baseInstruction;
}

// ============================================================================
// CHAT SERVICE FACTORY
// ============================================================================

export const createChatService = (
    settings: ApiProviderSettings,
    chatMode: ChatMode,
    history: Message[],
    options: ChatServiceOptions = {}
) => {
    // Handle slash commands if enabled
    if (options.enableSlashCommands !== false) {
      const slashResult = parseSlashCommand(history[history.length - 1]?.text || '');
      if (slashResult) {
        // Route to appropriate chat mode based on command
        if (slashResult.command.agentMode && slashResult.command.agentMode !== chatMode) {
          // Would need to switch modes - for now just prepend instruction
        }
      }
    }

    if (settings.provider === 'google') {
        return createGoogleChatService(settings, chatMode, history, options);
    } else {
        return createOpenAICompatibleChatService(settings, chatMode, history, options);
    }
};

// --- Google (Gemini) Chat Service ---
function createGoogleChatService(
  settings: ApiProviderSettings,
  chatMode: ChatMode,
  history: Message[],
  options: ChatServiceOptions
) {
  if (!settings.googleApiKey) throw new Error("Google API Key is not set.");

  const ai = new GoogleGenAI({ apiKey: settings.googleApiKey });
  const toolCallManager = options.toolCallManager || new ToolCallManager();

  const modelName = ['study-plan', 'multi-quiz', 'lesson-prep', 'fhe-planner'].includes(chatMode)
      ? 'gemini-2.5-pro'
      : settings.model || getProviderDefaultModel('google');

  const systemInstruction = buildEnhancedSystemInstruction(
      chatMode,
      options.profile,
      options.memories,
      options.activeSkill,
      options.readingContext,
      { verbose: options.verbose, persona: options.persona, agentSystemPrompt: options.agentSystemPrompt }
  );

  // Build tools config with proper schema
  const tools: any[] = [{ googleSearch: {} }];

  if (chatMode === 'chat' || chatMode === 'thinking') {
      const functionDeclarations = getGeminiToolDeclarations();
      if (functionDeclarations.length > 0) {
          tools.push({ functionDeclarations });
      }
  }

  const config: any = {
      systemInstruction,
      tools,
  };

  if (chatMode === 'thinking' && options.thinkingDepth) {
      config.thinkingConfig = {
          thinkingBudget: THINKING_BUDGETS[options.thinkingDepth],
      };
  }

  const chat = ai.chats.create({
      model: modelName,
      history: toGeminiHistory(history),
      config,
  });

  return {
      sendMessageStream: async ({ message }: { message: string }) => {
          return chat.sendMessageStream({ message });
      },

      handleToolCalls: async (response: GenerateContentResponse): Promise<GenerateContentResponse | null> => {
          const functionCalls = response.functionCalls;
          if (!functionCalls || functionCalls.length === 0) return null;

          const functionResponses: FunctionResponse[] = [];

          for (const fc of functionCalls) {
              const toolCall = toolCallManager.createToolCall(fc.name, fc.args || {});
              toolCallManager.updateToolCall(toolCall.id, { status: 'running' });
              toolCallManager.recordInConversation(toolCall);

              try {
                  const result = await executeToolWithRetry(
                    fc.name,
                    fc.args || {},
                    settings,
                    {
                      onStart: (name) => console.log(`[Tool] Starting: ${name}`),
                      onComplete: (name, res) => console.log(`[Tool] Completed: ${name}`),
                      onError: (name, err) => console.error(`[Tool] Error: ${name}`, err),
                    }
                  );

                  toolCallManager.completeToolCall(toolCall.id, result);

                  functionResponses.push({
                      name: fc.name,
                      response: result as unknown as Record<string, unknown>,
                  });
              } catch (e) {
                  const errorResult = { success: false, data: null, error: String(e) };
                  toolCallManager.failToolCall(toolCall.id, String(e));

                  functionResponses.push({
                      name: fc.name,
                      response: errorResult,
                  });
              }
          }

          // Send function responses back to model for continued conversation
          const followUp = await chat.sendMessageStream({
              message: functionResponses.map(fr => ({
                  functionResponse: fr,
              }) as any),
          } as any);

          return followUp as any;
      },

      getToolCalls: () => toolCallManager.getConversationToolCalls(),

      getToolCallManager: () => toolCallManager,
  };
}

// --- OpenAI Compatible Chat Service ---
function createOpenAICompatibleChatService(
  settings: ApiProviderSettings,
  chatMode: ChatMode,
  history: Message[],
  options: ChatServiceOptions
) {
  let baseUrl = '';
  let apiKey = '';

  switch(settings.provider) {
      case 'lmstudio':
          baseUrl = settings.lmStudioBaseUrl;
          apiKey = settings.lmStudioApiKey || '';
          break;
      case 'openrouter':
          baseUrl = settings.openRouterBaseUrl;
          apiKey = settings.openRouterApiKey;
          break;
      case 'mcp': baseUrl = settings.mcpBaseUrl; break;
      case 'minimax':
          baseUrl = settings.minimaxBaseUrl || 'https://api.minimax.chat/v1';
          apiKey = settings.minimaxApiKey || '';
          break;
  }

  const toolCallManager = options.toolCallManager || new ToolCallManager();

  const sendMessageStream = async function* ({ message }: { message: string }): AsyncGenerator<any> {
      const systemInstruction = buildEnhancedSystemInstruction(
          chatMode,
          options.profile,
          options.memories,
          options.activeSkill,
          options.readingContext,
          { verbose: options.verbose, persona: options.persona, agentSystemPrompt: options.agentSystemPrompt }
      );

      const currentDateNote = `\n\nCurrent date: ${new Date().toISOString().split('T')[0]}. For time-sensitive questions, note that you may not have real-time information access. Use your available search/retrieval tools whenever possible for current or recent topics.`;
      const msgs = [
          { role: 'system', content: systemInstruction + currentDateNote },
          ...history.filter(m => m.id !== 'initial-message' && m.text).map(m => ({
              role: m.sender === 'user' ? 'user' as const : 'assistant' as const,
              content: m.text
          })),
          { role: 'user' as const, content: message }
      ];

      // Build OpenAI-format tools with enhanced schema
      const openaiTools = chatMode === 'chat' || chatMode === 'thinking'
          ? SCRIPTURE_TOOLS.map(t => ({
              type: 'function',
              function: {
                  name: t.name,
                  description: t.description,
                  parameters: convertGeminiParamsToOpenAI(t.parameters),
              }
          }))
          : undefined;

      const body: any = {
          model: settings.model,
          messages: msgs,
          stream: true,
      };

      if (openaiTools && openaiTools.length > 0) {
          body.tools = openaiTools;
          // Enhanced tool calling configuration (OpenClaw pattern)
          body.tool_choice = 'auto';
      }

  // LM Studio 0.4.0+ MCP integration
  if (settings.provider === 'lmstudio') {
    const integrations: any[] = [];

    // Add MCP servers from settings
    if (settings.lmStudioMcpServers && settings.lmStudioMcpServers.length > 0) {
      for (const server of settings.lmStudioMcpServers) {
        integrations.push({
          type: 'ephemeral_mcp',
          server_label: server.server_label,
          server_url: server.server_url,
          ...(server.allowed_tools && server.allowed_tools.length > 0
            ? { allowed_tools: server.allowed_tools }
            : {}),
        });
      }
    }

    // Also add the global mcpBaseUrl if set and not already in lmStudioMcpServers
    if (settings.mcpBaseUrl) {
      const mcpUrl = settings.mcpBaseUrl.replace(/\/v1\/?$/, '/sse');
      const alreadyAdded = integrations.some(
        (i: any) => i.server_url === mcpUrl
      );
      if (!alreadyAdded) {
        integrations.push({
          type: 'ephemeral_mcp',
          server_label: 'scripture-scholar-mcp',
          server_url: mcpUrl,
          allowed_tools: ['search_lds_sources', 'search_web'],
        });
      }
    }

    if (integrations.length > 0) {
      body.integrations = integrations;
    }
  }
      const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              ...(apiKey && { 'Authorization': `Bearer ${apiKey}` })
          },
          body: JSON.stringify(body)
      });

      if (!response.body) throw new Error("Response body is null");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';

      while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
              if (line.startsWith('data: ')) {
                  const jsonStr = line.substring(6);
                  if (jsonStr.trim() === '[DONE]') {
                      return;
                  }
                  try {
                      const chunk = JSON.parse(jsonStr);
                      const delta = chunk.choices?.[0]?.delta;

              // Handle text content - use typeof guard to prevent "undefined" string leaking
              const rawText = delta?.content;
              const text = (typeof rawText === 'string' && rawText !== 'undefined') ? rawText : '';
              if (text) {
                // Filter out raw function call XML that some models (LM Studio/MiniMax) emit as text
                if (/<function=|<\/function>|<tool_call|<\/tool_call>|<function_call|<\/function_call>|<invoke|<tool_response|<python-repl|<\/invoke|<\/tool_response|<\/python-repl>|<\|im_start\|>|<\|tool\|>|<scratchpad|<thought|\[TOOL_CALL:/i.test(text)) {
                  console.warn('[Stream] Filtering out raw function XML from text output:', text.substring(0, 80));
                  continue;
          // Filter JSON-style tool calls that some models emit
          if (/^\s*\{\s*"(name|function|tool_calls)"\s*:/i.test(text.trim())) {
            console.warn('[Stream] Filtering out raw JSON tool call from text output:', text.substring(0, 80));
            continue;
          }
                }
                accumulatedText += text;
                yield { text, isDelta: true } as any;
              }

                      // Handle tool calls with proper tracking (Hermes/OpenClaw pattern)
                      if (delta?.tool_calls) {
                          for (const tc of delta.tool_calls) {
                              const idx = tc.index ?? 0;
                              const id = tc.id || `tc-${Date.now()}-${idx}`;

                              if (tc.function?.name) {
                                  const toolCall = toolCallManager.createToolCall(tc.function.name, {});
                                  toolCall.id = id;
                                  toolCallManager.updateToolCall(id, { status: 'pending' });
                                  yield { toolCall: { id, name: tc.function.name, status: 'pending' }, isToolCall: true } as any;
                              }

                              if (tc.function?.arguments) {
                                  const existing = toolCallManager.getToolCall(id);
                                  if (existing) {
                                      try {
                                          const args = JSON.parse(tc.function.arguments);
                                          toolCallManager.updateToolCall(id, { parameters: args });
                                      } catch {
                                          // Arguments may be partial - accumulate
                                          const currentParams = existing.parameters || {};
                                          try {
                                            const partialArgs = JSON.parse(tc.function.arguments);
                                            toolCallManager.updateToolCall(id, {
                                              parameters: { ...currentParams, ...partialArgs }
                                            });
                                          } catch {
                                            // Ignore - will be complete on finish
                                          }
                                      }
                                  }
                              }
                          }
                      }

                      // Handle finish_reason for tool calls
                      const finishReason = chunk.choices?.[0]?.finish_reason;
                      if (finishReason === 'tool_calls') {
                          // Execute all pending tool calls with retry
                          const pendingCalls = toolCallManager.getPendingToolCalls();

                          for (const tc of pendingCalls) {
                              toolCallManager.updateToolCall(tc.id, { status: 'running' });
                              yield { toolCall: { id: tc.id, name: tc.name, status: 'running' }, isToolCall: true } as any;

                              try {
                                  const result = await executeToolWithRetry(
                                    tc.name,
                                    tc.parameters,
                                    settings,
                                    {
                                      onStart: (name) => console.log(`[Tool] Starting: ${name}`),
                                      onError: (name, err) => console.error(`[Tool] Error: ${name}`, err),
                                    }
                                  );

                                  toolCallManager.completeToolCall(tc.id, result);
                                  yield { toolCall: { id: tc.id, name: tc.name, status: 'completed', result }, isToolCallComplete: true } as any;
                              } catch (e) {
                                  const errorResult = { success: false, data: null, error: String(e) };
                                  toolCallManager.failToolCall(tc.id, String(e));
                                  yield { toolCall: { id: tc.id, name: tc.name, status: 'error', result: errorResult }, isToolCallComplete: true } as any;
                              }
                          }

                          // Build function call messages for follow-up
                          const toolMsgs = [...msgs];
                          toolMsgs.push({
                              role: 'assistant' as const,
                              content: null as any,
                              tool_calls: pendingCalls.map(tc => ({
                                  id: tc.id,
                                  type: 'function',
                                  function: {
                                      name: tc.name,
                                      arguments: JSON.stringify(tc.parameters),
                                  }
                              }))
                          } as any);

                          for (const tc of pendingCalls) {
                              toolMsgs.push({
                                  role: 'tool' as any,
                                  tool_call_id: tc.id,
                                  content: JSON.stringify(tc.result || { error: 'No result' }),
                              } as any);
                          }

                          // Record in conversation
                          for (const tc of pendingCalls) {
                            toolCallManager.recordInConversation(tc);
                          }

                          // Send follow-up request (non-streaming for tool results)
                          const followUpBody = {
                              model: settings.model,
                              messages: toolMsgs,
                              stream: false,
                          };

                          const followUpResp = await fetch(`${baseUrl}/chat/completions`, {
                              method: 'POST',
                              headers: {
                                  'Content-Type': 'application/json',
                                  ...(apiKey && { 'Authorization': `Bearer ${apiKey}` })
                              },
                              body: JSON.stringify(followUpBody)
                          });

                          if (followUpResp.ok) {
                              const followUpData = await followUpResp.json();
          const rawFollowUpText = followUpData.choices?.[0]?.message?.content || '';
          const followUpText = rawFollowUpText
            .replace(/<function_call[^>]*>[\s\S]*?<\/function_call>/gi, '')
            .replace(/<tool_call[^>]*>[\s\S]*?<\/tool_call>/gi, '')
            .replace(/<\|im_start\|>[\s\S]*?<\|im_end\|>/gi, '')
            .replace(/<\|tool\|>[\s\S]*?<\|\/tool\|>/gi, '')
            .replace(/<\|im_start\|>[\s\S]*$/gi, '')
            .replace(/<\|tool\|>[\s\S]*$/gi, '')
            .replace(/\bundefined\b/g, '')
            .trim();
                              if (followUpText) {
                                  yield { text: followUpText, isFinal: true } as any;
                              }
                          }
                      }
                  } catch (e) {
                      console.error('Error parsing stream chunk:', e, jsonStr);
                  }
              }
          }
      }
  };

  return {
      sendMessageStream,
      handleToolCalls: async () => null,
      getToolCalls: () => toolCallManager.getConversationToolCalls(),
      getToolCallManager: () => toolCallManager,
  };
}

// --- Multi-Provider Failover ---

export const createChatServiceWithFailover = (
    settings: ApiProviderSettings,
    chatMode: ChatMode,
    history: Message[],
    options: ChatServiceOptions = {}
) => {
    try {
        return createChatService(settings, chatMode, history, options);
    } catch (e) {
        // Try fallback provider
        if (settings.fallbackProvider && settings.fallbackModel) {
            console.warn('Primary provider failed, trying fallback:', e);
            const fallbackSettings: ApiProviderSettings = {
                ...settings,
                provider: settings.fallbackProvider,
                model: settings.fallbackModel,
            };
            return createChatService(fallbackSettings, chatMode, history, options);
        }
        throw e;
    }
};

// ============================================================================
// EXISTING EXPORTS (unchanged)
// ============================================================================

export const connectLive = (apiKey: string, callbacks: any, systemInstruction?: string): Promise<Session> => {
    if (!apiKey) throw new Error("Google API Key is not set for Live Connect.");
    const ai = new GoogleGenAI({ apiKey });

    if (systemInstruction && systemInstruction.includes('transcription assistant')) {
         return ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            callbacks,
            config: {
                inputAudioTranscription: {},
                systemInstruction: systemInstruction,
            },
        });
    }

    return ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks,
        config: {
            responseModalities: [Modality.AUDIO],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
        },
    });
};

export const generateSpeech = async (apiKey: string, text: string): Promise<string> => {
    if (!apiKey) throw new Error("Google API Key is not set for TTS.");
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' },
                },
            },
        },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
        throw new Error("No audio data received from API.");
    }
    return base64Audio;
};

export const getJournalInsights = async (settings: ApiProviderSettings, text: string): Promise<any> => {
    if (!settings) throw new Error("Provider settings are not configured for Journal Insights.");
    return generateJsonWithSettings(settings, text, {
        systemInstruction: JOURNAL_SUMMARY_SYSTEM_INSTRUCTION,
        model: settings.model || undefined,
        temperature: 0.2,
    });
};

export const getProactiveSuggestion = async (settings: ApiProviderSettings, history: Content[]): Promise<string | null> => {
    if (!settings || history.length === 0) return null;
    try {
        const conversationText = history
            .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${(msg.parts || []).map(part => ('text' in part ? part.text : '')).join(' ')}`)
            .join('\n');
        let suggestion = await generateTextWithSettings(settings, conversationText, {
            systemInstruction: `You are a helpful assistant. Based on this short conversation history, suggest ONE concise and relevant follow-up question the user might be interested in asking. The suggestion should be a question. Do not add any preamble. Respond with only the question text.`,
            temperature: 0.8,
            model: settings.model || undefined,
        });
        if (suggestion.startsWith('"') && suggestion.endsWith('"')) {
            suggestion = suggestion.substring(1, suggestion.length - 1);
        }
        return suggestion;
    } catch (e) {
        console.error("Failed to get proactive suggestion:", e);
        return null;
    }
};

export const getWikimediaImageUrl = async (filename: string): Promise<string> => {
    const WIKIMEDIA_API_ENDPOINT = "https://commons.wikimedia.org/w/api.php";
    const params = new URLSearchParams({
        action: "query",
        prop: "imageinfo",
        titles: filename,
        iiprop: "url",
        format: "json",
        origin: "*"
    });
    const response = await fetch(`${WIKIMEDIA_API_ENDPOINT}?${params.toString()}`);
    if (!response.ok) throw new Error(`Wikimedia API error: ${response.statusText}`);
    const data = await response.json();
    const pages = data.query.pages;
    const pageId = Object.keys(pages)[0];
    if (pageId === "-1" || !pages[pageId].imageinfo) {
        throw new Error("Image not found on Wikimedia Commons.");
    }
    return pages[pageId].imageinfo[0].url;
};

// Pre-populated model lists for providers that don't have a standard /models endpoint
const MINIMAX_MODELS: Model[] = [
  { id: 'MiniMax-M1', name: 'MiniMax M1 (Reasoning)' },
  { id: 'MiniMax-Text-01', name: 'MiniMax Text 01' },
  { id: 'abab6.5s-chat', name: 'Abab 6.5s Chat' },
];

export const fetchModels = async (settings: ApiProviderSettings): Promise<Model[]> => {
    // MiniMax uses pre-populated models (no standard /models endpoint)
    if (settings.provider === 'minimax') {
        return MINIMAX_MODELS;
    }

    let url: string;
    let headers: Record<string, string> = {};

    switch (settings.provider) {
        case 'lmstudio':
            url = `${settings.lmStudioBaseUrl}/models`;
            if (settings.lmStudioApiKey) {
                headers['Authorization'] = `Bearer ${settings.lmStudioApiKey}`;
            }
            break;
        case 'mcp':
            url = `${settings.mcpBaseUrl}/models`;
            break;
        case 'openrouter':
            url = `${settings.openRouterBaseUrl}/models`;
            headers['Authorization'] = `Bearer ${settings.openRouterApiKey}`;
            break;
        default:
            return [];
    }

    try {
        const response = await fetch(url, { headers });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch models: ${response.status} ${errorText}`);
        }
        const data = await response.json();

        if (settings.provider === 'openrouter') {
            return data.data.map((model: any) => ({
                id: model.id,
                name: model.name || model.id,
                isFree: model.pricing?.prompt === "0" && model.pricing?.completion === "0"
            })).sort((a: Model, b: Model) => (a.name || '').localeCompare(b.name || ''));
        } else {
            return data.data.map((model: any) => ({
                id: model.id,
                name: model.id,
                isFree: true
            })).sort((a: Model, b: Model) => (a.name || '').localeCompare(b.name || ''));
        }
    } catch (e: any) {
        if (e.message?.includes('Failed to fetch') || e.name === 'TypeError') {
            throw new Error(`Cannot reach ${url}. Make sure the server is running and CORS is configured.`);
        }
        throw e;
    }
};

export const testMCPConnection = async (baseUrl: string): Promise<{ success: boolean; message: string }> => {
    try {
        const response = await fetch(`${baseUrl}/models`);
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Could not read error body.');
            return { success: false, message: `Connection failed with status ${response.status}: ${errorText}` };
        }
        const data = await response.json();
        const modelCount = data.data?.length || 0;
        return { success: true, message: `Connection successful! Found ${modelCount} models.` };
    } catch (e) {
        if (e instanceof TypeError && e.message === 'Failed to fetch') {
            return { success: false, message: `Could not reach the server at ${baseUrl}. Is it running and is CORS configured correctly?` };
        }
        if (e instanceof Error) {
            return { success: false, message: `Connection failed: ${e.message}` };
        }
        return { success: false, message: "An unknown error occurred during connection test." };
    }
};

export const getCrossReferences = getCrossReferencesCompat;
