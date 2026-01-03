import React, { useState, useRef } from 'react';
import { Account, AccountType, Currency } from '../types';
import { 
  Save, Plus, Loader2, TrendingUp, Building2, 
  Minus, ScanLine, CloudUpload, History, Sparkles, X, Trash2, CheckCircle2 
} from 'lucide-react';
import { getStockEstimate, parseFinancialStatement, ScannedAsset } from '../services/geminiService';
import Confetti from './Confetti';

// 你的 Google Apps Script URL (如果有的話)
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw2sgqsu0u5qBZYzrPvW_UEQVREUR8NBi2kIY1JfCCDPGpIWJwCgFNvdNzrj4xyXTAJHw/exec';

interface UpdatePageProps {
  accounts: Account[];
  onSave: (updatedAccounts: Account[]) => void;
}

const UpdatePage: React.FC<UpdatePageProps> = ({ accounts, onSave }) => {
  const [activeTab, setActiveTab] = useState<'MANUAL' | 'AI_SCANNER'>('MANUAL');
  const [showConfetti, setShowConfetti] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [localAccounts, setLocalAccounts] = useState<Account[]>([...accounts]);
  
  // Modal & Edit State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newAssetType, setNewAssetType] = useState<AccountType | null>(null);
  const [newItemData, setNewItemData] = useState({ name: '', symbol: '', amount: '' });
  
  // AI Scanner State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scannedItems, setScannedItems] = useState<ScannedAsset[]>([]);
  const aiInputRef = useRef<HTMLInputElement>(null);

  // --- 1. 核心儲存邏輯 (保證執行) ---
  const handleFinalSave = (updatedLocalAccounts: Account[]) => {
    setIsSaving(true);
    setShowConfetti(true);

    // A. 雲端同步 (非阻塞式 - Fire and Forget)
    if (GOOGLE_SCRIPT_URL && GOOGLE_SCRIPT_URL.includes('/exec')) {
      const payload = {
        assets: updatedLocalAccounts.map(acc => ({
          category: acc.type === AccountType.STOCK ? 'STOCK' : 'CASH',
          institution: acc.name,
          symbol: acc.symbol || '',
          amount: acc.type === AccountType.STOCK ? acc.quantity : acc.balance,
          currency: acc.currency,
          metadata: { market: acc.symbol?.includes('.AX') ? 'AU' : (acc.symbol?.includes('.HK') ? 'HK' : 'US') }
        }))
      };
      
      // 使用 catch 忽略錯誤，確保不影響流程
      fetch(GOOGLE_SCRIPT_URL, { 
        method: 'POST', 
        mode: 'no-cors', 
        body: JSON.stringify(payload) 
      }).catch(e => console.warn("Cloud sync skipped:", e));
    }

    // B. 本地儲存與跳轉 (延遲 1 秒讓動畫展示，然後強制跳轉)
    setTimeout(() => {
      onSave(updatedLocalAccounts);
      setIsSaving(false);
    }, 1000);
  };

  // --- 2. 手動功能：新增與刪除 ---
  const handleAddAsset = async () => {
    if (!newAssetType) return;
    setIsSaving(true);
    
    let price = 0;
    let finalSymbol = newItemData.symbol.toUpperCase().trim();
    
    // 自動補全市場後綴邏輯
    if (newAssetType === AccountType.STOCK && finalSymbol) {
      if (/^\d{1,4}$/.test(finalSymbol)) finalSymbol = finalSymbol.padStart(5, '0') + '.HK';
      // 簡單獲取價格
      try {
        const est = await getStockEstimate(finalSymbol);
        price = est || 0;
      } catch (e) { console.warn("Price fetch failed"); }
    }

    const newAcc: Account = {
      id: Date.now().toString(),
      name: newItemData.name || finalSymbol,
      type: newAssetType,
      currency: 'HKD' as Currency,
      symbol: finalSymbol,
      quantity: newAssetType === AccountType.STOCK ? parseFloat(newItemData.amount) : undefined,
      balance: newAssetType === AccountType.STOCK ? Math.round(parseFloat(newItemData.amount) * price) : parseFloat(newItemData.amount),
      lastPrice: price
    };

    setLocalAccounts(prev => [...prev, newAcc]);
    setIsModalOpen(false);
    setNewItemData({ name: '', symbol: '', amount: '' });
    setIsSaving(false);
  };

  const handleDeleteAccount = (id: string, name: string) => {
    if (window.confirm(`Delete "${name}"? This affects your total wealth.`)) {
      setLocalAccounts(prev => prev.filter(acc => acc.id !== id));
    }
  };

  // --- 3. AI Scanner 功能 ---
  const handleAIFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsAnalyzing(true);
    
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1];
      const results = await parseFinancialStatement(base64, true);
      if (results) setScannedItems(results);
      setIsAnalyzing(false);
    };
    reader.readAsDataURL(file);
  };

  const updateScannedItem = (index: number, field: keyof ScannedAsset, value: any) => {
    const updated = [...scannedItems];
    updated[index] = { ...updated[index], [field]: value };
    setScannedItems(updated);
  };

  const handleAISyncConfirm = async () => {
    setIsSaving(true);
    
    // 為掃描到的項目豐富數據 (獲取價格)
    const enriched = await Promise.all(scannedItems.map(async (item) => {
      let finalSymbol = item.symbol?.toUpperCase().trim() || '';
      if (/^\d{1,5}$/.test(finalSymbol)) {
        finalSymbol = finalSymbol.padStart(5, '0') + '.HK';
      }

      let price = 0;
      if (item.category === 'STOCK' && finalSymbol) {
        price = await getStockEstimate(finalSymbol) || 0;
      }

      return {
        id: Math.random().toString(36).substr(2, 9),
        name: item.institution,
        type: item.category === 'STOCK' ? AccountType.STOCK : AccountType.CASH,
        currency: item.currency as Currency,
        balance: item.category === 'STOCK' ? Math.round(item.amount * price) : item.amount,
        symbol: finalSymbol,
        quantity: item.category === 'STOCK' ? item.amount : undefined,
        lastPrice: price
      };
    }));

    const finalAccounts = [...localAccounts, ...enriched];
    setLocalAccounts(finalAccounts);
    setScannedItems([]); 
    
    handleFinalSave(finalAccounts);
  };

  return (
    <div className="p-6 pb-32 space-y-6 bg-gray-50 min-h-screen font-sans">
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />

      {/* Tabs */}
      <div className="bg-gray-200 p-1 rounded-2xl flex shadow-inner">
        <button onClick={() => setActiveTab('MANUAL')} className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${activeTab === 'MANUAL' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>MANUAL</button>
        <button onClick={() => setActiveTab('AI_SCANNER')} className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${activeTab === 'AI_SCANNER' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>AI SCANNER</button>
      </div>

      {activeTab === 'MANUAL' ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-top-2">
          {/* Bank Accounts Section */}
          <section>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center"><Building2 className="w-4 h-4 mr-2" /> Bank Accounts</h2>
              <button onClick={() => { setNewAssetType(AccountType.CASH); setIsModalOpen(true); }} className="bg-blue-50 text-blue-600 px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1 active:scale-95 transition-all"><Plus size={14}/> Add Bank</button>
            </div>
            <div className="space-y-3">
              {localAccounts.filter(a => a.type === AccountType.CASH).map(acc => (
                <div key={acc.id} className="bg-white p-5 rounded-[1.5rem] shadow-sm flex justify-between items-center border border-gray-100 group">
                  <div className="flex items-center gap-4">
                    <button onClick={() => handleDeleteAccount(acc.id, acc.name)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"><Trash2 size={18}/></button>
                    <div className="font-bold text-gray-700">{acc.name}</div>
                  </div>
                  <div className="flex items-center bg-gray-50 px-4 py-2 rounded-xl border border-gray-100">
                    <span className="text-gray-400 font-bold mr-1 text-xs">$</span>
                    <input type="number" value={acc.balance} onChange={(e) => setLocalAccounts(prev => prev.map(a => a.id === acc.id ? {...a, balance: parseFloat(e.target.value)||0} : a))} className="w-24 text-right font-black text-gray-800 bg-transparent outline-none" />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Portfolio Section */}
          <section>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center"><TrendingUp className="w-4 h-4 mr-2" /> Portfolio</h2>
              <button onClick={() => { setNewAssetType(AccountType.STOCK); setIsModalOpen(true); }} className="bg-blue-50 text-blue-600 px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1 active:scale-95 transition-all"><Plus size={14}/> Add Stock</button>
            </div>
            <div className="space-y-4">
              {localAccounts.filter(a => a.type === AccountType.STOCK).map(acc => (
                <div key={acc.id} className="bg-white p-5 rounded-[1.5rem] shadow-sm border border-gray-100 relative transition-all">
                  <div className="flex justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <button onClick={() => handleDeleteAccount(acc.id, acc.symbol || acc.name)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"><Trash2 size={18}/></button>
                      <div>
                        <div className="font-black text-gray-800 text-lg">{acc.symbol}</div>
                        <div className="text-[10px] text-gray-400 font-bold">LATEST PRICE: ${acc.lastPrice}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-blue-600">${(acc.balance || 0).toLocaleString()}</div>
                      <div className="text-[10px] text-gray-400 uppercase font-bold">{acc.currency}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 bg-gray-50 p-2 rounded-2xl">
                    <button onClick={() => setLocalAccounts(prev => prev.map(a => a.id === acc.id ? {...a, quantity: Math.max(0, (a.quantity||0)-1), balance: Math.round(((a.quantity||0)-1)*(a.lastPrice||0))} : a))} className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-gray-400 hover:text-blue-600"><Minus size={20}/></button>
                    <input type="number" value={acc.quantity} onChange={(e) => {
                      const q = parseFloat(e.target.value)||0;
                      setLocalAccounts(prev => prev.map(a => a.id === acc.id ? {...a, quantity: q, balance: Math.round(q*(a.lastPrice||0))} : a));
                    }} className="flex-1 text-center font-black bg-transparent outline-none text-gray-700 text-xl" />
                    <button onClick={() => setLocalAccounts(prev => prev.map(a => a.id === acc.id ? {...a, quantity: (a.quantity||0)+1, balance: Math.round(((a.quantity||0)+1)*(a.lastPrice||0))} : a))} className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-gray-400 hover:text-blue-600"><Plus size={20}/></button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <button onClick={() => handleFinalSave(localAccounts)} disabled={isSaving} className="fixed bottom-28 left-6 right-6 bg-blue-600 text-white py-5 rounded-[2rem] font-black shadow-2xl shadow-blue-200 flex justify-center items-center gap-3 active:scale-95 transition-all disabled:bg-gray-400 z-30 hover:shadow-blue-300">
            {isSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />} 
            {isSaving ? 'UPDATING...' : 'SAVE & UPDATE'}
          </button>
        </div>
      ) : (
        /* AI Scanner Tab */
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
          <div onClick={() => !isAnalyzing && aiInputRef.current?.click()} className={`border-2 border-dashed rounded-[2.5rem] p-16 text-center transition-all ${isAnalyzing ? 'border-blue-300 bg-blue-50' : 'border-gray-300 hover:border-blue-400 cursor-pointer bg-white'}`}>
            <input type="file" ref={aiInputRef} className="hidden" accept="image/*" onChange={handleAIFileUpload} />
            {isAnalyzing ? (
              <div className="flex flex-col items-center"><Loader2 className="w-12 h-12 text-blue-600 animate-spin" /><p className="mt-4 font-black text-blue-600 tracking-tighter">AI ANALYZING...</p></div>
            ) : (
              <div className="flex flex-col items-center"><ScanLine className="w-16 h-16 text-gray-200 mb-4" /><p className="font-black text-gray-700 text-lg">UPLOAD STATEMENT</p><p className="text-xs text-gray-400 mt-2 font-bold tracking-widest uppercase">Auto-detect assets with Gemini</p></div>
            )}
          </div>

          {scannedItems.length > 0 && (
            <div className="bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden mb-24">
              <div className="p-6 bg-blue-600 text-white flex justify-between items-center">
                <div className="flex items-center gap-2 font-black italic"><Sparkles size={20}/> AI DETECTED</div>
                <button onClick={() => setScannedItems([])} className="bg-white/20 p-2 rounded-full hover:bg-white/30"><X size={16}/></button>
              </div>
              <div className="p-4 space-y-3 max-h-[45vh] overflow-y-auto bg-gray-50/50">
                {scannedItems.map((item, idx) => (
                  <div key={idx} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Name / Institution</label>
                        <input className="w-full text-sm font-bold text-gray-800 bg-gray-50 px-3 py-2 rounded-xl outline-none border border-transparent focus:border-blue-200" value={item.institution} onChange={(e) => updateScannedItem(idx, 'institution', e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Symbol (HK/AU/US)</label>
                        <input className="w-full text-sm font-black text-blue-600 bg-blue-50/50 px-3 py-2 rounded-xl outline-none border border-transparent focus:border-blue-200" value={item.symbol || ''} onChange={(e) => updateScannedItem(idx, 'symbol', e.target.value)} />
                      </div>
                    </div>
                    <div className="flex justify-between items-end pt-2 border-t border-gray-50">
                      <div className="text-[10px] font-black text-gray-300 uppercase">Amount / Qty</div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-gray-400">{item.currency}</span>
                        <input type="number" className="w-28 text-right font-black text-blue-600 text-lg bg-gray-100 px-3 py-1 rounded-xl outline-none" value={item.amount} onChange={(e) => updateScannedItem(idx, 'amount', parseFloat(e.target.value) || 0)} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-6 bg-white border-t border-gray-100">
                <button onClick={handleAISyncConfirm} disabled={isSaving} className="w-full py-5 bg-blue-600 text-white rounded-[1.5rem] font-black text-lg shadow-xl shadow-blue-100 flex justify-center items-center gap-3">
                  {isSaving ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={24} />}
                  {isSaving ? 'UPDATING...' : 'CONFIRM & UPDATE'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-[100] backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 shadow-2xl space-y-8">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-3xl text-gray-800 tracking-tighter">Add {newAssetType === AccountType.STOCK ? 'Stock' : 'Bank'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-300 hover:text-gray-600 transition-colors"><X size={28}/></button>
            </div>
            <div className="space-y-5">
              {newAssetType === AccountType.STOCK ? (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 ml-2 uppercase">Stock Symbol</label>
                    <input placeholder="e.g. 0700.HK, NAB.AX, TSLA" value={newItemData.symbol} onChange={e => setNewItemData({...newItemData, symbol: e.target.value})} className="w-full p-5 bg-gray-50 rounded-2xl outline-none focus:ring-4 ring-blue-100 font-black text-xl text-blue-600 placeholder:text-gray-200" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 ml-2 uppercase">Quantity</label>
                    <input type="number" placeholder="0" value={newItemData.amount} onChange={e => setNewItemData({...newItemData, amount: e.target.value})} className="w-full p-5 bg-gray-50 rounded-2xl outline-none focus:ring-4 ring-blue-100 font-black text-xl placeholder:text-gray-200" />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 ml-2 uppercase">Institution Name</label>
                    <input placeholder="e.g. HSBC, CommBank" value={newItemData.name} onChange={e => setNewItemData({...newItemData, name: e.target.value})} className="w-full p-5 bg-gray-50 rounded-2xl outline-none focus:ring-4 ring-blue-100 font-black text-xl text-gray-800 placeholder:text-gray-200" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 ml-2 uppercase">Current Balance</label>
                    <input type="number" placeholder="0.00" value={newItemData.amount} onChange={e => setNewItemData({...newItemData, amount: e.target.value})} className="w-full p-5 bg-gray-50 rounded-2xl outline-none focus:ring-4 ring-blue-100 font-black text-xl placeholder:text-gray-200" />
                  </div>
                </>
              )}
            </div>
            <button onClick={handleAddAsset} disabled={isSaving} className="w-full py-5 bg-blue-600 text-white rounded-[2rem] font-black text-xl shadow-2xl shadow-blue-200 active:scale-95 transition-all flex justify-center items-center">
                {isSaving ? <Loader2 className="animate-spin" /> : 'ADD ASSET'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UpdatePage;