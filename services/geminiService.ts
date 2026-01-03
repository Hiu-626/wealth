import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

// Retrieve API Key safely. 
// Vercel/Vite uses import.meta.env.VITE_GEMINI_API_KEY.
// process.env.API_KEY is kept for compatibility if defined.
const getApiKey = (): string | undefined => {
  let key: string | undefined;
  
  // Try Vite env (Standard for Vercel Vite deployments)
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      key = import.meta.env.VITE_GEMINI_API_KEY;
    }
  } catch {}

  // Try process.env if not found (Node/Standard fallback)
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
// Initialize only if key exists to prevent "An API Key must be set" error
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

if (!ai) {
  console.warn("WealthSnapshot: Gemini API Key is missing. AI features will be disabled. Check VITE_GEMINI_API_KEY in Vercel.");
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
 * Estimate stock price using Gemini 3 Flash
 */
export const getStockEstimate = async (symbol: string): Promise<number | null> => {
  if (!ai) {
    console.warn("Gemini API not initialized (Missing API Key)");
    return null;
  }

  try {
    const response: GenerateContentResponse = await runWithRetry(() => ai!.models.generateContent({
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
 * Analyze financial statement image using Gemini 3 Flash
 */
export const parseFinancialStatement = async (base64Data: string): Promise<ScannedAsset[] | null> => {
  if (!ai) {
    console.warn("Gemini API not initialized (Missing API Key)");
    return null;
  }

  try {
    const prompt = `
      Analyze this financial statement image. Extract asset details.
      Identify bank accounts (CASH) and stock positions (STOCK).
      
      Rules:
      1. For STOCK, 'amount' must be the QUANTITY/SHARES held, NOT the value.
      2. For CASH, 'amount' is the BALANCE.
      3. If currency is not clear, infer from context.
    `;

    const response: GenerateContentResponse = await runWithRetry(() => ai!.models.generateContent({
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
    }));

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text) as ScannedAsset[];
  } catch (error) {
    console.error("Error parsing financial statement:", error);
    if (JSON.stringify(error).includes("RESOURCE_EXHAUSTED")) {
      alert("⚠️ Gemini AI usage limit reached (429). Please try again in a few moments.");
    }
    return null;
  }
};