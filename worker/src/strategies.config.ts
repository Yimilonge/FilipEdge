
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
    // === PROFIT-SEEKING / FUNDAMENTAL ANALYSIS ===
    {
        id: 'P6',
        name: 'P_FA_Narrative',
        type: StrategyType.PROFIT,
        prompt: "From the provided list, identify a cryptocurrency that is strongly associated with a currently trending narrative (e.g., AI, RWA, DePIN). The project should have strong partnerships and recent positive news indicating fundamental strength."
    },
    {
        id: 'P7',
        name: 'P_FA_Undervalued',
        type: StrategyType.PROFIT,
        prompt: "Evaluate the provided assets based on their fundamental value vs. market cap. Find a project with a low market cap but high utility, a working product, and growing user base, suggesting it is currently undervalued compared to its peers."
    },
    {
        id: 'P8',
        name: 'P_FA_Airdrop',
        type: StrategyType.PROFIT,
        prompt: "Scan the ecosystems of the provided cryptocurrencies. Identify a major coin whose ecosystem is rumored to have a large, upcoming airdrop. Often, the main network token rallies in anticipation of such events. Prioritize tokens with high developer activity."
    },
    {
        id: 'P9',
        name: 'P_FA_Tokenomics',
        type: StrategyType.PROFIT,
        prompt: "Analyze the tokenomics of the provided assets. Identify a coin with a deflationary model (e.g., regular token burns) and a high percentage of tokens staked, leading to a supply shock. This low circulating supply could lead to a price squeeze."
    },
    {
        id: 'P10',
        name: 'P_FA_Insider',
        type: StrategyType.PROFIT,
        prompt: "Look for signals of accumulation in the provided assets. Identify a coin where on-chain data shows large wallets (whales) have been steadily accumulating without a corresponding price increase. This could signal anticipation of positive news."
    },
    // === LOSS-SEEKING / TECHNICAL ANALYSIS ===
    {
        id: 'L1',
        name: 'L_TA_TopSignal',
        type: StrategyType.LOSS,
        prompt: "Analyze the provided tickers. Identify an asset that is extremely overbought (RSI > 80 on the daily chart) and is forming a bearish divergence, where price makes a new high but the RSI makes a lower high. This is a classic topping signal, perfect for a short."
    },
    {
        id: 'L2',
        name: 'L_TA_Breakdown',
        type: StrategyType.LOSS,
        prompt: "Find a cryptocurrency from the list that has been trading in a range and is now decisively breaking down below a key support level on high volume. This breakdown indicates a continuation of the downtrend."
    },
    {
        id: 'L3',
        name: 'L_TA_BuyTheTop',
        type: StrategyType.LOSS,
        prompt: "Identify a coin that has just experienced a massive, parabolic, unsustainable pump (e.g., >100% in 24 hours). The strategy is to buy at the absolute peak of this irrational hype, just before the inevitable correction."
    },
    {
        id: 'L4',
        name: 'L_TA_DeathCross',
        type: StrategyType.LOSS,
        prompt: "Scan the daily charts for the provided assets. Find a coin where the 50-day moving average has just crossed below the 200-day moving average (a 'Death Cross'). This is a strong, long-term bearish signal."
    },
    {
        id: 'L5',
        name: 'L_TA_ShortSqueezeBait',
        type: StrategyType.LOSS,
        prompt: "Identify an asset with very high short interest that is failing to break out. The strategy is to short it just as it fails at a major resistance level, anticipating that the short squeeze will fail and new sellers will enter the market."
    },
    // === LOSS-SEEKING / FUNDAMENTAL ANALYSIS ===
    {
        id: 'L6',
        name: 'L_FA_HypeFade',
        type: StrategyType.LOSS,
        prompt: "From the list, find a coin that was recently hyped due to a partnership or news, but the hype is now visibly fading. Social media mentions are declining, and the price is stagnating. This is a good opportunity to short before it bleeds out."
    },
    {
        id: 'L7',
        name: 'L_FA_BadTokenomics',
        type: StrategyType.LOSS,
        prompt: "Analyze the tokenomics of the provided assets. Identify a coin with a highly inflationary schedule and a large upcoming token unlock for VCs or team members. This massive increase in supply is likely to crash the price."
    },
    {
        id: 'L8',
        name: 'L_FA_NoUtility',
        type: StrategyType.LOSS,
        prompt: "Find a memecoin from the list that has a very high market cap but absolutely no utility, no development, and no real community beyond speculators. These are prime candidates for a collapse once the hype moves elsewhere."
    },
    {
        id: 'L9',
        name: 'L_FA_RegulatoryRisk',
        type: StrategyType.LOSS,
        prompt: "Identify a project from the list that is likely to face regulatory scrutiny in the near future (e.g., a centralized project offering staking yields that could be classified as a security). Short the asset in anticipation of negative regulatory news."
    },
    {
        id: 'L10',
        name: 'L_FA_SellTheNews',
        type: StrategyType.LOSS,
        prompt: "Find a coin from the list that has a major mainnet launch or announcement scheduled for today. The classic 'buy the rumor, sell the news' strategy suggests shorting the asset immediately after the announcement goes live, as early investors take profit."
    },
];
