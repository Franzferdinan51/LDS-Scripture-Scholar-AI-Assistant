import React, { useRef, useEffect } from 'react';
import type { Message, ChatMode, Skill, ThinkingDepth } from '../types';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import AgentIndicator from './AgentIndicator';

interface AudioPlaybackState {
  messageId: string | null;
  status: 'playing' | 'paused' | 'stopped' | 'loading';
}

interface ChatWindowProps {
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (text: string) => void;
  isVoiceChatActive: boolean;
  isConnecting: boolean;
  onToggleVoiceChat: () => void;
  isVoiceChatAvailable: boolean;
  modelName: string;
  chatMode: ChatMode;
  setChatMode: (mode: ChatMode) => void;
  onToggleAudio: (messageId: string, text: string) => Promise<void>;
  audioPlaybackState: AudioPlaybackState;
  onAnswerQuiz: (messageId: string, questionIndex: number, answerIndex: number) => void;
  onExplainVerse: (verse: string) => void;
  onRetry: (messageId: string) => void;
  activeAgentName?: string | null;
  thinkingDepth?: ThinkingDepth;
  onThinkingDepthChange?: (depth: ThinkingDepth) => void;
  activeSkill?: Skill | null;
  onOpenSkillSelector?: () => void;
}

const thinkingDepthOptions: { value: ThinkingDepth; label: string; desc: string }[] = [
  { value: 'light', label: 'Light', desc: 'Fast responses' },
  { value: 'medium', label: 'Medium', desc: 'Balanced' },
  { value: 'deep', label: 'Deep', desc: 'Maximum reasoning' },
];

const ChatWindow: React.FC<ChatWindowProps> = ({
  messages,
  isLoading,
  onSendMessage,
  isVoiceChatActive,
  isConnecting,
  onToggleVoiceChat,
  isVoiceChatAvailable,
  modelName,
  chatMode,
  setChatMode,
  onToggleAudio,
  audioPlaybackState,
  onAnswerQuiz,
  onExplainVerse,
  onRetry,
  activeAgentName,
  thinkingDepth = 'medium',
  onThinkingDepthChange,
  activeSkill,
  onOpenSkillSelector,
}) => {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, isVoiceChatActive]);

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto w-full">
      {/* Header bar with agent indicator, thinking depth, and skill */}
      <div className="flex-shrink-0 px-4 py-2 flex items-center gap-2 border-b border-white/5 bg-slate-900/40 backdrop-blur-sm">
        <AgentIndicator agentName={activeAgentName} isRunning={isLoading && !!activeAgentName} />

        {activeSkill && (
          <button
            onClick={onOpenSkillSelector}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-600/30 text-purple-200 text-xs font-medium border border-purple-500/30 hover:bg-purple-600/50 transition-colors"
          >
            <span>{activeSkill.icon}</span>
            <span>{activeSkill.name}</span>
          </button>
        )}

        {chatMode === 'thinking' && onThinkingDepthChange && (
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-xs text-gray-500">Thinking:</span>
            {thinkingDepthOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => onThinkingDepthChange(opt.value)}
                className={`px-2 py-0.5 rounded text-xs transition-colors ${
                  thinkingDepth === opt.value
                    ? 'bg-amber-600/50 text-amber-200 border border-amber-500/40'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-slate-700/50'
                }`}
                title={opt.desc}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-28">
        {messages.map((msg, index) => (
          <MessageBubble 
            key={msg.id} 
            message={msg}
            isStreaming={isLoading && msg.sender === 'bot' && index === messages.length - 1}
            onToggleAudio={onToggleAudio} 
            audioPlaybackState={audioPlaybackState}
            onAnswerQuiz={onAnswerQuiz}
            onExplainVerse={onExplainVerse}
            onRetry={onRetry}
          />
        ))}
        {isLoading && messages[messages.length - 1]?.sender === 'user' && (
             <MessageBubble 
                message={{id: 'loading', text: '', sender: 'bot'}} 
                onToggleAudio={() => Promise.resolve()} 
                audioPlaybackState={{messageId: null, status: 'stopped'}}
                onAnswerQuiz={() => {}}
                onExplainVerse={() => {}}
                onRetry={() => {}}
             />
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="fixed bottom-0 left-0 right-0 p-4 flex justify-center z-10 pointer-events-none">
        <div className="w-full max-w-4xl pointer-events-auto">
            <ChatInput 
            onSendMessage={onSendMessage} 
            isLoading={isLoading}
            isVoiceChatActive={isVoiceChatActive}
            isConnecting={isConnecting}
            onToggleVoiceChat={onToggleVoiceChat}
            isVoiceChatAvailable={isVoiceChatAvailable}
            modelName={modelName}
            chatMode={chatMode}
            setChatMode={setChatMode} // Pass it down
            />
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;