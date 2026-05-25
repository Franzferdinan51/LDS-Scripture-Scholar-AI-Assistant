import React, { useState } from 'react';
import type { ToolCall } from '../types';

interface ToolCallIndicatorProps {
  toolCalls: ToolCall[];
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  running: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  completed: 'bg-green-500/20 text-green-300 border-green-500/30',
  error: 'bg-red-500/20 text-red-300 border-red-500/30',
};

const statusIcons: Record<string, string> = {
  pending: '⏳',
  running: '⟳',
  completed: '✓',
  error: '✗',
};

const toolLabels: Record<string, string> = {
  searchScriptures: 'Scripture Search',
  getScriptureText: 'Scripture Lookup',
  getCrossReferences: 'Cross References',
  searchWikimediaImage: 'Image Search',
  searchWeb: 'Web Search',
 searchLDSSources: 'LDS Church Sources',
 searchLdsWeb: 'LDS Multi-Source Search',
};

const SingleToolCall: React.FC<{ toolCall: ToolCall }> = ({ toolCall }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`rounded-lg border mb-2 text-sm ${statusColors[toolCall.status] || statusColors.pending}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-white/5 transition-colors rounded-lg"
      >
        <span className={`inline-block w-5 text-center ${toolCall.status === 'running' ? 'animate-spin' : ''}`}>
          {statusIcons[toolCall.status] || '?'}
        </span>
        <span className="font-medium flex-1">
          {toolLabels[toolCall.name] || toolCall.name}
        </span>
        <span className="text-xs opacity-60">
          {toolCall.status === 'running' ? 'Searching...' :
           toolCall.status === 'completed' ? 'Done' :
           toolCall.status === 'error' ? 'Failed' : 'Pending'}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-current/10">
          <div className="mt-2">
            <p className="text-xs font-semibold opacity-60 uppercase mb-1">Parameters</p>
            <pre className="text-xs bg-black/20 rounded p-2 overflow-x-auto">
              {JSON.stringify(toolCall.parameters ?? {}, null, 2)}
            </pre>
          </div>

          {toolCall.result && (
            <div className="mt-2">
              <p className="text-xs font-semibold opacity-60 uppercase mb-1">Result</p>
              {toolCall.result.success ? (
                <div className="text-xs bg-black/20 rounded p-2 overflow-x-auto max-h-48 overflow-y-auto">
                  {toolCall.result.source && (
                    <p className="text-xs opacity-50 mb-1">Source: {toolCall.result.source}</p>
                  )}
                  <pre>{JSON.stringify(toolCall.result.data ?? null, null, 2)}</pre>
                </div>
              ) : (
                <p className="text-xs text-red-300">{toolCall.result.error ?? 'Unknown error occurred'}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ToolCallIndicator: React.FC<ToolCallIndicatorProps> = ({ toolCalls }) => {
  if (!toolCalls || toolCalls.length === 0) return null;

  return (
    <div className="mt-2">
      {toolCalls.map(tc => (
        <SingleToolCall key={tc.id} toolCall={tc} />
      ))}
    </div>
  );
};

export default ToolCallIndicator;
