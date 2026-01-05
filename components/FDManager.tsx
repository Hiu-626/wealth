import React, { useState, useMemo } from 'react';
import { FixedDeposit, Currency, Account } from '../types';
import { Plus, Trash2, RefreshCw, Percent, AlertCircle, X, Check, Clock, Download, Landmark, Calculator, Info, EyeOff } from 'lucide-react';

interface FDManagerProps {
  fds: FixedDeposit[];
  accounts: Account[];
  onUpdate: (fds: FixedDeposit[]) => void;
  onSettle: (fdId: string, targetAccountId: string, finalAmount: number) => void;
  onBack: () => void;
}

const calculateSimpleInterest = (principal: number, rate: number, months: number) => {
    return Math.round(principal * (rate / 100) * (months / 12));
};

const FDManager: React.FC<FDManagerProps> = ({ fds, accounts, onUpdate, onSettle, onBack }) => {
  const [isAdding, setIsAdding] = useState(false);
  
  const [newFD, setNewFD] = useState<Partial<FixedDeposit & { startDate: string, type: 'Fixed' | 'Savings' }>>({
    bankName: 'HSBC',
    currency: 'HKD',
    actionOnMaturity: 'Renew',
    autoRoll: true,
    interestRate: 4.0,
    startDate: new Date().toISOString().split('T')[0],
    type: 'Fixed'
  });

  const [rolloverTarget, setRolloverTarget] = useState<any | null>(null);
  const [rolloverInterest, setRolloverInterest] = useState<number>(0);
  const [rolloverNewRate, setRolloverNewRate] = useState<number>(4.0);
  const [rolloverDuration, setRolloverDuration] = useState<number>(3);

  const [settleTarget, setSettleTarget] = useState<any | null>(null);
  const [settleFinalInterest, setSettleFinalInterest] = useState<number>(0);
  const [settleDestId, setSettleDestId] = useState<string>('');

  const estimation = useMemo(() => {
    const principal = Number(newFD.principal) || 0;
    const rate = Number(newFD.interestRate) || 0;
    if (!newFD.startDate || !newFD.maturityDate || principal <= 0) return { interest: 0, total: principal, days: 0 };
    const start = new Date(newFD.startDate);
    const maturity = new Date(newFD.maturityDate);
    const diffDays = Math.ceil((maturity.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return { interest: 0, total: principal, days: 0 };
    const interest = Math.round(principal * (rate / 100) * (diffDays / 365));
    return { interest, total: principal + interest, days: diffDays };
  }, [newFD.principal, newFD.interestRate, newFD.startDate, newFD.maturityDate]);

  const bankOptions = useMemo(() => {
      const userBanks = accounts.filter(acc => acc.type === 'Cash').map(acc => acc.name);
      return Array.from(new Set(['HSBC', 'Standard Chartered', 'BOC', 'Hang Seng', 'Citibank', 'Mox', 'ZA Bank', 'BOQ', ...userBanks]));
  }, [accounts]);

  const handleAdd = () => {
    if (!newFD.principal || !newFD.maturityDate) return;
    const fd: any = {
        id: Date.now().toString(),
        bankName: newFD.bankName || 'Other',
        principal: Number(newFD.principal),
        currency: newFD.currency as Currency,
        maturityDate: newFD.maturityDate,
        actionOnMaturity: newFD.actionOnMaturity as 'Renew' | 'Transfer Out',
        interestRate: Number(newFD.interestRate),
        autoRoll: newFD.autoRoll || false,
        type: newFD.type || 'Fixed'
    };
    onUpdate([...fds, fd]);
    setIsAdding(false);
    setNewFD({ ...newFD, principal: undefined, maturityDate: undefined });
  };

  const openRolloverModal = (fd: any) => {
      const estimatedInt = calculateSimpleInterest(fd.principal, fd.interestRate || 0, 3);
      setRolloverTarget(fd);
      setRolloverInterest(estimatedInt);
      setRolloverNewRate(fd.interestRate || 4.0);
      setRolloverDuration(3);
  };

  const confirmRollover = () => {
      if (!rolloverTarget) return;
      
      // 這裡體現你的需求：
      // 如果 rolloverInterest 保持為計算出來的值 (如 10)，新本金變 5010 (複利)
      // 如果用戶在 Modal 手動改成 0，新本金維持 5000 (不計複利)
      const newPrincipal = rolloverTarget.principal + Number(rolloverInterest);
      
      const d = new Date(); 
      d.setMonth(d.getMonth() + Number(rolloverDuration));
      const updatedFDs = fds.map(fd => {
          if (fd.id === rolloverTarget.id) {
              return { ...fd, principal: newPrincipal, interestRate: Number(rolloverNewRate), maturityDate: d.toISOString() };
          }
          return fd;
      });
      onUpdate(updatedFDs);
      setRolloverTarget(null);
  };

  const openSettleModal = (fd: any) => {
      const estimatedInt = calculateSimpleInterest(fd.principal, fd.interestRate || 0, 3);
      setSettleTarget(fd);
      setSettleFinalInterest(estimatedInt);
      const defaultAcc = accounts.find(a => a.currency === fd.currency && a.type === 'Cash') || accounts[0];
      setSettleDestId(defaultAcc?.id || '');
  };

  const confirmSettle = () => {
      if (!settleTarget || !settleDestId) return;
      
      // 關鍵邏輯修改：
      // 如果是活期 (Savings)，最終轉入金額 = 僅利息 (例如 10)
      // 如果是定期 (Fixed)，最終轉入金額 = 本金 + 利息 (原本邏輯)
      const finalTransferAmount = settleTarget.type === 'Savings' 
        ? Number(settleFinalInterest) 
        : settleTarget.principal + Number(settleFinalInterest);

      onSettle(settleTarget.id, settleDestId, finalTransferAmount);
      setSettleTarget(null);
  };

  return (
    <div className="p-6 pb-24 relative">
      <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Fixed Deposits</h1>
          <button onClick={() => setIsAdding(!isAdding)} className="bg-gray-100 p-2 rounded-full">
             <Plus className={`w-6 h-6 text-gray-600 transition-transform ${isAdding ? 'rotate-45' : ''}`} />
          </button>
      </div>

      {/* --- ADD NEW FORM --- */}
      {isAdding && (
          <div className="bg-white p-5 rounded-2xl shadow-xl border border-gray-100 mb-6 animate-in slide-in-from-top-4">
              <div className="flex bg-gray-100 p-1 rounded-xl mb-4">
                  <button onClick={() => setNewFD({...newFD, type: 'Fixed'})} className={`flex-1 py-2 text-xs font-bold rounded-lg ${newFD.type === 'Fixed' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}>定期 (外存)</button>
                  <button onClick={() => setNewFD({...newFD, type: 'Savings'})} className={`flex-1 py-2 text-xs font-bold rounded-lg ${newFD.type === 'Savings' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-400'}`}>活期 (戶口內)</button>
              </div>
              <div className="space-y-4">
                  <select className="w-full bg-gray-50 p-3 rounded-xl font-bold" value={newFD.bankName} onChange={(e) => setNewFD({...newFD, bankName: e.target.value})}>
                      {bankOptions.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <div className="flex gap-2">
                      <input type="number" className="flex-1 bg-gray-50 p-3 rounded-xl font-bold" placeholder="Principal" onChange={(e) => setNewFD({...newFD, principal: Number(e.target.value)})} />
                      <select className="w-24 bg-gray-50 p-3 rounded-xl font-bold" value={newFD.currency} onChange={(e) => setNewFD({...newFD, currency: e.target.value as Currency})}>
                          <option value="HKD">HKD</option><option value="AUD">AUD</option><option value="USD">USD</option>
                      </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                      <input type="number" step="0.01" className="bg-gray-50 p-3 rounded-xl font-bold" value={newFD.interestRate} onChange={(e) => setNewFD({...newFD, interestRate: Number(e.target.value)})} />
                      <input type="date" className="bg-gray-50 p-3 rounded-xl" value={newFD.startDate} onChange={(e) => setNewFD({...newFD, startDate: e.target.value})} />
                  </div>
                  <input type="date" className="w-full bg-gray-50 p-3 rounded-xl" onChange={(e) => setNewFD({...newFD, maturityDate: e.target.value})} />
                  
                  <div className={`p-4 rounded-xl border ${newFD.type === 'Savings' ? 'bg-green-50 border-green-100' : 'bg-blue-50 border-blue-100'}`}>
                      <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase">
                          <span>Est. Interest</span>
                          {newFD.type === 'Savings' && <span className="text-green-600 flex items-center font-black"><EyeOff className="w-2 h-2 mr-1"/>不重複計入淨值</span>}
                      </div>
                      <div className="flex justify-between font-black mt-1">
                          <span className="text-green-600">+{estimation.interest.toLocaleString()}</span>
                          <span className="text-blue-700">{newFD.type === 'Savings' ? '利息結算後撥入' : estimation.total.toLocaleString()}</span>
                      </div>
                  </div>
                  <button onClick={handleAdd} className="w-full bg-[#0052CC] text-white font-bold py-3.5 rounded-xl">建立存款紀錄</button>
              </div>
          </div>
      )}

      {/* --- LIST --- */}
      <div className="space-y-4">
          {[...fds].sort((a,b) => new Date(a.maturityDate).getTime() - new Date(b.maturityDate).getTime()).map((fd: any) => {
              const daysLeft = Math.ceil((new Date(fd.maturityDate).getTime() - new Date().setHours(0,0,0,0)) / (1000*3600*24));
              const isMatured = daysLeft <= 0;
              
              return (
                <div key={fd.id} className={`bg-white rounded-2xl border-l-[6px] shadow-sm ${isMatured ? 'border-l-red-500' : (fd.type === 'Savings' ? 'border-l-green-400' : 'border-l-blue-500')}`}>
                    <div className="p-4">
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className="text-xs font-bold text-gray-400">{fd.bankName}</span>
                                    {fd.type === 'Savings' && (
                                        <span className="bg-green-100 text-green-700 text-[9px] px-1.5 py-0.5 rounded font-black flex items-center">
                                            <EyeOff className="w-2 h-2 mr-1"/>內部資金（不計入總額）
                                        </span>
                                    )}
                                </div>
                                <div className="text-xl font-bold text-gray-800">{fd.currency === 'HKD' ? '$' : fd.currency} {fd.principal.toLocaleString()}</div>
                            </div>
                            <div className={`px-2 py-1 rounded text-[10px] font-bold ${isMatured ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                {isMatured ? 'MATURED' : `${daysLeft}d left`}
                            </div>
                        </div>

                        <div className="flex gap-4 text-xs font-bold text-gray-500 mb-4">
                            <span className="flex items-center"><Percent className="w-3 h-3 mr-1" />{fd.interestRate}%</span>
                            <span className="flex items-center"><Clock className="w-3 h-3 mr-1" />{new Date(fd.maturityDate).toLocaleDateString()}</span>
                        </div>

                        <div className="flex gap-2">
                            {isMatured ? (
                                <>
                                    <button onClick={() => openRolloverModal(fd)} className="flex-1 bg-[#0052CC] text-white text-xs font-bold py-3 rounded-xl flex items-center justify-center">
                                        <RefreshCw className="w-3 h-3 mr-1.5" /> Renew
                                    </button>
                                    <button onClick={() => openSettleModal(fd)} className="flex-1 bg-orange-50 border border-orange-100 text-orange-600 text-xs font-bold py-3 rounded-xl flex items-center justify-center">
                                        <Download className="w-3 h-3 mr-1.5" /> {fd.type === 'Savings' ? 'Cash Out Interest' : 'Settle All'}
                                    </button>
                                </>
                            ) : (
                                <button onClick={() => openRolloverModal(fd)} className="flex-1 bg-gray-50 text-gray-600 text-xs font-bold py-3 rounded-xl">
                                    Manage / Edit
                                </button>
                            )}
                            <button onClick={() => onUpdate(fds.filter(f => f.id !== fd.id))} className="w-12 bg-white border border-gray-100 text-gray-400 rounded-xl flex items-center justify-center hover:text-red-500">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
              );
          })}
      </div>

      {/* --- ROLLOVER MODAL --- */}
      {rolloverTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-sm rounded-3xl p-6 relative animate-in zoom-in-95">
                <button onClick={() => setRolloverTarget(null)} className="absolute top-4 right-4 text-gray-400"><X /></button>
                <div className="text-center mb-6">
                    <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-2 text-[#0052CC]"><RefreshCw /></div>
                    <h2 className="text-xl font-bold">續期 / 複利管理</h2>
                    <p className="text-[11px] text-gray-400">若不要複利（本金維持原金額），請將利息設為 0</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl mb-6 space-y-2">
                    <div className="flex justify-between text-sm"><span>現有本金</span><span className="font-bold">${rolloverTarget.principal.toLocaleString()}</span></div>
                    <div className="flex justify-between items-center text-sm text-green-600">
                        <span>加入複利</span>
                        <input type="number" value={rolloverInterest} onChange={(e) => setRolloverInterest(Number(e.target.value))} className="w-20 text-right bg-white border rounded px-1 font-bold outline-none" />
                    </div>
                    <div className="border-t pt-2 flex justify-between font-bold text-[#0052CC]"><span>新一期本金</span><span>${(rolloverTarget.principal + rolloverInterest).toLocaleString()}</span></div>
                </div>
                {/* ...其餘續期欄位... */}
                <div className="space-y-4 mb-6">
                    <input type="number" value={rolloverNewRate} onChange={(e) => setRolloverNewRate(Number(e.target.value))} className="w-full bg-gray-50 p-3 rounded-xl font-bold" placeholder="新利率 %" />
                    <div className="grid grid-cols-4 gap-2">
                        {[1, 3, 6, 12].map(m => (
                            <button key={m} onClick={() => setRolloverDuration(m)} className={`py-2 rounded-lg text-sm font-bold ${rolloverDuration === m ? 'bg-[#0052CC] text-white' : 'bg-gray-50 text-gray-500'}`}>{m}M</button>
                        ))}
                    </div>
                </div>
                <button onClick={confirmRollover} className="w-full bg-[#0052CC] text-white font-bold py-4 rounded-xl shadow-lg">確認續期</button>
            </div>
        </div>
      )}

      {/* --- SETTLE MODAL --- */}
      {settleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-sm rounded-3xl p-6 relative animate-in zoom-in-95">
                <button onClick={() => setSettleTarget(null)} className="absolute top-4 right-4 text-gray-400"><X /></button>
                <div className="text-center mb-6">
                    <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-2 text-orange-500"><Landmark /></div>
                    <h2 className="text-xl font-bold">結算利息</h2>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl mb-4 space-y-2">
                    <div className="flex justify-between text-sm text-gray-400"><span>存款本金 (不變)</span><span>${settleTarget.principal.toLocaleString()}</span></div>
                    <div className="flex justify-between items-center text-sm text-green-600 font-bold">
                        <span>實收利息</span>
                        <input type="number" value={settleFinalInterest} onChange={(e) => setSettleFinalInterest(Number(e.target.value))} className="w-24 text-right bg-white border rounded px-1 outline-none" />
                    </div>
                    <div className="border-t pt-2 flex justify-between font-bold text-orange-600">
                        <span>{settleTarget.type === 'Savings' ? '預計撥入利息' : '總回收金額'}</span>
                        <span>${(settleTarget.type === 'Savings' ? settleFinalInterest : settleTarget.principal + settleFinalInterest).toLocaleString()}</span>
                    </div>
                </div>
                
                <div className={`p-3 rounded-xl text-[11px] mb-6 flex gap-2 ${settleTarget.type === 'Savings' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>
                    <Info className="w-4 h-4 shrink-0" />
                    <span>
                        {settleTarget.type === 'Savings' 
                            ? "活期模式：本金已在銀行戶口內，系統僅將利息部分撥入銀行餘額。" 
                            : "定期模式：本金與利息將全數撥回銀行帳戶餘額。"}
                    </span>
                </div>

                <div className="mb-6">
                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">入賬戶口</label>
                    <select value={settleDestId} onChange={(e) => setSettleDestId(e.target.value)} className="w-full bg-gray-50 p-4 rounded-xl font-bold">
                        {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({acc.currency})</option>)}
                    </select>
                </div>
                <button onClick={confirmSettle} className="w-full bg-orange-500 text-white font-bold py-4 rounded-xl shadow-lg">確認結算利息</button>
            </div>
        </div>
      )}
    </div>
  );
};

export default FDManager;