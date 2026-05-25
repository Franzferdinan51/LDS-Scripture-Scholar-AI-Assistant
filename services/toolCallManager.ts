import type { ToolCall } from '../types';

/**
 * Manages tool calls within a conversation context.
 * Shared between geminiService.ts and agentLoop.ts.
 */
export class ToolCallManager {
  private toolCalls: Map<string, ToolCall> = new Map();
  private conversationToolCalls: ToolCall[] = [];

  createToolCall(name: string, parameters: Record<string, unknown>): ToolCall {
    const id = `tc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const toolCall: ToolCall = { id, name, parameters, status: 'pending' };
    this.toolCalls.set(id, toolCall);
    return toolCall;
  }

  addToolCall(toolCall: ToolCall): void {
    this.toolCalls.set(toolCall.id, toolCall);
    this.conversationToolCalls.push(toolCall);
  }

  updateToolCall(id: string, update: Partial<ToolCall>): void {
    const tc = this.toolCalls.get(id);
    if (tc) {
      this.toolCalls.set(id, { ...tc, ...update });
    }
  }

  completeToolCall(id: string, result: any): void {
    this.updateToolCall(id, { status: 'completed', result });
  }

  failToolCall(id: string, error: string): void {
    this.updateToolCall(id, { status: 'error', result: { success: false, data: null, error } });
  }

  getToolCall(id: string): ToolCall | undefined {
    return this.toolCalls.get(id);
  }

  getAllToolCalls(): ToolCall[] {
    return [...this.toolCalls.values()];
  }

  getPendingToolCalls(): ToolCall[] {
    return this.getAllToolCalls().filter(tc => tc.status === 'pending' || tc.status === 'running');
  }

  getCompletedToolCalls(): ToolCall[] {
    return this.getAllToolCalls().filter(tc => tc.status === 'completed');
  }

  recordInConversation(toolCall: ToolCall): void {
    this.conversationToolCalls.push(toolCall);
  }

  getConversationToolCalls(): ToolCall[] {
    return [...this.conversationToolCalls];
  }

  /** Alias for clear() — used by agentLoop */
  reset(): void {
    this.clear();
  }

  clear(): void {
    this.toolCalls.clear();
    this.conversationToolCalls = [];
  }
}
