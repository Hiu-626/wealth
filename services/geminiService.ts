import { GoogleGenAI, Type } from "@google/genai";

// Use process.env.API_KEY as required by guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface ScannedAsset {
  category: 'CASH' | 'STOCK';
  institution: string;
  symbol?: string;
  amount: number; // Balance for Cash, Quantity for Stock
  currency: string;
  metadata?: any;
}

/**
 * Estimate stock price using Gemini 3 Flash
 */
export const getStockEstimate = async (symbol: string): Promise<number | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `What is the approximate current stock price of ${symbol}?`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            price: { type: Type.NUMBER, description: "The stock price." }
          }
        }
      }
    });

    const text = response.text;
    if (!text) return null;
    const data = JSON.parse(text);
    return typeof data.price === 'number' ? data.price : null;
  } catch (error) {
    console.error("Error fetching stock estimate:", error);
    return null;
  }
};

/**
 * Analyze financial statement image using Gemini 3 Flash
 */
export const parseFinancialStatement = async (base64Data: string): Promise<ScannedAsset[] | null> => {
  try {
    const prompt = `
      Analyze this financial statement image. Extract asset details.
      Identify bank accounts (CASH) and stock positions (STOCK).
      
      Rules:
      1. For STOCK, 'amount' must be the QUANTITY/SHARES held, NOT the value.
      2. For CASH, 'amount' is the BALANCE.
      3. If currency is not clear, infer from context.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Data
            }
          },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              category: { 
                type: Type.STRING, 
                description: "Must be 'CASH' or 'STOCK'" 
              },
              institution: { type: Type.STRING },
              symbol: { type: Type.STRING },
              amount: { type: Type.NUMBER },
              currency: { 
                type: Type.STRING,
                description: "Currency code like HKD, USD, AUD"
              }
            },
            required: ["category", "institution", "amount", "currency"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text) as ScannedAsset[];
  } catch (error) {
    console.error("Error parsing financial statement:", error);
    return null;
  }
};