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
  const [notes, setNotes] = useState<Note[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Feature State
  const [chatMode, setChatMode] = useState<ChatMode>('chat');
  const [activeView, setActiveView] = useState<ViewMode>('chat');
  const [isSuggesting, setIsSuggesting] = useState<boolean>(false);
  const [readingContext, setReadingContext] = useState<string | null>(null);

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

  // --- Data Persistence and Initialization ---
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('chatHistory');
      const savedActiveId = localStorage.getItem('activeChatId');
      const savedNotes = localStorage.getItem('notes');
      const savedJournals = localStorage.getItem('journalEntries');
      
      const loadedHistory = savedHistory ? JSON.parse(savedHistory) : null;
      if (loadedHistory && Object.keys(loadedHistory).length > 0) {
        setChatHistory(loadedHistory);
        setActiveChatId(savedActiveId && loadedHistory[savedActiveId] ? savedActiveId : Object.keys(loadedHistory)[0]);
      } else {
        handleNewChat();
      }

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
  }, [chatHistory, activeChatId]);
  
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
      window.location.reload(); // Force a full refresh to clear all state
    }
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


  const handleSendMessage = async (text: string) => {
    if (isLoading || (isVoiceChatAvailable && isVoiceActive) || !activeChatId) return;
    if (!chat) {
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
      const responseStream = await chat.sendMessageStream(messageToSend);
      let groundingChunks: GroundingChunk[] | undefined = undefined;
      
      for await (const chunk of responseStream) {
        accumulatedText += chunk.text;
        const fullResponse = chunk as GenerateContentResponse;
        const newGrounding = fullResponse.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (newGrounding) groundingChunks = newGrounding;

        setChatHistory(prev => ({
            ...prev,
            [activeChatId]: prev[activeChatId]?.map(msg => 
                msg.id === botMessageId ? { ...msg, text: accumulatedText, groundingChunks } : msg
            )
        }));
      }
      
      let finalAccumulatedText = accumulatedText;
      const wikimediaRegex = /WIKIMEDIA_SEARCH\[(.*?)\]/;
      const match = accumulatedText.match(wikimediaRegex);

      if (match) {
        const filename = match[1];
        try {
            const loadingText = accumulatedText.replace(match[0], "Searching for the image...");
            setChatHistory(prev => ({ ...prev, [activeChatId]: prev[activeChatId]?.map(msg => msg.id === botMessageId ? { ...msg, text: loadingText } : msg)}));
            
            const imageUrl = await getWikimediaImageUrl(filename);
            const altText = filename.replace('File:', '').replace(/_/g, ' ').replace(/\.[^/.]+$/, "");
            finalAccumulatedText = accumulatedText.replace(match[0], `![${altText}](${imageUrl})`);
        } catch(e) {
            console.error("Wikimedia fetch failed:", e);
            finalAccumulatedText = accumulatedText.replace(match[0], `I was unable to find an image for "${filename.replace('File:', '').replace(/_/g, ' ')}".`);
        }
      }

      setChatHistory(prev => ({
          ...prev,
          [activeChatId]: prev[activeChatId]?.map(msg => {
            if (msg.id !== botMessageId) return msg;
            
            let finalMsg = { ...msg, text: finalAccumulatedText, groundingChunks };
            if (chatMode === 'study-plan' || chatMode === 'multi-quiz') {
                try {
                    const parsedJson = JSON.parse(finalAccumulatedText);
                    if (chatMode === 'study-plan') return { ...msg, text: '', studyPlan: parsedJson as StudyPlan };
                    if (chatMode === 'multi-quiz') return { ...msg, text: '', multiQuiz: parsedJson as MultiQuiz };
                } catch (e) {
                    return { ...msg, text: `Sorry, I couldn't create a ${chatMode}. Please try again.` };
                }
            }
            return finalMsg;
        })
      }));

    } catch (err) {
      console.error("Error sending message:", err);
      requestError = err;
      const errorMessage = `Sorry, I encountered an error. (${err instanceof Error ? err.message : String(err)})`;
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
    handleSendMessage("Give me an inspiring scripture and a short insight about its meaning.");
  };

  const handleExplainVerse = (verse: string) => {
    setActiveView('chat');
    setChatMode('chat');
    handleSendMessage(`Please explain ${verse} in more detail, including its context and key principles.`);
  }

  const handleAskAboutVerse = (verse: { book: string; chapter: number; verse: number; text: string; }) => {
    if (window.innerWidth < 768) setActiveView('chat');
    handleSendMessage(`Tell me more about this verse: "${verse.text}" (${verse.book} ${verse.chapter}:${verse.verse})`);
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
  
  const handleToggleVoiceChat = () => { (isVoiceActive || isConnecting) ? stopVoiceSession() : startVoiceChat(); };

  const handleToggleAudio = async (messageId: string, text: string) => {
    if (!settings.googleApiKey) { setError("Google API Key is required for TTS."); return; }
    const { status, messageId: currentMessageId, source, audioBuffer, pauseTime } = audioPlayback;

    if (messageId !== currentMessageId && (status === 'playing' || status === 'paused')) {
      if (source) { source.onended = null; source.stop(); }
    }
    
    if (!outputAudioContextRef.current || outputAudioContextRef.current.state === 'closed') {
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (outputAudioContextRef.current.state === 'suspended') await outputAudioContextRef.current.resume();
    const audioCtx = outputAudioContextRef.current!;

    if (messageId !== currentMessageId || status === 'stopped') { // Play new
      setAudioPlayback({ ...audioPlayback, status: 'loading', messageId });
      try {
        const audioData = await generateSpeech(settings.googleApiKey, text);
        const newAudioBuffer = await decodeAudioData(decode(audioData), audioCtx, 24000, 1);
        const newSource = audioCtx.createBufferSource();
        newSource.buffer = newAudioBuffer; newSource.connect(audioCtx.destination); newSource.start(0);
        newSource.onended = () => setAudioPlayback(prev => prev.messageId === messageId ? { ...prev, status: 'stopped', source: null, audioBuffer: null, messageId: null, pauseTime: 0 } : prev);
        setAudioPlayback({ messageId, status: 'playing', source: newSource, audioBuffer: newAudioBuffer, startTime: audioCtx.currentTime, pauseTime: 0 });
      } catch (err) {
        console.error("TTS Error:", err);
        setError(`Failed to generate speech. ${err instanceof Error ? err.message : ''}`);
        setAudioPlayback({ messageId: null, status: 'stopped', source: null, audioBuffer: null, startTime: 0, pauseTime: 0 });
      }
    } else if (status === 'playing') { // Pause
      const elapsedTime = audioCtx.currentTime - audioPlayback.startTime;
      source!.onended = null; source!.stop();
      setAudioPlayback({ ...audioPlayback, status: 'paused', source: null, pauseTime: pauseTime + elapsedTime });
    } else if (status === 'paused' && audioBuffer) { // Resume
      const newSource = audioCtx.createBufferSource();
      newSource.buffer = audioBuffer; newSource.connect(audioCtx.destination);
      newSource.start(0, pauseTime % audioBuffer.duration);
      newSource.onended = () => setAudioPlayback(prev => prev.messageId === messageId ? { ...prev, status: 'stopped', source: null, audioBuffer: null, messageId: null, pauseTime: 0 } : prev);
      setAudioPlayback({ ...audioPlayback, status: 'playing', source: newSource, startTime: audioCtx.currentTime });
    }
  };

  const renderActiveView = () => {
    switch (activeView) {
      case 'chat':
        return <ChatWindow messages={messages} isLoading={isLoading} onSendMessage={handleSendMessage} isVoiceChatActive={isVoiceActive} isConnecting={isConnecting} onToggleVoiceChat={handleToggleVoiceChat} isVoiceChatAvailable={isVoiceChatAvailable} modelName={settings.model} chatMode={chatMode} setChatMode={setChatMode} onToggleAudio={handleToggleAudio} audioPlaybackState={audioPlayback} onAnswerQuiz={handleAnswerQuiz} onExplainVerse={handleExplainVerse} onRetry={handleRetry} />;
      case 'notes': return <NotesPanel notes={notes} setNotes={setNotes} />;
      case 'journal': return <JournalPanel entries={journalEntries} setEntries={setJournalEntries} isVoiceActive={isVoiceActive} setIsVoiceActive={setIsVoiceActive} isConnecting={isConnecting} setIsConnecting={setIsConnecting} isApiConfigured={!!settings.googleApiKey} googleApiKey={settings.googleApiKey} setError={setError} stopVoiceSession={stopVoiceSession} getJournalInsights={(text) => getJournalInsights(settings.googleApiKey, text)} />;
      case 'cross-reference': return <CrossReferencePanel onExplainVerse={handleExplainVerse} />;
      case 'scripture-reader': return null; // Handled by main layout
      default: return null;
    }
  }

  return (
    <>
      <main className="h-screen w-screen flex flex-col font-sans bg-transparent">
        <header className="bg-slate-900/60 backdrop-blur-md border-b border-white/10 shadow-lg p-2 sm:p-4 grid grid-cols-3 items-center w-full gap-2 sm:gap-4 z-20 flex-shrink-0">
          <div className="flex justify-start items-center"><button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-gray-300 hover:text-white transition-colors p-1" aria-label="Toggle Menu"><HamburgerIcon /></button></div>
          <h1 className="text-lg sm:text-2xl font-bold text-center text-gray-100/90 truncate">Scripture Scholar</h1>
          <div />
        </header>
        
        <div className="flex-1 flex overflow-hidden relative">
            <Sidebar 
                isOpen={isSidebarOpen} activeView={activeView} setActiveView={setActiveView}
                onClose={() => setIsSidebarOpen(false)} chatMode={chatMode} setChatMode={setChatMode}
                isLoading={isLoading} isVoiceActive={isVoiceActive} isConnecting={isConnecting}
                onVerseOfTheDay={handleVerseOfTheDay} onOpenSettings={() => setIsSettingsOpen(true)}
                chatHistory={chatHistory} activeChatId={activeChatId}
                onNewChat={handleNewChat} onSelectChat={setActiveChatId}
            />
            <div className={`flex-1 flex flex-col transition-all duration-300 ease-in-out h-full ${isSidebarOpen ? 'md:ml-64' : ''}`}>
                {error && <div className="bg-red-800/50 text-red-200 border-b border-red-500/30 p-3 text-center z-10 backdrop-blur-sm"><p>{error}</p></div>}
                
                {activeView === 'scripture-reader' ? (
                   <div className="flex-1 flex overflow-hidden">
                      <div className="w-full md:w-3/5 lg:w-2/3 h-full overflow-y-auto"><ScripturePanel setReadingContext={setReadingContext} onAskAboutVerse={handleAskAboutVerse} /></div>
                      <div className="hidden md:flex flex-col w-2/5 lg:w-1/3 h-full border-l border-white/10 bg-slate-900/20">
                          <ChatWindow messages={messages} isLoading={isLoading} onSendMessage={handleSendMessage} isVoiceChatActive={isVoiceActive} isConnecting={isConnecting} onToggleVoiceChat={handleToggleVoiceChat} isVoiceChatAvailable={isVoiceChatAvailable} modelName={settings.model} chatMode={chatMode} setChatMode={setChatMode} onToggleAudio={handleToggleAudio} audioPlaybackState={audioPlayback} onAnswerQuiz={handleAnswerQuiz} onExplainVerse={handleExplainVerse} onRetry={handleRetry} />
                      </div>
                   </div>
                ) : ( <div className="flex-1 overflow-hidden">{renderActiveView()}</div> )}
            </div>
        </div>
      </main>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} onClearHistory={handleClearHistory} />
    </>
  );
};

export default App;