import { GoogleGenerativeAI } from "@google/generative-ai";

// 1. 取得 Key (Vite 專用讀取方式)
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// 2. 初始化客戶端
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

export interface ScannedAsset {
  category: 'CASH' | 'STOCK';
  institution: string;
  symbol?: string;
  amount: number;
  currency: string;
}

/**
 * 估算股價
 */
export const getStockEstimate = async (symbol: string): Promise<number | null> => {
  if (!genAI) {
    console.error("AI Key Missing");
    return null;
  }
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(`Current price of ${symbol}? Return ONLY JSON: {"price": 123.4}`);
    const response = await result.response;
    const data = JSON.parse(response.text());
    return data.price || null;
  } catch (e) {
    console.error("Stock API Error:", e);
    return null;
  }
};

/**
 * AI 掃描單據
 */
export const parseFinancialStatement = async (base64Data: string): Promise<ScannedAsset[] | null> => {
  if (!genAI) {
    alert("AI Key 尚未設定，請在 Vercel 設定 VITE_GEMINI_API_KEY");
    return null;
  }
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Extract assets from this image into JSON list: [{"category": "CASH"|"STOCK", "institution": "name", "symbol": "ticker", "amount": number, "currency": "HKD"}]. Note: For stocks, amount is quantity.`;

    const result = await model.generateContent([
      { inlineData: { mimeType: "image/jpeg", data: base64Data } },
      { text: prompt }
    ]);

    const response = await result.response;
    return JSON.parse(response.text());
  } catch (e) {
    console.error("AI Analysis Error:", e);
    return null;
  }
};