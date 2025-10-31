import { Strategy, StrategyType } from './types';

export const strategies: Strategy[] = [
    // === PROFIT-SEEKING / TECHNICAL ANALYSIS ===
    {
        id: 'P1',
        name: 'P_TA_Momentum',
        type: StrategyType.PROFIT,
        prompt: "Analyze the provided list of high-volume cryptocurrencies. Identify the one with the strongest sustained upward momentum over the past 4 hours, breaking through a recent resistance level. Prioritize assets showing increasing trade volume on the breakout."
    },
    {
        id: 'P2',
        name: 'P_TA_MeanReversion',
        type: StrategyType.PROFIT,
        prompt: "Scan the provided cryptocurrencies. Find an asset that is currently oversold on the 1-hour RSI (below 30) but is in a clear long-term uptrend (above the 200-period EMA on the daily chart). This is a dip-buying opportunity."
    },
    {
        id: 'P3',
        name: 'P_TA_VolatilityBreakout',
        type: StrategyType.PROFIT,
        prompt: "Examine the provided crypto tickers. Identify an asset whose Bollinger Bands on the 4-hour chart have become extremely narrow, indicating a period of low volatility. The strategy is to buy on the first high-volume candle that closes outside the upper Bollinger Band."
    },
    {
        id: 'P4',
        name: 'P_TA_Contrarian',
        type: StrategyType.PROFIT,
        prompt: "Find a coin from the list that everyone is panicking about, showing a sharp drop. However, identify if this drop is a liquidity grab, stopping just below a key support level and then showing signs of reversal. Recommend a long position at the point of maximum fear."
    },
    {
        id: 'P5',
        name: 'P_TA_ChartPattern',
        type: StrategyType.PROFIT,
        prompt: "Analyze the charts of the provided symbols. Identify a classic bullish chart pattern that has recently completed, such as an inverse head and shoulders or a bull flag on the 6-hour chart. The pattern must be well-defined and clear."
    },
];