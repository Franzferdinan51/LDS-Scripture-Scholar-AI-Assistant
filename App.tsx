import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Message, ChatMode, ViewMode, GroundingChunk, StudyPlan, MultiQuiz, Note, JournalEntry, UserProfile, Memory as MemoryType, Skill, StudySession, Reminder, ThinkingDepth, ToolCall } from './types';
import type { Session, LiveServerMessage, GenerateContentResponse, Content } from '@google/genai';
import { createChatService, createChatServiceWithFailover, connectLive, generateSpeech, getJournalInsights, getProactiveSuggestion, getWikimediaImageUrl } from './services/aiService';
import type { ChatServiceOptions } from './services/aiService';
import { addUsage, getUsageTracker, estimateCost } from './services/usageTracker';
import ChatWindow from './components/ChatWindow';
import Sidebar from './components/Sidebar';
import NotesPanel from './components/NotesPanel';
import JournalPanel from './components/JournalPanel';
import CrossReferencePanel from './components/CrossReferencePanel';
import ScripturePanel from './components/ScripturePanel';
import StudyDashboard from './components/StudyDashboard';
import SkillSelector from './components/SkillSelector';
import RemindersPanel from './components/RemindersPanel';
import ReminderToast from './components/ReminderToast';
import SuggestedReminderToast from './components/SuggestedReminderToast';
import SkillSaveOffer from './components/SkillSaveOffer';
import { createBlob, decode, decodeAudioData } from './utils/audio';
import { useSettings } from './contexts/SettingsContext';
import SettingsModal from './components/SettingsModal';
import HamburgerIcon from './components/HamburgerIcon';
import DisclaimerModal from './components/DisclaimerModal';
import ScriptureAgentSidebar from './components/ScriptureAgentSidebar';
import { normalizeApiProvider, providerSupportsLiveVoice, providerSupportsTextToSpeech } from './services/providerCapabilities';
// IndexedDB storage
import {
  getAllChats, saveChat, deleteChat as deleteChatDB, clearAllChats,
  getAllNotes, saveNote, deleteNote as deleteNoteDB,
  deleteMemory as deleteMemoryDB, updateSkillUsage,
  getAllJournalEntries, saveJournalEntry,
  deleteJournalEntry as deleteJournalEntryDB,
  getSetting, setSetting, migrateFromLocalStorage,
  getAllSkills, saveSkill as saveSkillDB,
  getAllReminders, saveReminder as saveReminderDB, deleteReminder as deleteReminderDB,
  getAllStudySessions, saveStudySession,
  getUserProfile, saveUserProfile,
  getPersona, savePersona,
} from './services/storage';
// Memory system
import { extractMemories, storeMemories, retrieveRelevantMemories, updateProfileFromConversation, consolidateMemories, extractProactiveMemories } from './services/memory';
// Skills
import { BUILTIN_SKILLS, initializeSkills, getSkillById } from './services/skills';
// Reminders
import { startReminderCheck, stopReminderCheck, suggestReminders, createReminderFromSuggestion } from './services/reminders';
import type { SuggestedReminder } from './services/reminders';
// Study progress tracking
import { recordConversation } from './services/studyProgress';
// Agent router
import { routeToAgent } from './services/agentRouter';

