import React, { useState, useRef, useEffect } from 'react';
import { Account, AccountType, Currency } from '../types';
import { 
  Save, Plus, Loader2, TrendingUp, Building2, 
  Minus, ScanLine, CloudUpload, History, Sparkles, X, Trash2, CheckCircle2, Globe2,
  Wallet, Edit3, Search, Image as ImageIcon, Landmark, Quote, ArrowRight, Lightbulb, TrendingDown, RefreshCw
} from 'lucide-react';
import { parseFinancialStatement, ScannedAsset } from '../services/geminiService';
import Confetti from './Confetti';

// --- 配置 ---
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwcew_uZTf1VM66NSub7n5oF4MxTQDk2kqAe39HSdJ7f2fs5x-6OCxrNNk1XhYqdZ97HA/exec';

interface UpdatePageProps {
  accounts: Account[];
  onSave: (updatedAccounts: Account[]) => void;
}

// --- 成功同步後的摘要彈窗 (UI/UX 升級版) ---
const SyncSuccessModal = ({ isOpen, onClose, data }: { isOpen: boolean, onClose: () => void, data: any }) => {
  if (!isOpen) return null;

  const isPositive = data.netChange >= 0;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-[200] backdrop-blur-xl animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-300">
        
        {/* Header Area */}
        <div className={`p-8 pb-10 text-white text-center relative overflow-hidden transition-colors ${isPositive ? 'bg-[#0052CC]' : 'bg-gray-800'}`}>
          <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.1)_50%,transparent_75%)] bg-[length:250%_250%] animate-[shimmer_3s_infinite]" />
          <div className="absolute top-6 right-6 opacity-20"><Sparkles size={32}/></div>
          
          <div className="bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 border border-white/30 shadow-lg backdrop-blur-sm">
            <CheckCircle2 size={32} />
          </div>
          <h3 className="text-xl font-black tracking-tight">✅ 同步成功！</h3>
          <p className="text-blue-200 text-[10px] font-bold uppercase tracking-widest mt-1">WEALTH SNAPSHOT SAVED</p>
        </div>
        
        <div className="px-6 py-6 -mt-6 bg-white rounded-t-[2.5rem] relative z-10 space-y-5">
          
          {/* 核心數據卡片 */}
          <div className="grid grid-cols-2 gap-3 text-center">
             <div className="bg-blue-50/50 p-3 rounded-2xl border border-blue-100 flex flex-col justify-center">
                <div className="text-[10px] font-bold text-gray-400 uppercase mb-1 flex items-center justify-center gap-1"><Building2 size={10}/> 銀行總額</div>
                <div className="text-sm font-black text-gray-800">
                   HK${Math.round(data.bankTotal).toLocaleString()}
                </div>
             </div>
             <div className="bg-purple-50/50 p-3 rounded-2xl border border-purple-100 flex flex-col justify-center">
                <div className="text-[10px] font-bold text-gray-400 uppercase mb-1 flex items-center justify-center gap-1"><TrendingUp size={10}/> 股票總額</div>
                <div className="text-sm font-black text-gray-800">
                   HK${Math.round(data.stockTotal).toLocaleString()}
                </div>
             </div>
          </div>

          {/* 總淨資產與變動 */}
          <div className="text-center bg-gray-50 rounded-2xl p-4 border border-gray-100">
             <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">💎 總淨資產</p>
             <div className="text-3xl font-black text-gray-800 font-roboto tracking-tighter">
                HK${Math.round(data.totalNetWorth).toLocaleString()}
             </div>
             <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold mt-2 ${isPositive ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {isPositive ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                {isPositive ? '+' : ''}HK${Math.round(data.netChange).toLocaleString()} vs 上次
             </div>
          </div>

          {/* AI 分析建議區塊 */}
          <div className="space-y-3">
            {/* 鼓勵語 */}
            <div className={`p-4 rounded-2xl border-l-4 shadow-sm ${isPositive ? 'bg-blue-50 border-blue-500' : 'bg-gray-50 border-gray-400'}`}>
               <p className="text-sm font-bold text-gray-700 leading-snug">
                 {data.encouragement}
               </p>
            </div>

            {/* 建議 */}
            <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-100 flex gap-3">
               <Lightbulb className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
               <p className="text-xs font-medium text-yellow-800 leading-relaxed">
                 {data.suggestion}
               </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="w-full py-4 bg-gray-900 text-white rounded-[1.5rem] font-black text-lg active:scale-95 transition-all shadow-xl hover:bg-black flex items-center justify-center gap-2"
          >
            知道，繼續努力 <ArrowRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

const UpdatePage: React.FC<UpdatePageProps> = ({ accounts, onSave }) => {
  const [activeTab, setActiveTab] = useState<'MANUAL' | 'AI_SCANNER'>('MANUAL');
  const [showConfetti, setShowConfetti] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [localAccounts, setLocalAccounts] = useState<Account[]>([...accounts]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  
  const [syncSummary, setSyncSummary] = useState({ 
    totalNetWorth: 0, 
    bankTotal: 0, 
    stockTotal: 0,
    netChange: 0,
    encouragement: '',
    suggestion: ''
  });

  const [newAssetType, setNewAssetType] = useState<AccountType | null>(null);
  const [newItemData, setNewItemData] = useState({ name: '', symbol: '', amount: '' });
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scannedItems, setScannedItems] = useState<ScannedAsset[]>([]);
  const aiInputRef = useRef<HTMLInputElement>(null);
  const [isFetchingPreview, setIsFetchingPreview] = useState(false);
  const [previewPrice, setPreviewPrice] = useState<number | null>(null);

  // --- 輔助函數：市場代碼修正 ---
  const getUpdatedSymbolInfo = (baseSymbol: string, suffix: '.HK' | '.AX' | 'US') => {
    let cleanSymbol = baseSymbol.replace(/\.(HK|AX)$/i, '').trim();
    if (suffix === 'US') {
      return { symbol: cleanSymbol, currency: 'USD' };
    } else {
      if (suffix === '.HK' && /^\d+$/.test(cleanSymbol)) cleanSymbol = cleanSymbol.padStart(5, '0');
      return { 
        symbol: `${cleanSymbol}${suffix}`, 
        currency: suffix === '.HK' ? 'HKD' : 'AUD' 
      };
    }
  };

  const updateMarketSuffix = (index: number, suffix: '.HK' | '.AX' | 'US') => {
    const updated = [...scannedItems];
    const info = getUpdatedSymbolInfo(updated[index].symbol || '', suffix);
    updated[index] = { ...updated[index], symbol: info.symbol, currency: info.currency };
    setScannedItems(updated);
  };

  // --- 恢復的一鍵市場設定 (SET ALL) ---
  const applyGlobalMarket = (suffix: '.HK' | '.AX' | 'US') => {
    const updated = scannedItems.map(item => {
       if (item.category !== 'STOCK') return item;
       const info = getUpdatedSymbolInfo(item.symbol || '', suffix);
       return { ...item, symbol: info.symbol, currency: info.currency };
    });
    setScannedItems(updated);
  };

  // --- 1. 市場預覽查詢 (用於手動新增視窗) ---
  const fetchLivePreview = async (inputSymbol: string) => {
    if (!inputSymbol || newAssetType !== AccountType.STOCK) return;
    setIsFetchingPreview(true);
    try {
      const response = await fetch(`${GOOGLE_SCRIPT_URL}?symbol=${encodeURIComponent(inputSymbol.toUpperCase().trim())}`);
      const data = await response.json();
      setPreviewPrice(Number(data.price) || 0);
    } catch (e) { setPreviewPrice(0); }
    finally { setIsFetchingPreview(false); }
  };

  // --- 1.1 掃描項目的單獨查價 ---
  const fetchScannedItemPrice = async (index: number) => {
    const item = scannedItems[index];
    if (!item.symbol) return;
    setIsFetchingPreview(true); 
    try {
      const response = await fetch(`${GOOGLE_SCRIPT_URL}?symbol=${encodeURIComponent(item.symbol.toUpperCase().trim())}`);
      const data = await response.json();
      if (data.price) {
        const updated = [...scannedItems];
        updated[index].price = Number(data.price);
        setScannedItems(updated);
      }
    } catch (e) { console.error("Price fetch failed", e); }
    finally { setIsFetchingPreview(false); }
  };

  // --- 1.2 批量查價 (Auto-fill) ---
  const fetchBatchPrices = async (items: ScannedAsset[]) => {
    setIsFetchingPreview(true);
    let updatedItems = [...items];
    
    // 平行處理請求，加快速度
    const promises = updatedItems.map(async (item, index) => {
      if (item.category === 'STOCK' && item.symbol) {
        try {
          const res = await fetch(`${GOOGLE_SCRIPT_URL}?symbol=${encodeURIComponent(item.symbol.trim())}`);
          const d = await res.json();
          if (d.price) {
            updatedItems[index] = { ...updatedItems[index], price: Number(d.price) };
          }
        } catch(e) { console.error(e); }
      }
    });

    await Promise.all(promises);
    setScannedItems(updatedItems);
    setIsFetchingPreview(false);
  };

  // --- 2. 核心同步功能 (POST) - 升級邏輯 ---
  // manualOverrides: 手動輸入的價格優先使用
  const handleFinalSave = async (updatedLocalAccounts: Account[], manualOverrides: Record<string, number> = {}) => {
    setIsSaving(true);
    
    // 0. 輔助函數：簡易統一匯率計算 (用於前後對比)
    const calculateValueHKD = (acc: Account) => {
        let val = acc.type === AccountType.STOCK 
            ? ((acc.quantity || 0) * (acc.lastPrice || 0)) 
            : acc.balance;
        
        if(acc.currency === 'USD') val = val * 7.82;
        if(acc.currency === 'AUD') val = val * 5.15;
        return val;
    };

    // 1. 計算舊的總額 (用於對比)
    const oldTotal = accounts.reduce((sum, acc) => sum + calculateValueHKD(acc), 0);

    try {
      const payload = {
        assets: updatedLocalAccounts.map(acc => ({
          category: acc.type === AccountType.STOCK ? 'STOCK' : 'CASH',
          institution: acc.name,
          symbol: acc.symbol || '',
          amount: acc.type === AccountType.STOCK ? acc.quantity : acc.balance,
          currency: acc.currency,
          market: acc.symbol?.endsWith(".HK") ? "HK" : (acc.symbol?.endsWith(".AX") ? "AU" : "US")
        }))
      };
      
      const response = await fetch(GOOGLE_SCRIPT_URL, { 
        method: 'POST', 
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload) 
      });

      const result = await response.json();
      if (result.status === "Success") {
        setShowConfetti(true);
        
        // 根據雲端回傳的最新價更新本地數據，但如果 Manual Override 存在，優先使用
        const syncedAccounts = updatedLocalAccounts.map(acc => {
          if (acc.type === AccountType.STOCK && acc.symbol) {
            const symKey = acc.symbol.toUpperCase().trim();
            const manualPrice = manualOverrides[symKey];
            const cloudPrice = result.latestPrices?.[symKey];
            
            // 優先順序: Manual > Cloud > Existing
            if (manualPrice !== undefined && manualPrice > 0) {
                 return { ...acc, lastPrice: manualPrice, balance: Math.round((acc.quantity || 0) * manualPrice) };
            } else if (cloudPrice !== undefined && cloudPrice > 0) {
                 return { ...acc, lastPrice: cloudPrice, balance: Math.round((acc.quantity || 0) * cloudPrice) };
            }
          }
          return acc;
        });

        // 2. 分類計算新總額
        let currentTotal = 0;
        let bankTotal = 0;
        let stockTotal = 0;

        syncedAccounts.forEach(acc => {
            const val = calculateValueHKD(acc);
            currentTotal += val;
            if (acc.type === AccountType.STOCK) stockTotal += val;
            else bankTotal += val;
        });

        // 3. 計算差異
        const diff = currentTotal - oldTotal;

        // 4. 生成鼓勵語
        const getEncouragement = () => {
            if (diff > 0) return `🚀 太強了！資產增加了 HK$${Math.round(diff).toLocaleString()}，離財富自由又近一步！`;
            if (diff < 0) return `📉 市場波動是暫時的，資產微調 HK$${Math.abs(Math.round(diff)).toLocaleString()}，專注於長期增長！`;
            return "💰 資產持平，穩健就是最好的投資！";
        };

        // 5. 生成建議
        const getSuggestion = () => {
            const stockRatio = currentTotal > 0 ? stockTotal / currentTotal : 0;
            if (stockRatio > 0.7) return `建議：目前股票比例較高 (${Math.round(stockRatio*100)}%)，可考慮預留更多現金應對波動。`;
            if (stockRatio < 0.2) return `建議：現金儲備非常充足，可考慮分批佈署優質藍籌股或指數基金。`;
            return "建議：目前的資產配置非常均衡，繼續保持！";
        };

        setSyncSummary({ 
          totalNetWorth: currentTotal, 
          bankTotal: bankTotal, 
          stockTotal: stockTotal,
          netChange: diff,
          encouragement: getEncouragement(),
          suggestion: getSuggestion()
        });

        setLocalAccounts(syncedAccounts);
        onSave(syncedAccounts);
        setIsSuccessModalOpen(true);
      }
    } catch (e) { alert("Sync Error. Please check your Script URL."); }
    setIsSaving(false);
  };

  // --- 3. AI 掃描處理 ---
  const handleAIFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsAnalyzing(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1];
      const results = await parseFinancialStatement(base64);
      if (results) {
         setScannedItems(results);
         // Auto-fetch prices immediately for better UX
         await fetchBatchPrices(results);
      }
      setIsAnalyzing(false);
    };
    reader.readAsDataURL(file);
  };

  const handleAISyncConfirm = async () => {
    setIsSaving(true);
    
    // Collect manual price overrides to prevent overwriting by cloud sync
    const overrides: Record<string, number> = {};

    const enriched = scannedItems.map(item => {
       const sym = item.symbol?.toUpperCase() || '';
       if (item.category === 'STOCK' && item.price) {
           overrides[sym] = item.price;
       }
       return {
          id: Math.random().toString(36).substr(2, 9),
          name: item.institution,
          type: item.category === 'STOCK' ? AccountType.STOCK : AccountType.CASH,
          currency: item.currency as Currency,
          balance: item.category === 'CASH' ? item.amount : 0, 
          symbol: sym,
          quantity: item.category === 'STOCK' ? item.amount : undefined,
          lastPrice: item.price || 0 
       };
    });
    
    setScannedItems([]);
    await handleFinalSave([...localAccounts, ...enriched], overrides);
  };

  const handleAddAsset = async () => {
    if (!newAssetType) return;
    const sym = newItemData.symbol.toUpperCase().trim();
    const newAcc: Account = {
      id: Date.now().toString(),
      name: newItemData.name || sym,
      type: newAssetType,
      currency: (sym.endsWith('.AX') || sym === 'GOLD') ? 'AUD' : (sym.endsWith('.HK') || /^\d+$/.test(sym)) ? 'HKD' : 'USD',
      symbol: sym,
      quantity: newAssetType === AccountType.STOCK ? parseFloat(newItemData.amount) : undefined,
      balance: newAssetType === AccountType.CASH ? parseFloat(newItemData.amount) : 0,
      lastPrice: previewPrice || 0
    };
    const overrides = (newAssetType === AccountType.STOCK && previewPrice) ? { [sym]: previewPrice } : {};
    
    const updated = [...localAccounts, newAcc];
    setLocalAccounts(updated);
    setIsModalOpen(false);
    setNewItemData({ name: '', symbol: '', amount: '' });
    await handleFinalSave(updated, overrides);
  };

  return (
    <div className="p-6 pb-32 space-y-6 bg-gray-50 min-h-screen font-sans">
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />
      <SyncSuccessModal isOpen={isSuccessModalOpen} onClose={() => setIsSuccessModalOpen(false)} data={syncSummary} />

      {/* Tab Switcher */}
      <div className="bg-gray-200 p-1 rounded-2xl flex shadow-inner">
        {(['MANUAL', 'AI_SCANNER'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${activeTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>{tab}</button>
        ))}
      </div>

      {activeTab === 'MANUAL' ? (
        <div className="space-y-8 animate-in fade-in duration-500">
          {/* Bank Section */}
          <section>
            <div className="flex justify-between items-center mb-4 px-2">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center"><Building2 size={14} className="mr-2" /> Bank Accounts</h2>
              <button onClick={() => { setNewAssetType(AccountType.CASH); setIsModalOpen(true); }} className="text-blue-600 font-black text-xs">+ ADD</button>
            </div>
            <div className="space-y-3">
              {localAccounts.filter(a => a.type === AccountType.CASH).map(acc => (
                <div key={acc.id} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setLocalAccounts(prev => prev.filter(a => a.id !== acc.id))} className="text-gray-200 hover:text-red-400 transition-colors"><Trash2 size={16}/></button>
                    <span className="font-bold text-gray-700">{acc.name}</span>
                  </div>
                  <input type="number" value={acc.balance} onChange={(e) => setLocalAccounts(prev => prev.map(a => a.id === acc.id ? {...a, balance: parseFloat(e.target.value)||0} : a))} className="w-24 text-right font-black text-blue-600 bg-transparent outline-none" />
                </div>
              ))}
            </div>
          </section>

          {/* Stock Section */}
          <section>
            <div className="flex justify-between items-center mb-4 px-2">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center"><TrendingUp size={14} className="mr-2" /> Stock Portfolio</h2>
              <button onClick={() => { setNewAssetType(AccountType.STOCK); setIsModalOpen(true); }} className="text-blue-600 font-black text-xs">+ ADD</button>
            </div>
            <div className="space-y-4">
              {localAccounts.filter(a => a.type === AccountType.STOCK).map(acc => (
                <div key={acc.id} className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-100 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setLocalAccounts(prev => prev.filter(a => a.id !== acc.id))} className="text-gray-200 hover:text-red-400"><Trash2 size={16}/></button>
                      <div>
                        <div className="font-black text-gray-800 text-lg">{acc.symbol}</div>
                        <div className="text-[10px] font-bold text-blue-500 uppercase tracking-tighter">Live: ${acc.lastPrice || '---'}</div>
                      </div>
                    </div>
                    <div className="text-right font-black text-blue-600">${(acc.balance || 0).toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-2xl">
                    <button onClick={() => setLocalAccounts(prev => prev.map(a => a.id === acc.id ? {...a, quantity: Math.max(0, (a.quantity||0)-1)} : a))} className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-gray-400"><Minus size={16}/></button>
                    <input type="number" value={acc.quantity} onChange={(e) => setLocalAccounts(prev => prev.map(a => a.id === acc.id ? {...a, quantity: parseFloat(e.target.value)||0} : a))} className="flex-1 text-center font-black bg-transparent outline-none text-gray-700" />
                    <button onClick={() => setLocalAccounts(prev => prev.map(a => a.id === acc.id ? {...a, quantity: (a.quantity||0)+1} : a))} className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-gray-400"><Plus size={16}/></button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Floating Save Button */}
          <button onClick={() => handleFinalSave(localAccounts)} disabled={isSaving} className="fixed bottom-28 left-6 right-6 bg-blue-600 text-white py-5 rounded-full font-black shadow-2xl flex justify-center items-center gap-3 active:scale-95 disabled:bg-gray-300 transition-all z-50">
            {isSaving ? <Loader2 className="animate-spin" /> : <CloudUpload size={20} />} 
            {isSaving ? 'SYNCING...' : 'SAVE & SYNC CLOUD'}
          </button>
        </div>
      ) : (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          {/* AI Scanner Input */}
          <div onClick={() => !isAnalyzing && aiInputRef.current?.click()} className={`border-2 border-dashed rounded-[2.5rem] p-16 text-center transition-all ${isAnalyzing ? 'border-blue-300 bg-blue-50' : 'border-gray-300 bg-white cursor-pointer'}`}>
            <input type="file" ref={aiInputRef} className="hidden" accept="image/*" onChange={handleAIFileUpload} />
            {isAnalyzing ? (
              <div className="flex flex-col items-center"><Loader2 className="w-12 h-12 text-blue-600 animate-spin" /><p className="mt-4 font-black text-blue-600 text-xs">ANALYZING STATEMENT...</p></div>
            ) : (
              <div className="flex flex-col items-center"><ScanLine className="w-12 h-12 text-gray-300 mb-4" /><p className="font-black text-gray-400 text-xs tracking-widest">UPLOAD DOCUMENT</p></div>
            )}
          </div>

          {/* AI Results Editor */}
          {scannedItems.length > 0 && (
            <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden mb-24 animate-in fade-in zoom-in-95">
              <div className="p-6 bg-gray-900 text-white space-y-4">
                 <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 font-black italic"><Sparkles size={18} className="text-blue-400"/> AI DETECTED</div>
                    <button onClick={() => setScannedItems([])} className="text-gray-500"><X size={20}/></button>
                 </div>
                 
                 {/* RESTORED: SET ALL Global Market Settings */}
                 <div className="bg-gray-800/50 p-3 rounded-2xl flex items-center justify-between gap-3 border border-gray-700">
                    <div className="text-[9px] font-black text-gray-400 flex items-center gap-1 uppercase tracking-widest"><Globe2 size={12}/> SET ALL MARKETS:</div>
                    <div className="flex gap-2">
                      {(['.HK', '.AX', 'US'] as const).map(suffix => (
                        <button 
                          key={suffix}
                          onClick={() => applyGlobalMarket(suffix)}
                          className="bg-gray-700 hover:bg-blue-600 text-white hover:text-white px-3 py-1.5 rounded-lg text-[10px] font-black transition-all"
                        >
                          {suffix}
                        </button>
                      ))}
                    </div>
                    {/* Bulk Price Fetch Button */}
                    <button 
                       onClick={() => fetchBatchPrices(scannedItems)}
                       className="ml-auto bg-blue-600 p-1.5 rounded-lg text-white hover:bg-blue-500"
                       title="Get All Live Prices"
                    >
                       <RefreshCw size={14} className={isFetchingPreview ? 'animate-spin' : ''} />
                    </button>
                 </div>
              </div>

              <div className="p-4 space-y-4 max-h-[50vh] overflow-y-auto bg-gray-50">
                {scannedItems.map((item, idx) => (
                  <div key={idx} className="bg-white p-4 rounded-2xl border border-gray-100 space-y-3 shadow-sm">
                    {/* Row 1: Institution */}
                    <div className="space-y-1">
                      <span className="text-[9px] font-black text-gray-400 uppercase">Institution (請填寫機構)</span>
                      <input 
                        className="w-full text-xs font-bold p-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-100" 
                        value={item.institution} 
                        onChange={(e) => {
                          const next = [...scannedItems]; next[idx].institution = e.target.value; setScannedItems(next);
                        }} 
                        placeholder="e.g. CommSec, Hang Seng"
                      />
                    </div>
                    
                    {/* Row 2: Symbol & Qty */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                          <span className="text-[9px] font-black text-blue-400 uppercase">Symbol / Ticker</span>
                          <input 
                            className="w-full text-xs font-black text-blue-600 p-3 bg-blue-50 rounded-xl outline-none" 
                            value={item.symbol || ''} 
                            onChange={(e) => {
                              const next = [...scannedItems]; next[idx].symbol = e.target.value; setScannedItems(next);
                            }} 
                          />
                      </div>
                      <div className="space-y-1">
                          <span className="text-[9px] font-black text-gray-400 uppercase">Qty / Amount</span>
                          <input 
                            className="w-full text-xs font-bold text-right p-3 bg-gray-50 rounded-xl outline-none" 
                            type="number" 
                            value={item.amount} 
                            onChange={(e) => {
                              const next = [...scannedItems]; next[idx].amount = parseFloat(e.target.value)||0; setScannedItems(next);
                            }} 
                          />
                      </div>
                    </div>

                    {/* Row 3: Manual Price & Market Switcher */}
                    {item.category === 'STOCK' && (
                        <>
                           <div className="space-y-1 border-t border-gray-50 pt-3">
                              <span className="text-[9px] font-black text-green-600 uppercase">Est. Price (Manual Override)</span>
                              <div className="flex gap-2">
                                <input 
                                    className="flex-1 text-xs font-black text-green-700 p-3 bg-green-50 rounded-xl outline-none focus:ring-2 focus:ring-green-100 placeholder-green-300" 
                                    type="number" 
                                    placeholder="Auto-filled..."
                                    value={item.price || ''} 
                                    onChange={(e) => {
                                        const next = [...scannedItems]; next[idx].price = parseFloat(e.target.value); setScannedItems(next);
                                    }} 
                                />
                                <button 
                                    onClick={() => fetchScannedItemPrice(idx)}
                                    className="px-4 bg-green-100 text-green-700 rounded-xl hover:bg-green-200 transition-colors"
                                    title="Refresh Price"
                                >
                                    <RefreshCw size={16} className={isFetchingPreview ? 'animate-spin' : ''} />
                                </button>
                              </div>
                           </div>
                           
                           <div className="flex items-center gap-2 pt-1">
                             <span className="text-[9px] font-black text-gray-300 uppercase">MARKET:</span>
                             {(['.HK', '.AX', 'US'] as const).map((m) => (
                               <button
                                 key={m}
                                 onClick={() => updateMarketSuffix(idx, m)}
                                 className={`px-3 py-1.5 rounded-lg text-[9px] font-black transition-all ${
                                   (m === 'US' && !item.symbol?.includes('.')) || (item.symbol?.endsWith(m))
                                   ? 'bg-blue-600 text-white' 
                                   : 'bg-gray-100 text-gray-400'
                                 }`}
                               >
                                 {m}
                               </button>
                             ))}
                             <span className="ml-auto text-[9px] font-bold text-gray-400">{item.currency}</span>
                           </div>
                        </>
                    )}
                  </div>
                ))}
              </div>
              <div className="p-6 bg-white border-t">
                 <button onClick={handleAISyncConfirm} disabled={isSaving} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black flex justify-center items-center gap-2 shadow-lg shadow-blue-200 active:scale-95 transition-all">
                    {isSaving ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={18}/>} 
                    {isSaving ? 'SYNCING...' : 'CONFIRM & SYNC'}
                 </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-[100] backdrop-blur-md">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 space-y-6 animate-in zoom-in-95">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-xl italic tracking-tight">Add {newAssetType === AccountType.STOCK ? 'Stock' : 'Bank'}</h3>
              <button onClick={() => { setIsModalOpen(false); setPreviewPrice(null); }} className="text-gray-300"><X size={24}/></button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase">Symbol / Name</label>
                <div className="relative">
                  <input 
                    placeholder={newAssetType === AccountType.STOCK ? "e.g. 700 or GOLD.AX" : "HSBC / Bank"} 
                    value={newAssetType === AccountType.STOCK ? newItemData.symbol : newItemData.name} 
                    onChange={e => setNewItemData({...newItemData, [newAssetType === AccountType.STOCK ? 'symbol' : 'name']: e.target.value})} 
                    className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold text-blue-600" 
                  />
                  {newAssetType === AccountType.STOCK && (
                    <button onClick={() => fetchLivePreview(newItemData.symbol)} className="absolute right-2 top-2 p-2 bg-blue-600 text-white rounded-xl">
                      {isFetchingPreview ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                    </button>
                  )}
                </div>
              </div>

              {/* Added Manual Price Input for Stocks */}
              {newAssetType === AccountType.STOCK && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase">Price per Share (Est. / Manual)</label>
                    <div className="relative">
                       <input
                         type="number"
                         placeholder="0.00"
                         value={previewPrice || ''}
                         onChange={(e) => setPreviewPrice(parseFloat(e.target.value))}
                         className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold text-gray-800 focus:ring-2 focus:ring-blue-100"
                       />
                       {isFetchingPreview && <div className="absolute right-4 top-1/2 -translate-y-1/2"><Loader2 size={16} className="animate-spin text-blue-500"/></div>}
                    </div>
                  </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase">Amount / Qty</label>
                <input type="number" placeholder="0" value={newItemData.amount} onChange={e => setNewItemData({...newItemData, amount: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold" />
              </div>
            </div>
            <button onClick={handleAddAsset} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-100">ADD & SYNC</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UpdatePage;