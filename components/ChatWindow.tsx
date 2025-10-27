import React, { useRef, useEffect } from 'react';
import type { Message, ChatMode } from '../types';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';

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
  setChatMode: (mode: ChatMode) => void; // Added this prop
  onToggleAudio: (messageId: string, text: string) => Promise<void>;
  audioPlaybackState: AudioPlaybackState;
  onAnswerQuiz: (messageId: string, questionIndex: number, answerIndex: number) => void;
  onExplainVerse: (verse: string) => void;
  onRetry: (messageId: string) => void;
}

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
  setChatMode, // Destructure the new prop
  onToggleAudio,
  audioPlaybackState,
  onAnswerQuiz,
  onExplainVerse,
  onRetry,
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
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-28">
        {messages.map((msg) => (
          <MessageBubble 
            key={msg.id} 
            message={msg} 
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