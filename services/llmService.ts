import { GoogleGenAI } from '@google/genai';
import type { ApiProviderSettings } from '../types';
import { parseJSON } from '../utils/jsonRepair';
import { getProviderDefaultModel } from './providerCapabilities';

export interface GenerateResponseOptions {
  systemInstruction: string;
  model?: string;
  temperature?: number;
  responseMimeType?: 'application/json' | 'text/plain';
}

function getProviderConnection(settings: ApiProviderSettings): { baseUrl: string; apiKey: string; model: string } {
  switch (settings.provider) {
    case 'google':
      return {
        baseUrl: '',
        apiKey: settings.googleApiKey,
        model: settings.model || getProviderDefaultModel('google'),
      };
    case 'lmstudio':
      return {
        baseUrl: settings.lmStudioBaseUrl,
        apiKey: settings.lmStudioApiKey || '',
        model: settings.model,
      };
    case 'openrouter':
      return {
        baseUrl: settings.openRouterBaseUrl,
        apiKey: settings.openRouterApiKey,
        model: settings.model,
      };
    case 'mcp':
      return {
        baseUrl: settings.mcpBaseUrl,
        apiKey: '',
        model: settings.model,
      };
    case 'minimax':
      return {
        baseUrl: settings.minimaxBaseUrl || 'https://api.minimax.chat/v1',
        apiKey: settings.minimaxApiKey || '',
        model: settings.model,
      };
    default:
      return {
        baseUrl: '',
        apiKey: '',
        model: settings.model,
      };
  }
}

export async function generateTextWithSettings(
  settings: ApiProviderSettings,
  userText: string,
  options: GenerateResponseOptions
): Promise<string> {
  const model = options.model || getProviderConnection(settings).model;
  if (!model) {
    throw new Error('Please select a model in Settings before using this feature.');
  }

  if (settings.provider === 'google') {
    if (!settings.googleApiKey) {
      throw new Error('Google API key is not set.');
    }

    const ai = new GoogleGenAI({ apiKey: settings.googleApiKey });
    const response = await ai.models.generateContent({
      model,
      contents: userText,
      config: {
        systemInstruction: options.systemInstruction,
        temperature: options.temperature,
        ...(options.responseMimeType ? { responseMimeType: options.responseMimeType } : {}),
      },
    });

    return (response.text || '').trim();
  }

  const { baseUrl, apiKey } = getProviderConnection(settings);
  if (!baseUrl) {
    throw new Error('Cross-provider generation requires a configured API base URL.');
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: options.systemInstruction },
        { role: 'user', content: userText },
      ],
      temperature: options.temperature ?? 0.3,
      stream: false,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Request failed with status ${response.status}${detail ? `: ${detail}` : ''}`);
  }

  const payload = await response.json();
  return String(payload?.choices?.[0]?.message?.content ?? '').trim();
}

export async function generateJsonWithSettings<T>(
  settings: ApiProviderSettings,
  userText: string,
  options: GenerateResponseOptions
): Promise<T> {
  const rawText = await generateTextWithSettings(settings, userText, {
    ...options,
    responseMimeType: 'application/json',
  });

  return parseJSON(rawText);
}
