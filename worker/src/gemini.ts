
import { GoogleGenAI, Type } from '@google/genai';
import { log } from './logger';

// Initialize the GoogleGenAI client with the API key from environment variables.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
const model = 'gemini-2.5-flash';

export interface TradeDecision {
    symbol: string;
    reason: string;
    confidence: 'high' | 'medium' | 'low';
}

// Define the JSON schema for the model's response to ensure structured output.
const responseSchema = {
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

export const getTradeDecision = async (prompt: string, marketContext: string): Promise<TradeDecision | null> => {
    try {
        const fullPrompt = `
You are an expert crypto trading analyst. Your task is to select the best cryptocurrency to trade based on the given strategy and market context.
Provide your response in JSON format.

**Strategy:**
${prompt}

**Current Market Context:**
${marketContext}

Select one symbol from the market context list that best fits the strategy.
        `;

        const response = await ai.models.generateContent({
            model: model,
            // The `contents` field should be a string for a single text prompt.
            contents: fullPrompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: responseSchema,
                temperature: 0.5,
            }
        });

        const text = response.text;

        if (!text) {
            log('GEMINI', 'Received empty text response from Gemini.');
            return null;
        }
        
        // The Gemini API guarantees the response will be valid JSON when a schema is provided.
        const decision = JSON.parse(text.trim());

        if (decision.symbol && decision.reason && decision.confidence) {
            return decision as TradeDecision;
        }

        log('GEMINI', `Invalid JSON structure in response: ${text}`);
        return null;

    } catch (error) {
        if (error instanceof Error) {
            log('GEMINI_ERROR', `Error getting trade decision: ${error.message}`);
        } else {
            log('GEMINI_ERROR', `An unknown error occurred while getting trade decision.`);
        }
        return null;
    }
};
