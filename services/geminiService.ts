import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface ScannedAsset {
  category: 'CASH' | 'STOCK';
  institution: string;
  symbol?: string;
  amount: number; // For cash: balance, For stock: quantity
  currency: string;
  metadata?: any;
}

/**
 * Uses Gemini to estimate a stock price.
 * NOTE: In a production app, this should be a real financial API. 
 * Gemini is used here to simulate intelligent data retrieval as requested.
 */
export const getStockEstimate = async (symbol: string): Promise<number | null> => {
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
 * Analyzes a financial statement image using Gemini Vision.
 */
export const parseFinancialStatement = async (base64Data: string, isDebug: boolean = false): Promise<ScannedAsset[] | null> => {
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
          "amount": number (balance or quantity),
          "currency": "HKD" | "USD" | "AUD"
        }
      ]
      
      For stocks, 'amount' is the quantity of shares.
      For cash, 'amount' is the balance.
      If currency is not clear, infer from context (e.g. HK bank -> HKD).
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