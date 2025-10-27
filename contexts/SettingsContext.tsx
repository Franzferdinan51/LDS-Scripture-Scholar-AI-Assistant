import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { ApiProviderSettings, ApiProvider } from '../types';

const DEFAULT_SETTINGS: ApiProviderSettings = {
  provider: 'google',
  googleApiKey: process.env.API_KEY || '',
  openRouterApiKey: '',
  lmStudioBaseUrl: 'http://localhost:1234/v1',
  openRouterBaseUrl: 'https://openrouter.ai/api/v1',
  mcpBaseUrl: 'http://localhost:8080/v1',
  lmStudioConnectionTarget: 'standard',
  model: 'gemini-flash-lite-latest',
};

interface SettingsContextType {
  settings: ApiProviderSettings;
  setSettings: (settings: ApiProviderSettings) => void;
  saveSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<ApiProviderSettings>(() => {
    try {
      const storedSettings = localStorage.getItem('apiProviderSettings');
      if (storedSettings) {
        const parsed = JSON.parse(storedSettings);
        // Make sure the default API key is included if it exists and wasn't saved
        if (!parsed.googleApiKey && process.env.API_KEY) {
            parsed.googleApiKey = process.env.API_KEY;
        }
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (error) {
      console.error("Failed to parse settings from localStorage", error);
    }
    return DEFAULT_SETTINGS;
  });

  const handleSetSettings = (newSettings: ApiProviderSettings) => {
    // When provider changes, update the default model
    if (newSettings.provider !== settings.provider) {
        if (newSettings.provider === 'google') {
            newSettings.model = 'gemini-flash-lite-latest';
        } else {
            newSettings.model = ''; // Clear model for other providers until fetched
        }
    }
    setSettings(newSettings);
  };
  
  const saveSettings = () => {
    try {
      localStorage.setItem('apiProviderSettings', JSON.stringify(settings));
    } catch (error) {
      console.error("Failed to save settings to localStorage", error);
    }
  };

  // Auto-save when settings change
  useEffect(() => {
    saveSettings();
  }, [settings]);

  return (
    <SettingsContext.Provider value={{ settings, setSettings: handleSetSettings, saveSettings }}>
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