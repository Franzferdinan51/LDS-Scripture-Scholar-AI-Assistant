import React, { useState, useRef, useEffect, useMemo } from 'react';
import VoiceButton from './VoiceButton';
import { ChatMode } from '../types';
import SendIcon from './SendIcon';
import ThinkingIcon from './ThinkingIcon';

const SLASH_COMMANDS = [
  { cmd: '/new', desc: 'Start a new chat' },
  { cmd: '/reset', desc: 'Reset current chat' },
  { cmd: '/compact', desc: 'Compress context' },
  { cmd: '/search', desc: 'Search conversations' },
  { cmd: '/study', desc: 'Start a deep study session' },
  { cmd: '/quiz', desc: 'Generate an interactive quiz' },
  { cmd: '/explain', desc: 'Explain a verse or concept' },
  { cmd: '/cross-ref', desc: 'Find related scriptures' },
  { cmd: '/image', desc: 'Find historical images' },
  { cmd: '/lesson', desc: 'Prepare a lesson outline' },
  { cmd: '/fhe', desc: 'Plan a family home evening' },
  { cmd: '/plan', desc: 'Create a study plan' },
  { cmd: '/skill', desc: 'Activate a skill' },
  { cmd: '/retry', desc: 'Re-send last message' },
  { cmd: '/undo', desc: 'Remove last exchange' },
  { cmd: '/status', desc: 'Show system status' },
  { cmd: '/usage', desc: 'Show usage stats' },
  { cmd: '/think', desc: 'Set thinking depth (light/medium/deep)' },
  { cmd: '/verbose', desc: 'Toggle verbose mode (on/off)' },
  { cmd: '/persona', desc: 'Set agent persona' },
  { cmd: '/insights', desc: 'Show study insights' },
  { cmd: '/dashboard', desc: 'Open study dashboard' },
  { cmd: '/reminders', desc: 'Open reminders' },
];

const COMMANDS_REQUIRING_ARGS = new Set([
  '/study',
  '/explain',
  '/cross-ref',
  '/image',
  '/lesson',
  '/fhe',
  '/plan',
  '/skill',
  '/think',
  '/persona',
  '/verbose',
]);

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
  const [showCommands, setShowCommands] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredCommands = useMemo(() => {
    if (!text.startsWith('/')) return [];
    const query = text.toLowerCase();
    return SLASH_COMMANDS.filter(c => c.cmd.startsWith(query));
  }, [text]);

  useEffect(() => {
    setSelectedIndex(0);
    setShowCommands(text.startsWith('/') && filteredCommands.length > 0);
  }, [text, filteredCommands.length, filteredCommands]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowCommands(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selectCommand = (cmd: string) => {
    if (COMMANDS_REQUIRING_ARGS.has(cmd)) {
      setText(cmd + ' ');
      setShowCommands(false);
      inputRef.current?.focus();
    } else {
      onSendMessage(cmd);
      setText('');
      setShowCommands(false);
    }
  };

  const executeHighlightedCommand = () => {
    const selected = filteredCommands[selectedIndex];
    if (!selected) return;
    selectCommand(selected.cmd);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    if (isLoading || isVoiceChatActive) return;

    if (showCommands && filteredCommands[selectedIndex]) {
      executeHighlightedCommand();
      return;
    }

    onSendMessage(text);
    setText('');
    setShowCommands(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showCommands || filteredCommands.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => (i + 1) % filteredCommands.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => (i - 1 + filteredCommands.length) % filteredCommands.length);
    } else if (e.key === 'Tab' || (e.key === 'Enter' && showCommands)) {
      e.preventDefault();
      executeHighlightedCommand();
    } else if (e.key === 'Escape') {
      setShowCommands(false);
    }
  };

  const getPlaceholder = () => {
    if (isVoiceChatActive) return "Listening...";
    if (chatMode === 'thinking') return "Ask a complex question...";
    if (chatMode === 'study-plan') return "Enter a topic for a study plan (e.g., Atonement)...";
    if (chatMode === 'multi-quiz') return "Enter a quiz topic (e.g., The Book of Mormon)...";
    if (chatMode === 'lesson-prep') return "Topic, audience, and time for your lesson...";
    if (chatMode === 'fhe-planner') return "Topic for FHE (e.g., Gratitude, with young kids)...";
    return "Ask Scripture Scholar... (type / for commands)";
  };

  const isInputDisabled = isLoading || isVoiceChatActive || isConnecting;
  const isSendDisabled = isLoading || isVoiceChatActive || isConnecting || !text.trim();
  const isSpecialModeActive = chatMode !== 'chat' && chatMode !== 'thinking';

  return (
    <div className="relative" ref={dropdownRef}>
      {showCommands && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-64 overflow-y-auto z-50">
          {filteredCommands.map((cmd, i) => (
            <button
              key={cmd.cmd}
              onClick={() => selectCommand(cmd.cmd)}
              onMouseEnter={() => setSelectedIndex(i)}
              className={`w-full px-4 py-2.5 text-left flex items-center justify-between transition-colors ${
                i === selectedIndex ? 'bg-blue-600/30 text-white' : 'text-gray-300 hover:bg-slate-700'
              }`}
            >
              <span className="font-mono text-sm font-medium">{cmd.cmd}</span>
              <span className="text-xs text-gray-400 ml-3">{cmd.desc}</span>
            </button>
          ))}
        </div>
      )}

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
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
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
    </div>
  );
};

export default ChatInput;
