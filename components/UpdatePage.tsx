import React, { useState, useRef } from 'react';
import { Account, AccountType, Currency } from '../types';
import { 
  Save, Plus, Loader2, TrendingUp, Building2, 
  Minus, ScanLine, CloudUpload, History, Sparkles, X, Trash2, CheckCircle2, Globe2,
  Wallet, Edit3, Search, Image as ImageIcon
} from 'lucide-react';
import { parseFinancialStatement, ScannedAsset } from '../services/geminiService';
import Confetti from './Confetti';

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxFY5F47Vir8cJwapxmVdXaCEgReQ4tqpX0ky8cDRdwezHc0BRorUZtnft1dCA08kTKIg/exec';

interface UpdatePageProps {
  accounts: Account[];
  onSave: (updatedAccounts: Account[]) => void;
}

const SyncSuccessModal = ({ isOpen, onClose, data }: { isOpen: boolean, onClose: () => void, data: any }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-6 z-[200] backdrop-blur-lg animate-in fade-in duration-300">
      <div className="bg-white w-full max-sm rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="bg-gradient-to-br from-blue-600 to-blue-400 p-8 text-white text-center relative">
          <div className="absolute top-6 right-6 opacity-20"><Sparkles size={40}/></div>
          <div className="bg-white/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/30">
            <CheckCircle2 size={40} />
          </div>
          <h3 className="text-2xl font-black italic tracking-tighter">SYNC COMPLETE!</h3>
          <p className="text-blue-100 text-xs font-bold uppercase tracking-widest mt-1 font-mono">Database Updated</p>
        </div>
        <div className="p-8 space-y-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Wallet size={18}/></div>
                <span className="text-xs font-black text-gray-400">TOTAL NET WORTH</span>
              </div>
              <div className="text-right font-black text-gray-800">HK${Number(data.totalNetWorth).toLocaleString()}</div>
            </div>
          </div>
          <button onClick={onClose} className="w-full py-5 bg-gray-900 text-white rounded-[2rem] font-black text-lg active:scale-95 transition-all">AWESOME</button>
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
  const [syncSummary, setSyncSummary] = useState({ totalNetWorth: 0, count: 0 });
  const [newAssetType, setNewAssetType] = useState<AccountType | null>(null);
  const [newItemData, setNewItemData] = useState({ name: '', symbol: '', amount: '' });
  
  const [isFetchingPreview, setIsFetchingPreview] = useState(false);
  const [previewPrice, setPreviewPrice] = useState<number | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scannedItems, setScannedItems] = useState<ScannedAsset[]>([]);
  const aiInputRef = useRef<HTMLInputElement>(null);

  const updateStockBalance = (acc: Account, newPrice: number) => {
    return { ...acc, lastPrice: newPrice, balance: Math.round((acc.quantity || 0) * newPrice) };
  };

  // --- 即時抓取預覽市價 ---
  const fetchLivePreview = async (inputSymbol: string) => {
    if (!inputSymbol || newAssetType !== AccountType.STOCK) return;
    setIsFetchingPreview(true);
    setPreviewPrice(null);
    try {
      let querySym = inputSymbol.toUpperCase().trim();
      if (/^\d+$/.test(querySym)) querySym = querySym.padStart(4, '0');
      const response = await fetch(`${GOOGLE_SCRIPT_URL}?symbol=${encodeURIComponent(querySym)}`);
      const data = await response.json();
      setPreviewPrice(Number(data.price) || 0);
    } catch (e) {
      setPreviewPrice(0);
    } finally {
      setIsFetchingPreview(false);
    }
  };

  // --- AI 掃描處理 ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsAnalyzing(true);
    try {
      const results = await parseFinancialStatement(file);
      setScannedItems(results);
    } catch (err) {
      alert("AI Analysis failed. Please try a clearer image.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const applyScannedItems = () => {
    const newAccounts: Account[] = scannedItems.map(item => {
      let finalSymbol = item.symbol?.toUpperCase() || '';
      if (item.type === AccountType.STOCK && /^\d{1,5}$/.test(finalSymbol)) {
        finalSymbol = finalSymbol.padStart(5, '0') + '.HK';
      }
      return {
        id: Math.random().toString(36).substr(2, 9),
        name: item.name,
        type: item.type,
        symbol: finalSymbol,
        quantity: item.type === AccountType.STOCK ? item.amount : undefined,
        balance: item.type === AccountType.CASH ? item.amount : 0,
        currency: item.currency as Currency,
        lastPrice: 0
      };
    });
    setLocalAccounts([...localAccounts, ...newAccounts]);
    setScannedItems([]);
    setActiveTab('MANUAL');
  };

  const handleFinalSave = async (updatedLocalAccounts: Account[]) => {
    setIsSaving(true);
    try {
      const payload = {
        assets: updatedLocalAccounts.map(acc => ({
          category: acc.type === AccountType.STOCK ? 'STOCK' : 'CASH',
          institution: acc.name,
          symbol: acc.symbol?.toUpperCase() || '',
          amount: acc.type === AccountType.STOCK ? acc.quantity : acc.balance,
          currency: acc.currency,
          market: acc.symbol?.includes('.HK') ? 'HK' : (acc.symbol?.includes('.AX') ? 'AU' : 'US')
        }))
      };
      const resp = await fetch(GOOGLE_SCRIPT_URL, { 
        method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload) 
      });
      const result = await resp.json();
      if (result.status === "Success") {
        setShowConfetti(true);
        setSyncSummary({ totalNetWorth: parseFloat(result.totalNetWorth) || 0, count: updatedLocalAccounts.length });
        setIsSuccessModalOpen(true);
        onSave(updatedLocalAccounts);
      }
    } catch (e) {
      alert("Sync Error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 pb-32 space-y-6 bg-gray-50 min-h-screen">
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />
      <SyncSuccessModal isOpen={isSuccessModalOpen} onClose={() => setIsSuccessModalOpen(false)} data={syncSummary} />

      <div className="bg-gray-200 p-1 rounded-2xl flex shadow-inner">
        <button onClick={() => setActiveTab('MANUAL')} className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${activeTab === 'MANUAL' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>MANUAL</button>
        <button onClick={() => setActiveTab('AI_SCANNER')} className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${activeTab === 'AI_SCANNER' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>AI SCANNER</button>
      </div>

      {activeTab === 'MANUAL' ? (
        <div className="space-y-8 animate-in fade-in">
          {/* Bank Accounts */}
          <section>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xs font-black text-gray-400 uppercase flex items-center"><Building2 className="w-4 h-4 mr-2" /> Bank Accounts</h2>
              <button onClick={() => { setNewAssetType(AccountType.CASH); setIsModalOpen(true); }} className="bg-blue-50 text-blue-600 px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1"><Plus size={14}/> Add Bank</button>
            </div>
            <div className="space-y-3">
              {localAccounts.filter(a => a.type === AccountType.CASH).map(acc => (
                <div key={acc.id} className="bg-white p-5 rounded-[1.5rem] shadow-sm flex justify-between items-center border border-gray-100">
                  <div className="flex items-center gap-4">
                    <button onClick={() => setLocalAccounts(prev => prev.filter(a => a.id !== acc.id))} className="p-2 text-gray-300 hover:text-red-500"><Trash2 size={18}/></button>
                    <div className="font-bold text-gray-700">{acc.name}</div>
                  </div>
                  <div className="flex items-center bg-gray-50 px-4 py-2 rounded-xl">
                    <span className="text-gray-400 font-bold mr-1 text-xs">$</span>
                    <input type="number" value={acc.balance} onChange={(e) => setLocalAccounts(prev => prev.map(a => a.id === acc.id ? {...a, balance: parseFloat(e.target.value)||0} : a))} className="w-24 text-right font-black text-gray-800 bg-transparent outline-none" />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Portfolio */}
          <section>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xs font-black text-gray-400 uppercase flex items-center"><TrendingUp className="w-4 h-4 mr-2" /> Portfolio</h2>
              <button onClick={() => { setNewAssetType(AccountType.STOCK); setIsModalOpen(true); }} className="bg-blue-50 text-blue-600 px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1"><Plus size={14}/> Add Stock</button>
            </div>
            <div className="space-y-4">
              {localAccounts.filter(a => a.type === AccountType.STOCK).map(acc => (
                <div key={acc.id} className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-100 space-y-4">
                  <div className="flex justify-between">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setLocalAccounts(prev => prev.filter(a => a.id !== acc.id))} className="p-2 text-gray-300 hover:text-red-500"><Trash2 size={18}/></button>
                      <div>
                        <div className="font-black text-gray-800 text-lg">{acc.symbol}</div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase">{acc.name}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-blue-600">HK${(acc.balance || 0).toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 p-3 rounded-2xl">
                      <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Quantity</label>
                      <input type="number" value={acc.quantity} onChange={(e) => {
                        const q = parseFloat(e.target.value)||0;
                        setLocalAccounts(prev => prev.map(a => a.id === acc.id ? {...a, quantity: q, balance: Math.round(q * (a.lastPrice || 0))} : a));
                      }} className="w-full font-black bg-transparent outline-none text-gray-700 text-lg" />
                    </div>
                    <div className="bg-blue-50/50 p-3 rounded-2xl border border-blue-100">
                      <label className="text-[9px] font-black text-blue-500 uppercase block mb-1 flex items-center gap-1"><Edit3 size={10}/> Unit Price</label>
                      <input type="number" value={acc.lastPrice} onChange={(e) => {
                        const p = parseFloat(e.target.value)||0;
                        setLocalAccounts(prev => prev.map(a => a.id === acc.id ? updateStockBalance(a, p) : a));
                      }} className="w-full font-black bg-transparent outline-none text-blue-600 text-lg" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <button onClick={() => handleFinalSave(localAccounts)} disabled={isSaving} className="fixed bottom-28 left-6 right-6 bg-blue-600 text-white py-5 rounded-[2rem] font-black shadow-2xl flex justify-center items-center gap-3 active:scale-95 disabled:bg-gray-400 z-30 transition-all">
            {isSaving ? <Loader2 className="animate-spin" /> : <CloudUpload size={20} />} 
            {isSaving ? 'SYNCING...' : 'SAVE & SYNC CLOUD'}
          </button>
        </div>
      ) : (
        /* 🎨 重新補回的 AI Scanner 介面 */
        <div className="space-y-6 animate-in fade-in">
          <div 
            onClick={() => aiInputRef.current?.click()}
            className="border-4 border-dashed border-gray-200 rounded-[3rem] p-12 flex flex-col items-center justify-center bg-white hover:border-blue-400 transition-colors cursor-pointer group"
          >
            <input type="file" ref={aiInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
            {isAnalyzing ? (
              <div className="text-center space-y-4">
                <Loader2 size={48} className="animate-spin text-blue-600 mx-auto" />
                <p className="font-black text-gray-400 animate-pulse">GEMINI ANALYZING...</p>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <div className="bg-blue-50 p-6 rounded-full group-hover:scale-110 transition-transform">
                  <ScanLine size={48} className="text-blue-600" />
                </div>
                <div>
                  <p className="font-black text-xl text-gray-800">Scan Statement</p>
                  <p className="text-gray-400 font-bold text-sm">Upload a screenshot or photo</p>
                </div>
              </div>
            )}
          </div>

          {scannedItems.length > 0 && (
            <div className="space-y-4 animate-in slide-in-from-bottom-4">
              <h3 className="text-xs font-black text-gray-400 uppercase px-2">Detected Assets</h3>
              <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
                {scannedItems.map((item, idx) => (
                  <div key={idx} className="p-5 border-b border-gray-50 flex justify-between items-center">
                    <div>
                      <div className="font-black text-gray-800">{item.name}</div>
                      <div className="text-[10px] font-bold text-blue-500 uppercase">{item.type} • {item.symbol || 'CASH'}</div>
                    </div>
                    <div className="text-right font-black text-gray-700">
                      {item.currency} {item.amount.toLocaleString()}
                    </div>
                  </div>
                ))}
                <button onClick={applyScannedItems} className="w-full py-5 bg-gray-900 text-white font-black text-lg hover:bg-black transition-colors">
                  CONFIRM & ADD ALL
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual Add Asset Modal (包含即時預覽價格) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-[100] backdrop-blur-md">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 shadow-2xl space-y-8 animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-3xl text-gray-800 tracking-tighter italic">Add {newAssetType === AccountType.STOCK ? 'Stock' : 'Bank'}</h3>
              <button onClick={() => { setIsModalOpen(false); setPreviewPrice(null); }} className="text-gray-300"><X size={28}/></button>
            </div>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Symbol / Name</label>
                <div className="relative">
                  <input 
                    placeholder={newAssetType === AccountType.STOCK ? "e.g. 5 or AAPL" : "Bank Name"} 
                    value={newAssetType === AccountType.STOCK ? newItemData.symbol : newItemData.name} 
                    onChange={e => setNewItemData({...newItemData, [newAssetType === AccountType.STOCK ? 'symbol' : 'name']: e.target.value})} 
                    className="w-full p-5 bg-gray-50 rounded-2xl outline-none font-black text-xl text-blue-600" 
                  />
                  {newAssetType === AccountType.STOCK && (
                    <button 
                      onClick={() => fetchLivePreview(newItemData.symbol)}
                      disabled={isFetchingPreview || !newItemData.symbol}
                      className="absolute right-3 top-3 p-2 bg-blue-600 text-white rounded-xl shadow-lg active:scale-90"
                    >
                      {isFetchingPreview ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                    </button>
                  )}
                </div>
                {newAssetType === AccountType.STOCK && previewPrice !== null && (
                  <div className={`mt-2 p-3 rounded-xl flex items-center justify-between animate-in slide-in-from-top-2 ${previewPrice > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                    <span className="text-[10px] font-black text-gray-400 uppercase">Live Price:</span>
                    <span className={`font-black text-sm ${previewPrice > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {previewPrice > 0 ? `$${previewPrice.toLocaleString()}` : "Not Found"}
                    </span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Amount / Qty</label>
                <input type="number" placeholder="0" value={newItemData.amount} onChange={e => setNewItemData({...newItemData, amount: e.target.value})} className="w-full p-5 bg-gray-50 rounded-2xl outline-none font-black text-xl" />
              </div>
            </div>
            <button onClick={handleAddAsset} className="w-full py-5 bg-blue-600 text-white rounded-[2rem] font-black text-xl active:scale-95 transition-all">ADD TO LIST</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UpdatePage;