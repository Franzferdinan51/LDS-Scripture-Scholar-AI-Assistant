/**
 * Sub-Agent Session Management
 *
 * Manages isolated conversation sessions for each sub-agent type.
 * Inspired by Hermes Agent's multi-agent architecture.
 */

import type { Message, ApiProviderSettings, ChatMode } from '../types';
import { SUB_AGENTS, type SubAgent } from './agentRouter';

export interface AgentSession {
  id: string;
  agent: SubAgent;
  messages: Message[];
  createdAt: number;
  lastActiveAt: number;
  turnCount: number;
  metadata: Record<string, unknown>;
}

/**
 * Manages active agent sessions and their contexts
 */
export class SubAgentSessionManager {
  private sessions: Map<string, AgentSession> = new Map();
  private currentSessionId: string | null = null;

  /**
   * Create a new agent session or return existing one for re-use
   */
  createSession(agentId: string): AgentSession {
    const agent = SUB_AGENTS.get(agentId);
    if (!agent) {
      throw new Error(`Unknown agent: ${agentId}`);
    }

    // Reuse existing session if available
    const existingSession = Array.from(this.sessions.values()).find(
      s => s.agent.id === agentId
    );
    if (existingSession) {
      existingSession.lastActiveAt = Date.now();
      return existingSession;
    }

    // Create new session
    const sessionId = `session-${agentId}-${Date.now()}`;
    const session: AgentSession = {
      id: sessionId,
      agent,
      messages: [],
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      turnCount: 0,
      metadata: {},
    };

    this.sessions.set(sessionId, session);
    this.currentSessionId = sessionId;
    return session;
  }

  /**
   * Get the current active session
   */
  getCurrentSession(): AgentSession | null {
    if (!this.currentSessionId) return null;
    return this.sessions.get(this.currentSessionId) || null;
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): AgentSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Add a message to the current session
   */
  addMessage(sessionId: string, message: Message): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.messages.push(message);
    session.lastActiveAt = Date.now();
  }

  /**
   * Increment turn count for a session
   */
  incrementTurns(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.turnCount++;
    }
  }

  /**
   * Get conversation history for a session
   */
  getHistory(sessionId: string): Message[] {
    const session = this.sessions.get(sessionId);
    return session ? [...session.messages] : [];
  }

  /**
   * Inject system prompt for the agent's specialized mode
   */
  getAgentSystemPrompt(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) return '';

    return session.agent.systemPrompt;
  }

  /**
   * Clear a specific session
   */
  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    if (this.currentSessionId === sessionId) {
      this.currentSessionId = null;
    }
  }

  /**
   * Clear all sessions
   */
  clearAll(): void {
    this.sessions.clear();
    this.currentSessionId = null;
  }

  /**
   * Get all active session IDs
   */
  getActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Get session metadata
   */
  getSessionMetadata(sessionId: string): Record<string, unknown> {
    const session = this.sessions.get(sessionId);
    return session?.metadata || {};
  }

  /**
   * Update session metadata
   */
  setSessionMetadata(sessionId: string, key: string, value: unknown): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.metadata[key] = value;
    }
  }
}

/**
 * Create a new SubAgentSessionManager instance
 */
export const createSubAgentSessionManager = (): SubAgentSessionManager =>
  new SubAgentSessionManager();