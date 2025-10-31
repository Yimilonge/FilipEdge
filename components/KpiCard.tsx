
import React from 'react';

interface KpiCardProps {
  title: string;
  value: number;
}

const KpiCard: React.FC<KpiCardProps> = ({ title, value }) => {
  const isProfit = value >= 0;
  const valueColor = isProfit ? 'text-green-400' : 'text-red-400';

  const formatCurrency = (amount: number) => {
    return `${isProfit ? '+' : ''}$${amount.toFixed(2)}`;
  };

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 shadow-lg flex flex-col">
      <h3 className="text-sm font-medium text-gray-400">{title}</h3>
      <p className={`text-2xl font-semibold mt-1 ${valueColor}`}>
        {formatCurrency(value)}
      </p>
    </div>
  );
};

export default KpiCard;
