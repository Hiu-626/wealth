import { GoogleGenerativeAI } from "@google/generative-ai";

// 確保 Vite 能讀到 Key
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

export interface ScannedAsset {
  category: 'CASH' | 'STOCK';
  institution: string;
  symbol?: string;
  amount: number;
  currency: string;
}

// 1. 估算股價
export const getStockEstimate = async (symbol: string): Promise<number | null> => {
  if (!genAI) {
    console.error("API Key missing");
    return null;
  }
  try {
    // 統一改用 gemini-1.5-flash，這是目前最穩定的 Endpoint 名稱
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(`Current price of ${symbol}? Return ONLY JSON: {"price": 123.4}`);
    const response = await result.response;
    const text = response.text().replace(/```json|```/g, "").trim();
    const data = JSON.parse(text);
    return data.price || null;
  } catch (e) {
    console.error("Stock API Error:", e);
    return null;
  }
};

// 2. AI 掃描單據
export const parseFinancialStatement = async (base64Data: string): Promise<ScannedAsset[] | null> => {
  if (!genAI) {
    console.error("API Key missing");
    return null;
  }
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Extract assets from this image into JSON list: [{"category": "CASH"|"STOCK", "institution": "name", "symbol": "ticker", "amount": number, "currency": "HKD"}]. For stocks, amount is quantity.`;

    const result = await model.generateContent([
      { inlineData: { mimeType: "image/jpeg", data: base64Data } },
      { text: prompt }
    ]);

    const response = await result.response;
    const text = response.text();
    // 增加過濾：確保 JSON 解析不會因為 Markdown 標籤失敗
    const cleanJson = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (e) {
    console.error("AI Analysis Error:", e);
    return null;
  }
};