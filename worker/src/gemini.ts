
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

interface TradingDecision {
    symbol: string;
    side: 'Buy' | 'Sell';
    reasoning: string;
}

const responseSchema = {
    type: Type.OBJECT,
    properties: {
        symbol: {
            type: Type.STRING,
            description: "The cryptocurrency symbol to trade, e.g., BTCUSDT."
        },
        side: {
            type: Type.STRING,
            enum: ["Buy", "Sell"],
            description: "The side of the trade. 'Buy' for a long position, 'Sell' for a short position."
        },
        reasoning: {
            type: Type.STRING,
            description: "A brief, one-sentence explanation for the trading decision."
        }
    },
    required: ["symbol", "side", "reasoning"]
};


export const getTradingDecision = async (prompt: string, symbols: string[]): Promise<TradingDecision | null> => {
    try {
        const fullPrompt = `
            ${prompt}
            
            Your task is to select exactly one cryptocurrency from the following list and recommend a trade.
            Provide your answer as a JSON object that strictly adheres to the provided schema.
            Do not include any extra text or markdown formatting outside of the JSON object.

            Available symbols:
            ${symbols.join(', ')}
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: fullPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.9, // Higher temperature for more varied/creative decisions
            },
        });
        
        const jsonText = response.text.trim();
        const decision = JSON.parse(jsonText);
        
        // Validate that the chosen symbol was from the provided list
        if (!symbols.includes(decision.symbol)) {
            console.error(`Gemini returned a symbol (${decision.symbol}) not in the provided list.`);
            return null;
        }

        return decision as TradingDecision;

    } catch (error) {
        console.error("Error getting trading decision from Gemini:", error);
        return null;
    }
};
