import React, { useState, useRef } from 'react';
import { Account, AccountType, Currency } from '../types';
import { 
  Save, Plus, Loader2, TrendingUp, Building2, 
  Minus, ScanLine, CloudUpload, Sparkles, X, Trash2, CheckCircle2, Globe2,
  Search, ArrowRight, Lightbulb, TrendingDown, RefreshCw
} from 'lucide-react';
import { parseFinancialStatement, ScannedAsset } from '../services/geminiService';
import Confetti from './Confetti';

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwcew_uZTf1VM66NSub7n5oF4MxTQDk2kqAe39HSdJ7f2fs5x-6OCxrNNk1XhYqdZ97HA/exec';

interface UpdatePageProps {
  accounts: Account[];
  onSave: (updatedAccounts: Account[]) => void;
}

const SyncSuccessModal = ({ isOpen, onClose, data }: { isOpen: boolean, onClose: () => void, data: any }) => {
  if (!isOpen) return null;
  const isPositive = data.netChange >= 0;
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-[9999] backdrop-blur-xl animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-300">
        <div className={`p-8 pb-10 text-white text-center relative ${isPositive ? 'bg-[#0052CC]' : 'bg-gray-800'}`}>
          <div className="bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 border border-white/30 shadow-lg">
            <CheckCircle2 size={32} />
          </div>
          <h3 className="text-xl font-black tracking-tight">✅ 同步成功！</h3>
        </div>
        <div className="px-6 py-6 -mt-6 bg-white rounded-t-[2.5rem] relative z-10 space-y-5">
          <div className="grid grid-cols-2 gap-3 text-center">
             <div className="bg-blue-50/50 p-3 rounded-2xl border border-blue-100">
                <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">銀行總額</div>
                <div className="text-sm font-black text-gray-800">HK${Math.round(data.bankTotal).toLocaleString()}</div>
             </div>
             <div className="bg-purple-50/50 p-3 rounded-2xl border border-purple-100">
                <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">股票總額</div>
                <div className="text-sm font-black text-gray-800">HK${Math.round(data.stockTotal).toLocaleString()}</div>
             </div>
          </div>
          <div className="text-center bg-gray-50 rounded-2xl p-4 border border-gray-100">
             <p className="text-xs font-black text-gray-400 uppercase mb-1">💎 總淨資產</p>
             <div className="text-3xl font-black text-gray-800 tracking-tighter">HK${Math.round(data.totalNetWorth).toLocaleString()}</div>
             <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold mt-2 ${isPositive ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {isPositive ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                {isPositive ? '+' : ''}HK${Math.round(data.netChange).toLocaleString()}
             </div>
          </div>
          <button onClick={onClose} className="w-full py-4 bg-gray-900 text-white rounded-[1.5rem] font-black flex items-center justify-center gap-2">知道，繼續努力 <ArrowRight size={20} /></button>
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
  const [syncSummary, setSyncSummary] = useState({ totalNetWorth: 0, bankTotal: 0, stockTotal: 0, netChange: 0 });
  const [newAssetType, setNewAssetType] = useState<AccountType | null>(null);
  const [newItemData, setNewItemData] = useState({ name: '', symbol: '', amount: '' });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scannedItems, setScannedItems] = useState<ScannedAsset[]>([]);
  const aiInputRef = useRef<HTMLInputElement>(null);
  const [isFetchingPreview, setIsFetchingPreview] = useState(false);
  const [previewPrice, setPreviewPrice] = useState<number | string>("");

  const fetchSinglePrice = async (sym: string) => {
    try {
      const res = await fetch(`${GOOGLE_SCRIPT_URL}?symbol=${encodeURIComponent(sym.toUpperCase().trim())}`);
      const d = await res.json();
      return Number(d.price) || 0;
    } catch { return 0; }
  };

  const calculateValueHKD = (acc: Account) => {
    const q = Number(acc.quantity) || 0, p = Number(acc.lastPrice) || 0, b = Number(acc.balance) || 0;
    let val = acc.type === AccountType.STOCK ? (q * p) : b;
    if(acc.currency === 'USD') val *= 7.82;
    if(acc.currency === 'AUD') val *= 5.15;
    return isNaN(val) ? 0 : val;
  };

  const handleFinalSave = async (updatedLocalAccounts: Account[], manualOverrides: Record<string, number> = {}) => {
    setIsSaving(true);
    const oldTotal = accounts.reduce((sum, acc) => sum + calculateValueHKD(acc), 0);
    try {
      const payload = {
        assets: updatedLocalAccounts.map(acc => ({
          category: acc.type === AccountType.STOCK ? 'STOCK' : 'CASH',
          institution: acc.name || 'Other',
          symbol: acc.symbol || '',
          amount: acc.type === AccountType.STOCK ? Number(acc.quantity) : Number(acc.balance),
          currency: acc.currency,
          market: acc.symbol?.endsWith(".HK") ? "HK" : (acc.symbol?.endsWith(".AX") ? "AU" : "US")
        }))
      };
      const response = await fetch(GOOGLE_SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (result && (result.status === "Success" || result.Status === "Success")) {
        const synced = updatedLocalAccounts.map(acc => {
          if (acc.type === AccountType.STOCK && acc.symbol) {
            const symKey = acc.symbol.toUpperCase().trim();
            const p = manualOverrides[symKey] || result.latestPrices?.[symKey] || acc.lastPrice || 0;
            return { ...acc, lastPrice: p, balance: Math.round((acc.quantity || 0) * p) };
          }
          return acc;
        });
        let cur = 0, bnk = 0, stk = 0;
        synced.forEach(a => { const v = calculateValueHKD(a); cur += v; if(a.type === AccountType.STOCK) stk += v; else bnk += v; });
        setSyncSummary({ totalNetWorth: cur, bankTotal: bnk, stockTotal: stk, netChange: cur - oldTotal });
        setLocalAccounts(synced);
        setShowConfetti(true);
        setIsSuccessModalOpen(true);
      }
    } catch (e) { alert("Sync Failed"); } finally { setIsSaving(false); }
  };

  // 新增：手動列表一鍵更新所有市價
  const handleUpdateAllPrices = async () => {
    setIsFetchingPreview(true);
    const updated = await Promise.all(localAccounts.map(async (acc) => {
      if (acc.type === AccountType.STOCK && acc.symbol) {
        const p = await fetchSinglePrice(acc.symbol);
        if (p > 0) return { ...acc, lastPrice: p, balance: Math.round((acc.quantity || 0) * p) };
      }
      return acc;
    }));
    setLocalAccounts(updated);
    setIsFetchingPreview(false);
  };

  const handleAIFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsAnalyzing(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64 = (reader.result as string).split(',')[1];
        const results = await parseFinancialStatement(base64);
        if (results) {
           const processed = await Promise.all(results.map(async (item) => {
             const finalName = (item.institution && item.institution !== 'Unknown') ? item.institution : (item.category === 'STOCK' ? 'Stocks' : 'Deposit');
             let livePrice = 0;
             if(item.category === 'STOCK' && item.symbol) livePrice = await fetchSinglePrice(item.symbol);
             return { ...item, institution: finalName, price: livePrice || item.price || 0 };
           }));
           setScannedItems(processed);
        }
      } finally { setIsAnalyzing(false); if(aiInputRef.current) aiInputRef.current.value = ""; }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="p-6 pb-32 space-y-6 bg-gray-50 min-h-screen">
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />
      <SyncSuccessModal isOpen={isSuccessModalOpen} onClose={() => { setIsSuccessModalOpen(false); onSave(localAccounts); }} data={syncSummary} />

      <div className="bg-gray-200 p-1 rounded-2xl flex">
        {['MANUAL', 'AI_SCANNER'].map(t => (
          <button key={t} onClick={() => setActiveTab(t as any)} className={`flex-1 py-3 rounded-xl text-xs font-black ${activeTab === t ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>{t}</button>
        ))}
      </div>

      {activeTab === 'MANUAL' ? (
        <div className="space-y-8 animate-in fade-in">
          {/* Bank Section */}
          <section>
            <div className="flex justify-between items-center mb-4 px-2">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center"><Building2 size={14} className="mr-2" /> Bank</h2>
              <button onClick={() => { setNewAssetType(AccountType.CASH); setIsModalOpen(true); }} className="text-blue-600 font-black text-xs">+ ADD</button>
            </div>
            {localAccounts.filter(a => a.type === AccountType.CASH).map(acc => (
              <div key={acc.id} className="bg-white p-5 rounded-3xl mb-3 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-3">
                  <button onClick={() => setLocalAccounts(prev => prev.filter(p => p.id !== acc.id))} className="text-gray-200 hover:text-red-400"><Trash2 size={16}/></button>
                  <span className="font-bold text-gray-700">{acc.name}</span>
                </div>
                <input type="number" value={acc.balance} onChange={e => setLocalAccounts(prev => prev.map(p => p.id === acc.id ? {...p, balance: Number(e.target.value)} : p))} className="w-24 text-right font-black text-blue-600 bg-transparent outline-none" />
              </div>
            ))}
          </section>

          {/* Stock Section */}
          <section>
            <div className="flex justify-between items-center mb-4 px-2">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center"><TrendingUp size={14} className="mr-2" /> Stocks</h2>
              <div className="flex gap-4">
                <button onClick={handleUpdateAllPrices} disabled={isFetchingPreview} className="text-green-600 font-black text-xs flex items-center gap-1">
                  <RefreshCw size={12} className={isFetchingPreview ? 'animate-spin' : ''} /> REFRESH PRICES
                </button>
                <button onClick={() => { setNewAssetType(AccountType.STOCK); setIsModalOpen(true); }} className="text-blue-600 font-black text-xs">+ ADD</button>
              </div>
            </div>
            {localAccounts.filter(a => a.type === AccountType.STOCK).map(acc => (
              <div key={acc.id} className="bg-white p-5 rounded-[2rem] mb-4 shadow-sm border border-gray-100">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setLocalAccounts(prev => prev.filter(p => p.id !== acc.id))} className="text-gray-200 hover:text-red-400"><Trash2 size={16}/></button>
                    <div>
                        <div className="font-black text-gray-800 text-lg">{acc.symbol}</div>
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] font-bold text-blue-400 uppercase italic">Live $:</span>
                          <input type="number" value={acc.lastPrice} onChange={e => {
                            const p = Number(e.target.value);
                            setLocalAccounts(prev => prev.map(item => item.id === acc.id ? {...item, lastPrice: p, balance: Math.round((item.quantity || 0) * p)} : item));
                          }} className="w-16 bg-blue-50 text-blue-600 font-black text-[10px] px-1 rounded outline-none border border-transparent focus:border-blue-200" />
                        </div>
                    </div>
                  </div>
                  <div className="text-right font-black text-blue-600">${(acc.balance || 0).toLocaleString()}</div>
                </div>
                <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-2xl">
                    <button onClick={() => setLocalAccounts(prev => prev.map(p => p.id === acc.id ? {...p, quantity: Math.max(0, (p.quantity||0)-1), balance: Math.round(Math.max(0, (p.quantity||0)-1) * (p.lastPrice||0))} : p))} className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-gray-400"><Minus size={16}/></button>
                    <input type="number" value={acc.quantity} onChange={e => {
                      const q = Number(e.target.value);
                      setLocalAccounts(prev => prev.map(p => p.id === acc.id ? {...p, quantity: q, balance: Math.round(q * (p.lastPrice||0))} : p));
                    }} className="flex-1 text-center font-black bg-transparent outline-none text-gray-700" />
                    <button onClick={() => setLocalAccounts(prev => prev.map(p => p.id === acc.id ? {...p, quantity: (p.quantity||0)+1, balance: Math.round(((p.quantity||0)+1) * (p.lastPrice||0))} : p))} className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-gray-400"><Plus size={16}/></button>
                </div>
              </div>
            ))}
          </section>

          <button onClick={() => handleFinalSave(localAccounts)} disabled={isSaving} className="fixed bottom-28 left-6 right-6 bg-blue-600 text-white py-5 rounded-full font-black shadow-2xl flex justify-center items-center gap-3 active:scale-95 disabled:bg-gray-300 z-50">
            {isSaving ? <Loader2 className="animate-spin" /> : <CloudUpload size={20} />} 
            {isSaving ? 'SYNCING...' : 'SAVE & SYNC CLOUD'}
          </button>
        </div>
      ) : (
        /* AI Scanner 內容完全保留，未做任何刪減 */
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
          <div onClick={() => !isAnalyzing && aiInputRef.current?.click()} className={`border-2 border-dashed rounded-[2.5rem] p-16 text-center transition-all ${isAnalyzing ? 'border-blue-300 bg-blue-50' : 'border-gray-300 bg-white cursor-pointer'}`}>
            <input type="file" ref={aiInputRef} className="hidden" accept="image/*" onChange={handleAIFileUpload} />
            {isAnalyzing ? (
              <div className="flex flex-col items-center"><Loader2 className="w-12 h-12 text-blue-600 animate-spin" /><p className="mt-4 font-black text-blue-600 text-xs uppercase">Analyzing Statement...</p></div>
            ) : (
              <div className="flex flex-col items-center"><ScanLine className="w-12 h-12 text-gray-300 mb-4" /><p className="font-black text-gray-400 text-xs tracking-widest uppercase">Upload Document</p></div>
            )}
          </div>
          {scannedItems.length > 0 && (
            <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden mb-24">
              <div className="p-6 bg-gray-900 text-white">
                 <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2 font-black italic text-blue-400"><Sparkles size={18}/> AI DETECTED</div>
                    <button onClick={() => setScannedItems([])}><X size={20}/></button>
                 </div>
                 <div className="flex gap-2">
                    {['.HK', '.AX', 'US'].map(s => (
                      <button key={s} onClick={() => {
                        const updated = scannedItems.map(item => {
                          if (item.category !== 'STOCK') return item;
                          let clean = (item.symbol || '').replace(/\.(HK|AX)$/i, '');
                          if (s === '.HK' && /^\d+$/.test(clean)) clean = clean.padStart(5, '0');
                          return { ...item, symbol: s === 'US' ? clean : `${clean}${s}`, currency: s === '.HK' ? 'HKD' : s === '.AX' ? 'AUD' : 'USD' };
                        });
                        setScannedItems(updated);
                      }} className="bg-gray-800 px-3 py-1.5 rounded-lg text-[10px] font-black">{s}</button>
                    ))}
                 </div>
              </div>
              <div className="p-4 space-y-4 max-h-[50vh] overflow-y-auto bg-gray-50">
                {scannedItems.map((item, idx) => (
                  <div key={idx} className="bg-white p-4 rounded-2xl border border-gray-100 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <span className="text-[9px] font-black text-gray-400 uppercase">Institution</span>
                        <input className="w-full text-xs font-bold p-2 bg-gray-50 rounded-lg outline-none" value={item.institution} onChange={e => { const n = [...scannedItems]; n[idx].institution = e.target.value; setScannedItems(n); }} />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] font-black text-blue-400 uppercase">Ticker</span>
                        <input className="w-full text-xs font-black text-blue-600 p-2 bg-blue-50 rounded-lg outline-none uppercase" value={item.symbol || ''} onChange={e => { const n = [...scannedItems]; n[idx].symbol = e.target.value; setScannedItems(n); }} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <span className="text-[9px] font-black text-gray-400 uppercase">Quantity</span>
                        <input className="w-full text-xs font-bold p-2 bg-gray-50 rounded-lg outline-none" type="number" value={item.amount} onChange={e => { const n = [...scannedItems]; n[idx].amount = Number(e.target.value); setScannedItems(n); }} />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] font-black text-green-600 uppercase">Est. Price</span>
                        <div className="flex gap-1">
                          <input className="flex-1 text-xs font-black text-green-700 p-2 bg-green-50 rounded-lg outline-none" type="number" value={item.price || ''} onChange={e => { const n = [...scannedItems]; n[idx].price = Number(e.target.value); setScannedItems(n); }} />
                          <button onClick={async () => {
                            if(!item.symbol) return;
                            setIsFetchingPreview(true);
                            const p = await fetchSinglePrice(item.symbol);
                            const n = [...scannedItems]; n[idx].price = p; setScannedItems(n);
                            setIsFetchingPreview(false);
                          }} className="bg-green-100 p-2 rounded-lg text-green-700"><RefreshCw size={12} className={isFetchingPreview ? 'animate-spin' : ''}/></button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-6 bg-white border-t">
                 <button onClick={async () => {
                   const overrides: Record<string, number> = {};
                   const enriched = scannedItems.map(item => {
                     const sym = (item.symbol || '').toUpperCase();
                     if (item.category === 'STOCK' && item.price) overrides[sym] = item.price;
                     return { id: Math.random().toString(36).substr(2, 9), name: item.institution || (item.category === 'STOCK' ? 'Stocks' : 'Deposit'), type: item.category === 'STOCK' ? AccountType.STOCK : AccountType.CASH, currency: (item.currency || 'HKD') as Currency, balance: item.category === 'CASH' ? item.amount : 0, symbol: sym, quantity: item.category === 'STOCK' ? item.amount : undefined, lastPrice: item.price || 0 };
                   });
                   const updatedTotal = [...localAccounts, ...enriched];
                   setScannedItems([]);
                   await handleFinalSave(updatedTotal, overrides);
                 }} disabled={isSaving} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black flex justify-center items-center gap-2">
                    {isSaving ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={18}/>} CONFIRM & SYNC
                 </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-[9999] backdrop-blur-md">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-xl italic">Add {newAssetType === AccountType.STOCK ? 'Stock' : 'Bank'}</h3>
              <button onClick={() => { setIsModalOpen(false); setPreviewPrice(""); }} className="text-gray-300"><X size={24}/></button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase">Symbol / Name</label>
                <div className="relative">
                  <input placeholder="e.g. 700.HK" value={newAssetType === AccountType.STOCK ? newItemData.symbol : newItemData.name} onChange={e => setNewItemData({...newItemData, [newAssetType === AccountType.STOCK ? 'symbol' : 'name']: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold text-blue-600 uppercase" />
                  {newAssetType === AccountType.STOCK && (
                    <button onClick={async () => {
                      setIsFetchingPreview(true);
                      const p = await fetchSinglePrice(newItemData.symbol);
                      setPreviewPrice(p);
                      setIsFetchingPreview(false);
                    }} className="absolute right-2 top-2 p-2 bg-blue-600 text-white rounded-xl">
                      {isFetchingPreview ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                    </button>
                  )}
                </div>
              </div>
              {newAssetType === AccountType.STOCK && (
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-green-600 uppercase">Est. Price</label>
                  <input type="number" value={previewPrice} onChange={e => setPreviewPrice(Number(e.target.value))} className="w-full p-4 bg-green-50 rounded-2xl outline-none font-black text-green-700" placeholder="0.00" />
                </div>
              )}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase">Amount / Quantity</label>
                <input type="number" value={newItemData.amount} onChange={e => setNewItemData({...newItemData, amount: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold" />
              </div>
              <button onClick={async () => {
                const sym = newItemData.symbol.toUpperCase().trim();
                const currentPrice = Number(previewPrice) || 0;
                const newAcc: Account = { id: Date.now().toString(), name: newItemData.name || (newAssetType === AccountType.STOCK ? 'Stocks' : 'Deposit'), type: newAssetType!, currency: sym.endsWith('.AX') ? 'AUD' : (sym.endsWith('.HK') || /^\d+$/.test(sym)) ? 'HKD' : 'USD', symbol: sym, quantity: newAssetType === AccountType.STOCK ? Number(newItemData.amount) : undefined, balance: newAssetType === AccountType.CASH ? Number(newItemData.amount) : 0, lastPrice: currentPrice };
                const updated = [...localAccounts, newAcc];
                setLocalAccounts(updated);
                setIsModalOpen(false);
                setNewItemData({ name: '', symbol: '', amount: '' });
                setPreviewPrice("");
                await handleFinalSave(updated, currentPrice > 0 ? { [sym]: currentPrice } : {});
              }} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black">ADD ASSET</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UpdatePage;