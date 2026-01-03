import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

export interface ScannedAsset {
  category: 'CASH' | 'STOCK';
  institution: string;
  symbol?: string;
  amount: number;
  currency: string;
}

// 估算股價
export const getStockEstimate = async (symbol: string): Promise<number | null> => {
  if (!genAI) return null;
  try {
    // 修正點：改用 gemini-1.5-flash-latest
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const result = await model.generateContent(`Current price of ${symbol}? Return ONLY JSON: {"price": 123.4}`);
    const response = await result.response;
    const data = JSON.parse(response.text());
    return data.price || null;
  } catch (e) {
    console.error("Stock API Error:", e);
    return null;
  }
};

// AI 掃描單據
export const parseFinancialStatement = async (base64Data: string): Promise<ScannedAsset[] | null> => {
  if (!genAI) return null;
  try {
    // 修正點：改用 gemini-1.5-flash-latest
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const prompt = `Extract assets from this image into JSON list: [{"category": "CASH"|"STOCK", "institution": "name", "symbol": "ticker", "amount": number, "currency": "HKD"}]. For stocks, amount is quantity.`;

    const result = await model.generateContent([
      { inlineData: { mimeType: "image/jpeg", data: base64Data } },
      { text: prompt }
    ]);

    const response = await result.response;
    const text = response.text();
    // 預防 AI 回傳 Markdown 格式 (```json ... ```)
    const cleanJson = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (e) {
    console.error("AI Analysis Error:", e);
    return null;
  }
};