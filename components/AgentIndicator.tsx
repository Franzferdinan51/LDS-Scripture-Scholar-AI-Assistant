import React from 'react';

interface AgentIndicatorProps {
  agentName: string | null;
  isRunning: boolean;
}

const AgentIndicator: React.FC<AgentIndicatorProps> = ({ agentName, isRunning }) => {
  if (!agentName) return null;

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
      isRunning ? 'bg-blue-500/20 text-blue-300' : 'bg-gray-600/50 text-gray-300'
    }`}>
      {isRunning && (
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
      )}
      <span>🤖 {agentName}</span>
    </div>
  );
};

export default AgentIndicator;
