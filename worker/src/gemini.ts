
import { GoogleGenAI, Type } from '@google/genai';
import { log } from './logger';
import { Position } from './types';

// Initialize the GoogleGenAI client with the API key from environment variables.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
const model = 'gemini-2.5-flash';

export interface TradeDecision {
    symbol: string;
    reason: string;
    confidence: 'high' | 'medium' | 'low';
}

export type HoldDecision = 'HOLD' | 'CLOSE';

// Define the JSON schema for the trade decision response.
const tradeDecisionSchema = {
    type: Type.OBJECT,
    properties: {
        symbol: {
            type: Type.STRING,
            description: 'The cryptocurrency symbol to trade, e.g., BTCUSDT.'
        },
        reason: {
            type: Type.STRING,
            description: 'A brief explanation for choosing this symbol based on the strategy.'
        },
        confidence: {
            type: Type.STRING,
            description: 'The confidence level of this decision (high, medium, or low).'
        }
    },
    required: ['symbol', 'reason', 'confidence']
};

// Define the JSON schema for the hold decision response.
const holdDecisionSchema = {
    type: Type.OBJECT,
    properties: {
        decision: {
            type: Type.STRING,
            description: "Your decision, either 'HOLD' or 'CLOSE'."
        },
        reason: {
            type: Type.STRING,
            description: 'A brief explanation for your decision.'
        }
    },
    required: ['decision', 'reason']
};

export const getTradeDecision = async (prompt: string, marketContext: string): Promise<TradeDecision | null> => {
    try {
        const fullPrompt = `
You are an expert crypto trading analyst. Your task is to select the best cryptocurrency to trade based on the given strategy and market context.
Provide your response in JSON format.

**Strategy:**
${prompt}

**Current Market Context (Symbol, Last Price, 24h Change %, 24h Volume):**
${marketContext}

Select one symbol from the market context list that best fits the strategy.
        `;

        const response = await ai.models.generateContent({
            model: model,
            contents: fullPrompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: tradeDecisionSchema,
                temperature: 0.5,
            }
        });

        const text = response.text;
        if (!text) {
            log('GEMINI', 'Received empty text response from Gemini for trade decision.');
            return null;
        }
        
        const decision = JSON.parse(text.trim());
        if (decision.symbol && decision.reason && decision.confidence) {
            return decision as TradeDecision;
        }

        log('GEMINI', `Invalid JSON structure in trade decision response: ${text}`);
        return null;

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        log('GEMINI_ERROR', `Error getting trade decision: ${errorMessage}`);
        return null;
    }
};

export const getHoldDecision = async (strategyPrompt: string, position: Position, marketContext: string): Promise<HoldDecision | null> => {
     try {
        const fullPrompt = `
You are an expert crypto trading analyst. You are currently in a trade and need to decide whether to hold or close the position.
Provide your response in JSON format.

**Original Strategy:**
${strategyPrompt}

**Current Position:**
- Symbol: ${position.symbol}
- Side: ${position.side}
- Entry Price: ${position.entryPrice}
- Current Unrealized PnL: ${position.unrealizedPnl.toFixed(2)} USD

**Current Market Context (Symbol, Last Price, 24h Change %, 24h Volume):**
${marketContext}

Based on the original strategy and current market conditions, should you HOLD or CLOSE this position?
        `;

        const response = await ai.models.generateContent({
            model: model,
            contents: fullPrompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: holdDecisionSchema,
                temperature: 0.2,
            }
        });

        const text = response.text;
         if (!text) {
            log('GEMINI', 'Received empty text response from Gemini for hold decision.');
            return null;
        }
        
        const parsedResponse = JSON.parse(text.trim());
         if (parsedResponse.decision && (parsedResponse.decision === 'HOLD' || parsedResponse.decision === 'CLOSE')) {
            log(position.agentId, `Gemini Hold/Close decision: ${parsedResponse.decision}. Reason: ${parsedResponse.reason}`);
            return parsedResponse.decision as HoldDecision;
        }

        log('GEMINI', `Invalid JSON structure in hold decision response: ${text}`);
        return null;

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        log('GEMINI_ERROR', `Error getting hold decision: ${errorMessage}`);
        return null;
    }
}
