import React, { useState, useRef } from 'react';
import { Account, AccountType, Currency } from '../types';
import { 
  Save, Plus, Loader2, TrendingUp, Building2, 
  Minus, ScanLine, CloudUpload, History, Sparkles, X, Trash2, CheckCircle2, Globe2,
  ChevronRight, ArrowUpRight, Wallet
} from 'lucide-react';
import { getStockEstimate, parseFinancialStatement, ScannedAsset } from '../services/geminiService';
import Confetti from './Confetti';

// 你的 Google Apps Script URL
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyQ303l6RRA3xMueTtntWEQmMw0S8qAEMvS63Iy4VjaXIokfxrfEiKp494UE84NmObx-A/exec';

interface UpdatePageProps {
  accounts: Account[];
  onSave: (updatedAccounts: Account[]) => void;
}

// --- 成功同步後的摘要彈窗 ---
const SyncSuccessModal = ({ isOpen, onClose, data }: { isOpen: boolean, onClose: () => void, data: any }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-6 z-[200] backdrop-blur-lg animate-in fade-in">
      <div className="bg-white w-full max-w-sm rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="bg-gradient-to-br from-blue-600 to-blue-400 p-8 text-white text-center relative">
          <div className="absolute top-6 right-6 opacity-20"><Sparkles size={40}/></div>
          <div className="bg-white/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/30">
            <CheckCircle2 size={40} />
          </div>
          <h3 className="text-2xl font-black italic tracking-tighter">SYNC COMPLETE!</h3>
          <p className="text-blue-100 text-xs font-bold uppercase tracking-widest mt-1">Cloud Database Updated</p>
        </div>
        
        <div className="p-8 space-y-6">
          <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Wallet size={18}/></div>
              <span className="text-xs font-black text-gray-400">TOTAL NET WORTH</span>
            </div>
            <div className="text-right">
              <div className="text-xl font-black text-gray-800">HK${Math.round(data.totalNetWorth).toLocaleString()}</div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-sm border-b border-dashed pb-2">
              <span className="font-bold text-gray-400">Assets Synced</span>
              <span className="font-black text-blue-600">{data.count} Items</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="font-bold text-gray-400">Status</span>
              <span className="font-black text-green-500 flex items-center gap-1">LIVE <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"/></span>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="w-full py-5 bg-gray-900 text-white rounded-[2rem] font-black text-lg active:scale-95 transition-all shadow-lg"
          >
            AWESOME
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
  
  // 彈窗控制
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [syncSummary, setSyncSummary] = useState({ totalNetWorth: 0, count: 0 });
  const [newAssetType, setNewAssetType] = useState<AccountType | null>(null);
  const [newItemData, setNewItemData] = useState({ name: '', symbol: '', amount: '' });
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scannedItems, setScannedItems] = useState<ScannedAsset[]>([]);
  const aiInputRef = useRef<HTMLInputElement>(null);

  // --- 處理市場後綴與幣別的統一邏輯 ---
  const getUpdatedSymbolInfo = (baseSymbol: string, suffix: '.HK' | '.AX' | 'US') => {
    let cleanSymbol = baseSymbol.split('.')[0] || '';
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

  const applyGlobalMarket = (suffix: '.HK' | '.AX' | 'US') => {
    setScannedItems(prev => prev.map(item => 
      item.category === 'STOCK' ? { ...item, ...getUpdatedSymbolInfo(item.symbol || '', suffix) } : item
    ));
  };

  const updateMarketSuffix = (index: number, suffix: '.HK' | '.AX' | 'US') => {
    const updated = [...scannedItems];
    const info = getUpdatedSymbolInfo(updated[index].symbol || '', suffix);
    updated[index] = { ...updated[index], symbol: info.symbol, currency: info.currency };
    setScannedItems(updated);
  };

  const updateScannedItem = (index: number, field: keyof ScannedAsset, value: any) => {
    const updated = [...scannedItems];
    updated[index] = { ...updated[index], [field]: value };
    setScannedItems(updated);
  };

  // --- 儲存與同步 ---
  const handleFinalSave = async (updatedLocalAccounts: Account[]) => {
    setIsSaving(true);
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
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload) 
      });

      const result = await response.json();
      if (result.status === "Success") {
        setShowConfetti(true);
        setSyncSummary({ 
          totalNetWorth: result.totalNetWorth, 
          count: updatedLocalAccounts.length 
        });
        setIsSuccessModalOpen(true);

        const syncedAccounts = updatedLocalAccounts.map(acc => {
          if (acc.type === AccountType.STOCK && acc.symbol && result.latestPrices?.[acc.symbol]) {
            const cloudPrice = result.latestPrices[acc.symbol];
            return { ...acc, lastPrice: cloudPrice, balance: Math.round((acc.quantity || 0) * cloudPrice) };
          }
          return acc;
        });
        setLocalAccounts(syncedAccounts);
        onSave(syncedAccounts);
      }
    } catch (e) { 
      console.error(e); 
      alert("Sync Failed. Please check internet connection."); 
    }
    setIsSaving(false);
  };

  const handleAISyncConfirm = async () => {
    setIsSaving(true);
    const enriched = await Promise.all(scannedItems.map(async (item) => {
      let finalSymbol = item.symbol?.toUpperCase().trim() || '';
      let price = 0;
      if (item.category === 'STOCK' && finalSymbol) {
        // 如果是 1-4 位數字，自動補齊香港後綴
        if (/^\d{1,4}$/.test(finalSymbol)) finalSymbol = finalSymbol.padStart(5, '0') + '.HK';
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
    const updated = [...localAccounts, newAcc];
    setLocalAccounts(updated);
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
      
      <SyncSuccessModal 
        isOpen={isSuccessModalOpen} 
        onClose={() => setIsSuccessModalOpen(false)} 
        data={syncSummary} 
      />

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
              <div className="flex flex-col items-center"><Loader2 className="w-12 h-12 text-blue-600 animate-spin" /><p className="mt-4 font-black text-blue-600 uppercase tracking-widest">Analyzing Statement...</p></div>
            ) : (
              <div className="flex flex-col items-center"><ScanLine className="w-16 h-16 text-gray-200 mb-4" /><p className="font-black text-gray-700">SCAN DOCUMENT</p></div>
            )}
          </div>

          {scannedItems.length > 0 && (
            <div className="bg-white rounded-[2.5rem] shadow-2xl border overflow-hidden mb-24">
              <div className="p-6 bg-blue-600 text-white space-y-4">
                <div className="flex justify-between items-center font-black italic">
                   <div className="flex items-center gap-2"><Sparkles size={20}/> AI ANALYSIS RESULT</div>
                </div>
                <div className="bg-blue-700/50 p-3 rounded-2xl flex items-center justify-between gap-3">
                  <div className="text-[10px] font-black flex items-center gap-1"><Globe2 size={12}/> SET ALL:</div>
                  <div className="flex gap-2">
                    {(['.HK', '.AX', 'US'] as const).map(suffix => (
                      <button 
                        key={suffix}
                        onClick={() => applyGlobalMarket(suffix)}
                        className="bg-white/20 hover:bg-white text-white hover:text-blue-600 px-4 py-1.5 rounded-xl text-xs font-black transition-all"
                      >
                        {suffix}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-4 max-h-[40vh] overflow-y-auto bg-gray-50">
                {scannedItems.map((item, idx) => (
                  <div key={idx} className="bg-white p-5 rounded-2xl shadow-sm space-y-4 border border-gray-100">
                    <div className="grid grid-cols-2 gap-4 text-xs font-black">
                      <div className="space-y-1">
                        <label className="text-gray-400 uppercase tracking-tighter">Institution</label>
                        <input className="w-full bg-gray-50 p-2 rounded-lg outline-none focus:ring-1 ring-blue-500" value={item.institution} onChange={(e) => updateScannedItem(idx, 'institution', e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-blue-400 uppercase tracking-tighter">Symbol / Qty</label>
                        <div className="flex gap-2">
                          <input className="w-full bg-blue-50 p-2 rounded-lg text-blue-600 outline-none" value={item.symbol || ''} onChange={(e) => updateScannedItem(idx, 'symbol', e.target.value)} />
                          <input className="w-16 bg-gray-50 p-2 rounded-lg text-center" type="number" value={item.amount} onChange={(e) => updateScannedItem(idx, 'amount', parseFloat(e.target.value)||0)} />
                        </div>
                      </div>
                    </div>
                    {item.category === 'STOCK' && (
                      <div className="flex items-center gap-2 border-t pt-3">
                        <span className="text-[9px] font-black text-gray-300 uppercase">Modify:</span>
                        {(['.HK', '.AX', 'US'] as const).map((m) => (
                          <button
                            key={m}
                            onClick={() => updateMarketSuffix(idx, m)}
                            className={`px-3 py-1 rounded-full text-[10px] font-black transition-all ${
                              (m === 'US' && !item.symbol?.includes('.')) || (item.symbol?.endsWith(m))
                              ? 'bg-blue-600 text-white' 
                              : 'bg-gray-100 text-gray-400'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                        <span className="ml-auto text-[10px] font-black text-blue-500 bg-blue-50 px-2 py-1 rounded-md">{item.currency}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="p-6 bg-white border-t">
                <button 
                  onClick={handleAISyncConfirm} 
                  disabled={isSaving} 
                  className="w-full py-5 bg-blue-600 text-white rounded-[1.5rem] font-black flex justify-center items-center gap-3 active:scale-95 transition-all shadow-xl disabled:bg-gray-400"
                >
                  {isSaving ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={24} />} 
                  {isSaving ? 'UPDATING...' : 'CONFIRM & ADD TO LIST'}
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