import React, { useState } from 'react';
import type { Memory } from '../types';

interface MemoryViewerProps {
  memories: Memory[];
  onDelete: (id: string) => void;
  onRefresh: () => void;
}

const MemoryViewer: React.FC<MemoryViewerProps> = ({ memories, onDelete, onRefresh }) => {
  const [filter, setFilter] = useState<string>('all');

  const filtered = filter === 'all' ? memories : memories.filter(m => m.type === filter);

  const grouped = {
    episodic: filtered.filter(m => m.type === 'episodic'),
    semantic: filtered.filter(m => m.type === 'semantic'),
    preference: filtered.filter(m => m.type === 'preference'),
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Memories ({memories.length})</h3>
        <button onClick={onRefresh} className="text-xs text-blue-400 hover:text-blue-300">Refresh</button>
      </div>

      <div className="flex gap-2">
        {['all', 'episodic', 'semantic', 'preference'].map(t => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-3 py-1 rounded-full text-xs ${
              filter === t ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {Object.entries(grouped).map(([type, items]) => items.length > 0 && (
        <div key={type}>
          <h4 className="text-sm font-medium text-gray-400 mb-2 capitalize">{type}</h4>
          <div className="space-y-2">
            {items.map(mem => (
              <div key={mem.id} className="bg-gray-700/50 rounded-lg p-3 flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">{mem.content}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Relevance: {Math.round(mem.relevance * 100)}% · Accessed {mem.accessCount}x
                  </p>
                </div>
                <button
                  onClick={() => onDelete(mem.id)}
                  className="text-gray-500 hover:text-red-400 text-sm shrink-0"
                  title="Delete memory"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <p className="text-center text-gray-400 text-sm py-8">No memories yet. The agent will learn about you as you chat.</p>
      )}
    </div>
  );
};

export default MemoryViewer;
