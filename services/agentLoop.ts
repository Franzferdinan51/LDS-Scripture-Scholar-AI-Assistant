import type { Message, ChatMode, ApiProviderSettings, ToolCall } from '../types';
import { executeToolWithRetry } from './aiService';
import { buildSystemPrompt } from './promptBuilder';
import { ToolCallManager } from './toolCallManager';

export type AgentPhase = 'thinking' | 'planning' | 'acting' | 'reflecting' | 'responding' | 'done';

export interface AgentLoopOptions {
  messages: Message[];
  settings: ApiProviderSettings;
  mode: ChatMode;
  verbose?: boolean;
  persona?: string;
}

export interface AgentStep {
  phase: AgentPhase;
  content: string;
  toolCalls?: ToolCall[];
  timestamp: number;
}

/**
 * Full agent loop service inspired by Hermes Agent.
 * Replaces one-shot streaming with: think -> plan -> act -> reflect -> respond loop.
 */
export class AgentLoop {
  private messages: Message[];
  private settings: ApiProviderSettings;
  private mode: ChatMode;
  private verbose: boolean;
  private persona: string;
  private steps: AgentStep[] = [];
  private toolCallManager: ToolCallManager;

  constructor(options: AgentLoopOptions) {
    this.messages = options.messages;
    this.settings = options.settings;
    this.mode = options.mode;
    this.verbose = options.verbose ?? false;
    this.persona = options.persona ?? '';
    this.toolCallManager = new ToolCallManager();
  }

  /**
   * Run the full agent loop. Returns an async iterator that yields:
   * - Phase changes for UI indicators
   * - Text deltas for streaming display
   * - Tool call execution events
   * - Final response text
   */
  async *run(): AsyncGenerator<AgentLoopEvent> {
    this.steps = [];
    this.toolCallManager.reset();

    yield { type: 'phase', phase: 'thinking', content: 'Analyzing your question...' };

    const systemPrompt = this.buildSystemPrompt();
    const responseStream = await this.generateResponse(systemPrompt);

    let accumulatedText = '';
    let pendingFunctionCalls: any[] = [];
    let currentPhase: AgentPhase = 'responding';

    for await (const chunk of responseStream) {
      let text = '';
      try {
        text = typeof chunk.text === 'string' ? chunk.text : chunk.text != null ? String(chunk.text) : '';
      } catch {
        text = '';
      }

      if (!text) continue;

      accumulatedText += text;
      accumulatedText = accumulatedText.replace(/\bundefined\b/g, '');

      const newPhase = this.detectPhase(accumulatedText);
      if (newPhase !== currentPhase) {
        currentPhase = newPhase;
        yield { type: 'phase', phase: currentPhase, content: this.phaseLabel(currentPhase) };
      }

      const functionCalls = this.extractFunctionCalls(chunk);
      if (functionCalls.length > 0) {
        pendingFunctionCalls.push(...functionCalls);
        yield { type: 'tool_call_detected', toolCalls: functionCalls };
      }

      const cleanedText = text
        .replace(/<function=[^>]*>[\s\S]*?<\/function>/gi, '')
        .replace(/<function_call[^>]*>[\s\S]*?<\/function_call>/gi, '')
        .replace(/<tool_call[^>]*>[\s\S]*?<\/tool_call>/gi, '')
        .replace(/<\|im_start\|>[\s\S]*?<\|im_end\|>/gi, '')
        .replace(/<\|tool\|>[\s\S]*?<\|\/tool\|>/gi, '')
        .replace(/<\|im_start\|>[\s\S]*$/gi, '')
        .replace(/<\|tool\|>[\s\S]*$/gi, '')
        .replace(/\bundefined\b/g, '')
        .trim();

      if (cleanedText) {
        yield { type: 'text_delta', text: cleanedText, accumulatedText };
      }
    }

    if (pendingFunctionCalls.length > 0) {
      yield { type: 'phase', phase: 'acting', content: 'Executing tools...' };

      const toolResults = await this.executeToolCalls(pendingFunctionCalls);

      yield { type: 'phase', phase: 'reflecting', content: 'Processing results...' };

      const reflectedResponse = await this.generateResponseWithTools(
        systemPrompt,
        accumulatedText,
        toolResults
      );

      yield { type: 'phase', phase: 'responding', content: 'Generating response...' };

      for await (const chunk of reflectedResponse) {
        const text = typeof chunk.text === 'string' ? chunk.text : chunk.text != null ? String(chunk.text) : '';
        const cleanText = text.replace(/\bundefined\b/g, '');
        if (!cleanText) continue;
        yield { type: 'text_delta', text: cleanText, accumulatedText: cleanText };
        accumulatedText = cleanText;
      }
    }

    yield { type: 'phase', phase: 'done', content: 'Complete' };
    yield { type: 'final_response', text: accumulatedText };
  }

  private buildSystemPrompt(): string {
    const personaSection = this.persona ? `\n\n## User Persona\n${this.persona}\n` : '';
    const verboseSection = this.verbose
      ? '\n\n## Response Style\nProvide detailed, comprehensive responses with thorough explanations.'
      : '\n\n## Response Style\nBe concise but thorough.';
    const modeInstructions = this.getModeInstructions();

    return `You are a knowledgeable LDS scripture scholar assistant.${personaSection}${verboseSection}

${modeInstructions}

## Guidelines
- Cite specific scripture references (book, chapter, verse)
- Provide context and historical background when relevant
- Be faithful to the original text
- Use the available tools to search scriptures and find cross-references
${this.mode === 'thinking' ? '\n\n## Thinking Mode\nUse <thinking> tags to show your reasoning process.' : ''}`;
  }

