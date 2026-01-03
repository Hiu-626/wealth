import { GoogleGenerativeAI } from "@google/generative-ai";

// Vite 環境下讀取環境變數的方式是 import.meta.env
// 如果你還沒設定環境變數，可以暫時改為: const API_KEY = "你的_AIza_KEY";
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

export interface ScannedAsset {
  category: 'CASH' | 'STOCK';
  institution: string;
  symbol?: string;
  amount: number; // 現金為餘額，股票為股數
  currency: string;
  metadata?: any;
}

/**
 * 使用 Gemini 估算股票價格
 */
export const getStockEstimate = async (symbol: string): Promise<number | null> => {
  if (!API_KEY) {
    console.error("Gemini API Key is missing!");
    return null;
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent({
      contents: [{
        role: "user",
        parts: [{
          text: `What is the approximate current stock price of ${symbol}? 
          Return ONLY a JSON object with a single key "price" containing the number. 
          Example: {"price": 340.5}. 
          If unsure, give a reasonable realistic estimate based on recent history.`
        }]
      }],
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const response = await result.response;
    const text = response.text();
    if (!text) return null;
    
    const data = JSON.parse(text);
    return typeof data.price === 'number' ? data.price : null;
  } catch (error) {
    console.error("Error fetching stock estimate:", error);
    return null;
  }
};

/**
 * 使用 Gemini Vision 分析財務報表截圖
 */
export const parseFinancialStatement = async (base64Data: string, isDebug: boolean = false): Promise<ScannedAsset[] | null> => {
  if (!API_KEY) {
    console.error("Gemini API Key is missing!");
    return null;
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
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

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Data
        }
      },
      { text: prompt }
    ]);

    const response = await result.response;
    const text = response.text();
    if (!text) return null;
    
    return JSON.parse(text) as ScannedAsset[];
  } catch (error) {
    console.error("Error parsing financial statement:", error);
    return null;
  }
};