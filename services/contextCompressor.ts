import type { Message } from '../types';
import { GoogleGenAI } from '@google/genai';

export function estimateTokens(messages: Message[]): number {
  return messages.reduce((total, m) => total + Math.ceil(m.text.length / 4), 0);
}

export function needsCompression(messages: Message[], threshold: number = 8000): boolean {
  return estimateTokens(messages) > threshold;
}

export async function compressContext(messages: Message[], apiKey: string, maxTokens: number = 8000): Promise<Message[]> {
  if (!apiKey || messages.length <= 10) return messages;

  const currentTokens = estimateTokens(messages);
  if (currentTokens <= maxTokens) return messages;

  // Keep last 10 messages intact, summarize the rest
  const recentMessages = messages.slice(-10);
  const oldMessages = messages.slice(0, -10);

  if (oldMessages.length === 0) return messages;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const conversationText = oldMessages
      .filter(m => !m.isSuggestion && m.id !== 'initial-message')
      .map(m => `${m.sender === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
      .join('\n');

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: conversationText,
      config: {
        systemInstruction: `Summarize this conversation segment concisely. Preserve: key questions asked, important facts learned, scriptures discussed, and decisions reached. Be concise - 2-3 paragraphs maximum.`,
        temperature: 0.3,
      },
    });

    const summary = response.text.trim();
    const summaryMessage: Message = {
      id: `compressed-${Date.now()}`,
      text: `[Previous conversation summary]\n${summary}`,
      sender: 'bot',
    };

    return [summaryMessage, ...recentMessages];
  } catch (e) {
    console.error('Context compression failed:', e);
    return messages;
  }
}
