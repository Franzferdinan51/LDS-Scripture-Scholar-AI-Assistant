import { GoogleGenAI } from '@google/genai';
import type { ApiProviderSettings } from '../types';
import { parseJSON } from '../utils/jsonRepair';
import { getProviderDefaultModel, getProviderKeyLabel, normalizeApiProvider, providerSupportsOpenAIChatCompletions } from './providerCapabilities';

export interface CrossReferenceItem {
  scripture: string;
  explanation: string;
  connectionType?: 'doctrinal' | 'historical' | 'thematic' | 'prophetic';
}

export interface CrossReferenceResult {
  mainScripture: string;
  context?: string;
  references: CrossReferenceItem[];
  studySuggestions?: string[];
}

export const CROSS_REFERENCE_SYSTEM_INSTRUCTION = `You are an expert scripture cross-referencing tool for members of The Church of Jesus Christ of Latter-day Saints. Your task is to find and explain related scriptures for a given verse or passage. When analyzing, consider:
1. Doctrinal parallels - scriptures that teach the same principle
2. Historical context - related events or time periods
3. Thematic connections - shared themes like faith, atonement, covenant, repentance, prophecy, and discipleship
4. Prophetic commentary - where prophets reference or expand on the same ideas
5. Cross-standard work connections - links between the Bible, Book of Mormon, Doctrine and Covenants, and Pearl of Great Price

Return only a valid JSON object with this schema:
{
  "mainScripture": "The user's provided scripture reference",
  "context": "Brief historical or doctrinal context for the main scripture",
  "references": [
    { "scripture": "Reference string", "explanation": "Brief explanation", "connectionType": "doctrinal|historical|thematic|prophetic" }
  ],
  "studySuggestions": ["One or two suggestions for deeper study"]
}`.trim();

function getOpenAICompatibleSettings(settings: ApiProviderSettings): { baseUrl: string; apiKey: string; model: string } {
  const provider = normalizeApiProvider(settings.provider);

  switch (provider) {
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
        baseUrl: settings.minimaxBaseUrl || 'https://api.minimax.io/v1',
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

async function generateWithOpenAICompatibleProvider(
  settings: ApiProviderSettings,
  scripture: string
): Promise<CrossReferenceResult> {
  const { baseUrl, apiKey, model } = getOpenAICompatibleSettings(settings);
  const provider = normalizeApiProvider(settings.provider);

  if (!baseUrl) {
    throw new Error('Cross-references require a configured AI provider.');
  }

  if (!model) {
    throw new Error('Please select a model in Settings before using cross-references.');
  }

  const requiredKeyLabel = getProviderKeyLabel(provider);
  if (provider !== 'mcp' && requiredKeyLabel && !apiKey) {
    throw new Error(`${requiredKeyLabel} is required for cross-references. Please set it in Settings.`);
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
        { role: 'system', content: CROSS_REFERENCE_SYSTEM_INSTRUCTION },
        { role: 'user', content: scripture },
      ],
      temperature: 0.2,
      stream: false,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Cross-reference request failed with status ${response.status}${detail ? `: ${detail}` : ''}`);
  }

  const payload = await response.json();
  const rawText = payload?.choices?.[0]?.message?.content ?? '';
  return parseJSON(String(rawText).replace(/```json/g, '').replace(/```/g, '').trim());
}

async function generateWithGoogleProvider(
  settings: ApiProviderSettings,
  scripture: string
): Promise<CrossReferenceResult> {
  if (!settings.googleApiKey) {
    throw new Error('Google API key is not set.');
  }

  const ai = new GoogleGenAI({ apiKey: settings.googleApiKey });
  const response = await ai.models.generateContent({
    model: settings.model || getProviderDefaultModel('google'),
    contents: scripture,
    config: {
      systemInstruction: CROSS_REFERENCE_SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
    },
  });

  return parseJSON(response.text);
}

export async function getCrossReferencesForSettings(
  settings: ApiProviderSettings,
  scripture: string
): Promise<CrossReferenceResult> {
  const provider = normalizeApiProvider(settings.provider);

  if (provider === 'google') {
    return generateWithGoogleProvider(settings, scripture);
  }

  if (!providerSupportsOpenAIChatCompletions(provider)) {
    throw new Error('The selected provider does not support cross-references.');
  }

  return generateWithOpenAICompatibleProvider({ ...settings, provider }, scripture);
}

export async function getCrossReferences(
  apiKeyOrSettings: string | ApiProviderSettings,
  scripture: string
): Promise<CrossReferenceResult> {
  if (typeof apiKeyOrSettings === 'string') {
    return generateWithGoogleProvider(
      {
        provider: 'google',
        googleApiKey: apiKeyOrSettings,
        openRouterApiKey: '',
        lmStudioBaseUrl: 'http://localhost:1234/v1',
        lmStudioApiKey: '',
        openRouterBaseUrl: 'https://openrouter.ai/api/v1',
        mcpBaseUrl: 'http://localhost:8080/v1',
        minimaxBaseUrl: 'https://api.minimax.io/v1',
        minimaxApiKey: '',
        model: getProviderDefaultModel('google'),
      },
      scripture
    );
  }

  return getCrossReferencesForSettings(apiKeyOrSettings, scripture);
}
