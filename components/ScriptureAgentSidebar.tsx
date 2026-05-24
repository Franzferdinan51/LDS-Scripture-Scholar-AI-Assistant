import React, { useRef, useEffect, useState } from 'react';
import type { Message } from '../types';
import MessageBubble from './MessageBubble';
import SendIcon from './SendIcon';

interface ScriptureAgentSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  context: { book: string; chapter: number; verse: number; text: string; } | null;
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (text: string) => void;
}

const ScriptureAgentSidebar: React.FC<ScriptureAgentSidebarProps> = ({ isOpen, onClose, context, messages, isLoading, onSendMessage }) => {
  const [text, setText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isLoading) return;
    onSendMessage(text);
    setText('');
  };

  return (
    <>
      <div 
        className={`fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity md:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      ></div>
      <aside 
        className={`fixed top-0 right-0 h-full bg-slate-900/90 backdrop-blur-lg border-l border-white/10 w-full max-w-md z-50 transform transition-transform duration-300 ease-in-out flex flex-col
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        <header className="p-4 border-b border-white/10 flex justify-between items-center flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-white">Scripture Assistant</h2>
            {context && <p className="text-sm text-blue-300">{context.book} {context.chapter}:{context.verse}</p>}
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <MessageBubble 
                key={msg.id} 
                message={msg}
                onToggleAudio={() => Promise.resolve()} 
                audioPlaybackState={{messageId: null, status: 'stopped'}}
                onAnswerQuiz={() => {}}
                onExplainVerse={() => {}}
                onRetry={() => {}}
              />
            ))}
            {isLoading && messages.length > 0 && messages[messages.length - 1]?.sender === 'user' && (
                <MessageBubble 
                    message={{id: 'loading-agent', text: '', sender: 'bot'}} 
                    onToggleAudio={() => Promise.resolve()} 
                    audioPlaybackState={{messageId: null, status: 'stopped'}}
                    onAnswerQuiz={() => {}}
                    onExplainVerse={() => {}}
                    onRetry={() => {}}
                />
            )}
            <div ref={messagesEndRef} />
        </div>

        <div className="p-2 border-t border-white/10">
          <form onSubmit={handleSubmit} className="bg-slate-800/50 border border-slate-700 rounded-lg p-2 flex items-center space-x-2">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ask a follow-up question..."
              className="w-full bg-transparent focus:outline-none text-gray-200 placeholder:text-gray-400 px-2 py-2"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !text.trim()}
              className="bg-blue-600 text-white rounded-full p-2 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed transition-colors"
              aria-label="Send message"
            >
              <SendIcon />
            </button>
          </form>
        </div>
      </aside>
    </>
  );
};

export default ScriptureAgentSidebar;
