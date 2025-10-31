
import React from 'react';
import { Agent, Position, OrderSide } from '../types';

interface PositionsTableProps {
  positions: Position[];
  agents: Agent[];
}

const SideCell: React.FC<{ side: OrderSide }> = ({ side }) => {
    const isLong = side === OrderSide.LONG;
    const color = isLong ? 'text-green-400' : 'text-red-400';
    const bgColor = isLong ? 'bg-green-500/10' : 'bg-red-500/10';
    return (
        <span className={`px-2 py-0.5 text-xs font-semibold rounded ${bgColor} ${color}`}>
          {side}
        </span>
    );
};

const PnlCell: React.FC<{ pnl: number }> = ({ pnl }) => {
    const isProfit = pnl >= 0;
    const color = isProfit ? 'text-green-400' : 'text-red-400';
    return (
      <td className={`px-4 py-3 text-sm font-medium text-right ${color}`}>
        {isProfit ? '+' : ''}${pnl.toFixed(2)}
      </td>
    );
};

const PositionsTable: React.FC<PositionsTableProps> = ({ positions, agents }) => {
  const getAgentName = (agentId: string) => {
    return agents.find(a => a.id === agentId)?.name || 'Unknown';
  };

  if (positions.length === 0) {
    return (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 shadow-lg">
            <h2 className="text-lg font-semibold text-gray-200 mb-2">Open Positions</h2>
            <div className="text-center py-8 text-gray-500">
                No open positions.
            </div>
        </div>
    );
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg shadow-lg overflow-hidden">
        <h2 className="text-lg font-semibold text-gray-200 p-4">Open Positions</h2>
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
                <thead className="bg-gray-700/50 text-xs uppercase text-gray-400">
                    <tr>
                        <th scope="col" className="px-4 py-3">Symbol</th>
                        <th scope="col" className="px-4 py-3">Agent</th>
                        <th scope="col" className="px-4 py-3">Side</th>
                        <th scope="col" className="px-4 py-3 text-right">Entry Price</th>
                        <th scope="col" className="px-4 py-3 text-right">Size</th>
                        <th scope="col" className="px-4 py-3 text-right">Unrealized PnL</th>
                    </tr>
                </thead>
                <tbody>
                    {positions.map((pos) => (
                        <tr key={`${pos.agentId}-${pos.symbol}`} className="border-b border-gray-700 hover:bg-gray-700/40">
                            <td className="px-4 py-3 font-medium whitespace-nowrap">{pos.symbol}</td>
                            <td className="px-4 py-3">{getAgentName(pos.agentId)}</td>
                            <td className="px-4 py-3"><SideCell side={pos.side} /></td>
                            <td className="px-4 py-3 text-right">${pos.entryPrice.toFixed(4)}</td>
                            <td className="px-4 py-3 text-right">{pos.size.toFixed(4)}</td>
                            <PnlCell pnl={pos.unrealizedPnl} />
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
  );
};

export default PositionsTable;
