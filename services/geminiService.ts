import { GoogleGenAI } from "@google/genai";

// 取得 API Key
const getApiKey = (): string | undefined => {
  let key: string | undefined;
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      key = import.meta.env.VITE_GEMINI_API_KEY;
    }
  } catch {}
  if (!key && typeof process !== 'undefined' && process.env) {
    key = process.env.API_KEY;
  }
  return key;
};

const apiKey = getApiKey();
// 初始化
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export interface ScannedAsset {
  category: 'CASH' | 'STOCK';
  institution: string;
  symbol?: string;
  amount: number; 
  currency: string;
  price?: number; // Added for manual price editing
}

/**
 * 自動重試機制
 * 增強版：處理 Quota Exceeded 的等待時間 (指數退避)
 */
const runWithRetry = async <T>(fn: () => Promise<T>, retries = 5, delay = 3000): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    const errorMsg = JSON.stringify(error);
    const isQuotaError = error?.status === 429 || errorMsg.includes("429");
    const isOverloaded = errorMsg.includes("503") || errorMsg.includes("overloaded");

    if ((isQuotaError || isOverloaded) && retries > 0) {
      console.warn(`AI busy (429/503), retrying in ${delay}ms... (${retries} left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      // Exponential backoff: 3s -> 6s -> 12s -> 24s -> 48s
      return runWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

/**
 * 核心功能：分析財務報表圖片
 * @param base64Data 不含標頭的純 Base64 字串
 */
export const parseFinancialStatement = async (base64Data: string): Promise<ScannedAsset[] | null> => {
  if (!ai) {
    console.error("Gemini API Key is missing.");
    return null;
  }

  try {
    // 💡 修正：使用 'gemini-flash-latest' 以獲得更穩定的 Quota 限制 (避免使用 Experimental 模型導致 429)
    const prompt = `
      Instructions:
      1. Analyze the attached financial statement image.
      2. Extract all assets into a JSON array.
      3. For each asset:
         - category: 'STOCK' (for shares/equities/funds) or 'CASH' (for bank balances/deposits).
         - institution: Name of the bank or brokerage. clearly identify names like 'CommSec', 'Hang Seng', 'HSBC', 'Schwab', 'IBKR'.
         - symbol: The ticker or stock code (e.g., 'AAPL', '0700.HK', 'GOLD.AX', 'IVV'). If CASH, leave empty.
         - amount: If STOCK, must be the QUANTITY of shares. If CASH, must be the BALANCE.
         - currency: Extract 'HKD', 'USD', or 'AUD'. Default to 'HKD' if not found.
      
      Return ONLY a JSON array.
    `;

    const response = await runWithRetry(() => ai.models.generateContent({
      model: 'gemini-flash-latest', 
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
      }
    }));

    const text = response.text;
    
    if (!text) return null;

    // 💡 增加 JSON 解析與格式檢查
    try {
      const parsed = JSON.parse(text);
      // 自動處理 AI 可能包裝在物件內的情況
      const finalData = Array.isArray(parsed) ? parsed : (parsed.assets || []);
      
      console.log("AI Analysis Success:", finalData);
      return finalData as ScannedAsset[];
    } catch (e) {
      console.error("AI JSON Parsing Error. Raw Text:", text);
      return null;
    }

  } catch (error: any) {
    // 這裡會捕獲 404, 403, 429 等嚴重錯誤
    console.error("Critical AI Error Details:", error);
    return null;
  }
};