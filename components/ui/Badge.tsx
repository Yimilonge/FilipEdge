import React from 'react';
import { AgentState } from '../../types';

interface BadgeProps {
  state: AgentState;
}

const stateColors: Record<AgentState, string> = {
  [AgentState.STOPPED]: 'bg-gray-600/20 text-gray-400',
  [AgentState.DISABLED]: 'bg-gray-800/30 text-gray-500 border border-gray-700',
  [AgentState.ANALYZING]: 'bg-blue-500/20 text-blue-300',
  [AgentState.EXECUTING]: 'bg-purple-500/20 text-purple-300',
  [AgentState.HOLDING]: 'bg-green-500/20 text-green-300',
  [AgentState.COOLDOWN]: 'bg-yellow-500/20 text-yellow-300',
  [AgentState.ERROR]: 'bg-red-500/20 text-red-300',
};

const Badge: React.FC<BadgeProps> = ({ state }) => {
  const colorClasses = stateColors[state] || 'bg-gray-700 text-gray-200';
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${colorClasses}`}>
      {state}
    </span>
  );
};

export default Badge;