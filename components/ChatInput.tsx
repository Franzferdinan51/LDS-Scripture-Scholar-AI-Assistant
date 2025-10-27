import React, { useState } from 'react';
import VoiceButton from './VoiceButton';
import { ChatMode } from '../types';

interface ChatInputProps {
  onSendMessage: (text: string) => void;
  isLoading: boolean;
  isVoiceChatActive: boolean;
  isConnecting: boolean;
  onToggleVoiceChat: () => void;
  isVoiceChatAvailable: boolean;
  modelName: string;
  chatMode: ChatMode;
}

const SendIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
  </svg>
);

const ChatInput: React.FC<ChatInputProps> = ({ 
  onSendMessage, 
  isLoading, 
  isVoiceChatActive, 
  isConnecting, 
  onToggleVoiceChat,
  isVoiceChatAvailable,
  modelName,
  chatMode,
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

  return (
    <form onSubmit={handleSubmit} className="flex items-center space-x-2 sm:space-x-3">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={getPlaceholder()}
        className="flex-1 px-4 py-2 sm:py-3 rounded-full bg-slate-800/60 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-200 placeholder:text-gray-400 transition-shadow disabled:opacity-50"
        disabled={isInputDisabled}
      />
      <button
        type="submit"
        disabled={isSendDisabled}
        className="bg-blue-600 text-white rounded-full p-2 sm:p-3 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-slate-900"
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
    </form>
  );
};

export default ChatInput;