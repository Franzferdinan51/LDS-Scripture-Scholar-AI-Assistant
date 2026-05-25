import type { ApiProvider } from '../types';

export interface ProviderCapabilityInfo {
  id: ApiProvider;
  title: string;
  shortLabel: string;
  description: string;
  note: string;
  keyLabel: string;
  baseUrlLabel?: string;
  defaultModel?: string;
  environment: 'cloud' | 'local' | 'bridge';
  supportsLiveVoice: boolean;
  supportsTextToSpeech: boolean;
  supportsModelDiscovery: boolean;
  supportsOpenAIChatCompletions: boolean;
}

const PROVIDER_CAPABILITIES: Record<ApiProvider, ProviderCapabilityInfo> = {
  google: {
    id: 'google',
    title: 'Google AI',
    shortLabel: 'Cloud',
    description: 'Best for the built-in live voice, grounding, and the fastest end-to-end experience.',
    note: 'Use a Google API key for Google-only live voice and TTS features.',
    keyLabel: 'Google API key',
    defaultModel: 'gemini-2.5-flash',
    environment: 'cloud',
    supportsLiveVoice: true,
    supportsTextToSpeech: true,
    supportsModelDiscovery: false,
    supportsOpenAIChatCompletions: false,
  },
  lmstudio: {
    id: 'lmstudio',
    title: 'LM Studio',
    shortLabel: 'Local',
    description: 'Run local models on your machine for privacy and offline experimentation.',
    note: 'Enter your local server URL, then refresh models from the running LM Studio instance.',
    keyLabel: 'LM Studio API key',
    baseUrlLabel: 'Base URL',
    environment: 'local',
    supportsLiveVoice: false,
    supportsTextToSpeech: false,
    supportsModelDiscovery: true,
    supportsOpenAIChatCompletions: true,
  },
  openrouter: {
    id: 'openrouter',
    title: 'OpenRouter',
    shortLabel: 'Cloud',
    description: 'Use hosted models from multiple vendors through one API.',
    note: 'Refresh the model list after adding your API key to browse available models.',
    keyLabel: 'OpenRouter API key',
    baseUrlLabel: 'Base URL',
    environment: 'cloud',
    supportsLiveVoice: false,
    supportsTextToSpeech: false,
    supportsModelDiscovery: true,
    supportsOpenAIChatCompletions: true,
  },
  mcp: {
    id: 'mcp',
    title: 'Docker MCP Toolkit',
    shortLabel: 'Bridge',
    description: 'Connect to a local MCP endpoint that exposes compatible models or tools.',
    note: 'Set the base URL and test the connection before choosing a model.',
    keyLabel: 'MCP access key',
    baseUrlLabel: 'Base URL',
    environment: 'bridge',
    supportsLiveVoice: false,
    supportsTextToSpeech: false,
    supportsModelDiscovery: true,
    supportsOpenAIChatCompletions: true,
  },
  minimax: {
    id: 'minimax',
    title: 'MiniMax',
    shortLabel: 'Cloud',
    description: 'Use MiniMax chat models through its API bridge.',
    note: 'Refresh the model list after setting your API key and base URL.',
    keyLabel: 'MiniMax API key',
    baseUrlLabel: 'Base URL',
    defaultModel: 'MiniMax-M1',
    environment: 'cloud',
    supportsLiveVoice: false,
    supportsTextToSpeech: false,
    supportsModelDiscovery: true,
    supportsOpenAIChatCompletions: true,
  },
};

export function getProviderCapabilities(provider: ApiProvider): ProviderCapabilityInfo {
  return PROVIDER_CAPABILITIES[provider];
}

export function getProviderDisplayName(provider: ApiProvider): string {
  return PROVIDER_CAPABILITIES[provider].title;
}

export function getProviderShortLabel(provider: ApiProvider): string {
  return PROVIDER_CAPABILITIES[provider].shortLabel;
}

export function getProviderKeyLabel(provider: ApiProvider): string {
  return PROVIDER_CAPABILITIES[provider].keyLabel;
}

export function getProviderBaseUrlLabel(provider: ApiProvider): string {
  return PROVIDER_CAPABILITIES[provider].baseUrlLabel ?? 'Base URL';
}

export function getProviderNote(provider: ApiProvider): string {
  return PROVIDER_CAPABILITIES[provider].note;
}

export function getProviderDescription(provider: ApiProvider): string {
  return PROVIDER_CAPABILITIES[provider].description;
}

export function getProviderDefaultModel(provider: ApiProvider): string {
  return PROVIDER_CAPABILITIES[provider].defaultModel ?? '';
}

export function providerSupportsLiveVoice(provider: ApiProvider): boolean {
  return PROVIDER_CAPABILITIES[provider].supportsLiveVoice;
}

export function providerSupportsTextToSpeech(provider: ApiProvider): boolean {
  return PROVIDER_CAPABILITIES[provider].supportsTextToSpeech;
}

export function providerSupportsModelDiscovery(provider: ApiProvider): boolean {
  return PROVIDER_CAPABILITIES[provider].supportsModelDiscovery;
}

export function providerSupportsOpenAIChatCompletions(provider: ApiProvider): boolean {
  return PROVIDER_CAPABILITIES[provider].supportsOpenAIChatCompletions;
}
