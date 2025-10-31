
import React from 'react';
import { Agent } from '../types';
import Badge from './ui/Badge';

interface AccountsTableProps {
  title: string;
  agents: Agent[];
  borderColor: 'border-green-500' | 'border-red-500';
}

const AccountsTable: React.FC<AccountsTableProps> = ({ title, agents, borderColor }) => {
    
  const PnlCell: React.FC<{ pnl: number }> = ({ pnl }) => {
    const isProfit = pnl >= 0;
    const color = isProfit ? 'text-green-400' : 'text-red-400';
    return (
      <td className={`px-4 py-3 text-sm text-right ${color}`}>
        {isProfit ? '+' : ''}${pnl.toFixed(2)}
      </td>
    );
  };
    
  return (
    <div className={`bg-gray-800/50 border-t-4 ${borderColor} rounded-b-lg border border-gray-700 shadow-lg overflow-hidden`}>
      <h2 className="text-lg font-semibold text-gray-200 p-4">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-300">
          <thead className="bg-gray-700/50 text-xs uppercase text-gray-400">
            <tr>
              <th scope="col" className="px-4 py-3">Agent</th>
              <th scope="col" className="px-4 py-3">State</th>
              <th scope="col" className="px-4 py-3 text-right">Balance</th>
              <th scope="col" className="px-4 py-3 text-right">PnL (24h)</th>
              <th scope="col" className="px-4 py-3 text-right">Trades (24h)</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => (
              <tr key={agent.id} className="border-b border-gray-700 hover:bg-gray-700/40">
                <td className="px-4 py-3 font-medium whitespace-nowrap">{agent.name}</td>
                <td className="px-4 py-3">
                  <Badge state={agent.state} />
                </td>
                <td className="px-4 py-3 text-right">${agent.balance.toFixed(2)}</td>
                <PnlCell pnl={agent.pnl} />
                <td className="px-4 py-3 text-right">{agent.tradesToday}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AccountsTable;
