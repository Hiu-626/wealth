import React, { useState, useRef, useEffect } from 'react';
import { Account, AccountType, Currency } from '../types';
import { 
  Save, Plus, Loader2, TrendingUp, Building2, 
  Minus, ScanLine, CloudUpload, History, Sparkles, X, Trash2, CheckCircle2, Globe2,
  Wallet, Edit3, Search, Image as ImageIcon, Landmark, Quote, ArrowRight
} from 'lucide-react';
import { parseFinancialStatement, ScannedAsset } from '../services/geminiService';
import Confetti from './Confetti';

// --- 配置 ---
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwcew_uZTf1VM66NSub7n5oF4MxTQDk2kqAe39HSdJ7f2fs5x-6OCxrNNk1XhYqdZ97HA/exec';

const MOTIVATIONAL_QUOTES = [
  "Wealth is the ability to fully experience life.",
  "Compound interest is the eighth wonder of the world.",
  "Small steps lead to big destinations.",
  "The best investment is in yourself."
];

interface UpdatePageProps {
  accounts: Account[];
  onSave: (updatedAccounts: Account[]) => void;
}

// --- 成功同步後的摘要彈窗 ---
const SyncSuccessModal = ({ isOpen, onClose, data }: { isOpen: boolean, onClose: () => void, data: any }) => {
  const [quote, setQuote] = useState("");
  useEffect(() => { if (isOpen) setQuote(MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]); }, [isOpen]);
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-[200] backdrop-blur-xl">
      <div className="bg-white w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl relative animate-in zoom-in-95">
        <div className="bg-[#0052CC] p-8 pb-10 text-white text-center">
          <div className="bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-sm">
            <CheckCircle2 size={32} />
          </div>
          <h3 className="text-xl font-black italic">SYNC COMPLETE!</h3>
        </div>
        <div className="px-6 py-8 -mt-6 bg-white rounded-t-[2.5rem] relative z-10 space-y-6 text-center">
          <div>
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Net Worth</p>
             <div className="text-4xl font-black text-gray-800 tracking-tighter">HK${Math.round(data.totalNetWorth).toLocaleString()}</div>
          </div>
          <p className="text-sm font-medium text-gray-600 italic px-4">"{quote}"</p>
          <button onClick={onClose} className="w-full py-4 bg-gray-900 text-white rounded-[1.5rem] font-black hover:bg-black transition-all">CONTINUE</button>
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
  const [syncSummary, setSyncSummary] = useState({ totalNetWorth: 0, cashAssets: 0, stockAssets: 0 });
  const [newAssetType, setNewAssetType] = useState<AccountType | null>(null);
  const [newItemData, setNewItemData] = useState({ name: '', symbol: '', amount: '' });
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scannedItems, setScannedItems] = useState<ScannedAsset[]>([]);
  const aiInputRef = useRef<HTMLInputElement>(null);
  const [isFetchingPreview, setIsFetchingPreview] = useState(false);
  const [previewPrice, setPreviewPrice] = useState<number | null>(null);

  // --- 1. 市場預覽查詢 (GET) ---
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

  // --- 2. 核心同步功能 (POST) ---
  const handleFinalSave = async (updatedLocalAccounts: Account[]) => {
    setIsSaving(true);
    try {
      const payload = {
        assets: updatedLocalAccounts.map(acc => ({
          category: acc.type === AccountType.STOCK ? 'STOCK' : 'CASH',
          institution: acc.name,
          symbol: acc.symbol || '',
          amount: acc.type === AccountType.STOCK ? acc.quantity : acc.balance,
          currency: acc.currency
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
        
        // 根據雲端回傳的最新價更新本地數據
        const syncedAccounts = updatedLocalAccounts.map(acc => {
          if (acc.type === AccountType.STOCK && acc.symbol) {
            const cloudPrice = result.latestPrices[acc.symbol.toUpperCase().trim()];
            if (cloudPrice !== undefined) {
              return { ...acc, lastPrice: cloudPrice, balance: Math.round((acc.quantity || 0) * cloudPrice) };
            }
          }
          return acc;
        });

        // 計算摘要 (簡易匯率)
        let total = 0;
        syncedAccounts.forEach(a => {
          let val = (a.type === AccountType.STOCK ? (a.quantity! * a.lastPrice!) : a.balance);
          if (a.currency === 'USD') val *= 7.82;
          if (a.currency === 'AUD') val *= 5.15;
          total += val;
        });

        setSyncSummary({ totalNetWorth: total, cashAssets: 0, stockAssets: 0 });
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
      if (results) setScannedItems(results);
      setIsAnalyzing(false);
    };
    reader.readAsDataURL(file);
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
    const updated = [...localAccounts, newAcc];
    setLocalAccounts(updated);
    setIsModalOpen(false);
    setNewItemData({ name: '', symbol: '', amount: '' });
    await handleFinalSave(updated);
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
              <div className="p-6 bg-gray-900 text-white flex justify-between items-center">
                 <div className="flex items-center gap-2 font-black italic"><Sparkles size={18} className="text-blue-400"/> AI DETECTED</div>
                 <button onClick={() => setScannedItems([])} className="text-gray-500"><X size={20}/></button>
              </div>
              <div className="p-4 space-y-3 max-h-[40vh] overflow-y-auto bg-gray-50">
                {scannedItems.map((item, idx) => (
                  <div key={idx} className="bg-white p-4 rounded-2xl border border-gray-100 grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="text-[8px] font-black text-gray-400 uppercase">Institution</span>
                      <input className="w-full text-xs font-bold outline-none" value={item.institution} onChange={(e) => {
                        const next = [...scannedItems]; next[idx].institution = e.target.value; setScannedItems(next);
                      }} />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[8px] font-black text-blue-400 uppercase">Symbol & Qty</span>
                      <div className="flex gap-2">
                        <input className="w-full text-xs font-black text-blue-600 outline-none" value={item.symbol || ''} onChange={(e) => {
                          const next = [...scannedItems]; next[idx].symbol = e.target.value; setScannedItems(next);
                        }} />
                        <input className="w-12 text-xs font-bold text-right outline-none" type="number" value={item.amount} onChange={(e) => {
                          const next = [...scannedItems]; next[idx].amount = parseFloat(e.target.value)||0; setScannedItems(next);
                        }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-6 bg-white border-t">
                 <button onClick={() => {
                   const enriched = scannedItems.map(item => ({
                     id: Math.random().toString(36).substr(2, 9),
                     name: item.institution,
                     type: item.category === 'STOCK' ? AccountType.STOCK : AccountType.CASH,
                     currency: item.currency as Currency,
                     balance: item.category === 'CASH' ? item.amount : 0, 
                     symbol: item.symbol?.toUpperCase() || '',
                     quantity: item.category === 'STOCK' ? item.amount : undefined,
                     lastPrice: 0 
                   }));
                   setScannedItems([]);
                   handleFinalSave([...localAccounts, ...enriched]);
                 }} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black flex justify-center items-center gap-2 shadow-lg shadow-blue-200">
                    <CheckCircle2 size={18}/> SYNC DETECTED ASSETS
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
                {previewPrice !== null && <p className="text-[10px] font-black text-blue-500 mt-1 ml-1">ESTIMATED PRICE: ${previewPrice}</p>}
              </div>
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