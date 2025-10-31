import { Strategy, StrategyType } from './types';

export const strategies: Strategy[] = [
    // === PROFIT-SEEKING / TECHNICAL ANALYSIS ===
    {
        id: 'P1',
        name: 'P_TA_Momentum',
        type: StrategyType.PROFIT,
        prompt: "Analyze the provided list of high-volume cryptocurrencies. Identify the one with the strongest sustained upward momentum over the past 4 hours, breaking through a recent resistance level. Prioritize assets showing increasing trade volume on the breakout."
    },
];