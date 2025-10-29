import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Message, ChatMode, ViewMode, GroundingChunk, StudyPlan, MultiQuiz, Note, JournalEntry } from './types';
// Fix: Replaced 'LiveSession' with 'Session' as it is not an exported member.
import type { Session, LiveServerMessage, GenerateContentResponse, Content } from '@google/genai';
import { createChatService, connectLive, generateSpeech, getJournalInsights, getProactiveSuggestion, getWikimediaImageUrl } from './services/geminiService';
import ChatWindow from './components/ChatWindow';
import Sidebar from './components/Sidebar';
import NotesPanel from './components/NotesPanel';
import JournalPanel from './components/JournalPanel';
import CrossReferencePanel from './components/CrossReferencePanel';
import ScripturePanel from './components/ScripturePanel';
import { createBlob, decode, decodeAudioData } from './utils/audio';
import { useSettings } from './contexts/SettingsContext';
import SettingsModal from './components/SettingsModal';
import HamburgerIcon from './components/HamburgerIcon';
import DisclaimerModal from './components/DisclaimerModal';
import ScriptureAgentSidebar from './components/ScriptureAgentSidebar';

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

  // Refs for audio processing
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const currentUserMessageIdRef = useRef<string | null>(null);
  const currentBotMessageIdRef = useRef<string | null>(null);
  
  const isVoiceChatAvailable = settings.provider === 'google';
  const messages = activeChatId ? chatHistory[activeChatId] || [] : [];

  // --- PWA Install Logic ---
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e);
    };

    const handleAppInstalled = () => {
      setInstallPromptEvent(null);
      console.log('PWA was installed');
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
    installPromptEvent.prompt();
    const { outcome } = await installPromptEvent.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    setInstallPromptEvent(null);
  };

  // --- Data Persistence and Initialization ---
  useEffect(() => {
    try {
      const hasSeenDisclaimer = localStorage.getItem('hasSeenDisclaimer');
      if (!hasSeenDisclaimer) {
        setShowDisclaimer(true);
      }

      const savedHistory = localStorage.getItem('chatHistory');
      const savedActiveId = localStorage.getItem('activeChatId');
      const savedPinnedIds = localStorage.getItem('pinnedChatIds');
      const savedNotes = localStorage.getItem('notes');
      const savedJournals = localStorage.getItem('journalEntries');
      
      const loadedHistory = savedHistory ? JSON.parse(savedHistory) : null;
      if (loadedHistory && Object.keys(loadedHistory).length > 0) {
        setChatHistory(loadedHistory);
        setActiveChatId(savedActiveId && loadedHistory[savedActiveId] ? savedActiveId : Object.keys(loadedHistory)[0]);
      } else {
        handleNewChat();
      }

      if (savedPinnedIds) setPinnedChatIds(JSON.parse(savedPinnedIds));
      if (savedNotes) setNotes(JSON.parse(savedNotes));
      if (savedJournals) setJournalEntries(JSON.parse(savedJournals));

    } catch (e) {
      console.error("Failed to load data from localStorage", e);
      handleNewChat(); // Start fresh if loading fails
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (Object.keys(chatHistory).length > 0) {
      localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
    }
    if (activeChatId) {
      localStorage.setItem('activeChatId', activeChatId);
    }
    localStorage.setItem('pinnedChatIds', JSON.stringify(pinnedChatIds));
  }, [chatHistory, activeChatId, pinnedChatIds]);
  
  useEffect(() => { localStorage.setItem('notes', JSON.stringify(notes)); }, [notes]);
  useEffect(() => { localStorage.setItem('journalEntries', JSON.stringify(journalEntries)); }, [journalEntries]);

  const initializeChat = useCallback(() => {
    setError(null);
    try {
      const isConfigured = (settings.provider === 'google' && settings.googleApiKey) || 
                           (settings.provider !== 'google' && settings.model);

      if (isConfigured && activeChatId) {
        const currentHistory = chatHistory[activeChatId] || [];
        const newChat = createChatService(settings, chatMode, currentHistory);
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
  }, [settings, chatMode, activeChatId, chatHistory, activeView]);
  
  useEffect(() => {
    initializeChat();
    if (!isVoiceChatAvailable && isVoiceActive) {
      stopVoiceSession();
    }
  }, [settings.provider, settings.googleApiKey, settings.model, chatMode, activeChatId, initializeChat, isVoiceChatAvailable, isVoiceActive]);

  const handleDisclaimerClose = (dontShowAgain: boolean) => {
    if (dontShowAgain) {
      localStorage.setItem('hasSeenDisclaimer', 'true');
    }
    setShowDisclaimer(false);
  };

  const handleNewChat = () => {
    const newId = `chat-${Date.now()}`;
    setChatHistory(prev => ({ ...prev, [newId]: [initialBotMessage] }));
    setActiveChatId(newId);
    setChatMode('chat');
    setActiveView('chat');
  };

  const handleClearHistory = () => {
    if (window.confirm("Are you sure you want to delete all chat history? This action cannot be undone.")) {
      localStorage.removeItem('chatHistory');
      localStorage.removeItem('activeChatId');
      localStorage.removeItem('pinnedChatIds');
      window.location.reload(); // Force a full refresh to clear all state
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
    if (isSuggesting || !settings.googleApiKey || chatMode !== 'chat' || !activeChatId) return;
    
    setIsSuggesting(true);
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

    const suggestion = await getProactiveSuggestion(settings.googleApiKey, history);
    if (suggestion) {
      const suggestionMessage: Message = { id: `suggestion-${Date.now()}`, text: suggestion, sender: 'bot', isSuggestion: true };
      setChatHistory(prev => ({...prev, [activeChatId]: [...(prev[activeChatId] || []), suggestionMessage]}));
    }
    setIsSuggesting(false);
  }, [chatHistory, settings.googleApiKey, isSuggesting, chatMode, activeChatId]);


  const handleSendMessage = async (text: string, overrideMode?: ChatMode) => {
    if (isLoading || (isVoiceChatAvailable && isVoiceActive) || !activeChatId) return;

    let chatService = chat;
    // Create a temporary service if an override is requested and it's different from the current mode
    if (overrideMode && overrideMode !== chatMode) {
        try {
            const currentHistory = chatHistory[activeChatId] || [];
            chatService = createChatService(settings, overrideMode, currentHistory);
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
    try {
      const responseStream = await chatService.sendMessageStream({ message: messageToSend });
      let groundingChunks: GroundingChunk[] | undefined = undefined;
      
      for await (const chunk of responseStream) {
        accumulatedText += chunk.text;

        if (settings.provider === 'google') {
          const fullResponse = chunk as GenerateContentResponse;
          const newGrounding = fullResponse.candidates?.[0]?.groundingMetadata?.groundingChunks;
          if (newGrounding) groundingChunks = newGrounding;
        }

        let visibleText = accumulatedText;
        let thinkingText: string | undefined = undefined;

        // Live-parse the thinking tags during the stream
        const thinkingStartTag = '<thinking>';
        const thinkingEndTag = '</thinking>';
        const startIdx = accumulatedText.indexOf(thinkingStartTag);

        if (startIdx !== -1) {
            const endIdx = accumulatedText.indexOf(thinkingEndTag);
            visibleText = accumulatedText.substring(0, startIdx);
            
            if (endIdx !== -1 && endIdx > startIdx) {
                // Tag is complete
                thinkingText = accumulatedText.substring(startIdx + thinkingStartTag.length, endIdx);
                visibleText += accumulatedText.substring(endIdx + thinkingEndTag.length);
            } else {
                // Tag is not yet closed, so everything after it is thinking
                thinkingText = accumulatedText.substring(startIdx + thinkingStartTag.length);
            }
        }

        setChatHistory(prev => ({
            ...prev,
            [activeChatId]: prev[activeChatId]?.map(msg => 
                msg.id === botMessageId ? { ...msg, text: visibleText.trim(), thinking: thinkingText?.trim(), groundingChunks } : msg
            )
        }));
      }
      
      let finalVisibleText = accumulatedText;
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
            setChatHistory(prev => ({ ...prev, [activeChatId]: prev[activeChatId]?.map(msg => msg.id === botMessageId ? { ...msg, text: loadingText, thinking: finalThinkingText } : msg)}));
            
            const imageUrl = await getWikimediaImageUrl(filename);
            const altText = filename.replace('File:', '').replace(/_/g, ' ').replace(/\.[^/.]+$/, "");
            finalVisibleText = finalVisibleText.replace(matchImage[0], `![${altText}](${imageUrl})`);
        } catch(e) {
            console.error("Wikimedia fetch failed:", e);
            finalVisibleText = finalVisibleText.replace(matchImage[0], `I was unable to find an image for "${filename.replace('File:', '').replace(/_/g, ' ')}".`);
        }
      }

      setChatHistory(prev => ({
          ...prev,
          [activeChatId]: prev[activeChatId]?.map(msg => {
            if (msg.id !== botMessageId) return msg;
            
            let finalMsg = { ...msg, text: finalVisibleText, thinking: finalThinkingText, groundingChunks };
            const currentMode = overrideMode || chatMode; // Use override if it exists
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
      let errorMessage = `Sorry, I encountered an error. (${err instanceof Error ? err.message : String(err)})`;

      if (err instanceof TypeError && err.message === 'Failed to fetch' && settings.provider !== 'google') {
        let baseUrl = '';
        switch(settings.provider) {
            case 'lmstudio': baseUrl = settings.lmStudioBaseUrl; break;
            case 'openrouter': baseUrl = settings.openRouterBaseUrl; break;
            case 'mcp': baseUrl = settings.mcpBaseUrl; break;
        }
        errorMessage = `Failed to connect to the model provider at ${baseUrl}. Please ensure the server is running, the URL is correct in settings, and there are no CORS issues.`;
      }
      
      setError(errorMessage);
      setChatHistory(prev => ({...prev, [activeChatId]: prev[activeChatId]?.map(msg => msg.id === botMessageId ? { ...msg, text: errorMessage } : msg)}));
    } finally {
      setIsLoading(false);
      if (chatMode === 'chat' && !requestError) {
          setTimeout(() => triggerProactiveSuggestion(), 2000);
      }
    }
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
        setTimeout(() => handleSendMessage(userMessageToRetry!.text), 50);
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
    setScriptureAgentHistory([...currentHistory, botPlaceholder]);
    setIsScriptureAgentLoading(true);

    try {
        const agentChatService = createChatService(settings, 'chat', currentHistory);
        const responseStream = await agentChatService.sendMessageStream({ message: prompt });

        let accumulatedText = "";
        for await (const chunk of responseStream) {
            accumulatedText += chunk.text;
            const visibleText = accumulatedText.replace(/<thinking>[\s\S]*?<\/thinking>/, '').trim();
            setScriptureAgentHistory(prev => prev.map(msg => msg.id === botMessageId ? { ...msg, text: visibleText } : msg));
        }
    } catch (err) {
        console.error("Scripture agent error:", err);
        const errorMessage = "Sorry, I encountered an error.";
        setScriptureAgentHistory(prev => prev.map(msg => msg.id === botMessageId ? { ...msg, text: errorMessage } : msg));
    } finally {
        setIsScriptureAgentLoading(false);
    }
  };

  const handleAskAboutVerse = (verse: { book: string; chapter: number; verse: number; text: string; }) => {
    const question = `Tell me more about this verse: "${verse.text}" (${verse.book} ${verse.chapter}:${verse.verse})`;
    setScriptureAgentContext(verse);
    setIsScriptureAgentOpen(true);

    const userMessage: Message = { id: `agent-user-${Date.now()}`, text: question, sender: 'user' };
    setScriptureAgentHistory([userMessage]);
    runScriptureAgentQuery(question, [userMessage]);
  };
  
  const handleSendScriptureAgentFollowup = (prompt: string) => {
    const userMessage: Message = { id: `agent-user-${Date.now()}`, text: prompt, sender: 'user' };
    const newHistory = [...scriptureAgentHistory, userMessage];
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

  const stopVoiceSession = () => {
    if (session) session.close();
    setSession(null);
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;
    scriptProcessorRef.current?.disconnect();
    scriptProcessorRef.current = null;
    if (inputAudioContextRef.current?.state !== 'closed') inputAudioContextRef.current?.close();
    audioSourcesRef.current.forEach(source => source.stop());
    audioSourcesRef.current.clear();
    setIsVoiceActive(false);
    setIsConnecting(false);
    currentUserMessageIdRef.current = null;
    currentBotMessageIdRef.current = null;
  };

  const startVoiceChat = async () => {
     if (!settings.googleApiKey) { setError("Google API Key is not set."); return; }
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
          console.log('Voice session opened');
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
          if (!activeChatId) return; // Should not happen but safety check
          // Handle Input Transcription
          if (message.serverContent?.inputTranscription) {
            const text = message.serverContent.inputTranscription.text;
            if (currentUserMessageIdRef.current) {
              setChatHistory(prev => ({...prev, [activeChatId]: prev[activeChatId]?.map(m => m.id === currentUserMessageIdRef.current ? { ...m, text: m.text + text } : m)}));
            } else {
              const id = `user-${Date.now()}`;
              currentUserMessageIdRef.current = id;
              setChatHistory(prev => ({...prev, [activeChatId]: [...(prev[activeChatId] || []), { id, text, sender: 'user' }]}));
            }
          }
          // Handle Bot Response
          if (message.serverContent?.outputTranscription) {
            const text = message.serverContent.outputTranscription.text;
            if (currentBotMessageIdRef.current) {
               setChatHistory(prev => ({...prev, [activeChatId]: prev[activeChatId]?.map(m => m.id === currentBotMessageIdRef.current ? { ...m, text: m.text + text } : m)}));
            } else {
              currentUserMessageIdRef.current = null;
              const id = `bot-${Date.now()}`;
              currentBotMessageIdRef.current = id;
              setChatHistory(prev => ({...prev, [activeChatId]: [...(prev[activeChatId] || []), { id, text, sender: 'bot' }]}));
            }
          }

          const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
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
        onclose: (e: CloseEvent) => { console.log('Voice closed'); stopVoiceSession(); },
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
        if (!settings.googleApiKey) throw new Error("Google API Key is required for text-to-speech.");
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
        
        setAudioPlayback({ ...audioPlayback, messageId, status: 'playing', source: newSource, audioBuffer });
    } catch (e) {
        console.error("Audio playback error:", e);
        setError(e instanceof Error ? e.message : "Failed to play audio.");
        setAudioPlayback({ messageId: null, status: 'stopped', source: null, audioBuffer: null, startTime: 0, pauseTime: 0 });
    }
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
            onExplainVerse={handleExplainVerse}
            onRetry={handleRetry}
          />
        );
      case 'notes':
        return <NotesPanel notes={notes} setNotes={setNotes} />;
      case 'journal':
        return (
          <JournalPanel
            entries={journalEntries}
            setEntries={setJournalEntries}
            isVoiceActive={isVoiceActive}
            setIsVoiceActive={setIsVoiceActive}
            isConnecting={isConnecting}
            setIsConnecting={setIsConnecting}
            isApiConfigured={!!settings.googleApiKey}
            googleApiKey={settings.googleApiKey}
            setError={setError}
            stopVoiceSession={stopVoiceSession}
            getJournalInsights={(text) => getJournalInsights(settings.googleApiKey, text)}
          />
        );
      case 'cross-reference':
        return <CrossReferencePanel onExplainVerse={handleExplainVerse} />;
      case 'scripture-reader':
        return <ScripturePanel setReadingContext={setReadingContext} onAskAboutVerse={handleAskAboutVerse} />;
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
          setActiveView={setActiveView}
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
        />
      </div>

      <div className="md:hidden">
        <Sidebar
          isOpen={isSidebarOpen}
          activeView={activeView}
          setActiveView={setActiveView}
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