  private getModeInstructions(): string {
    switch (this.mode) {
      case 'study-plan':
        return 'Create structured study plans in JSON format with daily sessions.';
      case 'multi-quiz':
        return 'Generate interactive quizzes in JSON format with multiple-choice questions.';
      case 'lesson-prep':
        return 'Prepare lesson outlines with discussion questions and points.';
      default:
        return 'Provide helpful, accurate responses about LDS scriptures and doctrines.';
    }
  }

  private detectPhase(text: string): AgentPhase {
    if (text.includes('<thinking>')) return 'thinking';
    if (text.includes('[Planning]') || text.includes('Step 1:')) return 'planning';
    if (text.includes('[Acting]') || text.includes('Let me search')) return 'acting';
    if (text.includes('[Reflecting]') || text.includes('Based on the results')) return 'reflecting';
    return 'responding';
  }

  private phaseLabel(phase: AgentPhase): string {
    switch (phase) {
      case 'thinking':
        return 'Thinking...';
      case 'planning':
        return 'Planning approach...';
      case 'acting':
        return 'Taking action...';
      case 'reflecting':
        return 'Reflecting on results...';
      case 'responding':
        return 'Generating response...';
      case 'done':
        return 'Complete';
    }
  }

  private extractFunctionCalls(chunk: any): any[] {
    if (chunk.functionCalls && chunk.functionCalls.length > 0) {
      return chunk.functionCalls;
    }

    if (chunk.function_call) {
      return [chunk.function_call];
    }

    if (chunk.tool_calls && chunk.tool_calls.length > 0) {
      return chunk.tool_calls.map((tc: any) => ({
        name: tc.function?.name || tc.name,
        args: tc.function?.arguments
          ? typeof tc.function.arguments === 'string'
            ? JSON.parse(tc.function.arguments)
            : tc.function.arguments
          : tc.arguments || {},
        id: tc.id,
      }));
    }

    return [];
  }

  private async generateResponse(systemPrompt: string): Promise<AsyncGenerator<any>> {
    const { createChatService } = await import('./aiService');
    const history: Message[] = this.messages.map(m => ({
      id: m.id,
      text: m.text,
      sender: m.sender as 'user' | 'bot',
    }));

    const service = createChatService(this.settings, this.mode, history);
    return service.sendMessageStream({ message: this.messages[this.messages.length - 1]?.text || '' });
  }

  private async generateResponseWithTools(
    systemPrompt: string,
    priorResponse: string,
    toolResults: ToolResult[]
  ): Promise<AsyncGenerator<any>> {
    const { createChatService } = await import('./aiService');
    const history: Message[] = this.messages.map(m => ({
      id: m.id,
      text: m.text,
      sender: m.sender as 'user' | 'bot',
    }));

    for (const tr of toolResults) {
      history.push({
        id: `tool-${Date.now()}`,
        text: `Tool ${tr.toolName} returned: ${JSON.stringify(tr.result)}`,
        sender: 'bot' as const,
      });
    }

    const service = createChatService(this.settings, this.mode, history);
    return service.sendMessageStream({
      message: 'Based on the tool results provided, give me a refined response.',
    });
  }

  private async executeToolCalls(functionCalls: any[]): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (const fc of functionCalls) {
      const name = fc.name || fc.function?.name;
      const args = fc.args || fc.function?.arguments || {};

      const toolCall: ToolCall = {
        id: `tc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        parameters: args,
        status: 'running',
      };

      this.toolCallManager.addToolCall(toolCall);

      try {
        const result = await executeToolWithRetry(name, args, this.settings);
        toolCall.status = 'completed';
        toolCall.result = result;
        this.toolCallManager.completeToolCall(toolCall.id, result);
        results.push({ toolName: name, result });
      } catch (e: any) {
        toolCall.status = 'error';
        toolCall.result = { success: false, data: null, error: String(e) };
        this.toolCallManager.failToolCall(toolCall.id, String(e));
        results.push({ toolName: name, result: { success: false, data: null, error: String(e) } });
        results.push({
          toolName: name,
          result: { success: false, data: null, error: `Tool "${name}" failed: ${String(e).substring(0, 200)}` },
        });
      }
    }

    return results;
  }

  getSteps(): AgentStep[] {
    return this.steps;
  }

  getToolCallManager(): ToolCallManager {
    return this.toolCallManager;
  }
}

export interface ToolResult {
  toolName: string;
  result: any;
}

export type AgentLoopEvent =
  | { type: 'phase'; phase: AgentPhase; content: string }
  | { type: 'text_delta'; text: string; accumulatedText: string }
  | { type: 'tool_call_detected'; toolCalls: any[] }
  | { type: 'tool_call_started'; toolCall: ToolCall }
  | { type: 'tool_call_completed'; toolCall: ToolCall; result: any }
  | { type: 'tool_call_failed'; toolCall: ToolCall; error: string }
  | { type: 'final_response'; text: string };
