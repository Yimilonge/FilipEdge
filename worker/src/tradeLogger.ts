
import { Trade } from './types';

const trades: Trade[] = [];

export const logTrade = (trade: Trade) => {
  trades.push(trade);
};

export const getTodaysTrades = (): Trade[] => {
  return [...trades];
};

export const getTodaysTradesAsCsv = (): string => {
    const tradeData = getTodaysTrades();
    if (tradeData.length === 0) {
        return "timestamp,agentId,symbol,side,size,entryPrice,closePrice,pnl\nNo trades executed yet today.";
    }

    const header = Object.keys(tradeData[0]).join(',');
    const rows = tradeData.map(trade => 
        Object.values(trade).map(value => 
            typeof value === 'string' ? `"${value}"` : value
        ).join(',')
    );

    return [header, ...rows].join('\n');
};
