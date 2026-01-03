import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

// Retrieve API Key safely. 
const getApiKey = (): string | undefined => {
  let key: string | undefined;
  
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      key = import.meta.env.VITE_GEMINI_API_KEY;
    }
  } catch {}

  if (!key) {
    try {
      if (typeof process !== 'undefined' && process.env) {
        key = process.env.API_KEY;
      }
    } catch {}
  }
  return key;
};

const apiKey = getApiKey();
// Initialize only if key exists
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

if (!ai) {
  console.warn("WealthSnapshot: Gemini API Key is missing.");
}

export interface ScannedAsset {
  category: 'CASH' | 'STOCK';
  institution: string;
  symbol?: string;
  amount: number; // Balance for Cash, Quantity for Stock
  currency: string;
  metadata?: any;
}

/**
 * Helper to retry functions on 429 (Rate Limit) errors
 * Retries 3 times with exponential backoff (2s -> 4s -> 8s)
 */
const runWithRetry = async <T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    const errString = JSON.stringify(error);
    const isQuotaError = 
      error?.status === 429 || 
      error?.code === 429 || 
      errString.includes("RESOURCE_EXHAUSTED") ||
      errString.includes("429");

    if (isQuotaError && retries > 0) {
      console.warn(`Gemini API Quota Hit (429). Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return runWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

/**
 * Estimate stock price using Gemini Flash (Stable)
 */
export const getStockEstimate = async (symbol: string): Promise<number | null> => {
  if (!ai) return null;

  try {
    // Using 'gemini-flash-latest' for better quota management than preview models
    const response: GenerateContentResponse = await runWithRetry(() => ai!.models.generateContent({
      model: "gemini-flash-latest",
      contents: `What is the approximate current stock price of ${symbol}? Return JSON only.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            price: { type: Type.NUMBER, description: "The stock price." }
          }
        }
      }
    }));

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
 * Analyze financial statement image using Gemini Flash (Stable)
 */
export const parseFinancialStatement = async (base64Data: string): Promise<ScannedAsset[] | null> => {
  if (!ai) return null;

  try {
    const prompt = `
      Extract all assets from this image. 
      - STOCK: For shares/equities/investments. 'amount' is number of shares (quantity). 'symbol' is ticker (e.g. ANZ, AAPL, 700).
      - CASH: For bank balances/savings. 'amount' is the monetary balance. 
      - Institution: Name of bank/broker (e.g. CommSec, HSBC, Interactive Brokers).
      - Currency: Must be HKD, USD, or AUD based on symbols or context (default to HKD if ambiguous).
      Return as a JSON array.
    `;

    // Using 'gemini-flash-latest' for better quota management
    const response: GenerateContentResponse = await runWithRetry(() => ai!.models.generateContent({
      model: "gemini-flash-latest",
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
                enum: ["CASH", "STOCK"],
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
    }));

    const text = response.text;
    console.log("AI Raw Output:", text);

    if (!text || text.trim() === "" || text === "[]") {
      console.warn("AI returned empty result");
      return null;
    }

    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : null;
  } catch (error: any) {
    console.error("Critical AI Error:", error);
    if (JSON.stringify(error).includes("RESOURCE_EXHAUSTED")) {
        alert("⚠️ Gemini AI 配額已滿 (429)。系統正在重試，請稍候再試。");
    }
    return null;
  }
};