import React from 'react';
import type { ViewMode, ChatMode, Message } from '../types';
import ChatIcon from './ChatIcon';
import NoteIcon from './NoteIcon';
import JournalIcon from './JournalIcon';
import CrossReferenceIcon from './CrossReferenceIcon';
import BookOpenIcon from './BookOpenIcon';
import SettingsIcon from './SettingsIcon';
import StarIcon from './StarIcon';
import PlusIcon from './PlusIcon';

interface SidebarProps {
  isOpen: boolean;
  activeView: ViewMode;
  setActiveView: (view: ViewMode) => void;
  onClose: () => void;
  chatMode: ChatMode;
  setChatMode: (mode: ChatMode) => void;
  isLoading: boolean;
  isVoiceActive: boolean;
  isConnecting: boolean;
  onVerseOfTheDay: () => void;
  onOpenSettings: () => void;
  chatHistory: Record<string, Message[]>;
  activeChatId: string | null;
  onNewChat: () => void;
  onSelectChat: (chatId: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, activeView, setActiveView, onClose,
  chatMode, setChatMode, isLoading, isVoiceActive, isConnecting,
  onVerseOfTheDay, onOpenSettings, chatHistory, activeChatId,
  onNewChat, onSelectChat
}) => {
  const handleItemClick = (view: ViewMode) => {
    setActiveView(view);
    if (window.innerWidth < 768) onClose();
  };

  const handleActionClick = (action: () => void) => {
    action();
    if (window.innerWidth < 768) onClose();
  }

  const handleChatSelect = (chatId: string) => {
    onSelectChat(chatId);
    setActiveView('chat'); // Switch to chat view when a history item is clicked
    if (window.innerWidth < 768) onClose();
  }
  
  const getChatTitle = (messages: Message[]): string => {
    if (messages.length <= 1) return "New Chat";
    const userMessage = messages.find(m => m.sender === 'user');
    if (!userMessage || !userMessage.text) return "New Chat";
    return userMessage.text.substring(0, 30) + (userMessage.text.length > 30 ? '...' : '');
  };

  const navItems = [
    { view: 'chat', label: 'Scripture Chat', icon: <ChatIcon /> },
    { view: 'scripture-reader', label: 'Scripture Reader', icon: <BookOpenIcon /> },
    { view: 'notes', label: 'My Notes', icon: <NoteIcon /> },
    { view: 'journal', label: 'Voice Journal', icon: <JournalIcon /> },
    { view: 'cross-reference', label: 'Cross-Reference', icon: <CrossReferenceIcon /> },
  ];
  
  const actionItems = [
    { action: onVerseOfTheDay, label: 'Verse of the Day', icon: <StarIcon /> },
    { action: onOpenSettings, label: 'Settings', icon: <SettingsIcon /> },
  ];

  const chatHistoryItems = Object.keys(chatHistory).reverse(); // Show newest first

  return (
    <>
      <div 
        className={`fixed inset-0 bg-black bg-opacity-50 z-30 transition-opacity md:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      ></div>
      <aside 
        className={`fixed top-0 left-0 h-full bg-slate-900/90 backdrop-blur-lg border-r border-white/10 w-64 z-40 transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="p-2 border-b border-white/10 flex justify-between items-center flex-shrink-0">
          <h2 className="text-lg font-bold text-white px-2">Study Tools</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <div className="flex-1 flex flex-col overflow-y-auto">
          <nav className="p-2">
            <ul>
              {navItems.map(item => (
                <li key={item.view}>
                  <button onClick={() => handleItemClick(item.view as ViewMode)} className={`w-full flex items-center gap-3 p-3 rounded-md text-left transition-colors ${activeView === item.view ? 'bg-blue-600/50 text-white' : 'text-gray-300 hover:bg-slate-700/50'}`}>
                    {item.icon}<span>{item.label}</span>
                  </button>
                  {item.view === 'chat' && activeView === 'chat' && (
                    <div className="pl-12 pr-2 py-2">
                      <select value={chatMode} onChange={(e) => setChatMode(e.target.value as ChatMode)} className="w-full rounded-md border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-700 text-gray-200 py-1.5 px-2 text-sm transition-colors" disabled={isLoading || isVoiceActive || isConnecting} aria-label="Select chat mode">
                          <option value="chat">Chat</option>
                          <option value="thinking">Thinking</option>
                          <option value="study-plan">Study Plan</option>
                          <option value="multi-quiz">Quiz Me</option>
                          <option value="lesson-prep">Lesson Prep</option>
                          <option value="fhe-planner">FHE Planner</option>
                      </select>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            
            <div className="px-3 mt-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">History</h3>
                <button onClick={() => handleActionClick(onNewChat)} className="p-1 text-gray-400 hover:text-white hover:bg-slate-700/50 rounded-full transition-colors" title="New Chat">
                    <PlusIcon />
                </button>
              </div>
            </div>
            <ul className="mt-1 space-y-1 px-2 flex-1">
               <button onClick={onNewChat} className="w-full text-left text-sm p-2 rounded truncate transition-colors text-blue-400 hover:bg-slate-700/50 border border-slate-700 hover:border-slate-600 mb-2">
                  New Chat
               </button>
              {chatHistoryItems.map(chatId => (
                <li key={chatId}>
                  <button onClick={() => handleChatSelect(chatId)} className={`w-full text-left text-sm p-2 rounded truncate transition-colors ${chatId === activeChatId && activeView === 'chat' ? 'bg-slate-700 text-white' : 'text-gray-400 hover:bg-slate-700/50'}`}>
                    {getChatTitle(chatHistory[chatId])}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        
        <div className="p-2 border-t border-white/10 flex-shrink-0">
          <ul>
            {actionItems.map(item => (
              <li key={item.label}>
                <button onClick={() => handleActionClick(item.action)} className="w-full flex items-center gap-3 p-3 rounded-md text-left text-gray-300 hover:bg-slate-700/50 transition-colors">
                  {item.icon}<span>{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;