import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { ApiProvider, Model, WebSearchProvider } from '../types';
import { fetchModels, testMCPConnection } from '../services/aiService';
import {
  getProviderCapabilities,
  getProviderDefaultModel,
  getProviderKeyLabel,
  providerSupportsModelDiscovery,
} from '../services/providerCapabilities';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClearHistory: () => void;
}

const MCP_TEST_INITIAL = { status: 'idle' as const, message: null };
const PROVIDER_DEFAULT_MODELS: Partial<Record<ApiProvider, string>> = {
  google: getProviderDefaultModel('google'),
  minimax: getProviderDefaultModel('minimax'),
};

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onClearHistory }) => {
  const { settings, setSettings } = useSettings();
  const [localSettings, setLocalSettings] = useState(settings);
  const [models, setModels] = useState<Model[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [modelSearch, setModelSearch] = useState('');
  const [showFreeOnly, setShowFreeOnly] = useState(false);
  const [mcpTestStatus, setMcpTestStatus] = useState<{ status: 'idle' | 'testing' | 'success' | 'error'; message: string | null }>(MCP_TEST_INITIAL);
  const providerModelMemory = useRef<Partial<Record<ApiProvider, string>>>({});
  const hasText = (value?: string) => Boolean(value?.trim());

  useEffect(() => {
    setLocalSettings(settings);
    providerModelMemory.current[settings.provider] = settings.model;
  }, [settings, isOpen]);

  useEffect(() => {
      // Clear models if provider changes
      setModels([]);
      setFetchError(null);
      setModelSearch('');
      setShowFreeOnly(false);
      setMcpTestStatus(MCP_TEST_INITIAL);
  }, [localSettings.provider, isOpen]);

  const handleFetchModels = async () => {
    setIsFetchingModels(true);
    setFetchError(null);
    setModels([]);
    try {
      const fetchedModels = await fetchModels(localSettings);
      setModels(fetchedModels);
    } catch (err) {
      console.error(err);
      setFetchError(err instanceof Error ? err.message : "An unknown error occurred.");
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleTestMCPConnection = async () => {
    setMcpTestStatus({ status: 'testing', message: 'Testing connection...' });
    const result = await testMCPConnection(localSettings.mcpBaseUrl);
    if (result.success) {
        setMcpTestStatus({ status: 'success', message: result.message });
    } else {
        setMcpTestStatus({ status: 'error', message: result.message });
    }
  };

  const handleSave = () => {
    setSettings({
      ...localSettings,
      googleApiKey: localSettings.googleApiKey.trim(),
      openRouterApiKey: localSettings.openRouterApiKey.trim(),
      openRouterBaseUrl: localSettings.openRouterBaseUrl.trim(),
      lmStudioBaseUrl: localSettings.lmStudioBaseUrl.trim(),
      lmStudioApiKey: localSettings.lmStudioApiKey.trim(),
      mcpBaseUrl: localSettings.mcpBaseUrl.trim(),
      minimaxBaseUrl: localSettings.minimaxBaseUrl.trim(),
      minimaxApiKey: localSettings.minimaxApiKey.trim(),
      googleSearchApiKey: localSettings.googleSearchApiKey.trim(),
      googleSearchCx: localSettings.googleSearchCx.trim(),
      tavilyApiKey: localSettings.tavilyApiKey.trim(),
      braveSearchApiKey: localSettings.braveSearchApiKey.trim(),
      model: localSettings.model.trim(),
    });
    onClose();
  };

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const provider = e.target.value as ApiProvider;
    providerModelMemory.current[localSettings.provider] = localSettings.model;
    const rememberedModel = providerModelMemory.current[provider];
    const newModel = rememberedModel ?? PROVIDER_DEFAULT_MODELS[provider] ?? '';
    setLocalSettings(prev => ({ ...prev, provider, model: newModel }));
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setLocalSettings(prev => ({ ...prev, [name]: value }));
  };

  const filteredModels = useMemo(() => {
    return models.filter(model => {
        const nameMatch = model.name ? model.name.toLowerCase().includes(modelSearch.toLowerCase()) : model.id.toLowerCase().includes(modelSearch.toLowerCase());
        const freeMatch = !showFreeOnly || model.isFree;
        return nameMatch && freeMatch;
    });
  }, [models, modelSearch, showFreeOnly]);

  const providerMeta = getProviderCapabilities(localSettings.provider);
  const providerRequiresModelRefresh = providerSupportsModelDiscovery(localSettings.provider);
  const activeModelHint = localSettings.model
    ? `Selected model: ${localSettings.model}`
    : 'No model selected yet.';
  const isMissingRequiredConnection =
    (localSettings.provider === 'google' && !hasText(localSettings.googleApiKey)) ||
    (localSettings.provider === 'lmstudio' && !hasText(localSettings.lmStudioBaseUrl)) ||
    (localSettings.provider === 'openrouter' && (!hasText(localSettings.openRouterBaseUrl) || !hasText(localSettings.openRouterApiKey))) ||
    (localSettings.provider === 'mcp' && !hasText(localSettings.mcpBaseUrl)) ||
    (localSettings.provider === 'minimax' && !hasText(localSettings.minimaxApiKey));
  const isMissingRequiredModel = localSettings.provider !== 'google' && !hasText(localSettings.model);
  const canSave = Boolean(localSettings.provider) && !isMissingRequiredConnection && !isMissingRequiredModel;
  const saveHint = isMissingRequiredConnection
    ? 'Enter the required provider connection details before saving.'
    : isMissingRequiredModel
      ? 'Select or enter a model before saving.'
      : null;


  if (!isOpen) return null;
  
  const isFetchVisible = providerSupportsModelDiscovery(localSettings.provider);
  
  const inputBaseClasses = "mt-1 block w-full shadow-sm sm:text-sm rounded-md p-2 bg-slate-700 border border-slate-600 text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500";
  const selectBaseClasses = "mt-1 block w-full pl-3 pr-10 py-2 text-base rounded-md bg-slate-700 border-slate-600 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm";


  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-slate-900/90 text-gray-200 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-white/10 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 px-6 py-5">
          <div>
            <div className="inline-flex items-center rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">
              Settings
            </div>
            <h2 className="mt-3 text-3xl font-bold text-white">Configure your study stack</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Choose the provider, key, and model that power chat, cross-references, journaling, and other study tools.
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-gray-400 transition-colors hover:bg-white/5 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="max-h-[78vh] overflow-y-auto px-6 py-5">
          <div className="mb-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-xl border border-white/10 bg-slate-800/50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-700 px-3 py-1 text-xs font-semibold text-slate-200">
                  {providerMeta.title}
                </span>
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
                  {activeModelHint}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-300">{providerMeta.description}</p>
              <p className="mt-2 text-xs text-slate-400">{providerMeta.note}</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-slate-800/50 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">What this affects</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                <li>- Chat agent provider and model selection</li>
                <li>- Scripture cross-references and related study tools</li>
                <li>- Model refresh and local provider connection checks</li>
              </ul>
            </div>
          </div>

          <div className="space-y-5">
            <section className="rounded-xl border border-white/10 bg-slate-800/50 p-4">
              <div className="mb-3 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">Provider</h3>
                  <p className="text-sm text-slate-400">Pick the AI backend you want the app to use.</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${providerMeta.environment === 'cloud' ? 'bg-amber-500/10 text-amber-200' : 'bg-sky-500/10 text-sky-200'}`}>
                  {providerMeta.shortLabel}
                </span>
              </div>
              <select
                id="provider"
                name="provider"
                value={localSettings.provider}
                onChange={handleProviderChange}
                className={selectBaseClasses}
              >
                <option value="google">Google AI</option>
                <option value="lmstudio">LM Studio</option>
                <option value="openrouter">OpenRouter</option>
                <option value="mcp">Docker MCP Toolkit</option>
                <option value="minimax">MiniMax</option>
              </select>
            </section>

            <section className="rounded-xl border border-white/10 bg-slate-800/50 p-4">
              <div className="mb-3">
                <h3 className="text-lg font-semibold text-white">Connection details</h3>
                <p className="text-sm text-slate-400">
                  Enter the API key or local base URL required by the selected provider.
                </p>
              </div>

              {localSettings.provider === 'google' && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="googleApiKey" className="block text-sm font-medium text-gray-300">{getProviderKeyLabel(localSettings.provider)}</label>
                    <input
                      type="password"
                      id="googleApiKey"
                      name="googleApiKey"
                      value={localSettings.googleApiKey}
                      onChange={handleInputChange}
                      className={inputBaseClasses}
                      placeholder="AIza..."
                    />
                  </div>
                  <p className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                    Google is required for live voice and TTS. Cross-references and journal insights work with other providers too.
                  </p>
                </div>
              )}

              {localSettings.provider === 'lmstudio' && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="lmStudioBaseUrl" className="block text-sm font-medium text-gray-300">Base URL</label>
                    <input
                      type="text"
                      id="lmStudioBaseUrl"
                      name="lmStudioBaseUrl"
                      value={localSettings.lmStudioBaseUrl}
                      onChange={handleInputChange}
                      className={inputBaseClasses}
                    />
                  </div>
                  <div>
                    <label htmlFor="lmStudioApiKey" className="block text-sm font-medium text-gray-300">API Key <span className="text-gray-500">(optional)</span></label>
                    <input
                      type="password"
                      id="lmStudioApiKey"
                      name="lmStudioApiKey"
                      value={localSettings.lmStudioApiKey || ''}
                      onChange={handleInputChange}
                      className={inputBaseClasses}
                      placeholder="Leave blank if not required"
                    />
                  </div>
                  <p className="text-xs text-gray-400">Required for newer LM Studio versions. Get it from LM Studio settings.</p>
                </div>
              )}

              {localSettings.provider === 'mcp' && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="mcpBaseUrl" className="block text-sm font-medium text-gray-300">Docker MCP URL</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        id="mcpBaseUrl"
                        name="mcpBaseUrl"
                        value={localSettings.mcpBaseUrl}
                        onChange={handleInputChange}
                        className={inputBaseClasses + ' flex-1'}
                      />
                      <button
                        type="button"
                        onClick={handleTestMCPConnection}
                        disabled={mcpTestStatus.status === 'testing'}
                        className="mt-1 rounded-md bg-slate-700 px-4 py-2 text-sm text-white transition-colors hover:bg-slate-600 disabled:cursor-wait disabled:opacity-50"
                      >
                        {mcpTestStatus.status === 'testing' ? 'Testing...' : 'Test'}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-gray-400">Default for Docker MCP is http://localhost:8080/v1</p>
                  </div>
                  {mcpTestStatus.message && (
                    <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-3">
                      <pre
                        className={`whitespace-pre-wrap font-mono text-xs ${
                          mcpTestStatus.status === 'success' ? 'text-green-400' : ''
                        } ${mcpTestStatus.status === 'error' ? 'text-red-400' : ''} ${
                          mcpTestStatus.status === 'testing' ? 'text-yellow-400' : ''
                        }`}
                      >
                        <code>{mcpTestStatus.message}</code>
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {localSettings.provider === 'openrouter' && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="openRouterBaseUrl" className="block text-sm font-medium text-gray-300">Base URL</label>
                    <input
                      type="text"
                      id="openRouterBaseUrl"
                      name="openRouterBaseUrl"
                      value={localSettings.openRouterBaseUrl}
                      onChange={handleInputChange}
                      className={inputBaseClasses}
                    />
                  </div>
                  <div>
                    <label htmlFor="openRouterApiKey" className="block text-sm font-medium text-gray-300">OpenRouter API Key</label>
                    <input
                      type="password"
                      id="openRouterApiKey"
                      name="openRouterApiKey"
                      value={localSettings.openRouterApiKey}
                      onChange={handleInputChange}
                      className={inputBaseClasses}
                      placeholder="sk-or-..."
                    />
                  </div>
                </div>
              )}

              {localSettings.provider === 'minimax' && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="minimaxBaseUrl" className="block text-sm font-medium text-gray-300">Base URL</label>
                    <input
                      type="text"
                      id="minimaxBaseUrl"
                      name="minimaxBaseUrl"
                      value={localSettings.minimaxBaseUrl}
                      onChange={handleInputChange}
                      className={inputBaseClasses}
                      placeholder="https://api.minimax.io/v1"
                    />
                  </div>
                  <div>
                    <label htmlFor="minimaxApiKey" className="block text-sm font-medium text-gray-300">MiniMax API Key</label>
                    <input
                      type="password"
                      id="minimaxApiKey"
                      name="minimaxApiKey"
                      value={localSettings.minimaxApiKey || ''}
                      onChange={handleInputChange}
                      className={inputBaseClasses}
                      placeholder="Enter your MiniMax key"
                    />
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-xl border border-white/10 bg-slate-800/50 p-4">
              <div className="mb-3 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">Model</h3>
                  <p className="text-sm text-slate-400">
                    {providerRequiresModelRefresh ? 'Refresh models from the provider, or enter one manually.' : 'Pick the model you want to use.'}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${localSettings.model ? 'bg-emerald-500/10 text-emerald-200' : 'bg-slate-700 text-slate-300'}`}>
                  {localSettings.model || 'No model selected'}
                </span>
              </div>

              {localSettings.provider === 'google' && (
                <div className="space-y-3">
                  <select
                    id="model"
                    name="model"
                    value={localSettings.model}
                    onChange={handleInputChange}
                    className={selectBaseClasses}
                  >
                                       <option value="gemini-2.5-pro">2.5 Pro</option>
                   <option value="gemini-2.5-flash">2.5 Flash</option>
                   <option value="gemini-2.0-flash">2.0 Flash</option>
                   <option value="gemini-2.0-flash-lite">2.0 Flash Lite</option>
                   <option value="gemini-1.5-pro">1.5 Pro</option>
                   <option value="gemini-1.5-flash">1.5 Flash</option>
                   </select>
                  <p className="text-xs text-gray-400">Specialized modes automatically promote to the higher-capability Google model.</p>
                </div>
              )}

              {isFetchVisible && (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={handleFetchModels}
                      disabled={isFetchingModels}
                      className="rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-600 disabled:cursor-wait disabled:opacity-50"
                    >
                      {isFetchingModels ? 'Fetching...' : 'Find / Refresh Models'}
                    </button>
                    <div className="flex flex-1 items-center gap-3">
                      <label className="flex items-center gap-2 text-sm text-gray-300">
                        <input
                          type="checkbox"
                          checked={showFreeOnly}
                          onChange={e => setShowFreeOnly(e.target.checked)}
                          className="rounded border-slate-500 bg-slate-700 text-blue-500 focus:ring-blue-500"
                        />
                        <span>Show free models only</span>
                      </label>
                    </div>
                  </div>

                  {fetchError && <p className="text-sm text-red-400">{fetchError}</p>}

                  {models.length > 0 && (
                    <div className="space-y-3">
                      <input
                        type="text"
                        placeholder="Search models..."
                        value={modelSearch}
                        onChange={e => setModelSearch(e.target.value)}
                        className={inputBaseClasses}
                      />
                      <label htmlFor="model" className="block text-sm font-medium text-gray-300">
                        Model ({filteredModels.length} found)
                      </label>
                      <select
                        id="model"
                        name="model"
                        value={localSettings.model}
                        onChange={handleInputChange}
                        className={selectBaseClasses}
                      >
                        <option value="">-- Select a Model --</option>
                        {filteredModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </div>
                  )}

                  <div>
                    <label htmlFor="manualModel" className="block text-sm font-medium text-gray-300">Or enter model ID manually</label>
                    <input
                      type="text"
                      id="manualModel"
                      name="model"
                      value={localSettings.model}
                      onChange={handleInputChange}
                      className={inputBaseClasses}
                      placeholder="e.g., MiniMax-M2.7, MiniMax-M2.7-highspeed, MiniMax-Text-01"
                    />
                    <p className="mt-1 text-xs text-gray-400">
                      Type any model ID if it doesn't appear in the list above.
                    </p>
                  </div>
                </div>
              )}
            </section>


      <section className="rounded-xl border border-white/10 bg-slate-800/50 p-4">
        <div className="mb-3">
          <h3 className="text-lg font-semibold text-white">Web Search Provider</h3>
          <p className="text-sm text-slate-400">
            Configure how the app searches for current Church information and LDS content online.
          </p>
        </div>
        <div className="space-y-4">
          <div>
            <label htmlFor="webSearchProvider" className="block text-sm font-medium text-gray-300">Search Provider</label>
            <select
              id="webSearchProvider"
              name="webSearchProvider"
              value={localSettings.webSearchProvider || 'duckduckgo'}
              onChange={handleInputChange}
              className={selectBaseClasses}
            >
              <option value="duckduckgo">DuckDuckGo (No API key needed)</option>
          <option value="tavily">Tavily (AI-optimized search)</option>
              <option value="searxng">SearXNG (Self-hosted)</option>
              <option value="brave">Brave Search API</option>
              <option value="google">Google Custom Search</option>
              <option value="wikipedia">Wikipedia Only (Fallback)</option>
<option value="churchofjesuschrist">ChurchofJesusChrist.org (No API key needed)</option>
            </select>
          </div>

          <p className="rounded-lg border border-blue-400/20 bg-blue-500/10 px-3 py-2 text-xs text-blue-100">
            All searches prioritize official Church sources (ChurchofJesusChrist.org, Book of Mormon Central, FAIR LDS, BYU).
          </p>

          {(localSettings.webSearchProvider === 'searxng') && (
            <div>
              <label htmlFor="searxngUrl" className="block text-sm font-medium text-gray-300">SearXNG Base URL</label>
              <input
                type="text"
                id="searxngUrl"
                name="searxngUrl"
                value={localSettings.searxngUrl || 'http://localhost:8080'}
                onChange={handleInputChange}
                className={inputBaseClasses}
                placeholder="http://localhost:8080"
              />
              <p className="mt-1 text-xs text-gray-400">URL of your self-hosted SearXNG instance with JSON format enabled.</p>
            </div>
          )}

          {(localSettings.webSearchProvider === 'tavily') && (
          <div>
            <label htmlFor="tavilyApiKey" className="block text-sm font-medium text-gray-300">Tavily API Key</label>
            <input
              type="password"
              id="tavilyApiKey"
              name="tavilyApiKey"
              value={localSettings.tavilyApiKey || ''}
              onChange={handleInputChange}
              className={inputBaseClasses}
              placeholder="tvly-..."
            />
            <p className="mt-1 text-xs text-gray-400">Get an API key at tavily.com</p>
          </div>
        )}

        {(localSettings.webSearchProvider === 'brave') && (
            <div>
              <label htmlFor="braveSearchApiKey" className="block text-sm font-medium text-gray-300">Brave Search API Key</label>
              <input
                type="password"
                id="braveSearchApiKey"
                name="braveSearchApiKey"
                value={localSettings.braveSearchApiKey || ''}
                onChange={handleInputChange}
                className={inputBaseClasses}
                placeholder="BSA-..."
              />
              <p className="mt-1 text-xs text-gray-400">Get a free API key at brave.com/search/api</p>
            </div>
          )}

          {(localSettings.webSearchProvider === 'google') && (
            <div className="space-y-4">
              <div>
                <label htmlFor="googleSearchApiKey" className="block text-sm font-medium text-gray-300">Google API Key</label>
                <input
                  type="password"
                  id="googleSearchApiKey"
                  name="googleSearchApiKey"
                  value={localSettings.googleSearchApiKey || ''}
                  onChange={handleInputChange}
                  className={inputBaseClasses}
                  placeholder="AIza..."
                />
              </div>
              <div>
                <label htmlFor="googleSearchCx" className="block text-sm font-medium text-gray-300">Custom Search Engine ID</label>
                <input
                  type="text"
                  id="googleSearchCx"
                  name="googleSearchCx"
                  value={localSettings.googleSearchCx || ''}
                  onChange={handleInputChange}
                  className={inputBaseClasses}
                  placeholder="a1b2c3..."
                />
                <p className="mt-1 text-xs text-gray-400">Create a Custom Search Engine at cse.google.com restricted to LDS domains.</p>
              </div>
            </div>
          )}
        </div>
      </section>

            <section className="rounded-xl border border-white/10 bg-slate-800/50 p-4">
              <h3 className="text-lg font-semibold text-white">Data management</h3>
              <p className="mt-1 text-sm text-slate-400">
                Remove local conversation history if you want to start fresh.
              </p>
              <button
                onClick={onClearHistory}
                className="mt-4 w-full rounded-md bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                Clear All Chat History
              </button>
              <p className="mt-2 text-xs text-gray-400">
                This permanently deletes all conversation history stored in the app.
              </p>
            </section>
          </div>
        </div>

        <div className="border-t border-white/10 bg-slate-950/60 px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={onClose}
              className="rounded-md border border-white/10 bg-transparent px-4 py-2 text-sm text-gray-200 transition-colors hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save Settings
            </button>
          </div>
          {!canSave && saveHint && (
            <p className="mt-3 text-right text-xs text-amber-300">
              {saveHint}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
