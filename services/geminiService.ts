import { GoogleGenerativeAI } from "@google/generative-ai"; 

// 1. 從 Vite 環境變數讀取 Key
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

// 2. 初始化 (統一使用官方建議的 genAI 命名)
let genAI: GoogleGenerativeAI | null = null;
if (apiKey) {
    try {
        genAI = new GoogleGenerativeAI(apiKey);
    } catch (e) {
        console.warn("Failed to initialize Gemini AI", e);
    }
}

export interface ScannedAsset {
  category: 'CASH' | 'STOCK';
  institution: string;
  symbol?: string;
  amount: number; 
  currency: string;
  metadata?: any;
}

/**
 * 使用 Gemini 估算股價
 */
export const getStockEstimate = async (symbol: string): Promise<number | null> => {
  if (!genAI) return null;
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `What is the approximate current stock price of ${symbol}? 
      Return ONLY a JSON object: {"price": number}.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const data = JSON.parse(text);
    return typeof data.price === 'number' ? data.price : null;
  } catch (error) {
    console.error("Error fetching stock estimate:", error);
    return null;
  }
};

/**
 * 使用 Gemini Vision 分析圖片
 */
export const parseFinancialStatement = async (base64Data: string): Promise<ScannedAsset[] | null> => {
  if (!genAI) {
    console.error("AI 尚未初始化，請檢查 API Key");
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
          "institution": "Bank/Broker Name",
          "symbol": "Ticker (e.g. 0700.HK)",
          "amount": number, 
          "currency": "HKD" | "USD" | "AUD"
        }
      ]
      Rules: 1. STOCK amount = Quantity. 2. CASH amount = Balance.
    `;

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'image/jpeg', 
          data: base64Data
        }
      },
      { text: prompt }
    ]);

    const response = await result.response;
    const text = response.text();
    return JSON.parse(text) as ScannedAsset[];
  } catch (error) {
    console.error("Error parsing financial statement:", error);
    return null;
  }
};