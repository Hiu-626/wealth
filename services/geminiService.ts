// 確保是這個官方 Library
import { GoogleGenerativeAI } from "@google/generative-ai"; 

// 確保是用 Vite 的讀取方式
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

let ai: GoogleGenAI | null = null;
if (apiKey) {
    try {
        ai = new GoogleGenAI({ apiKey: apiKey });
    } catch (e) {
        console.warn("Failed to initialize GoogleGenAI", e);
    }
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
 * Estimate stock price using Gemini 3 Flash Preview
 */
export const getStockEstimate = async (symbol: string): Promise<number | null> => {
  if (!ai) return null;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `What is the approximate current stock price of ${symbol}? 
      Return ONLY a JSON object with a single key "price" containing the number. 
      Example: {"price": 340.5}. 
      If unsure, give a reasonable realistic estimate based on recent history.`,
      config: {
        responseMimeType: "application/json"
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
 * Analyze financial statement image using Gemini Vision
 */
export const parseFinancialStatement = async (base64Data: string, isDebug: boolean = false): Promise<ScannedAsset[] | null> => {
  if (!ai) return null;
  try {
    const prompt = `
      Analyze this financial statement image. Extract asset details into a JSON list.
      Identify bank accounts (CASH) and stock positions (STOCK).
      
      Return JSON format:
      [
        {
          "category": "CASH" | "STOCK",
          "institution": "Bank Name or Broker Name",
          "symbol": "Ticker symbol if stock (e.g. AAPL, 0700.HK)",
          "amount": number, 
          "currency": "HKD" | "USD" | "AUD"
        }
      ]
      
      Rules:
      1. For STOCK, 'amount' must be the QUANTITY/SHARES held, NOT the value.
      2. For CASH, 'amount' is the BALANCE.
      3. If currency is not explicit, infer from the bank context (e.g. HSBC HK -> HKD).
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg', 
              data: base64Data
            }
          },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: 'application/json'
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