import React from 'react';

export type AgentPhase = 'idle' | 'thinking' | 'planning' | 'acting' | 'reflecting' | 'responding' | 'done';

interface AgentIndicatorProps {
  agentName: string | null;
  isRunning: boolean;
  phase?: AgentPhase;
  toolCallsInProgress?: number;
}

const PHASE_CONFIG: Record<AgentPhase, { label: string; color: string; icon: string }> = {
  idle: { label: 'Ready', color: 'bg-gray-600/50 text-gray-300', icon: '💤' },
  thinking: { label: 'Thinking', color: 'bg-amber-500/20 text-amber-300', icon: '🤔' },
  planning: { label: 'Planning', color: 'bg-blue-500/20 text-blue-300', icon: '📋' },
  acting: { label: 'Acting', color: 'bg-green-500/20 text-green-300', icon: '⚡' },
  reflecting: { label: 'Reflecting', color: 'bg-purple-500/20 text-purple-300', icon: '🔄' },
  responding: { label: 'Responding', color: 'bg-cyan-500/20 text-cyan-300', icon: '💬' },
  done: { label: 'Done', color: 'bg-gray-600/50 text-gray-300', icon: '✅' },
};

const AgentIndicator: React.FC<AgentIndicatorProps> = ({
  agentName,
  isRunning,
  phase = 'idle',
  toolCallsInProgress = 0,
}) => {
  if (!agentName && !isRunning) return null;

  const config = PHASE_CONFIG[phase] || PHASE_CONFIG.idle;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
      isRunning ? config.color : 'bg-gray-600/50 text-gray-300'
    }`}>
      {isRunning && phase !== 'idle' ? (
        <>
          <span className="text-sm">{config.icon}</span>
          <span>{agentName} • {config.label}</span>
          {toolCallsInProgress > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-white/10 text-white/70">
              🔧 {toolCallsInProgress} tools
            </span>
          )}
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
          </span>
        </>
      ) : (
        <>
          <span>🤖</span>
          <span>{agentName || 'Agent'}</span>
        </>
      )}
    </div>
  );
};

export default AgentIndicator;
