import React, { useState, useEffect, useMemo } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { ApiProvider, Model } from '../types';
import { fetchModels, testMCPConnection } from '../services/geminiService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClearHistory: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onClearHistory }) => {
  const { settings, setSettings, saveSettings } = useSettings();
  const [localSettings, setLocalSettings] = useState(settings);
  const [models, setModels] = useState<Model[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [modelSearch, setModelSearch] = useState('');
  const [showFreeOnly, setShowFreeOnly] = useState(false);
  const [mcpTestStatus, setMcpTestStatus] = useState<{ status: 'idle' | 'testing' | 'success' | 'error'; message: string | null }>({ status: 'idle', message: null });

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings, isOpen]);

  useEffect(() => {
      // Clear models if provider changes
      setModels([]);
      setFetchError(null);
      setModelSearch('');
      setShowFreeOnly(false);
      setMcpTestStatus({ status: 'idle', message: null });
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
    setSettings(localSettings);
    saveSettings();
    onClose();
  };

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const provider = e.target.value as ApiProvider;
    let newModel = '';
    if (provider === 'google') newModel = 'gemini-flash-lite-latest';
    
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


  if (!isOpen) return null;
  
  const isFetchVisible = localSettings.provider === 'lmstudio' || localSettings.provider === 'openrouter';
  
  const inputBaseClasses = "mt-1 block w-full shadow-sm sm:text-sm rounded-md p-2 bg-slate-700 border border-slate-600 text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500";
  const selectBaseClasses = "mt-1 block w-full pl-3 pr-10 py-2 text-base rounded-md bg-slate-700 border-slate-600 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm";


  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center backdrop-blur-sm" 
      onClick={onClose}
    >
      <div 
        className="bg-slate-800/70 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl p-6 w-full max-w-md m-4 relative text-gray-200"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 className="text-2xl font-bold mb-4 text-white">Settings</h2>

        <div className="space-y-4">
          <div>
            <label htmlFor="provider" className="block text-sm font-medium text-gray-300">API Provider</label>
            <select
              id="provider"
              name="provider"
              value={localSettings.provider}
              onChange={handleProviderChange}
              className={selectBaseClasses}
            >
              <option value="google">Google Gemini</option>
              <option value="lmstudio">LM Studio</option>
              <option value="openrouter">OpenRouter</option>
            </select>
          </div>
          
          {localSettings.provider === 'google' && (
            <>
              <div>
                <label htmlFor="googleApiKey" className="block text-sm font-medium text-gray-300">Google API Key</label>
                <input
                  type="password"
                  id="googleApiKey"
                  name="googleApiKey"
                  value={localSettings.googleApiKey}
                  onChange={handleInputChange}
                  className={inputBaseClasses}
                />
              </div>
              <div>
                <label htmlFor="model" className="block text-sm font-medium text-gray-300">Model</label>
                <select
                  id="model"
                  name="model"
                  value={localSettings.model}
                  onChange={handleInputChange}
                  className={selectBaseClasses}
                >
                  <option value="gemini-flash-lite-latest">Gemini Flash Lite (Low-Latency)</option>
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                  <option value="gemini-flash-latest">Gemini Flash Latest</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                </select>
                 <p className="mt-1 text-xs text-gray-400">Note: Specialized modes will use Gemini 2.5 Pro.</p>
              </div>
            </>
          )}

          {localSettings.provider === 'lmstudio' && (
             <>
                <div>
                  <label className="block text-sm font-medium text-gray-300">Connection Target</label>
                  <div className="mt-2 flex space-x-4 p-1 bg-slate-700/50 rounded-lg">
                    <label className="flex-1 text-center">
                      <input
                        type="radio"
                        name="lmStudioConnectionTarget"
                        value="standard"
                        checked={localSettings.lmStudioConnectionTarget === 'standard'}
                        onChange={handleInputChange}
                        className="sr-only peer"
                      />
                      <span className="block w-full py-1.5 px-3 rounded-md text-sm cursor-pointer peer-checked:bg-blue-600 peer-checked:text-white transition-colors">Standard Server</span>
                    </label>
                    <label className="flex-1 text-center">
                      <input
                        type="radio"
                        name="lmStudioConnectionTarget"
                        value="mcp"
                        checked={localSettings.lmStudioConnectionTarget === 'mcp'}
                        onChange={handleInputChange}
                        className="sr-only peer"
                      />
                       <span className="block w-full py-1.5 px-3 rounded-md text-sm cursor-pointer peer-checked:bg-blue-600 peer-checked:text-white transition-colors">Docker MCP</span>
                    </label>
                  </div>
                </div>

                {localSettings.lmStudioConnectionTarget === 'standard' ? (
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
                ) : (
                  <div>
                    <label htmlFor="mcpBaseUrl" className="block text-sm font-medium text-gray-300">Docker MCP URL</label>
                    <div className="flex items-center space-x-2">
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
                            className="mt-1 px-4 py-2 text-sm bg-slate-600 text-white rounded-md hover:bg-slate-500 disabled:opacity-50 transition-colors"
                        >
                            {mcpTestStatus.status === 'testing' ? 'Testing...' : 'Test'}
                        </button>
                    </div>
                     <p className="mt-1 text-xs text-gray-400">Default for Docker MCP is http://localhost:8080/v1</p>
                      {mcpTestStatus.message && (
                        <div className="mt-2 p-3 rounded-md bg-slate-900/70 border border-slate-700">
                            <pre className={`whitespace-pre-wrap font-mono text-xs 
                                ${mcpTestStatus.status === 'success' ? 'text-green-400' : ''}
                                ${mcpTestStatus.status === 'error' ? 'text-red-400' : ''}
                                ${mcpTestStatus.status === 'testing' ? 'text-yellow-400' : ''}
                            `}>
                                <code>
                                    {mcpTestStatus.message}
                                </code>
                            </pre>
                        </div>
                    )}
                  </div>
                )}
             </>
          )}

          {localSettings.provider === 'openrouter' && (
            <>
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
                />
              </div>
            </>
          )}

          {isFetchVisible && (
            <div className='border-t border-gray-600 pt-4'>
                <button
                    onClick={handleFetchModels}
                    disabled={isFetchingModels}
                    className="w-full bg-slate-600 text-white py-2 px-4 rounded-md hover:bg-slate-500 disabled:opacity-50 transition-colors"
                >
                    {isFetchingModels ? 'Fetching...' : 'Find / Refresh Models'}
                </button>
                {fetchError && <p className="text-red-400 text-sm mt-2">{fetchError}</p>}
                
                {models.length > 0 && (
                     <div>
                        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-2 sm:space-y-0">
                            <input
                                type="text"
                                placeholder="Search models..."
                                value={modelSearch}
                                onChange={e => setModelSearch(e.target.value)}
                                className={inputBaseClasses + ' flex-1'}
                            />
                            <label className="flex items-center space-x-2 text-sm text-gray-300 whitespace-nowrap">
                                <input
                                    type="checkbox"
                                    checked={showFreeOnly}
                                    onChange={e => setShowFreeOnly(e.target.checked)}
                                    className="rounded bg-slate-700 border-slate-500 text-blue-500 focus:ring-blue-500"
                                />
                                <span>Show free models only</span>
                            </label>
                        </div>
                        <label htmlFor="model" className="block text-sm font-medium text-gray-300 mt-2">Model ({filteredModels.length} found)</label>
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
            </div>
          )}
        </div>
        
        <div className="mt-6 border-t border-slate-600 pt-4">
            <h3 className="text-lg font-semibold text-gray-200 mb-2">Data Management</h3>
            <button
                onClick={onClearHistory}
                className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
                Clear All Chat History
            </button>
            <p className="mt-2 text-xs text-gray-400">
                This will permanently delete all your conversation history.
            </p>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;