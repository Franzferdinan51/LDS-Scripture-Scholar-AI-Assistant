import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { ApiProviderSettings, WebSearchProvider } from '../types';
import { getApiSettings, saveApiSettings, migrateFromLocalStorage } from '../services/storage';
import { getProviderDefaultModel, normalizeApiProvider } from '../services/providerCapabilities';

const DEFAULT_SETTINGS: ApiProviderSettings = {
  provider: 'google',
  googleApiKey: process.env.API_KEY || '',
  openRouterApiKey: '',
  lmStudioBaseUrl: 'http://localhost:1234/v1',
  lmStudioApiKey: '',
  openRouterBaseUrl: 'https://openrouter.ai/api/v1',
  mcpBaseUrl: 'http://localhost:8080/v1',
  mcpApiKey: '',
  minimaxBaseUrl: 'https://api.minimax.io/v1',
  minimaxApiKey: '',
  model: getProviderDefaultModel('google'),
  fallbackProvider: undefined,
  fallbackModel: undefined,
  webSearchProvider: 'duckduckgo',
  searxngUrl: 'http://localhost:8080',
  braveSearchApiKey: '',
  googleSearchApiKey: '',
  googleSearchCx: '',
  tavilyApiKey: '',
  lmStudioMcpServers: [],
};

const isWebSearchProvider = (value: unknown): value is WebSearchProvider => {
  return value === 'duckduckgo' ||
    value === 'tavily' ||
    value === 'brave' ||
    value === 'searxng' ||
    value === 'google' ||
    value === 'wikipedia' ||
    value === 'churchofjesuschrist';
};

const trimString = (value: string | undefined): string => value?.trim() || '';

const normalizeLoadedSettings = (stored: ApiProviderSettings | null): ApiProviderSettings => {
  if (!stored) {
    return DEFAULT_SETTINGS;
  }

  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    provider: normalizeApiProvider(stored.provider),
    fallbackProvider: stored.fallbackProvider ? normalizeApiProvider(stored.fallbackProvider) : undefined,
    googleApiKey: trimString(stored.googleApiKey),
    openRouterApiKey: trimString(stored.openRouterApiKey),
    lmStudioBaseUrl: trimString(stored.lmStudioBaseUrl) || DEFAULT_SETTINGS.lmStudioBaseUrl,
    lmStudioApiKey: trimString(stored.lmStudioApiKey),
    openRouterBaseUrl: trimString(stored.openRouterBaseUrl) || DEFAULT_SETTINGS.openRouterBaseUrl,
    mcpBaseUrl: trimString(stored.mcpBaseUrl) || DEFAULT_SETTINGS.mcpBaseUrl,
    mcpApiKey: trimString(stored.mcpApiKey),
    minimaxBaseUrl: trimString(stored.minimaxBaseUrl) || DEFAULT_SETTINGS.minimaxBaseUrl,
    minimaxApiKey: trimString(stored.minimaxApiKey),
    webSearchProvider: isWebSearchProvider(stored.webSearchProvider) ? stored.webSearchProvider : DEFAULT_SETTINGS.webSearchProvider,
    searxngUrl: trimString(stored.searxngUrl) || DEFAULT_SETTINGS.searxngUrl,
    braveSearchApiKey: trimString(stored.braveSearchApiKey),
    googleSearchApiKey: trimString(stored.googleSearchApiKey),
    googleSearchCx: trimString(stored.googleSearchCx),
    tavilyApiKey: trimString(stored.tavilyApiKey),
    model: trimString(stored.model) || getProviderDefaultModel(normalizeApiProvider(stored.provider)),
  };
};

interface SettingsContextType {
  settings: ApiProviderSettings;
  setSettings: (settings: ApiProviderSettings) => void;
  isLoaded: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettingsState] = useState<ApiProviderSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings from IndexedDB on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        await migrateFromLocalStorage();
        const stored = await getApiSettings();
        if (stored) {
          // Ensure default API key is included
          if (!stored.googleApiKey && process.env.API_KEY) {
            stored.googleApiKey = process.env.API_KEY;
          }
          setSettingsState(normalizeLoadedSettings(stored));
        } else {
          // First run: save defaults
          await saveApiSettings(DEFAULT_SETTINGS);
        }
      } catch (e) {
        console.error('Failed to load settings from IndexedDB:', e);
      }
      setIsLoaded(true);
    };
    loadSettings();
  }, []);

  const handleSetSettings = useCallback((newSettings: ApiProviderSettings) => {
    const normalizedProvider = normalizeApiProvider(newSettings.provider);
    if (normalizedProvider !== settings.provider) {
      newSettings.model = getProviderDefaultModel(normalizedProvider);
    }
    setSettingsState({ ...newSettings, provider: normalizedProvider });
  }, [settings.provider]);

  // Auto-save to IndexedDB when settings change
  useEffect(() => {
    if (isLoaded) {
      saveApiSettings(settings).catch(e => console.error('Failed to save settings:', e));
    }
  }, [settings, isLoaded]);

  return (
    <SettingsContext.Provider value={{ settings, setSettings: handleSetSettings, isLoaded }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
