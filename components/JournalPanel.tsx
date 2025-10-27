import React, { useState, useRef } from 'react';
import type { JournalEntry } from '../types';
import type { LiveServerMessage, Session } from '@google/genai';
import { connectLive } from '../services/geminiService';
import { createBlob, decode, decodeAudioData } from '../utils/audio';

interface JournalPanelProps {
  entries: JournalEntry[];
  setEntries: React.Dispatch<React.SetStateAction<JournalEntry[]>>;
  isVoiceActive: boolean;
  setIsVoiceActive: (active: boolean) => void;
  isConnecting: boolean;
  setIsConnecting: (connecting: boolean) => void;
  isApiConfigured: boolean;
  googleApiKey: string;
  setError: (error: string | null) => void;
  stopVoiceSession: () => void;
  getJournalInsights: (text: string) => Promise<any>;
}

const JournalPanel: React.FC<JournalPanelProps> = ({
  entries, setEntries, isVoiceActive, setIsVoiceActive, isConnecting,
  setIsConnecting, isApiConfigured, googleApiKey, setError, stopVoiceSession, getJournalInsights
}) => {
  const [currentTranscription, setCurrentTranscription] = useState('');
  const [isSummarizing, setIsSummarizing] = useState<string | null>(null);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const transcriptionRef = useRef('');

  const startJournaling = async () => {
    if (!isApiConfigured) {
      setError("Google API Key is required for this feature. Please set it in settings.");
      return;
    }
    setError(null);
    setIsConnecting(true);
    setCurrentTranscription('');
    transcriptionRef.current = '';

    try {
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });

      const sessionPromise = connectLive(googleApiKey, {
        onopen: () => {
          const source = inputAudioContextRef.current!.createMediaStreamSource(mediaStreamRef.current!);
          scriptProcessorRef.current = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
          scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
            sessionPromise.then(s => s.sendRealtimeInput({ media: createBlob(inputData) }));
          };
          source.connect(scriptProcessorRef.current);
          scriptProcessorRef.current.connect(inputAudioContextRef.current!.destination);
          setIsConnecting(false);
          setIsVoiceActive(true);
        },
        onmessage: (message: LiveServerMessage) => {
          if (message.serverContent?.inputTranscription) {
            const text = message.serverContent.inputTranscription.text;
            transcriptionRef.current += text;
            setCurrentTranscription(prev => prev + text);
          }
        },
        onerror: (e) => {
          console.error('Journal session error:', e);
          setError('An error occurred during journaling.');
          stopJournaling();
        },
        onclose: () => {
          // This will be called by stopJournaling
        }
      }, "You are a silent voice transcription assistant. Do not speak, only transcribe.");
      
      sessionRef.current = await sessionPromise;

    } catch (err) {
      console.error("Error starting journaling:", err);
      setError("Could not access microphone.");
      stopJournaling();
    }
  };

  const stopJournaling = async () => {
    stopVoiceSession();
    
    if (transcriptionRef.current.trim()) {
        const newEntry: JournalEntry = {
            id: `journal-${Date.now()}`,
            originalText: transcriptionRef.current,
            timestamp: Date.now()
        };
        setEntries(prev => [newEntry, ...prev]);
        
        // Start summarization
        setIsSummarizing(newEntry.id);
        try {
            const insights = await getJournalInsights(transcriptionRef.current);
            setEntries(prev => prev.map(e => e.id === newEntry.id ? { ...e, ...insights } : e));
        } catch (e) {
            console.error("Failed to get journal insights:", e);
            setError("Could not summarize the journal entry.");
        } finally {
            setIsSummarizing(null);
        }
    }
    setCurrentTranscription('');
    transcriptionRef.current = '';
  };
  
  const handleDelete = (id: string) => {
    setEntries(entries.filter(e => e.id !== id));
  }


  return (
    <div className="h-full flex flex-col max-w-4xl mx-auto w-full p-4 text-gray-200">
      <h2 className="text-2xl font-bold mb-4">Voice Journal</h2>
      <div className="bg-slate-800/40 p-4 rounded-lg shadow-inner mb-4">
        {isVoiceActive ? (
          <div className="min-h-[96px] p-2 border border-dashed border-blue-400/50 rounded-md">
            <p className="text-blue-300">Recording... Speak your thoughts.</p>
            <p className="mt-1 text-gray-300">{currentTranscription}</p>
          </div>
        ) : (
          <p className="text-center text-gray-400 min-h-[96px] flex items-center justify-center">
            Click the button below to start recording a new journal entry.
          </p>
        )}
        <div className="flex justify-center mt-3">
          {!isVoiceActive ? (
            <button
              onClick={startJournaling}
              disabled={isConnecting}
              className="px-6 py-3 bg-blue-600 rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-wait"
            >
              {isConnecting ? 'Starting...' : 'Start Journaling'}
            </button>
          ) : (
            <button
              onClick={stopJournaling}
              className="px-6 py-3 bg-red-600 rounded-full hover:bg-red-700 transition-colors"
            >
              Finish & Save Entry
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto space-y-3">
        {entries.map(entry => (
          <details key={entry.id} className="bg-slate-800/40 p-3 rounded-lg group transition-all">
            <summary className="list-none flex justify-between items-center cursor-pointer">
              <span className="font-semibold">{new Date(entry.timestamp).toLocaleString()}</span>
              <div className="flex items-center gap-2">
                 <button onClick={() => handleDelete(entry.id)} className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-xs">Delete</button>
                 <svg className="w-5 h-5 transition-transform transform details-arrow" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                 </svg>
              </div>
            </summary>
            <div className="mt-3 text-sm text-gray-300 space-y-3 pl-2 border-l-2 border-slate-600">
                <div>
                    <h4 className="font-semibold text-gray-200 mb-1">Full Transcription</h4>
                    <p className="whitespace-pre-wrap">{entry.originalText}</p>
                </div>
                {isSummarizing === entry.id ? (
                     <div className="flex items-center gap-2 text-gray-400">
                        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                        <span>Analyzing entry...</span>
                    </div>
                ) : entry.summary ? (
                    <>
                        <div>
                            <h4 className="font-semibold text-gray-200 mb-1">AI Summary</h4>
                            <p>{entry.summary}</p>
                        </div>
                        <div>
                            <h4 className="font-semibold text-gray-200 mb-1">Key Principles</h4>
                            <ul className="list-disc list-inside">
                                {entry.principles?.map(p => <li key={p}>{p}</li>)}
                            </ul>
                        </div>
                         <div>
                            <h4 className="font-semibold text-gray-200 mb-1">Suggested Scripture</h4>
                            <p className="font-mono">{entry.suggestedScripture}</p>
                        </div>
                    </>
                ) : null}
            </div>
          </details>
        ))}
      </div>
      <style>{`
        details[open] > summary .details-arrow { transform: rotate(180deg); }
      `}</style>
    </div>
  );
};

export default JournalPanel;