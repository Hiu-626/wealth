import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

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
// 💡 修正：SDK 的初始化類別名稱通常是 GoogleGenerativeAI
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export interface ScannedAsset {
  category: 'CASH' | 'STOCK';
  institution: string;
  symbol?: string;
  amount: number; 
  currency: string;
}

/**
 * 自動重試機制 (保持不變，這部分寫得很棒)
 */
const runWithRetry = async <T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    const isQuotaError = error?.status === 429 || JSON.stringify(error).includes("429");
    if (isQuotaError && retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
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
  if (!genAI) return null;

  try {
    // 使用 flash 1.5 獲取最佳性能與穩定性
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const prompt = `
      Extract all financial assets from this image.
      - STOCK: For equities/investments. 'amount' must be the QUANTITY of shares.
      - CASH: For bank balances. 'amount' must be the BALANCE.
      - Institution: Name of bank or broker.
      - Currency: Extract HKD, USD, or AUD. Default to HKD.
      Return a JSON array of objects.
    `;

    // 💡 修正內容結構，確保 inlineData 格式完全符合 API 規範
    const result = await runWithRetry(() => model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: "image/jpeg", // 通常 API 接受 jpeg 處理大部分圖片格式
          data: base64Data
        }
      }
    ]));

    const response = await result.response;
    const text = response.text();
    
    if (!text) return null;

    // 💡 增加 JSON 解析保護
    try {
      const parsed = JSON.parse(text);
      // 如果回傳的是物件而非陣列（有時 AI 會包一層），進行修正
      const finalData = Array.isArray(parsed) ? parsed : (parsed.assets || []);
      return finalData;
    } catch (e) {
      console.error("JSON Parsing Error from AI:", text);
      return null;
    }

  } catch (error: any) {
    console.error("Critical AI Error:", error);
    return null;
  }
};