// Strip raw function call syntax that some local LLMs emit as text instead of proper tool_calls
function stripRawToolCalls(text: string): string {
  return text
    // === Complete XML tool call tags (with closing tags) ===
    .replace(/<function=[^>]*>[\s\S]*?<\/function>/gi, '')
    .replace(/<function_call[^>]*>[\s\S]*?<\/function_call>/gi, '')
    .replace(/<tool_call[^>]*>[\s\S]*?<\/tool_call>/gi, '')
    .replace(/<invoke[^>]*>[\s\S]*?<\/invoke>/gi, '')
    .replace(/<tool_response[^>]*>[\s\S]*?<\/tool_response>/gi, '')
    .replace(/<python-repl[^>]*>[\s\S]*?<\/python-repl>/gi, '')
    .replace(/<tool>[\s\S]*?<\/tool>/gi, '')
    .replace(/<scratchpad[^>]*>[\s\S]*?<\/scratchpad>/gi, '')
    .replace(/<thought[^>]*>[\s\S]*?<\/thought>/gi, '')
    .replace(/<react[^>]*>[\s\S]*?<\/react>/gi, '')
    // === Partial/unclosed XML tags (during streaming) ===
    .replace(/<function=[^>]*>[\s\S]*$/gi, '')
    .replace(/<function_call[^>]*>[\s\S]*$/gi, '')
    .replace(/<tool_call[^>]*>[\s\S]*$/gi, '')
    .replace(/<invoke[^>]*>[\s\S]*$/gi, '')
    .replace(/<tool_response[^>]*>[\s\S]*$/gi, '')
    .replace(/<python-repl[^>]*>[\s\S]*$/gi, '')
    .replace(/<tool>[\s\S]*$/gi, '')
    .replace(/<scratchpad[^>]*>[\s\S]*$/gi, '')
    .replace(/<thought[^>]*>[\s\S]*$/gi, '')
    // Stray closing tags
    .replace(/<\/function>?\s*$/gi, '')
    .replace(/<\/function_call>?\s*$/gi, '')
    .replace(/<\/tool_call>?\s*$/gi, '')
    .replace(/<\/invoke>?\s*$/gi, '')
    .replace(/<\/tool_response>?\s*$/gi, '')
    .replace(/<\/python-repl>?\s*$/gi, '')
    .replace(/<\/tool>?\s*$/gi, '')
    .replace(/<\/scratchpad>?\s*$/gi, '')
    .replace(/<\/thought>?\s*$/gi, '')
    // === Special tokens from local LLMs ===
    .replace(/<\|im_start\|>[\s\S]*?<\|im_end\|>/gi, '')
    .replace(/<\|im_start\|>[\s\S]*$/gi, '')
    .replace(/<\|tool\|>[\s\S]*?<\|\/tool\|>/gi, '')
    .replace(/<\|tool\|>[\s\S]*$/gi, '')
    .replace(/<\|\/tool\|>\s*/g, '')
    .replace(/<\|im_end\|>\s*/g, '')
    .replace(/<\|action_start\|>[\s\S]*?<\|action_end\|>/gi, '')
    .replace(/<\|action_start\|>[\s\S]*$/gi, '')
    .replace(/<\|action_end\|>\s*/g, '')
    // === Bracket/JSON-style tool calls ===
    .replace(/\[TOOL_CALL:[^\]]*\]/gi, '')
    // Nested JSON tool calls (handles {"function":"x","args":{"y":"z"}})
    .replace(/\{\s*"function"\s*:\s*"[^"]+"[\s\S]*?\}\s*\}/g, '')
    .replace(/\{\s*"name"\s*:\s*"[^"]+"[\s\S]*?\}\s*\}/g, '')
    .replace(/\{\s*"tool_calls"\s*:\s*\[[\s\S]*?\]\s*\}/g, '')
    // Single-level JSON tool calls (no nested braces)
    .replace(/\{\s*"function"\s*:\s*"[^"]+"\s*,?\s*\}/g, '')
    .replace(/\{\s*"name"\s*:\s*"[^"]+"\s*,?\s*\}/g, '')
    // === ReAct patterns ===
    .replace(/^\s*(Thought|Action|Observation|Final Answer)\s*:\s*$/gim, '')
    .replace(/^\s*Action\s*:\s*\{[^}]*\}\s*$/gim, '')
    // === Code block tool calls ===
    .replace(/```json\s*\n?\s*\{\s*"name"\s*:[\s\S]*?```/gi, '')
    .replace(/```tool\s*\n?[\s\S]*?```/gi, '')
    // === "undefined" literal artifact ===
    .replace(/\bundefined\b/g, '')
    .trim();
}


/** Safely extract text from a streaming chunk, handling both Gemini and OpenAI-compatible responses. */
function safeChunkText(chunk: any): string {
  try {
    // OpenAI-compatible path: chunk has explicit text field
    if (typeof chunk.text === 'string' && chunk.text !== 'undefined') return chunk.text;
    // Gemini path: chunk is GenerateContentResponse, .text is a getter that can throw
    const raw = chunk.text;
    if (typeof raw === 'string' && raw !== 'undefined') return raw;
    return '';
  } catch {
    return '';
  }
}

/** Strip "undefined" literal strings and raw tool call XML from text output. */
function cleanStreamText(text: string): string {
  return stripRawToolCalls(text)
    .trim();
}

function estimateTokenCount(text: string): number {
  const normalized = text.trim();
  if (!normalized) return 0;
  return Math.max(1, Math.ceil(normalized.length / 4));
}

import type { AgentPhase } from './components/AgentIndicator';
// Context compression
import { needsCompression, compressContext } from './services/contextCompressor';
// Conversation search
import ConversationSearch from './components/ConversationSearch';

type ChatService = ReturnType<typeof createChatService>;
type ChatHistory = Record<string, Message[]>;

const initialBotMessage: Message = {
  id: 'initial-message',
  text: "Hello! I am Scripture Scholar. How can I help you learn about the Book of Mormon or The Church of Jesus Christ of Latter-day Saints today? You can type, use the microphone to talk, or even ask me to find a picture for you.",
  sender: 'bot',
};

interface AudioPlaybackState {
  messageId: string | null;
  status: 'playing' | 'paused' | 'stopped' | 'loading';
  source: AudioBufferSourceNode | null;
  audioBuffer: AudioBuffer | null; // Keep buffer for resume
  startTime: number; // For calculating elapsed time
  pauseTime: number; // Where to resume from
}

const App: React.FC = () => {
  const { settings } = useSettings();
  const [chat, setChat] = useState<ChatService | null>(null);
  
  // -- State Management --
  const [chatHistory, setChatHistory] = useState<ChatHistory>({});
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [pinnedChatIds, setPinnedChatIds] = useState<string[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState<boolean>(false);
  
  // Feature State
  const [chatMode, setChatMode] = useState<ChatMode>('chat');
  const [activeView, setActiveView] = useState<ViewMode>('chat');
  const [isSuggesting, setIsSuggesting] = useState<boolean>(false);
  const [readingContext, setReadingContext] = useState<string | null>(null);
  const [installPromptEvent, setInstallPromptEvent] = useState<any | null>(null);

  // State for Scripture Agent Sidebar
  const [isScriptureAgentOpen, setIsScriptureAgentOpen] = useState(false);
  const [scriptureAgentHistory, setScriptureAgentHistory] = useState<Message[]>([]);
  const [isScriptureAgentLoading, setIsScriptureAgentLoading] = useState(false);
  const [scriptureAgentContext, setScriptureAgentContext] = useState<{ book: string; chapter: number; verse: number; text: string; } | null>(null);

  // State for voice chat / journaling
  const [session, setSession] = useState<Session | null>(null);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // State for audio playback
  const [audioPlayback, setAudioPlayback] = useState<AudioPlaybackState>({
    messageId: null, status: 'stopped', source: null, audioBuffer: null, startTime: 0, pauseTime: 0,
  });

  // Agent enhancement state
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [memories, setMemories] = useState<MemoryType[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [activeSkill, setActiveSkill] = useState<Skill | null>(null);
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [activeReminder, setActiveReminder] = useState<Reminder | null>(null);
  const [suggestedReminders, setSuggestedReminders] = useState<SuggestedReminder[]>([]);
  const [isSkillSelectorOpen, setIsSkillSelectorOpen] = useState(false);
  const [thinkingDepth, setThinkingDepth] = useState<ThinkingDepth>('medium');
  const [activeAgentName, setActiveAgentName] = useState<string | null>(null);
  const [agentPhase, setAgentPhase] = useState<AgentPhase>('idle');
  const [toolCallsInProgress, setToolCallsInProgress] = useState(0);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [crossReferenceScripture, setCrossReferenceScripture] = useState('');
  const [verboseMode, setVerboseMode] = useState(false);
  const [persona, setPersona] = useState<string>('');

  const [skillSaveOffer, setSkillSaveOffer] = useState<{ chatId: string; messageId: string } | null>(null);

  // Refs for audio processing
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const currentUserMessageIdRef = useRef<string | null>(null);
  const currentBotMessageIdRef = useRef<string | null>(null);
  const chatHistoryRef = useRef<ChatHistory>(chatHistory);
  const activeChatIdRef = useRef<string | null>(activeChatId);
  const scriptureAgentHistoryRef = useRef<Message[]>(scriptureAgentHistory);
  const previousActiveViewRef = useRef<ViewMode>(activeView);
  const proactiveSuggestionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retrySendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSendMessageRef = useRef<((text: string, overrideMode?: ChatMode) => Promise<void>) | null>(null);
  const provider = normalizeApiProvider(settings.provider);

  const navigateToView = useCallback((view: ViewMode) => {
    setCrossReferenceScripture('');
    setActiveView(view);
  }, []);

  // Keep chatHistoryRef in sync so the finally block in handleSendMessage
  // always reads the latest state (avoids stale closure bug).
  useEffect(() => {
    chatHistoryRef.current = chatHistory;
  }, [chatHistory]);

  // Keep activeChatIdRef in sync for callbacks with stale closures
  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  useEffect(() => {
    setReadingContext(null);
  }, [activeChatId]);

  useEffect(() => {
    const previousActiveView = previousActiveViewRef.current;
    previousActiveViewRef.current = activeView;

    if (previousActiveView === 'scripture-reader' && activeView !== 'scripture-reader') {
      setReadingContext(null);
    }
  }, [activeView]);

  useEffect(() => {
    scriptureAgentHistoryRef.current = scriptureAgentHistory;
  }, [scriptureAgentHistory]);

  useEffect(() => {
    return () => {
      if (proactiveSuggestionTimerRef.current) {
        clearTimeout(proactiveSuggestionTimerRef.current);
        proactiveSuggestionTimerRef.current = null;
      }
      if (retrySendTimerRef.current) {
        clearTimeout(retrySendTimerRef.current);
        retrySendTimerRef.current = null;
      }
    };
  }, []);

  const isVoiceChatAvailable = providerSupportsLiveVoice(provider);
  const messages = activeChatId ? chatHistory[activeChatId] || [] : [];

  // --- PWA Install Logic ---
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e);
    };

    const handleAppInstalled = () => {
      setInstallPromptEvent(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallPWA = async () => {
    if (!installPromptEvent) return;
    try {
      installPromptEvent.prompt();
      const { outcome } = await installPromptEvent.userChoice;
      // User responded to install prompt
      void outcome;
    } catch (e) {
      console.error('PWA install prompt failed:', e);
    } finally {
      setInstallPromptEvent(null);
    }
  };

  // --- Data Persistence and Initialization (IndexedDB) ---
  useEffect(() => {
    const initApp = async () => {
      try {
        await migrateFromLocalStorage();

        const hasSeenDisclaimer = await getSetting('hasSeenDisclaimer');
        if (!hasSeenDisclaimer) setShowDisclaimer(true);

        const [loadedHistory, loadedNotes, loadedJournals, loadedPinned, savedActiveId, loadedProfile, loadedSkills, loadedReminders, loadedSessions, savedMemories] = await Promise.all([
          getAllChats(),
          getAllNotes(),
          getAllJournalEntries(),
          getSetting('pinnedChatIds'),
          getSetting('activeChatId'),
          getUserProfile(),
          getAllSkills(),
          getAllReminders(),
          getAllStudySessions(),
          getSetting('memories'),
        ]);

        if (Object.keys(loadedHistory).length > 0) {
          setChatHistory(loadedHistory);
          setActiveChatId(savedActiveId && loadedHistory[savedActiveId] ? savedActiveId : Object.keys(loadedHistory)[0]);
        } else {
          handleNewChat();
        }

        if (loadedPinned) setPinnedChatIds(loadedPinned);
        if (loadedNotes.length > 0) setNotes(loadedNotes);
        if (loadedJournals.length > 0) setJournalEntries(loadedJournals);
        if (loadedProfile) setUserProfile(loadedProfile);
        if (loadedSessions.length > 0) setStudySessions(loadedSessions);
        if (savedMemories) setMemories(savedMemories);

        // Load persona
        const savedPersona = await getPersona();
        if (savedPersona) setPersona(savedPersona);

        // Initialize skills
        if (loadedSkills.length > 0) {
          setSkills(loadedSkills);
        } else {
          // First run: seed built-in skills into IndexedDB
          const builtins = initializeSkills();
          for (const skill of builtins) {
            await saveSkillDB(skill);
          }
          setSkills(builtins);
        }

        // Initialize reminders
        if (loadedReminders.length > 0) setReminders(loadedReminders);

      } catch (e) {
        console.error("Failed to initialize app:", e);
        handleNewChat();
      }
    };
    initApp();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist chat history to IndexedDB
  useEffect(() => {
    if (Object.keys(chatHistory).length > 0) {
      for (const [chatId, msgs] of Object.entries(chatHistory)) {
        saveChat(chatId, msgs as Message[]).catch(e => console.error('Failed to save chat:', e));
      }
    }
    if (activeChatId) {
      setSetting('activeChatId', activeChatId).catch(() => {});
    }
    setSetting('pinnedChatIds', pinnedChatIds).catch(() => {});
  }, [chatHistory, activeChatId, pinnedChatIds]);

  // Persist notes/journals
  useEffect(() => {
    for (const note of notes) {
      saveNote(note).catch(() => {});
    }
  }, [notes]);
  useEffect(() => {
    for (const entry of journalEntries) {
      saveJournalEntry(entry).catch(() => {});
    }
  }, [journalEntries]);

  // Start reminder polling once and listen for reminder events from the service layer.
  useEffect(() => {
    const handleReminder = (event: Event) => {
      const detail = (event as CustomEvent<Reminder>).detail;
      if (detail) {
        setActiveReminder(detail);
      }
    };

    window.addEventListener('study-reminder', handleReminder as EventListener);
    startReminderCheck();

    return () => {
      window.removeEventListener('study-reminder', handleReminder as EventListener);
      stopReminderCheck();
    };
  }, []);

  // Run memory consolidation periodically
  useEffect(() => {
    const interval = setInterval(() => {
      consolidateMemories().catch(() => {});
    }, 3600000); // Every hour
    return () => clearInterval(interval);
  }, []);

  const initializeChat = useCallback(() => {
    setError(null);
    try {
      const isConfigured = (providerSupportsLiveVoice(provider) && settings.googleApiKey) ||
                           (provider === 'lmstudio' && settings.lmStudioBaseUrl && settings.model) ||
                           (provider === 'openrouter' && settings.openRouterApiKey && settings.model) ||
                           (provider === 'mcp' && settings.mcpBaseUrl && settings.model) ||
                           (provider === 'minimax' && settings.minimaxApiKey && settings.model);

      if (isConfigured && activeChatId) {
        const currentHistory = chatHistory[activeChatId] || [];
        const chatOptions: ChatServiceOptions = {
          profile: userProfile,
          memories: memories.slice(0, 5),
          activeSkill,
          readingContext: readingContext || undefined,
          thinkingDepth,
          verbose: verboseMode,
          persona,
        };
        const newChat = createChatServiceWithFailover(settings, chatMode, currentHistory, chatOptions);
        setChat(newChat);
      } else {
        setChat(null);
        if (activeView === 'chat') {
          setError("Please configure your API provider in the settings.");
        }
      }
    } catch (err: any) {
      console.error("Initialization error:", err);
      setError(`Could not initialize the chat: ${err.message}`);
      setChat(null);
    }
  }, [settings, provider, chatMode, activeChatId, chatHistory, activeView, userProfile, memories, activeSkill, readingContext, thinkingDepth, persona]);
  
  useEffect(() => {
    initializeChat();
    if (!isVoiceChatAvailable && isVoiceActive) {
      stopVoiceSession();
    }
  }, [initializeChat, isVoiceChatAvailable, isVoiceActive]);

  const handleDisclaimerClose = async (dontShowAgain: boolean) => {
    if (dontShowAgain) {
      await setSetting('hasSeenDisclaimer', true);
    }
    setShowDisclaimer(false);
  };

  const handleNewChat = () => {
    const newId = `chat-${Date.now()}`;
    setReadingContext(null);
    setChatHistory(prev => ({ ...prev, [newId]: [initialBotMessage] }));
    setActiveChatId(newId);
    setChatMode('chat');
    setActiveView('chat');
  };

  const handleClearHistory = async () => {
    if (window.confirm("Are you sure you want to delete all chat history? This action cannot be undone.")) {
      await clearAllChats();
      window.location.reload();
    }
  };

  const handleTogglePinChat = (chatId: string) => {
    setPinnedChatIds(prev => {
      const isPinned = prev.includes(chatId);
      if (isPinned) {
        return prev.filter(id => id !== chatId);
      } else {
        return [chatId, ...prev];
      }
    });
  };

  const triggerProactiveSuggestion = useCallback(async () => {
    if (isSuggesting || chatMode !== 'chat' || !activeChatId) return;

    setIsSuggesting(true);
    try {
      const relevantMessages = chatHistory[activeChatId]?.filter(m => !m.isSuggestion) || [];
      const history: Content[] = relevantMessages.slice(-4).map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }]
      }));

      if (history.length > 0 && history[history.length - 1].role === 'model') history.pop();
      if (history.length === 0 || history[history.length - 1].role !== 'user') {
        setIsSuggesting(false);
        return;
      }

      const suggestion = await getProactiveSuggestion(settings, history);
      if (suggestion) {
        const suggestionMessage: Message = { id: `suggestion-${Date.now()}`, text: suggestion, sender: 'bot', isSuggestion: true };
        setChatHistory(prev => ({...prev, [activeChatId]: [...(prev[activeChatId] || []), suggestionMessage]}));
      }
    } catch (err) {
      console.error("Proactive suggestion failed:", err);
    } finally {
      setIsSuggesting(false);
    }
  }, [chatHistory, settings, isSuggesting, chatMode, activeChatId]);


  // Handle slash commands
  const handleSlashCommand = async (text: string): Promise<boolean> => {
    const [cmd, ...args] = text.trim().split(/\s+/);
    const command = cmd.toLowerCase();

    const scheduleRetrySend = (message: string, delayMs: number) => {
      if (retrySendTimerRef.current) {
        clearTimeout(retrySendTimerRef.current);
      }
      retrySendTimerRef.current = setTimeout(() => {
        retrySendTimerRef.current = null;
        void handleSendMessageRef.current?.(message);
      }, delayMs);
    };

    switch (command) {
      case '/study':
      case '/plan':
        setChatMode('study-plan');
        setActiveView('chat');
        if (args.length > 0) {
          const prompt = args.join(' ');
          await handleSendMessageRef.current?.(prompt, 'study-plan');
        }
        return true;
      case '/quiz':
        setChatMode('multi-quiz');
        setActiveView('chat');
        if (args.length > 0) {
          const prompt = args.join(' ');
          await handleSendMessageRef.current?.(prompt, 'multi-quiz');
        }
        return true;
      case '/lesson':
        setChatMode('lesson-prep');
        setActiveView('chat');
        if (args.length > 0) {
          const prompt = args.join(' ');
          await handleSendMessageRef.current?.(prompt, 'lesson-prep');
        }
        return true;
      case '/fhe':
        setChatMode('fhe-planner');
        setActiveView('chat');
        if (args.length > 0) {
          const prompt = args.join(' ');
          await handleSendMessageRef.current?.(prompt, 'fhe-planner');
        }
        return true;
      case '/explain':
      case '/cross-ref':
        setActiveView('cross-reference');
        setCrossReferenceScripture(args.join(' '));
        return true;
      case '/image':
        setChatMode('chat');
        setActiveView('chat');
        if (args.length > 0) {
          const prompt = args.join(' ');
          await handleSendMessageRef.current?.(prompt, 'chat');
        } else {
          setError(`Usage: ${command} <topic or scripture>`);
        }
        return true;
      case '/new':
        handleNewChat();
        return true;
      case '/reset':
        if (activeChatId) {
          setChatHistory(prev => ({ ...prev, [activeChatId]: [initialBotMessage] }));
        }
        return true;
      case '/compact':
        if (activeChatId) {
          try {
            const currentMessages = chatHistoryRef.current[activeChatId] || [];
            const compressed = await compressContext(currentMessages, settings);
            setChatHistory(prev => ({ ...prev, [activeChatId]: compressed }));
          } catch (e) {
            console.error("Context compression failed:", e);
            setError("Failed to compress context. Please try again.");
          }
        }
        return true;
      case '/search':
        setIsSearchOpen(true);
        return true;
      case '/insights':
        if (!activeChatId) return true;
        {
          const targetChatId = activeChatId;
          const currentMessages = (chatHistoryRef.current[activeChatId] || [])
            .filter(m => !m.isSuggestion && m.id !== 'initial-message');

          if (currentMessages.length === 0) {
            const msg: Message = {
              id: `insights-${Date.now()}`,
              text: 'I need a little more conversation before I can generate insights. Ask a few questions or share more context, then try `/insights` again.',
              sender: 'bot',
            };
            setChatHistory(prev => ({ ...prev, [targetChatId]: [...(prev[targetChatId] || []), msg] }));
            return true;
          }

          const placeholderId = `insights-${Date.now()}`;
          const placeholder: Message = {
            id: placeholderId,
            text: 'Analyzing this conversation for key themes and scripture insights...',
            sender: 'bot',
          };
          setChatHistory(prev => ({ ...prev, [targetChatId]: [...(prev[targetChatId] || []), placeholder] }));

          const transcript = currentMessages
            .map(msg => `${msg.sender === 'user' ? 'User' : 'Assistant'}: ${msg.text}`)
            .join('\n');

          void getJournalInsights(settings, transcript)
            .then(insights => {
              const summary = typeof insights?.summary === 'string' ? insights.summary.trim() : '';
              const principles = Array.isArray(insights?.principles) ? insights.principles.filter((p: unknown) => typeof p === 'string' && p.trim()) : [];
              const suggestedScripture = typeof insights?.suggestedScripture === 'string' ? insights.suggestedScripture.trim() : '';

              const formatted = [
                '**Conversation Insights**',
                summary ? `**Summary:** ${summary}` : null,
                principles.length > 0 ? `**Key Principles:**\n${principles.map((p: string) => `- ${p}`).join('\n')}` : null,
                suggestedScripture ? `**Suggested Scripture:** ${suggestedScripture}` : null,
              ].filter(Boolean).join('\n\n');

              const finalText = formatted || 'I could not generate insights from that conversation yet. Try again after a little more context.';
              setChatHistory(prev => ({
                ...prev,
                [targetChatId]: prev[targetChatId]?.map(msg => msg.id === placeholderId ? { ...msg, text: finalText } : msg),
              }));
            })
            .catch(err => {
              console.error('Insights generation failed:', err);
              setChatHistory(prev => ({
                ...prev,
                [targetChatId]: prev[targetChatId]?.map(msg => msg.id === placeholderId
                  ? { ...msg, text: 'I could not generate insights right now. Please try again in a moment.' }
                  : msg),
              }));
            });
        }
        return true;
      case '/skill':
        if (args[0]) {
          const skill = getSkillById(args[0]);
          if (skill) {
            setActiveSkill(prev => {
              const next = prev?.id === skill.id ? null : skill;
              if (next) {
                // Track skill usage when activated
                updateSkillUsage(skill.id).catch(() => {});
              }
              return next;
            });
          }
        } else {
          setIsSkillSelectorOpen(true);
        }
        return true;
      case '/dashboard':
        setActiveView('dashboard');
        return true;
      case '/reminders':
        setActiveView('reminders');
        return true;
      case '/retry':
        if (activeChatId) {
          const msgs = chatHistory[activeChatId] || [];
          // Find last user message
          const lastUserIdx = [...msgs].reverse().findIndex(m => m.sender === 'user' && !m.isSuggestion);
          if (lastUserIdx !== -1) {
            const actualIdx = msgs.length - 1 - lastUserIdx;
            const lastUserMsg = msgs[actualIdx];
            // Remove the last bot response (if any) and resend
            const newMsgs = msgs.slice(0, actualIdx);
            setChatHistory(prev => ({ ...prev, [activeChatId]: newMsgs }));
            // Re-trigger send after a tick
            scheduleRetrySend(lastUserMsg.text, 100);
          }
        }
        return true;
      case '/undo':
        if (activeChatId) {
          const msgs = chatHistory[activeChatId] || [];
          // Find last user message and remove it + its bot response
          const lastUserIdx = [...msgs].reverse().findIndex(m => m.sender === 'user' && !m.isSuggestion);
          if (lastUserIdx !== -1) {
            const actualIdx = msgs.length - 1 - lastUserIdx;
            // Keep everything up to (not including) the last user message
            const newMsgs = msgs.slice(0, actualIdx);
            setChatHistory(prev => ({ ...prev, [activeChatId]: newMsgs }));
          }
        }
        return true;
      case '/status':
        if (activeChatId) {
          const msgs = chatHistory[activeChatId] || [];
          const msgCount = msgs.filter(m => !m.isSuggestion && m.id !== 'initial-message').length;
          const statusText = [
            `**System Status**`,
            `Provider: ${provider}`,
            `Model: ${settings.model || 'default'}`,
            `Chat Mode: ${chatMode}`,
            `Active Skill: ${activeSkill?.name || 'none'}`,
            `Messages in chat: ${msgCount}`,
            `Memories stored: ${memories.length}`,
            `Study Streak: ${userProfile?.streakDays || 0} days`,
            `Thinking Depth: ${thinkingDepth}`,
          ].join('\n');
          const statusMsg: Message = { id: `status-${Date.now()}`, text: statusText, sender: 'bot' };
          setChatHistory(prev => ({ ...prev, [activeChatId]: [...(prev[activeChatId] || []), statusMsg] }));
        }
        return true;
      case '/usage':
        if (activeChatId) {
          const usage = await getUsageTracker();
          const cost = estimateCost(provider, usage.sessionTokens);
          const usageText = [
            `**Usage Statistics**`,
            `Provider: ${provider}`,
            `Session tokens: ${usage.sessionTokens.toLocaleString()}`,
            `Session cost: ${cost}`,
            `Total tokens (all time): ${usage.totalTokens.toLocaleString()}`,
            `Messages this session: ${usage.messageCount}`,
          ].join('\n');
          const usageMsg: Message = { id: `usage-${Date.now()}`, text: usageText, sender: 'bot' };
          setChatHistory(prev => ({ ...prev, [activeChatId]: [...(prev[activeChatId] || []), usageMsg] }));
        }
        return true;
      case '/think':
        if (args[0] && ['light', 'medium', 'deep'].includes(args[0])) {
          setThinkingDepth(args[0] as ThinkingDepth);
          const thinkMsg: Message = { id: `think-${Date.now()}`, text: `Thinking depth set to **${args[0]}**.`, sender: 'bot' };
          if (activeChatId) {
            setChatHistory(prev => ({ ...prev, [activeChatId]: [...(prev[activeChatId] || []), thinkMsg] }));
          }
        } else {
          const errMsg: Message = { id: `think-err-${Date.now()}`, text: 'Usage: `/think light`, `/think medium`, or `/think deep`', sender: 'bot' };
          if (activeChatId) {
            setChatHistory(prev => ({ ...prev, [activeChatId]: [...(prev[activeChatId] || []), errMsg] }));
          }
        }
        return true;
      case '/verbose': {
        const newVerbose = args[0] === 'on' ? true : args[0] === 'off' ? false : !verboseMode;
        setVerboseMode(newVerbose);
        const verboseMsg: Message = { id: `verbose-${Date.now()}`, text: `Verbose mode ${newVerbose ? 'enabled' : 'disabled'}. Responses will be ${newVerbose ? 'more detailed' : 'more concise'}.`, sender: 'bot' };
        if (activeChatId) {
          setChatHistory(prev => ({ ...prev, [activeChatId]: [...(prev[activeChatId] || []), verboseMsg] }));
        }
        await setSetting('verboseMode', newVerbose);
        return true;
      }
      case '/persona':
        if (args.length > 0) {
          const newPersona = args.join(' ');
          setPersona(newPersona);
          await savePersona(newPersona);
          if (activeChatId) {
            const msg: Message = { id: `persona-${Date.now()}`, text: `Persona updated: "${newPersona}"`, sender: 'bot' };
            setChatHistory(prev => ({ ...prev, [activeChatId]: [...(prev[activeChatId] || []), msg] }));
          }
        } else {
          if (activeChatId) {
            const msg: Message = { id: `persona-${Date.now()}`, text: persona ? `Current persona: "${persona}"\n\nUsage: /persona <description>\nExample: /persona I am a seminary teacher preparing students for missions` : 'No persona set.\n\nUsage: /persona <description>\nExample: /persona I am a seminary teacher preparing students for missions', sender: 'bot' };
            setChatHistory(prev => ({ ...prev, [activeChatId]: [...(prev[activeChatId] || []), msg] }));
          }
        }
        return true;
      default:
        return false;
    }
  };

  const handleSendMessage = async (text: string, overrideMode?: ChatMode) => {
    if (isLoading || (isVoiceChatAvailable && isVoiceActive) || !activeChatId) return;

    // Handle slash commands locally
    const trimmed = text.trim();
    if (trimmed.startsWith('/')) {
      const handled = await handleSlashCommand(trimmed);
      if (handled) return;
    }

    let chatService = chat;
    let effectiveMode = overrideMode || chatMode;
    setAgentPhase('thinking');
    setToolCallsInProgress(0);

    // Auto-route to specialized mode if pattern matches (sub-agent routing)
  let agentSystemPrompt: string | undefined;
    if (!overrideMode && chatMode === 'chat') {
        const matchedAgent = routeToAgent(trimmed, chatMode);
        if (matchedAgent) {
            setActiveAgentName(matchedAgent.name);
            agentSystemPrompt = matchedAgent.systemPrompt;
            const modeMap: Record<string, ChatMode> = {
                research: 'chat',
                studyPlanner: 'study-plan',
                quizMaster: 'multi-quiz',
                lessonPrep: 'lesson-prep',
            };
            if (modeMap[matchedAgent.id]) {
                effectiveMode = modeMap[matchedAgent.id];
            }
        } else {
            setActiveAgentName('General Chat Agent');
            agentSystemPrompt = 'You are a helpful LDS scripture scholar assistant. Keep ordinary chat natural, concise, and grounded in scripture when relevant.';
        }
    } else if (chatMode === 'chat') {
        setActiveAgentName('General Chat Agent');
        agentSystemPrompt = 'You are a helpful LDS scripture scholar assistant. Keep ordinary chat natural, concise, and grounded in scripture when relevant.';
    }

    // Create a temporary service if an override is requested and it's different from the current mode
    if (effectiveMode !== chatMode) {
        try {
            let currentHistory = chatHistory[activeChatId] || [];
            // Auto-compress if context is too large
            if (needsCompression(currentHistory)) {
              currentHistory = await compressContext(currentHistory, settings);
            }
            chatService = createChatServiceWithFailover(settings, effectiveMode, currentHistory, {
        profile: userProfile,
        memories: memories.slice(0, 5),
        activeSkill,
        readingContext: readingContext || undefined,
        thinkingDepth,
        verbose: verboseMode,
        persona,
        agentSystemPrompt,
      });
        } catch (err: any) {
            console.error("Temporary chat service initialization error:", err);
            setError(`Could not initialize the chat for this request: ${err.message}`);
            return;
        }
    }

    if (!chatService) {
       setError("Chat is not initialized. Please check settings.");
       return;
    }
    
    const messageToSend = (activeView === 'scripture-reader' && readingContext)
      ? `With the context of ${readingContext}, please answer the following: ${text}`
      : text;

    const newUserMessage: Message = { id: Date.now().toString(), text, sender: 'user' };
    const botMessageId = `${Date.now()}-bot`;
    const botPlaceholder: Message = { id: botMessageId, text: '', sender: 'bot' };

    setChatHistory(prev => ({
        ...prev,
        [activeChatId]: [...(prev[activeChatId] || []), newUserMessage, botPlaceholder]
    }));
    
    setIsLoading(true);
    setError(null);
    
    let requestError = null;
    let accumulatedText = "";
    let finalVisibleText = "";
    try {
      setAgentPhase('responding');
      const responseStream = await chatService.sendMessageStream({ message: messageToSend });
      let groundingChunks: GroundingChunk[] | undefined = undefined;
      let lastGoogleResponse: GenerateContentResponse | null = null;

      for await (const chunk of responseStream) {
        if (chunk.isToolCall) continue; // Skip tool call chunks
 accumulatedText += safeChunkText(chunk);

        if (provider === 'google') {
          const fullResponse = chunk as GenerateContentResponse;
          lastGoogleResponse = fullResponse;
          const newGrounding = fullResponse.candidates?.[0]?.groundingMetadata?.groundingChunks;
          if (newGrounding) groundingChunks = newGrounding;
        }

        let visibleText = cleanStreamText(accumulatedText);
        let thinkingText: string | undefined = undefined;

        // Live-parse the thinking tags during the stream
        const thinkingStartTag = '<thinking>';
        const thinkingEndTag = '</thinking>';
        const startIdx = accumulatedText.indexOf(thinkingStartTag);

        if (startIdx !== -1) {
            const endIdx = accumulatedText.indexOf(thinkingEndTag);
      let rawVisible = accumulatedText.substring(0, startIdx);
            
            if (endIdx !== -1 && endIdx > startIdx) {
                // Tag is complete
                thinkingText = accumulatedText.substring(startIdx + thinkingStartTag.length, endIdx);
        rawVisible += accumulatedText.substring(endIdx + thinkingEndTag.length);
            } else {
                // Tag is not yet closed, so everything after it is thinking
                thinkingText = accumulatedText.substring(startIdx + thinkingStartTag.length);
      }
      // Apply tool-call stripping to visible portion
      visibleText = cleanStreamText(rawVisible);
            }

        setChatHistory(prev => ({
            ...prev,
            [activeChatId]: prev[activeChatId]?.map(msg => 
                msg.id === botMessageId ? { ...msg, text: visibleText.trim(), thinking: thinkingText?.trim(), groundingChunks } : msg
            )
        }));
      }
      
      finalVisibleText = cleanStreamText(accumulatedText);
      let finalThinkingText: string | undefined = undefined;

      const thinkingRegex = /<thinking>([\s\S]*)<\/thinking>/;
      const matchFinal = accumulatedText.match(thinkingRegex);
      if (matchFinal) {
          finalThinkingText = matchFinal[1].trim();
          finalVisibleText = accumulatedText.replace(thinkingRegex, '').trim();
      }

      const wikimediaRegex = /WIKIMEDIA_SEARCH\[(.*?)\]/;
      const matchImage = finalVisibleText.match(wikimediaRegex);
      if (matchImage) {
        const filename = matchImage[1];
        try {
          const loadingText = finalVisibleText.replace(matchImage[0], "Searching for the image...");
          setChatHistory(prev => ({ ...prev, [activeChatId]: prev[activeChatId]?.map(msg =>
            msg.id === botMessageId ? { ...msg, text: loadingText, thinking: finalThinkingText } : msg
          )}));

          const imageUrl = await getWikimediaImageUrl(filename);
          const altText = filename.replace('File:', '').replace(/_/g, ' ').replace(/\.[^/.]+$/, '');
          finalVisibleText = finalVisibleText.replace(matchImage[0], `![${altText}](${imageUrl})`);
        } catch(e) {
          console.error("Wikimedia fetch failed:", e);
          finalVisibleText = finalVisibleText.replace(matchImage[0], `I was unable to find an image for "${filename.replace('File:', '').replace(/_/g, ' ')}".`);
        }
      }
  
        // Handle tool calls if present
      const toolCallResults: ToolCall[] = [];
      if (lastGoogleResponse && chatService.handleToolCalls) {
        try {
          setAgentPhase('acting');
          const followUpResponse = await chatService.handleToolCalls(lastGoogleResponse);
          if (followUpResponse) {
            // Get the tool calls that were executed
            if (chatService.getToolCalls) {
              toolCallResults.push(...chatService.getToolCalls());
            }
            setToolCallsInProgress(toolCallResults.length);
            setAgentPhase('reflecting');
            // Accumulate the follow-up response text
        const followUpText = cleanStreamText(followUpResponse.text || '');
            if (followUpText) {
              accumulatedText += '\n\n' + followUpText;
          finalVisibleText = cleanStreamText(accumulatedText);
            }
          }
        } catch (toolErr) {
      console.error('Tool execution failed:', toolErr);
      finalVisibleText += '\n\n*Note: A tool call failed during processing. The response may be incomplete.*';
        }
      }

      setChatHistory(prev => ({
          ...prev,
          [activeChatId]: prev[activeChatId]?.map(msg => {
            if (msg.id !== botMessageId) return msg;

            let finalMsg = { ...msg, text: finalVisibleText, thinking: finalThinkingText, groundingChunks, toolCalls: toolCallResults.length > 0 ? toolCallResults : undefined };
            const currentMode = effectiveMode;
            if (currentMode === 'study-plan' || currentMode === 'multi-quiz') {
                try {
                    const cleanedJsonText = finalVisibleText.replace(/```json/g, '').replace(/```/g, '').trim();
                    const parsedJson = JSON.parse(cleanedJsonText);
                    if (currentMode === 'study-plan') return { ...msg, text: '', thinking: finalThinkingText, studyPlan: parsedJson as StudyPlan };
                    if (currentMode === 'multi-quiz') return { ...msg, text: '', thinking: finalThinkingText, multiQuiz: parsedJson as MultiQuiz };
                } catch (e) {
                    console.error(`JSON Parse Error in ${currentMode}:`, e, "Original text:", finalVisibleText);
                    return { ...msg, text: `Sorry, I couldn't create a ${currentMode}. Please try again.`, thinking: finalThinkingText };
                }
            }
            return finalMsg;
        })
      }));

    } catch (err) {
      console.error("Error sending message:", err);
      requestError = err;
      setAgentPhase('done');

      // Smart fallback based on user's message intent
      const lowerText = text.toLowerCase();
      let errorMessage: string;

      if (lowerText.includes('scripture') || lowerText.includes('verse') || lowerText.includes('read')) {
        errorMessage = "I had trouble processing that scripture request. Could you try rephrasing with a specific reference (e.g., '2 Nephi 2:25')?";
      } else if (lowerText.includes('quiz') || lowerText.includes('test')) {
        errorMessage = "I couldn't generate a quiz right now. Try asking about a specific topic like 'quiz me on faith' or 'test my knowledge of the Book of Mormon'.";
      } else if (lowerText.includes('lesson') || lowerText.includes('teach')) {
        errorMessage = "I had trouble preparing that lesson. Try specifying a topic and audience (e.g., 'prepare a lesson on charity for youth').";
      } else if (err instanceof TypeError && err.message === 'Failed to fetch') {
          errorMessage = `I couldn't connect to the ${provider} API. Please check that your server is running and your settings are correct.`;
      } else {
        errorMessage = "I encountered an unexpected issue. Please try again, or try rephrasing your question.";
      }
      
      setError(errorMessage);
      setChatHistory(prev => ({...prev, [activeChatId]: prev[activeChatId]?.map(msg => msg.id === botMessageId ? { ...msg, text: errorMessage } : msg)}));
    } finally {
      setIsLoading(false);
      setToolCallsInProgress(0);
      setActiveAgentName(null);
      setAgentPhase('idle');
      if (!requestError && activeChatId) {
        const promptTokens = estimateTokenCount(messageToSend);
        const completionTokens = estimateTokenCount(finalVisibleText);
        const totalTokens = promptTokens + completionTokens;
        if (totalTokens > 0) {
          addUsage(provider, totalTokens, 1).catch(() => {});
        }
      }
      if (effectiveMode === 'chat' && !requestError && activeChatId) {
          if (proactiveSuggestionTimerRef.current) {
            clearTimeout(proactiveSuggestionTimerRef.current);
          }
          proactiveSuggestionTimerRef.current = setTimeout(() => {
            proactiveSuggestionTimerRef.current = null;
            void triggerProactiveSuggestion();
          }, 2000);
          // Extract and store memories from the conversation (async, non-blocking)
          const currentMessages = chatHistoryRef.current[activeChatId] || [];
          if (currentMessages.length >= 4) {
            extractMemories(currentMessages, settings)
              .then(extracted => {
                if (extracted.length > 0) {
                  storeMemories(extracted);
                  // Update memories state
                  retrieveRelevantMemories('', 5).then(setMemories);
                }
              })
              .catch(() => {});
            // Suggest reminders based on conversation context (async, non-blocking)
            suggestReminders(text, settings)
              .then(suggestions => {
                if (suggestions.length > 0) {
                  setSuggestedReminders(suggestions);
                }
              })
              .catch(() => {});
            // Update user profile from conversation
            updateProfileFromConversation(currentMessages, settings)
              .then(async () => {
                const updated = await getUserProfile();
                if (updated) {
                  // Update study streak
                  const today = new Date().toISOString().split('T')[0];
                  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
                  if (updated.lastStudyDate !== today) {
                    updated.streakDays = updated.lastStudyDate === yesterday
                      ? (updated.streakDays || 0) + 1
                      : 1;
                    updated.longestStreak = Math.max(updated.longestStreak || 0, updated.streakDays);
                    updated.lastStudyDate = today;
                  }
                  updated.totalStudySessions = (updated.totalStudySessions || 0) + 1;
                  updated.lastActiveDate = today;
                  await saveUserProfile(updated);
                  setUserProfile(updated);
                }
              })
              .catch(() => {});

            // Record study session
            const topics = text.toLowerCase().match(/\b(faith|repentance|baptism|prayer|scripture|prophet|atonement|temple|covenant|priesthood|testimony|missionary|charity|hope|grace|revelation|restoration|plan of salvation|word of wisdom|tithing|fasting)\b/g);
            const session: StudySession = {
              id: `session-${Date.now()}`,
              chatId: activeChatId,
              date: new Date().toISOString().split('T')[0],
              topic: [...new Set(topics || [])].join(', ') || 'general study',
              messageCount: currentMessages.length,
              toolsUsed: [],
              skillsUsed: activeSkill ? [activeSkill.id] : [],
            };
            saveStudySession(session).catch(() => {});
            setStudySessions(prev => [...prev, session]);
            // Record progress for achievements
            recordConversation().catch(() => {});
            // Proactive memory capture - silently save important user facts
            extractProactiveMemories(currentMessages, settings).catch(() => {});

            // Self-improving skill creation: detect complex conversations
            if (botMessageId) {
              const toolCallCount = currentMessages.reduce((count: number, msg: Message) => count + (msg.toolCalls?.length || 0), 0);
              const isComplex = currentMessages.length >= 6 || toolCallCount > 3;
              if (isComplex) {
                setSkillSaveOffer({ chatId: activeChatId, messageId: botMessageId });
              }
            }
          }
      }
    }
  };

  useEffect(() => {
    handleSendMessageRef.current = handleSendMessage;
  }, [handleSendMessage]);
  
  const handleDeleteMessage = (messageId: string) => {
    if (!activeChatId) return;
    setChatHistory(prev => ({
      ...prev,
      [activeChatId]: (prev[activeChatId] || []).filter(m => m.id !== messageId),
    }));
  };

  const handleRetry = async (botMessageId: string) => {
    if (isLoading || !activeChatId) return;

    const currentMessages = chatHistory[activeChatId] || [];
    const messageIndex = currentMessages.findIndex(msg => msg.id === botMessageId);
    if (messageIndex < 1) return;

    let userMessageToRetry: Message | null = null;
    let userMessageIndex = -1;
    for (let i = messageIndex - 1; i >= 0; i--) {
        if (currentMessages[i].sender === 'user') {
            userMessageToRetry = currentMessages[i];
            userMessageIndex = i;
            break;
        }
    }

    if (userMessageToRetry) {
        setChatHistory(prev => ({...prev, [activeChatId]: currentMessages.slice(0, userMessageIndex + 1)}));
        if (retrySendTimerRef.current) {
            clearTimeout(retrySendTimerRef.current);
        }
        retrySendTimerRef.current = setTimeout(() => {
            retrySendTimerRef.current = null;
            void handleSendMessageRef.current?.(userMessageToRetry!.text);
        }, 50);
    } else {
        setError("Could not find the original prompt to retry.");
    }
  };

  const handleVerseOfTheDay = () => {
    handleSendMessage("Give me an inspiring scripture and a short insight about its meaning.", 'chat');
  };

  const handleExplainVerse = (verse: string) => {
    setActiveView('chat');
    setChatMode('chat');
    handleSendMessage(`Please explain ${verse} in more detail, including its context and key principles.`);
  }

  // Scripture Agent Sidebar Logic
  const runScriptureAgentQuery = async (prompt: string, currentHistory: Message[]) => {
    if (isScriptureAgentLoading) return;

    const botMessageId = `agent-bot-${Date.now()}`;
    const botPlaceholder: Message = { id: botMessageId, text: '', sender: 'bot' };
    scriptureAgentHistoryRef.current = [...currentHistory, botPlaceholder];
    setScriptureAgentHistory([...currentHistory, botPlaceholder]);
    setIsScriptureAgentLoading(true);
    setActiveAgentName('Scripture Agent');
    setAgentPhase('thinking');
    setToolCallsInProgress(0);

    try {
        const agentChatService = createChatServiceWithFailover(settings, 'chat', currentHistory, {
        profile: userProfile,
        memories: memories.slice(0, 5),
        activeSkill,
        readingContext: scriptureAgentContext ? `${scriptureAgentContext.book} ${scriptureAgentContext.chapter}:${scriptureAgentContext.verse} - ${scriptureAgentContext.text}` : undefined,
        agentSystemPrompt: 'You are a scripture study assistant specialized in verse-by-verse analysis. Provide doctrinal insights, cross-references, and practical applications for the specific verse being discussed. Use authoritative LDS sources and teachings.',
      });
        setAgentPhase('responding');
        const responseStream = await agentChatService.sendMessageStream({ message: prompt });

        let accumulatedText = "";
        for await (const chunk of responseStream) {
            if (chunk.isToolCall) continue; // Skip tool call chunks
 accumulatedText += safeChunkText(chunk);
            const visibleText = cleanStreamText(accumulatedText).replace(/<thinking>[\s\S]*?<\/thinking>/, '').trim();
            setScriptureAgentHistory(prev => prev.map(msg => msg.id === botMessageId ? { ...msg, text: visibleText } : msg));
        }
 } catch (err) {
        console.error("Scripture agent error:", err);
        setAgentPhase('done');
        const errorMessage = "Sorry, I encountered an error.";
        setScriptureAgentHistory(prev => prev.map(msg => msg.id === botMessageId ? { ...msg, text: errorMessage } : msg));
    } finally {
        setIsScriptureAgentLoading(false);
        setToolCallsInProgress(0);
        setAgentPhase('idle');
        setActiveAgentName(null);
    }
  };

  const handleAskAboutVerse = (verse: { book: string; chapter: number; verse: number; text: string; }) => {
    const question = `Tell me more about this verse: "${verse.text}" (${verse.book} ${verse.chapter}:${verse.verse})`;
    setScriptureAgentContext(verse);
    setIsScriptureAgentOpen(true);

    const userMessage: Message = { id: `agent-user-${Date.now()}`, text: question, sender: 'user' };
    scriptureAgentHistoryRef.current = [userMessage];
    setScriptureAgentHistory([userMessage]);
    runScriptureAgentQuery(question, [userMessage]);
  };
  
  const handleSendScriptureAgentFollowup = (prompt: string) => {
    const userMessage: Message = { id: `agent-user-${Date.now()}`, text: prompt, sender: 'user' };
    const newHistory = [...scriptureAgentHistoryRef.current, userMessage];
    scriptureAgentHistoryRef.current = newHistory;
    setScriptureAgentHistory(newHistory);
    runScriptureAgentQuery(prompt, newHistory);
  };


  const handleAnswerQuiz = (messageId: string, questionIndex: number, answerIndex: number) => {
    if(!activeChatId) return;
    setChatHistory(prev => ({
        ...prev,
        [activeChatId]: prev[activeChatId]?.map(msg => {
            if (msg.id === messageId && msg.multiQuiz) {
                const newQuestions = [...msg.multiQuiz.questions];
                newQuestions[questionIndex] = { ...newQuestions[questionIndex], userAnswerIndex: answerIndex };
                return { ...msg, multiQuiz: { ...msg.multiQuiz, questions: newQuestions } };
            }
            return msg;
        })
    }));
  };

  const handleResetQuiz = (messageId: string) => {
    if (!activeChatId) return;
    setChatHistory(prev => ({
      ...prev,
      [activeChatId]: prev[activeChatId]?.map(msg => {
        if (msg.id !== messageId || !msg.multiQuiz) return msg;
        return {
          ...msg,
          multiQuiz: {
            ...msg.multiQuiz,
            questions: msg.multiQuiz.questions.map(question => {
              const { userAnswerIndex, ...rest } = question;
              return rest;
            }),
          },
        };
      }),
    }));
  };

  const stopVoiceSession = () => {
    if (session) session.close();
    setSession(null);
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;
    scriptProcessorRef.current?.disconnect();
    scriptProcessorRef.current = null;
    if (inputAudioContextRef.current?.state !== 'closed') inputAudioContextRef.current?.close();
    if (outputAudioContextRef.current?.state !== 'closed') outputAudioContextRef.current?.close();
    outputAudioContextRef.current = null;
    audioSourcesRef.current.forEach(source => source.stop());
    audioSourcesRef.current.clear();
    setIsVoiceActive(false);
    setIsConnecting(false);
    currentUserMessageIdRef.current = null;
    currentBotMessageIdRef.current = null;
  };

  const startVoiceChat = async () => {
    if (!providerSupportsLiveVoice(provider)) {
       setError('Voice chat is currently available only with the selected live-voice provider.');
       return;
     }
     if (!settings.googleApiKey) { setError("A provider API key is not set."); return; }
    setError(null);
    setIsConnecting(true);

    try {
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      if (!outputAudioContextRef.current || outputAudioContextRef.current.state === 'closed') {
        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      nextStartTimeRef.current = 0;

      const sessionPromise = connectLive(settings.googleApiKey, {
        onopen: () => {
          console.debug('Voice session opened');
          const source = inputAudioContextRef.current!.createMediaStreamSource(mediaStreamRef.current!);
          scriptProcessorRef.current = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
          scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
            const pcmBlob = createBlob(inputData);
            sessionPromise.then((session) => session.sendRealtimeInput({ media: pcmBlob }));
          };
          source.connect(scriptProcessorRef.current);
          scriptProcessorRef.current.connect(inputAudioContextRef.current!.destination);
          setIsConnecting(false);
          setIsVoiceActive(true);
        },
        onmessage: async (message: LiveServerMessage) => {
          const currentActiveChatId = activeChatIdRef.current;
          if (!currentActiveChatId) return; // Should not happen but safety check
          // Handle Input Transcription
          if (message.serverContent?.inputTranscription) {
            const text = message.serverContent.inputTranscription.text;
            if (currentUserMessageIdRef.current) {
              setChatHistory(prev => ({...prev, [currentActiveChatId]: prev[currentActiveChatId]?.map(m => m.id === currentUserMessageIdRef.current ? { ...m, text: m.text + text } : m)}));
            } else {
              const id = `user-${Date.now()}`;
              currentUserMessageIdRef.current = id;
              setChatHistory(prev => ({...prev, [currentActiveChatId]: [...(prev[currentActiveChatId] || []), { id, text, sender: 'user' }]}));
            }
          }
          // Handle Bot Response
          if (message.serverContent?.outputTranscription) {
            const text = message.serverContent.outputTranscription.text;
            if (currentBotMessageIdRef.current) {
               setChatHistory(prev => ({...prev, [currentActiveChatId]: prev[currentActiveChatId]?.map(m => m.id === currentBotMessageIdRef.current ? { ...m, text: m.text + text } : m)}));
            } else {
              currentUserMessageIdRef.current = null;
              const id = `bot-${Date.now()}`;
              currentBotMessageIdRef.current = id;
              setChatHistory(prev => ({...prev, [currentActiveChatId]: [...(prev[currentActiveChatId] || []), { id, text, sender: 'bot' }]}));
            }
          }

          const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (audioData) {
            const outputCtx = outputAudioContextRef.current!;
            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
            const audioBuffer = await decodeAudioData(decode(audioData), outputCtx, 24000, 1);
            const source = outputCtx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(outputCtx.destination);
            source.addEventListener('ended', () => { audioSourcesRef.current.delete(source); });
            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current += audioBuffer.duration;
            audioSourcesRef.current.add(source);
          }

          if (message.serverContent?.turnComplete) { currentUserMessageIdRef.current = null; currentBotMessageIdRef.current = null; }
          if (message.serverContent?.interrupted) { audioSourcesRef.current.forEach(source => source.stop()); audioSourcesRef.current.clear(); nextStartTimeRef.current = 0; }
        },
        onerror: (e: ErrorEvent) => { console.error('Voice error:', e); setError('Voice chat error.'); stopVoiceSession(); },
        onclose: (e: CloseEvent) => { console.debug('Voice closed'); stopVoiceSession(); },
      });
      sessionPromise.then(setSession).catch(err => { console.error("Live session failed:", err); setError("Could not start voice chat."); stopVoiceSession(); });
    } catch (err) { console.error("Voice chat failed:", err); setError("Could not access microphone."); stopVoiceSession(); }
  };
  
  const handleToggleVoiceChat = () => {
    (isVoiceActive || isConnecting) ? stopVoiceSession() : startVoiceChat();
  };

  const handleToggleAudio = async (messageId: string, text: string) => {
    // If we're stopping the current sound
    if (audioPlayback.messageId === messageId && audioPlayback.source) {
        audioPlayback.source.stop(); // This will trigger onended
        setAudioPlayback({ messageId: null, status: 'stopped', source: null, audioBuffer: null, startTime: 0, pauseTime: 0 });
        return;
    }

    // Stop any other sound that might be playing before starting a new one
    if (audioPlayback.source) {
        audioPlayback.source.stop();
    }

    setAudioPlayback({ messageId, status: 'loading', source: null, audioBuffer: null, startTime: 0, pauseTime: 0 });
    try {
        if (!providerSupportsTextToSpeech(provider) || !settings.googleApiKey) {
          throw new Error("Text-to-speech is currently available only with the selected live-voice provider.");
        }
        if (!outputAudioContextRef.current || outputAudioContextRef.current.state === 'closed') {
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        const outputCtx = outputAudioContextRef.current;
        await outputCtx.resume();

        const base64Audio = await generateSpeech(settings.googleApiKey, text);
        const audioBuffer = await decodeAudioData(decode(base64Audio), outputCtx, 24000, 1);

        const newSource = outputCtx.createBufferSource();
        newSource.buffer = audioBuffer;
        newSource.connect(outputCtx.destination);
        newSource.start(0);

        newSource.onended = () => {
            // Only clear state if the message that ended is the one we are tracking
            setAudioPlayback(current => {
                if (current.messageId === messageId) {
                    return { messageId: null, status: 'stopped', source: null, audioBuffer: null, startTime: 0, pauseTime: 0 };
                }
                return current;
            });
        };
        
        setAudioPlayback(prev => ({ ...prev, messageId, status: 'playing', source: newSource, audioBuffer }));
    } catch (e) {
        console.error("Audio playback error:", e);
        setError(e instanceof Error ? e.message : "Failed to play audio.");
        setAudioPlayback({ messageId: null, status: 'stopped', source: null, audioBuffer: null, startTime: 0, pauseTime: 0 });
    }
  };

  const handleReminderDismiss = () => setActiveReminder(null);

  const handleReminderStartStudy = () => {
    setActiveReminder(null);
    handleNewChat();
    setActiveView('chat');
  };

  const handleAcceptSuggestedReminder = async (suggestion: SuggestedReminder) => {
    try {
      const reminder = await createReminderFromSuggestion(suggestion);
      setReminders(prev => [...prev, reminder]);
      setSuggestedReminders(prev => prev.filter(r => r !== suggestion));
    } catch (err) {
      console.error('Failed to create reminder:', err);
    }
  };

  const handleDismissSuggestedReminder = (suggestion: SuggestedReminder) => {
    setSuggestedReminders(prev => prev.filter(r => r !== suggestion));
  };

  const renderActiveView = () => {
    switch (activeView) {
      case 'chat':
        return (
          <ChatWindow
            messages={messages}
            isLoading={isLoading}
            onSendMessage={handleSendMessage}
            isVoiceChatActive={isVoiceActive}
            isConnecting={isConnecting}
            onToggleVoiceChat={handleToggleVoiceChat}
            isVoiceChatAvailable={isVoiceChatAvailable}
            modelName={settings.model}
            chatMode={chatMode}
            setChatMode={setChatMode}
            onToggleAudio={handleToggleAudio}
            audioPlaybackState={audioPlayback}
            onAnswerQuiz={handleAnswerQuiz}
            onResetQuiz={handleResetQuiz}
            onExplainVerse={handleExplainVerse}
            onRetry={handleRetry}
            onDeleteMessage={handleDeleteMessage}
            activeAgentName={activeAgentName}
            agentPhase={agentPhase}
            toolCallsInProgress={toolCallsInProgress}
            thinkingDepth={thinkingDepth}
            onThinkingDepthChange={setThinkingDepth}
            activeSkill={activeSkill}
            onOpenSkillSelector={() => setIsSkillSelectorOpen(true)}
          />
        );
      case 'notes':
        return <NotesPanel notes={notes} setNotes={setNotes} onDeleteNote={async (id: string) => {
          await deleteNoteDB(id);
          setNotes(prev => prev.filter(n => n.id !== id));
        }} />;
      case 'journal':
        return (
          <JournalPanel
            entries={journalEntries}
            setEntries={setJournalEntries}
            onDeleteEntry={async (id: string) => {
              await deleteJournalEntryDB(id);
              setJournalEntries(prev => prev.filter(entry => entry.id !== id));
            }}
            isVoiceActive={isVoiceActive}
            setIsVoiceActive={setIsVoiceActive}
            isConnecting={isConnecting}
            setIsConnecting={setIsConnecting}
            isApiConfigured={providerSupportsLiveVoice(provider) && !!settings.googleApiKey}
            googleApiKey={settings.googleApiKey}
            setError={setError}
            stopVoiceSession={stopVoiceSession}
            getJournalInsights={(text) => getJournalInsights(settings, text)}
          />
        );
      case 'cross-reference':
        return <CrossReferencePanel onExplainVerse={handleExplainVerse} initialScripture={crossReferenceScripture} />;
      case 'scripture-reader':
        return <ScripturePanel setReadingContext={setReadingContext} onAskAboutVerse={handleAskAboutVerse} isScriptureAgentOpen={isScriptureAgentOpen} onToggleScriptureAgent={() => setIsScriptureAgentOpen(prev => !prev)} />;
      case 'dashboard':
        return (
          <StudyDashboard
            memories={memories}
            profile={userProfile}
            studySessions={studySessions}
            onNavigate={(view) => navigateToView(view as ViewMode)}
            onDeleteMemory={async (id: string) => {
              await deleteMemoryDB(id);
              setMemories(prev => prev.filter(m => m.id !== id));
            }}
            onRefreshMemories={async () => {
              const refreshed = await retrieveRelevantMemories('', 20);
              setMemories(refreshed);
            }}
          />
        );
      case 'reminders':
        return (
          <RemindersPanel
            reminders={reminders}
            onAdd={async (r) => {
              await saveReminderDB(r);
              setReminders(prev => [...prev, r]);
            }}
            onUpdate={async (r) => {
              const existing = reminders.find(x => x.id === r.id);
              const scheduleChanged = existing
                ? existing.schedule.time !== r.schedule.time ||
                  existing.schedule.days.length !== r.schedule.days.length ||
                  existing.schedule.days.some((day, index) => day !== r.schedule.days[index])
                : false;
              const shouldResetTrigger = scheduleChanged || (r.enabled && existing && !existing.enabled);
              const nextReminder = shouldResetTrigger
                ? { ...r, lastTriggered: undefined }
                : r;
              await saveReminderDB(nextReminder);
              setReminders(prev => prev.map(x => x.id === nextReminder.id ? nextReminder : x));
            }}
            onDelete={async (id) => {
              await deleteReminderDB(id);
              setReminders(prev => prev.filter(x => x.id !== id));
            }}
          />
        );
    case 'skills':
      return (
        <div className="flex-1 flex flex-col bg-slate-900/40 text-gray-200 overflow-y-auto">
          <header className="border-b border-white/10 bg-slate-800/60 p-4 shadow-md backdrop-blur-sm">
            <h2 className="text-lg font-bold text-white">Skills Library</h2>
            <p className="text-sm text-gray-400 mt-1">Activate a skill to enhance your study session</p>
          </header>
          <div className="flex-1 p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {skills.map(skill => (
              <button
                key={skill.id}
                onClick={() => { setActiveSkill(skill); setActiveView('chat'); }}
                className={"p-4 rounded-lg border text-left transition-colors " + (activeSkill?.id === skill.id ? "border-blue-500 bg-blue-600/20" : "border-slate-700 bg-slate-800/50 hover:bg-slate-700/50")}
              >
                <div className="text-2xl mb-2">{skill.icon || '📚'}</div>
                <h3 className="font-semibold text-white">{skill.name}</h3>
                <p className="text-sm text-gray-400 mt-1">{skill.description}</p>
              </button>
            ))}
          </div>
        </div>
      );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-transparent font-sans">
      <div className="hidden md:block md:w-64 flex-shrink-0">
        <Sidebar
          isOpen={true}
          activeView={activeView}
          setActiveView={navigateToView}
          onClose={() => {}}
          chatMode={chatMode}
          setChatMode={setChatMode}
          isLoading={isLoading}
          isVoiceActive={isVoiceActive}
          isConnecting={isConnecting}
          onVerseOfTheDay={handleVerseOfTheDay}
          onOpenSettings={() => setIsSettingsOpen(true)}
          chatHistory={chatHistory}
          activeChatId={activeChatId}
          onNewChat={handleNewChat}
          onSelectChat={setActiveChatId}
          pinnedChatIds={pinnedChatIds}
          onTogglePin={handleTogglePinChat}
          onInstallPWA={handleInstallPWA}
          showInstallButton={!!installPromptEvent}
          activeSkill={activeSkill}
          onOpenSkillSelector={() => setIsSkillSelectorOpen(true)}
          onOpenSearch={() => setIsSearchOpen(true)}
        />
      </div>

      <div className="md:hidden">
        <Sidebar
          isOpen={isSidebarOpen}
          activeView={activeView}
          setActiveView={navigateToView}
          onClose={() => setIsSidebarOpen(false)}
          chatMode={chatMode}
          setChatMode={setChatMode}
          isLoading={isLoading}
          isVoiceActive={isVoiceActive}
          isConnecting={isConnecting}
          onVerseOfTheDay={handleVerseOfTheDay}
          onOpenSettings={() => setIsSettingsOpen(true)}
          chatHistory={chatHistory}
          activeChatId={activeChatId}
          onNewChat={handleNewChat}
          onSelectChat={setActiveChatId}
          pinnedChatIds={pinnedChatIds}
          onTogglePin={handleTogglePinChat}
          onInstallPWA={handleInstallPWA}
          showInstallButton={!!installPromptEvent}
          activeSkill={activeSkill}
          onOpenSkillSelector={() => setIsSkillSelectorOpen(true)}
          onOpenSearch={() => setIsSearchOpen(true)}
        />
      </div>

      <main className={`flex-1 flex flex-col relative bg-slate-900/20 transition-all duration-300 ease-in-out ${isScriptureAgentOpen ? 'md:mr-[28rem]' : ''}`}>
        <div className="absolute top-4 left-4 z-20 md:hidden">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 rounded-md bg-slate-800/50 hover:bg-slate-700/70 transition-colors text-gray-300"
            aria-label="Open sidebar"
          >
            <HamburgerIcon />
          </button>
        </div>
        
        {error && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl p-4 z-50">
                <div className="bg-red-800/80 backdrop-blur-sm border border-red-600 text-red-200 px-4 py-3 rounded-md relative shadow-lg" role="alert">
                    <strong className="font-bold">Error: </strong>
                    <span className="block sm:inline">{error}</span>
                    <button onClick={() => setError(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3" aria-label="Close">
                        <svg className="fill-current h-6 w-6 text-red-300" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg>
                    </button>
                </div>
            </div>
        )}

        {renderActiveView()}
        
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onClearHistory={handleClearHistory}
        />

        <DisclaimerModal
          isOpen={showDisclaimer}
          onClose={handleDisclaimerClose}
        />

        {isSkillSelectorOpen && (
          <SkillSelector
            skills={skills}
            activeSkillId={activeSkill?.id || null}
            onSelect={(skill) => {
              setActiveSkill(prev => {
                const next = prev?.id === skill.id ? null : skill;
                if (next) {
                  // Track skill usage when selected from UI
                  updateSkillUsage(skill.id).catch(() => {});
                }
                return next;
              });
              setIsSkillSelectorOpen(false);
            }}
            onClose={() => setIsSkillSelectorOpen(false)}
          />
        )}

        {isSearchOpen && (
          <ConversationSearch
            onNavigate={(chatId) => {
              setActiveChatId(chatId);
              setActiveView('chat');
            }}
            onClose={() => setIsSearchOpen(false)}
          />
        )}

        {activeReminder && (
          <ReminderToast
            reminder={activeReminder}
            onDismiss={handleReminderDismiss}
            onStartStudy={handleReminderStartStudy}
          />
        )}

        {suggestedReminders.length > 0 && (
          <SuggestedReminderToast
            suggestions={suggestedReminders}
            onAccept={handleAcceptSuggestedReminder}
            onDismiss={handleDismissSuggestedReminder}
          />
        )}

        {skillSaveOffer && (
          <SkillSaveOffer
            chatId={skillSaveOffer.chatId}
            messageId={skillSaveOffer.messageId}
            chatHistory={chatHistory}
            onSave={async (skill) => {
              await saveSkillDB(skill);
              const allSkills = await getAllSkills();
              setSkills(allSkills);
              setSkillSaveOffer(null);
            }}
            onDismiss={() => setSkillSaveOffer(null)}
          />
        )}
      </main>

      <ScriptureAgentSidebar
        isOpen={isScriptureAgentOpen}
        onClose={() => setIsScriptureAgentOpen(false)}
        context={scriptureAgentContext}
        messages={scriptureAgentHistory}
        isLoading={isScriptureAgentLoading}
        onSendMessage={handleSendScriptureAgentFollowup}
      />
    </div>
  );
};

export default App;
