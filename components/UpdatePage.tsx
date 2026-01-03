import React, { useState, useRef } from 'react';
import { Account, AccountType, Currency } from '../types';
import { 
  Save, Plus, Loader2, TrendingUp, Building2, 
  Minus, ScanLine, CloudUpload, History, Sparkles, X, Trash2, CheckCircle2 
} from 'lucide-react';
import { getStockEstimate, parseFinancialStatement, ScannedAsset } from '../services/geminiService';
import Confetti from './Confetti';

// 你的 Google Apps Script URL
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx7GhHej_A4WO8SqjyZjINbkVkWZJBhTEXrE7VjPuUYQ7qX6AzNwoytF8vjlYgYxOk68Q/exec';

interface UpdatePageProps {
  accounts: Account[];
  onSave: (updatedAccounts: Account[]) => void;
}

const UpdatePage: React.FC<UpdatePageProps> = ({ accounts, onSave }) => {
  const [activeTab, setActiveTab] = useState<'MANUAL' | 'AI_SCANNER'>('MANUAL');
  const [showConfetti, setShowConfetti] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [localAccounts, setLocalAccounts] = useState<Account[]>([...accounts]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newAssetType, setNewAssetType] = useState<AccountType | null>(null);
  const [newItemData, setNewItemData] = useState({ name: '', symbol: '', amount: '' });
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scannedItems, setScannedItems] = useState<ScannedAsset[]>([]);
  const aiInputRef = useRef<HTMLInputElement>(null);

  // --- 核心儲存與數據回流同步 ---
  const handleFinalSave = async (updatedLocalAccounts: Account[]) => {
    setIsSaving(true);
    try {
      if (GOOGLE_SCRIPT_URL && GOOGLE_SCRIPT_URL.includes('/exec')) {
        const payload = {
          assets: updatedLocalAccounts.map(acc => {
            let market = "US";
            if (acc.symbol?.toUpperCase().endsWith(".HK")) market = "HK";
            if (acc.symbol?.toUpperCase().endsWith(".AX")) market = "AU";
            return {
              category: acc.type === AccountType.STOCK ? 'STOCK' : 'CASH',
              institution: acc.name,
              symbol: acc.symbol || '',
              amount: acc.type === AccountType.STOCK ? acc.quantity : acc.balance,
              currency: acc.currency,
              market: market 
            };
          })
        };
        
        const response = await fetch(GOOGLE_SCRIPT_URL, { 
          method: 'POST', 
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify(payload) 
        });

        const result = await response.json();
        if (result.status === "Success") {
          setShowConfetti(true);
          const syncedAccounts = updatedLocalAccounts.map(acc => {
            if (acc.type === AccountType.STOCK && acc.symbol && result.latestPrices?.[acc.symbol]) {
              const cloudPrice = result.latestPrices[acc.symbol];
              return { ...acc, lastPrice: cloudPrice, balance: Math.round((acc.quantity || 0) * cloudPrice) };
            }
            return acc;
          });
          setLocalAccounts(syncedAccounts);
          onSave(syncedAccounts);
          alert(`🚀 同步成功！\n雲端總淨值：HK$${Math.round(result.totalNetWorth).toLocaleString()}`);
        }
      }
    } catch (e) { console.error(e); alert("同步失敗"); }
    setIsSaving(false);
  };

  // --- 手動修改 AI 結果中的市場後綴 ---
  const updateMarketSuffix = (index: number, suffix: '.HK' | '.AX' | 'US') => {
    const updated = [...scannedItems];
    let baseSymbol = updated[index].symbol?.split('.')[0] || '';
    
    if (suffix === 'US') {
      updated[index].symbol = baseSymbol;
      updated[index].currency = 'USD';
    } else {
      if (suffix === '.HK' && /^\d+$/.test(baseSymbol)) baseSymbol = baseSymbol.padStart(5, '0');
      updated[index].symbol = `${baseSymbol}${suffix}`;
      updated[index].currency = suffix === '.HK' ? 'HKD' : 'AUD';
    }
    setScannedItems(updated);
  };

  const handleAISyncConfirm = async () => {
    setIsSaving(true);
    const enriched = await Promise.all(scannedItems.map(async (item) => {
      let finalSymbol = item.symbol?.toUpperCase().trim() || '';
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
    await handleFinalSave(finalAccounts);
  };

  const updateScannedItem = (index: number, field: keyof ScannedAsset, value: any) => {
    const updated = [...scannedItems];
    updated[index] = { ...updated[index], [field]: value };
    setScannedItems(updated);
  };

  const handleAddAsset = async () => {
    if (!newAssetType) return;
    setIsSaving(true);
    let price = 0;
    let finalSymbol = newItemData.symbol.toUpperCase().trim();
    if (newAssetType === AccountType.STOCK && finalSymbol) {
      if (/^\d{1,4}$/.test(finalSymbol)) finalSymbol = finalSymbol.padStart(5, '0') + '.HK';
      price = await getStockEstimate(finalSymbol) || 0;
    }
    const newAcc: Account = {
      id: Date.now().toString(),
      name: newItemData.name || (newAssetType === AccountType.STOCK ? finalSymbol : 'New Bank'),
      type: newAssetType,
      currency: (finalSymbol.endsWith('.AX') ? 'AUD' : (finalSymbol.includes('.') ? 'HKD' : 'USD')) as Currency,
      symbol: finalSymbol,
      quantity: newAssetType === AccountType.STOCK ? parseFloat(newItemData.amount) : undefined,
      balance: newAssetType === AccountType.STOCK ? Math.round(parseFloat(newItemData.amount) * price) : parseFloat(newItemData.amount),
      lastPrice: price
    };
    const newAccountsList = [...localAccounts, newAcc];
    setLocalAccounts(newAccountsList);
    setIsModalOpen(false);
    setNewItemData({ name: '', symbol: '', amount: '' });
    setIsSaving(false);
  };

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

  return (
    <div className="p-6 pb-32 space-y-6 bg-gray-50 min-h-screen">
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />

      <div className="bg-gray-200 p-1 rounded-2xl flex shadow-inner">
        <button onClick={() => setActiveTab('MANUAL')} className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${activeTab === 'MANUAL' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>MANUAL</button>
        <button onClick={() => setActiveTab('AI_SCANNER')} className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${activeTab === 'AI_SCANNER' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>AI SCANNER</button>
      </div>

      {activeTab === 'MANUAL' ? (
        <div className="space-y-8 animate-in fade-in">
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

          <section>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xs font-black text-gray-400 uppercase flex items-center"><TrendingUp className="w-4 h-4 mr-2" /> Portfolio</h2>
              <button onClick={() => { setNewAssetType(AccountType.STOCK); setIsModalOpen(true); }} className="bg-blue-50 text-blue-600 px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1"><Plus size={14}/> Add Stock</button>
            </div>
            <div className="space-y-4">
              {localAccounts.filter(a => a.type === AccountType.STOCK).map(acc => (
                <div key={acc.id} className="bg-white p-5 rounded-[1.5rem] shadow-sm border border-gray-100">
                  <div className="flex justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setLocalAccounts(prev => prev.filter(a => a.id !== acc.id))} className="p-2 text-gray-300 hover:text-red-500"><Trash2 size={18}/></button>
                      <div>
                        <div className="font-black text-gray-800 text-lg">{acc.symbol}</div>
                        <div className="text-[10px] text-blue-500 font-bold uppercase">Market Est: ${acc.lastPrice}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-blue-600">${(acc.balance || 0).toLocaleString()}</div>
                      <div className="text-[10px] text-gray-400 font-bold">{acc.currency}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 bg-gray-50 p-2 rounded-2xl">
                    <button onClick={() => setLocalAccounts(prev => prev.map(a => a.id === acc.id ? {...a, quantity: Math.max(0, (a.quantity||0)-1), balance: Math.round(((a.quantity||0)-1)*(a.lastPrice||0))} : a))} className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-gray-400"><Minus size={20}/></button>
                    <input type="number" value={acc.quantity} onChange={(e) => {
                      const q = parseFloat(e.target.value)||0;
                      setLocalAccounts(prev => prev.map(a => a.id === acc.id ? {...a, quantity: q, balance: Math.round(q*(a.lastPrice||0))} : a));
                    }} className="flex-1 text-center font-black bg-transparent outline-none text-gray-700 text-xl" />
                    <button onClick={() => setLocalAccounts(prev => prev.map(a => a.id === acc.id ? {...a, quantity: (a.quantity||0)+1, balance: Math.round(((a.quantity||0)+1)*(a.lastPrice||0))} : a))} className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-gray-400"><Plus size={20}/></button>
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
        /* AI Scanner UI */
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
          <div onClick={() => !isAnalyzing && aiInputRef.current?.click()} className={`border-2 border-dashed rounded-[2.5rem] p-16 text-center transition-all ${isAnalyzing ? 'border-blue-300 bg-blue-50' : 'border-gray-300 hover:border-blue-400 bg-white cursor-pointer'}`}>
            <input type="file" ref={aiInputRef} className="hidden" accept="image/*" onChange={handleAIFileUpload} />
            {isAnalyzing ? (
              <div className="flex flex-col items-center"><Loader2 className="w-12 h-12 text-blue-600 animate-spin" /><p className="mt-4 font-black text-blue-600">ANALYZING...</p></div>
            ) : (
              <div className="flex flex-col items-center"><ScanLine className="w-16 h-16 text-gray-200 mb-4" /><p className="font-black text-gray-700">SCAN STATEMENT</p></div>
            )}
          </div>

          {scannedItems.length > 0 && (
            <div className="bg-white rounded-[2.5rem] shadow-2xl border overflow-hidden mb-24">
              <div className="p-6 bg-blue-600 text-white flex justify-between items-center font-black italic"><Sparkles size={20}/> AI ANALYSIS RESULT</div>
              <div className="p-4 space-y-4 max-h-[45vh] overflow-y-auto bg-gray-50">
                {scannedItems.map((item, idx) => (
                  <div key={idx} className="bg-white p-5 rounded-2xl shadow-sm space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-xs font-black">
                      <div className="space-y-1">
                        <label className="text-gray-400 uppercase">Institution</label>
                        <input className="w-full bg-gray-50 p-2 rounded-lg" value={item.institution} onChange={(e) => updateScannedItem(idx, 'institution', e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-blue-400 uppercase">Symbol / Amount</label>
                        <div className="flex gap-2">
                          <input className="w-full bg-blue-50 p-2 rounded-lg text-blue-600" value={item.symbol || ''} onChange={(e) => updateScannedItem(idx, 'symbol', e.target.value)} />
                          <input className="w-20 bg-gray-50 p-2 rounded-lg" type="number" value={item.amount} onChange={(e) => updateScannedItem(idx, 'amount', parseFloat(e.target.value)||0)} />
                        </div>
                      </div>
                    </div>
                    {item.category === 'STOCK' && (
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-[10px] font-black text-gray-400 mr-1 uppercase">Market:</span>
                        {[ 
                          { label: '.HK', suffix: '.HK' as const }, 
                          { label: '.AX', suffix: '.AX' as const }, 
                          { label: 'US', suffix: 'US' as const } 
                        ].map((m) => (
                          <button
                            key={m.label}
                            onClick={() => updateMarketSuffix(idx, m.suffix)}
                            className={`px-3 py-1 rounded-full text-[10px] font-black transition-all ${
                              (m.suffix === 'US' && !item.symbol?.includes('.')) || (item.symbol?.endsWith(m.suffix))
                              ? 'bg-blue-600 text-white shadow-md' 
                              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                        <span className="ml-auto text-[10px] font-black text-blue-500 bg-blue-50 px-2 py-1 rounded-md">{item.currency}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="p-6 bg-white border-t flex gap-3">
                 <button 
                    onClick={() => setScannedItems([])} 
                    className="py-5 px-6 bg-red-50 text-red-500 rounded-[1.5rem] font-black flex justify-center items-center gap-2 active:scale-95 transition-all hover:bg-red-100"
                 >
                    <X size={20} /> CANCEL
                 </button>
                 <button 
                    onClick={handleAISyncConfirm} 
                    disabled={isSaving} 
                    className="flex-1 py-5 bg-blue-600 text-white rounded-[1.5rem] font-black flex justify-center items-center gap-3 active:scale-95 transition-all shadow-xl shadow-blue-200"
                 >
                    {isSaving ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={24} />} CONFIRM & SYNC
                 </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-[100] backdrop-blur-md">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 shadow-2xl space-y-8 animate-in zoom-in-95">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-3xl text-gray-800 tracking-tighter">Add {newAssetType === AccountType.STOCK ? 'Stock' : 'Bank'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-300"><X size={28}/></button>
            </div>
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase">Name / Symbol</label>
                <input placeholder={newAssetType === AccountType.STOCK ? "e.g. 700 or AAPL" : "Institution"} value={newAssetType === AccountType.STOCK ? newItemData.symbol : newItemData.name} onChange={e => setNewItemData({...newItemData, [newAssetType === AccountType.STOCK ? 'symbol' : 'name']: e.target.value})} className="w-full p-5 bg-gray-50 rounded-2xl outline-none font-black text-xl text-blue-600" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase">Amount</label>
                <input type="number" placeholder="0" value={newItemData.amount} onChange={e => setNewItemData({...newItemData, amount: e.target.value})} className="w-full p-5 bg-gray-50 rounded-2xl outline-none font-black text-xl" />
              </div>
            </div>
            <button onClick={handleAddAsset} disabled={isSaving} className="w-full py-5 bg-blue-600 text-white rounded-[2rem] font-black text-xl active:scale-95 transition-all">ADD ASSET</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UpdatePage;