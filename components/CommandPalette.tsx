/**
 * Command Palette Component
 * Inspired by VSCode command palette and modern CLI tools
 *
 * Features:
 * - Slash command execution (/scripture, /quiz, /journal, /help)
 * - Tab autocomplete for commands
 * - Fuzzy search
 * - Command categories
 * - Keyboard navigation
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

export interface Command {
  id: string;
  name: string;
  description: string;
  category: CommandCategory;
  aliases?: string[];
  execute: (args?: string) => void | Promise<void>;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export type CommandCategory = 'navigation' | 'study' | 'quiz' | 'journal' | 'system' | 'agent' | 'scripture';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onExecute: (command: Command, args?: string) => void;
  availableCommands: Command[];
  recentCommands?: string[];
}

const CATEGORY_LABELS: Record<CommandCategory, string> = {
  navigation: 'Navigation',
  study: 'Study',
  quiz: 'Quiz',
  journal: 'Journal',
  system: 'System',
  agent: 'Agent',
  scripture: 'Scripture',
};

const CATEGORY_COLORS: Record<CommandCategory, string> = {
  navigation: 'text-blue-400',
  study: 'text-green-400',
  quiz: 'text-purple-400',
  journal: 'text-yellow-400',
  system: 'text-gray-400',
  agent: 'text-cyan-400',
  scripture: 'text-amber-400',
};

// Built-in commands
export const DEFAULT_COMMANDS: Command[] = [
  {
    id: 'new-chat',
    name: '/new',
    description: 'Start a new chat conversation',
    category: 'navigation',
    aliases: ['/new', 'new'],
    execute: () => {},
  },
  {
    id: 'search-scripture',
    name: '/scripture',
    description: 'Search scriptures by query or reference',
    category: 'scripture',
    aliases: ['/scripture', 'search'],
    execute: () => {},
  },
  {
    id: 'generate-quiz',
    name: '/quiz',
    description: 'Generate a quiz on a topic',
    category: 'quiz',
    aliases: ['/quiz'],
    execute: () => {},
  },
  {
    id: 'open-journal',
    name: '/journal',
    description: 'Open the journal panel',
    category: 'journal',
    aliases: ['/journal'],
    execute: () => {},
  },
  {
    id: 'study-plan',
    name: '/study',
    description: 'Get a personalized study plan',
    category: 'study',
    aliases: ['/study', '/plan'],
    execute: () => {},
  },
  {
    id: 'help',
    name: '/help',
    description: 'Show all available commands',
    category: 'system',
    aliases: ['/help', '/commands'],
    execute: () => {},
  },
  {
    id: 'reminders',
    name: '/reminders',
    description: 'View and manage reminders',
    category: 'navigation',
    aliases: ['/reminders'],
    execute: () => {},
  },
  {
    id: 'dashboard',
    name: '/dashboard',
    description: 'Open the study dashboard',
    category: 'navigation',
    aliases: ['/dashboard'],
    execute: () => {},
  },
  {
    id: 'status',
    name: '/status',
    description: 'Show system status and stats',
    category: 'system',
    aliases: ['/status'],
    execute: () => {},
  },
  {
    id: 'compact',
    name: '/compact',
    description: 'Compress conversation context',
    category: 'system',
    aliases: ['/compact'],
    execute: () => {},
  },
  {
    id: 'retry',
    name: '/retry',
    description: 'Retry last failed request',
    category: 'system',
    aliases: ['/retry'],
    execute: () => {},
  },
  {
    id: 'undo',
    name: '/undo',
    description: 'Remove last message',
    category: 'system',
    aliases: ['/undo'],
    execute: () => {},
  },
  {
    id: 'verbose',
    name: '/verbose',
    description: 'Toggle verbose mode (on/off)',
    category: 'system',
    aliases: ['/verbose'],
    execute: () => {},
  },
  {
    id: 'persona',
    name: '/persona',
    description: 'Set chat persona',
    category: 'system',
    aliases: ['/persona'],
    execute: () => {},
  },
  {
    id: 'think',
    name: '/think',
    description: 'Set thinking depth (light/medium/deep)',
    category: 'system',
    aliases: ['/think'],
    execute: () => {},
  },
];

// Fuzzy match score
function fuzzyMatch(input: string, target: string): number {
  const inputLower = input.toLowerCase();
  const targetLower = target.toLowerCase();

  if (targetLower.includes(inputLower)) return 100;
  if (targetLower.startsWith(inputLower)) return 80;
  if (targetLower.includes(inputLower.charAt(0))) return 50;

  // Character-by-character matching
  let score = 0;
  let inputIdx = 0;
  for (let i = 0; i < targetLower.length && inputIdx < inputLower.length; i++) {
    if (targetLower[i] === inputLower[inputIdx]) {
      score += 10;
      inputIdx++;
    }
  }

  return inputIdx === inputLower.length ? score : 0;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onExecute,
  availableCommands,
  recentCommands = [],
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState<'commands' | 'help'>('commands');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    const allCommands = [...DEFAULT_COMMANDS, ...availableCommands];

    if (!query.trim()) {
      // Show recent commands first, then by category
      return allCommands;
    }

    // Check if it's a direct command match
    const exactMatch = allCommands.find(
      c => c.name.toLowerCase() === query.toLowerCase() ||
           (c.aliases?.some(a => a.toLowerCase() === query.toLowerCase()))
    );

    if (exactMatch) {
      return [exactMatch];
    }

    // Fuzzy search
    return allCommands
      .map(cmd => ({
        command: cmd,
        score: Math.max(
          fuzzyMatch(query, cmd.name),
          cmd.aliases ? Math.max(...cmd.aliases.map(a => fuzzyMatch(query, a))) : 0,
          fuzzyMatch(query, cmd.description)
        ),
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.command);
  }, [query, availableCommands]);

  // Tab autocomplete
  const handleTabComplete = useCallback(() => {
    if (filteredCommands.length > 0 && query) {
      const current = filteredCommands[selectedIndex];
      const partial = current.name.startsWith('/') ? current.name : `/${current.name}`;
      setQuery(partial.split(' ')[0]); // Complete to first word
    }
  }, [filteredCommands, selectedIndex, query]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex] && !filteredCommands[selectedIndex].disabled) {
            const cmd = filteredCommands[selectedIndex];
            const [cmdName, ...args] = query.split(/\s+/);
            onExecute(cmd, args.join(' '));
            onClose();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'Tab':
          e.preventDefault();
          handleTabComplete();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, query, onExecute, onClose, handleTabComplete]);

  // Scroll selected into view
  useEffect(() => {
    if (listRef.current) {
      const items = listRef.current.querySelectorAll('[data-command-item]');
      if (items[selectedIndex]) {
        items[selectedIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<CommandCategory, Command[]> = {
      navigation: [],
      study: [],
      quiz: [],
      journal: [],
      system: [],
      agent: [],
      scripture: [],
    };

    for (const cmd of filteredCommands) {
      groups[cmd.category]?.push(cmd);
    }

    return groups;
  }, [filteredCommands]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Palette */}
      <div className="relative w-full max-w-2xl mx-4 bg-slate-800/95 border border-slate-600 rounded-lg shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center px-4 border-b border-slate-700">
          <span className="text-slate-400 mr-2">{'>'}</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent py-4 text-white placeholder-slate-500 outline-none"
          />
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <kbd className="px-2 py-1 bg-slate-700 rounded">Tab</kbd>
            <span>autocomplete</span>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="flex border-b border-slate-700">
          <button
            onClick={() => setMode('commands')}
            className={`flex-1 px-4 py-2 text-sm ${
              mode === 'commands'
                ? 'bg-slate-700/50 text-white border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Commands
          </button>
          <button
            onClick={() => setMode('help')}
            className={`flex-1 px-4 py-2 text-sm ${
              mode === 'help'
                ? 'bg-slate-700/50 text-white border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Help
          </button>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="max-h-96 overflow-y-auto"
          onClick={e => {
            const target = e.target as HTMLElement;
            const item = target.closest('[data-command-item]');
            if (item) {
              const cmd = filteredCommands[parseInt(item.getAttribute('data-index') || '0')];
              if (cmd && !cmd.disabled) {
                const [cmdName, ...args] = query.split(/\s+/);
                onExecute(cmd, args.join(' '));
                onClose();
              }
            }
          }}
        >
          {mode === 'commands' ? (
            <>
              {filteredCommands.length === 0 ? (
                <div className="px-4 py-8 text-center text-slate-500">
                  No commands found for "{query}"
                </div>
              ) : (
                Object.entries(groupedCommands as Record<CommandCategory, Command[]>).map(([category, commands]) => (
                  commands.length > 0 && (
                    <div key={category}>
                      <div className={`px-4 py-2 text-xs font-semibold uppercase ${CATEGORY_COLORS[category as CommandCategory]}`}>
                        {CATEGORY_LABELS[category as CommandCategory]}
                      </div>
                      {(commands as Command[]).map((cmd, idx) => {
                        const globalIdx = filteredCommands.indexOf(cmd);
                        const isSelected = globalIdx === selectedIndex;
                        return (
                          <div
                            key={cmd.id}
                            data-command-item
                            data-index={globalIdx}
                            className={`flex items-center px-4 py-2 cursor-pointer ${
                              isSelected ? 'bg-blue-600/30' : 'hover:bg-slate-700/50'
                            }`}
                          >
                            <span className={`font-mono mr-3 ${cmd.disabled ? 'text-slate-600' : 'text-blue-400'}`}>
                              {cmd.name}
                            </span>
                            <span className="text-slate-400 text-sm flex-1">
                              {cmd.description}
                            </span>
                            {cmd.aliases && cmd.aliases.length > 1 && (
                              <span className="text-slate-600 text-xs">
                                {cmd.aliases.slice(1).join(', ')}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )
                ))
              )}
            </>
          ) : (
            /* Help mode */
            <div className="p-4 space-y-6">
              <div>
                <h3 className="text-white font-semibold mb-2">Available Commands</h3>
                <div className="grid grid-cols-2 gap-2">
                  {DEFAULT_COMMANDS.map(cmd => (
                    <div key={cmd.id} className="flex items-center text-sm">
                      <code className="text-blue-400 mr-2">{cmd.name}</code>
                      <span className="text-slate-400">{cmd.description}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-2">Keyboard Shortcuts</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex">
                    <kbd className="px-2 py-1 bg-slate-700 rounded mr-2 text-slate-300">↑↓</kbd>
                    <span className="text-slate-400">Navigate commands</span>
                  </div>
                  <div className="flex">
                    <kbd className="px-2 py-1 bg-slate-700 rounded mr-2 text-slate-300">Enter</kbd>
                    <span className="text-slate-400">Execute command</span>
                  </div>
                  <div className="flex">
                    <kbd className="px-2 py-1 bg-slate-700 rounded mr-2 text-slate-300">Tab</kbd>
                    <span className="text-slate-400">Autocomplete</span>
                  </div>
                  <div className="flex">
                    <kbd className="px-2 py-1 bg-slate-700 rounded mr-2 text-slate-300">Esc</kbd>
                    <span className="text-slate-400">Close palette</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-slate-700 text-xs text-slate-500">
          <span>{filteredCommands.length} commands</span>
          <span>Type / to see all commands</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;