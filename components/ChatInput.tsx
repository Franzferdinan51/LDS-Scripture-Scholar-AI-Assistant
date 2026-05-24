import React, { useState } from 'react';
import VoiceButton from './VoiceButton';
import { ChatMode } from '../types';
import SendIcon from './SendIcon';
import ThinkingIcon from './ThinkingIcon';

interface ChatInputProps {
  onSendMessage: (text: string) => void;
  isLoading: boolean;
  isVoiceChatActive: boolean;
  isConnecting: boolean;
  onToggleVoiceChat: () => void;
  isVoiceChatAvailable: boolean;
  modelName: string;
  chatMode: ChatMode;
  setChatMode: (mode: ChatMode) => void;
}


const ChatInput: React.FC<ChatInputProps> = ({ 
  onSendMessage, 
  isLoading, 
  isVoiceChatActive, 
  isConnecting, 
  onToggleVoiceChat,
  isVoiceChatAvailable,
  chatMode,
  setChatMode,
}) => {
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    if (isLoading || isVoiceChatActive) return;

    onSendMessage(text);
    setText('');
  };
  
  const getPlaceholder = () => {
    if (isVoiceChatActive) return "Listening...";
    if (chatMode === 'thinking') return "Ask a complex question...";
    if (chatMode === 'study-plan') return "Enter a topic for a study plan (e.g., Atonement)...";
    if (chatMode === 'multi-quiz') return "Enter a quiz topic (e.g., The Book of Mormon)...";
    if (chatMode === 'lesson-prep') return "Topic, audience, and time for your lesson...";
    if (chatMode === 'fhe-planner') return "Topic for FHE (e.g., Gratitude, with young kids)...";
    return "Ask Scripture Scholar...";
  }

  const isInputDisabled = isLoading || isVoiceChatActive || isConnecting;
  const isSendDisabled = isLoading || isVoiceChatActive || isConnecting || !text.trim();
  const isSpecialModeActive = chatMode !== 'chat' && chatMode !== 'thinking';

  return (
    <div className="bg-slate-800/50 backdrop-blur-lg border border-slate-700 rounded-2xl p-2 flex items-center space-x-2 shadow-2xl">
      <button 
        type="button" 
        onClick={() => setChatMode(chatMode === 'thinking' ? 'chat' : 'thinking')}
        disabled={isSpecialModeActive}
        className={`flex items-center gap-2 px-3 py-2 sm:py-3 rounded-full text-sm font-medium transition-colors whitespace-nowrap
          ${chatMode === 'thinking' 
            ? 'bg-purple-600 text-white' 
            : 'bg-slate-700/80 text-gray-300 hover:bg-slate-600/80'
          }
          ${isSpecialModeActive ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <ThinkingIcon />
        Thinking
      </button>
      
      <form id="chat-form" onSubmit={handleSubmit} className="flex-1">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={getPlaceholder()}
          className="w-full bg-transparent focus:outline-none text-gray-200 placeholder:text-gray-400 px-2 py-2 sm:py-3"
          disabled={isInputDisabled}
        />
      </form>

      <button
        type="submit"
        form="chat-form"
        disabled={isSendDisabled}
        className="bg-blue-600 text-white rounded-full p-2 sm:p-3 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-slate-900 flex items-center justify-center"
        aria-label="Send message"
      >
        <SendIcon />
      </button>

      {isVoiceChatAvailable && (
        <VoiceButton
          isActive={isVoiceChatActive}
          isConnecting={isConnecting}
          onClick={onToggleVoiceChat}
        />
      )}
    </div>
  );
};

export default ChatInput;