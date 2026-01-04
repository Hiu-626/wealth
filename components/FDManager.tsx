import React, { useState, useMemo } from 'react';
import { FixedDeposit, Currency, Account } from '../types';
import { Plus, Trash2, Calendar, RefreshCw, ArrowRightLeft, Percent, TrendingUp, AlertCircle, X, Check, Clock, Download, Landmark, Wallet, Calculator } from 'lucide-react';

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
  
  const [newFD, setNewFD] = useState<Partial<FixedDeposit & { startDate: string }>>({
    bankName: 'HSBC',
    currency: 'HKD',
    actionOnMaturity: 'Renew',
    autoRoll: true,
    interestRate: 4.0,
    startDate: new Date().toISOString().split('T')[0]
  });

  const estimation = useMemo(() => {
    const principal = Number(newFD.principal) || 0;
    const rate = Number(newFD.interestRate) || 0;
    
    if (!newFD.startDate || !newFD.maturityDate || principal <= 0) {
        return { interest: 0, total: principal, days: 0 };
    }

    const start = new Date(newFD.startDate);
    start.setHours(0,0,0,0);
    const maturity = new Date(newFD.maturityDate);
    maturity.setHours(0,0,0,0);

    const diffTime = maturity.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return { interest: 0, total: principal, days: 0 };

    const interest = Math.round(principal * (rate / 100) * (diffDays / 365));

    return {
        interest,
        total: principal + interest,
        days: diffDays
    };
  }, [newFD.principal, newFD.interestRate, newFD.startDate, newFD.maturityDate]);

  const [rolloverTarget, setRolloverTarget] = useState<FixedDeposit | null>(null);
  const [rolloverInterest, setRolloverInterest] = useState<number>(0);
  const [rolloverNewRate, setRolloverNewRate] = useState<number>(4.0);
  const [rolloverDuration, setRolloverDuration] = useState<number>(3);

  const [settleTarget, setSettleTarget] = useState<FixedDeposit | null>(null);
  const [settleFinalInterest, setSettleFinalInterest] = useState<number>(0);
  const [settleDestId, setSettleDestId] = useState<string>('');

  const BANKS = ['HSBC', 'Standard Chartered', 'BOC', 'Hang Seng', 'Citibank', 'Mox', 'ZA Bank', 'CommSec'];

  const handleAdd = () => {
    if (!newFD.principal || !newFD.maturityDate) return;
    const fd: FixedDeposit = {
        id: Date.now().toString(),
        bankName: newFD.bankName || 'Other',
        principal: Number(newFD.principal),
        currency: newFD.currency as Currency,
        maturityDate: newFD.maturityDate,
        actionOnMaturity: newFD.actionOnMaturity as 'Renew' | 'Transfer Out',
        interestRate: Number(newFD.interestRate),
        autoRoll: newFD.autoRoll || false
    };
    onUpdate([...fds, fd]);
    setIsAdding(false);
    setNewFD({ 
        bankName: 'HSBC', 
        currency: 'HKD', 
        actionOnMaturity: 'Renew', 
        autoRoll: true, 
        interestRate: 4.0,
        startDate: new Date().toISOString().split('T')[0]
    });
  };

  const openRolloverModal = (fd: FixedDeposit) => {
      const estimatedInt = calculateSimpleInterest(fd.principal, fd.interestRate || 0, 3);
      setRolloverTarget(fd);
      setRolloverInterest(estimatedInt);
      setRolloverNewRate(fd.interestRate || 4.0);
      setRolloverDuration(3);
  };

  const confirmRollover = () => {
      if (!rolloverTarget) return;
      const newPrincipal = rolloverTarget.principal + Number(rolloverInterest);
      const d = new Date(); 
      d.setMonth(d.getMonth() + Number(rolloverDuration));
      const updatedFDs = fds.map(fd => {
          if (fd.id === rolloverTarget.id) {
              return {
                  ...fd,
                  principal: newPrincipal,
                  interestRate: Number(rolloverNewRate),
                  maturityDate: d.toISOString(),
                  autoRoll: true 
              };
          }
          return fd;
      });
      onUpdate(updatedFDs);
      setRolloverTarget(null);
  };

  const openSettleModal = (fd: FixedDeposit) => {
      const estimatedInt = calculateSimpleInterest(fd.principal, fd.interestRate || 0, 3);
      setSettleTarget(fd);
      setSettleFinalInterest(estimatedInt);
      const defaultAcc = accounts.find(a => a.currency === fd.currency && a.type === 'Cash') || accounts[0];
      setSettleDestId(defaultAcc?.id || '');
  };

  const confirmSettle = () => {
      if (!settleTarget || !settleDestId) return;
      const finalAmount = settleTarget.principal + Number(settleFinalInterest);
      onSettle(settleTarget.id, settleDestId, finalAmount);
      setSettleTarget(null);
  };

  const sortedFDs = [...fds].sort((a, b) => new Date(a.maturityDate).getTime() - new Date(b.maturityDate).getTime());

  return (
    <div className="p-6 pb-24 relative">
      <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Fixed Deposits</h1>
          <button onClick={() => setIsAdding(!isAdding)} className="bg-gray-100 p-2 rounded-full hover:bg-gray-200">
              <Plus className={`w-6 h-6 text-gray-600 transition-transform ${isAdding ? 'rotate-45' : ''}`} />
          </button>
      </div>

      {/* --- ADD NEW FORM --- */}
      {isAdding && (
          <div className="bg-white p-5 rounded-2xl shadow-xl border border-gray-100 mb-6 animate-in slide-in-from-top-4 fade-in">
              <h3 className="font-bold text-gray-700 mb-4 flex items-center">
                  <Plus className="w-4 h-4 mr-2 text-[#0052CC]" /> New Deposit Setup
              </h3>
              
              <div className="space-y-4">
                  <div>
                      <label className="text-xs font-bold text-gray-400 uppercase">Bank / Institution</label>
                      <select 
                        className="w-full bg-gray-50 p-3 rounded-xl mt-1 font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-100"
                        value={newFD.bankName}
                        onChange={(e) => setNewFD({...newFD, bankName: e.target.value})}
                      >
                          {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                  </div>

                  <div className="flex space-x-3">
                     <div className="flex-1">
                        <label className="text-xs font-bold text-gray-400 uppercase">Principal</label>
                        <input 
                            type="number" 
                            className="w-full bg-gray-50 p-3 rounded-xl mt-1 font-roboto font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-100"
                            placeholder="100000"
                            onChange={(e) => setNewFD({...newFD, principal: Number(e.target.value)})}
                        />
                     </div>
                     <div className="w-24">
                        <label className="text-xs font-bold text-gray-400 uppercase">Currency</label>
                        <select 
                            className="w-full bg-gray-50 p-3 rounded-xl mt-1 font-bold text-gray-700 outline-none"
                            value={newFD.currency}
                            onChange={(e) => setNewFD({...newFD, currency: e.target.value as Currency})}
                        >
                            <option value="HKD">HKD</option>
                            <option value="AUD">AUD</option>
                            <option value="USD">USD</option>
                        </select>
                     </div>
                  </div>

                  {/* 優化後的日期與利率佈局 */}
                  <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-gray-400 uppercase">Rate (%)</label>
                        <input 
                            type="number" 
                            step="0.01"
                            className="w-full bg-gray-50 p-3 rounded-xl mt-1 font-roboto font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-100"
                            placeholder="4.0"
                            value={newFD.interestRate}
                            onChange={(e) => setNewFD({...newFD, interestRate: Number(e.target.value)})}
                        />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-gray-400 uppercase">Start Date</label>
                          <input 
                            type="date" 
                            className="w-full bg-gray-50 p-3 rounded-xl mt-1 font-medium text-gray-700 outline-none focus:ring-2 focus:ring-blue-100"
                            value={newFD.startDate}
                            onChange={(e) => setNewFD({...newFD, startDate: e.target.value})}
                          />
                      </div>
                  </div>

                  <div>
                      <label className="text-xs font-bold text-gray-400 uppercase">Maturity Date</label>
                      <input 
                        type="date" 
                        className="w-full bg-gray-50 p-3 rounded-xl mt-1 font-medium text-gray-700 outline-none focus:ring-2 focus:ring-blue-100"
                        onChange={(e) => setNewFD({...newFD, maturityDate: e.target.value})}
                      />
                  </div>

                  {/* --- Live Interest Calculation --- */}
                  <div className="bg-gradient-to-br from-gray-50 to-blue-50/50 p-4 rounded-xl border border-blue-100 relative overflow-hidden">
                      <div className="flex justify-between items-center mb-1">
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center">
                              <Calculator className="w-3 h-3 mr-1" /> Est. Interest ({estimation.days} days)
                          </div>
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Maturity</div>
                      </div>
                      <div className="flex justify-between items-end">
                          <div className="text-xl font-black text-green-600 flex items-center">
                              +{estimation.interest.toLocaleString()}
                              <span className="text-[10px] font-bold text-green-400 ml-1">{newFD.currency}</span>
                          </div>
                          <div className="text-xl font-black text-blue-700 flex items-center">
                              {estimation.total.toLocaleString()}
                              <span className="text-[10px] font-bold text-blue-400 ml-1">{newFD.currency}</span>
                          </div>
                      </div>
                  </div>

                  <div className="bg-gray-50 p-3 rounded-xl flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-400 uppercase">Action</span>
                      <div className="flex bg-gray-200 rounded-lg p-1">
                          <button 
                            onClick={() => setNewFD({...newFD, actionOnMaturity: 'Renew'})}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${newFD.actionOnMaturity === 'Renew' ? 'bg-white text-[#0052CC] shadow-sm' : 'text-gray-500'}`}
                          >
                              Renew
                          </button>
                          <button 
                             onClick={() => setNewFD({...newFD, actionOnMaturity: 'Transfer Out'})}
                             className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${newFD.actionOnMaturity === 'Transfer Out' ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-500'}`}
                          >
                              Transfer
                          </button>
                      </div>
                  </div>

                  <button 
                    onClick={handleAdd}
                    className="w-full bg-[#0052CC] text-white font-bold py-3.5 rounded-xl shadow-lg active:scale-95 transition-transform mt-2"
                  >
                      Create Snapshot
                  </button>
              </div>
          </div>
      )}

      {/* --- LIST --- */}
      <div className="space-y-4">
          {sortedFDs.map(fd => {
              const today = new Date();
              today.setHours(0,0,0,0);
              const matDate = new Date(fd.maturityDate);
              matDate.setHours(0,0,0,0);

              const daysLeft = Math.ceil((matDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
              const isMatured = daysLeft <= 0;
              const isUrgent = daysLeft <= 30 && !isMatured;
              
              let statusColor = "bg-green-100 text-green-700";
              let statusText = `${daysLeft} days left`;
              
              if (isMatured) {
                  statusColor = "bg-[#FF5252] text-white";
                  statusText = "MATURED";
              } else if (isUrgent) {
                  statusColor = "bg-[#FFC107] text-yellow-800";
                  statusText = `${daysLeft} days left`;
              }

              return (
                <div key={fd.id} className={`bg-white rounded-2xl border-l-[6px] shadow-sm relative overflow-visible transition-transform ${isMatured ? 'border-l-[#FF5252] ring-2 ring-red-50' : (isUrgent ? 'border-l-[#FFC107]' : 'border-l-[#4CAF50]')}`}>
                    <div className="p-4">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <div className="text-xs font-bold text-gray-400 mb-0.5">{fd.bankName}</div>
                                <div className="text-xl font-roboto font-bold text-gray-800">
                                    {fd.currency === 'HKD' ? '$' : fd.currency} {fd.principal.toLocaleString()}
                                </div>
                            </div>
                            <div className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${statusColor}`}>
                                {statusText}
                            </div>
                        </div>

                        <div className="flex items-center space-x-4 text-xs font-medium text-gray-500 mb-4">
                            <div className="flex items-center">
                                <Percent className="w-3 h-3 mr-1 text-gray-400" />
                                {fd.interestRate}% p.a.
                            </div>
                            <div className="flex items-center">
                                <Clock className="w-3 h-3 mr-1 text-gray-400" />
                                {new Date(fd.maturityDate).toLocaleDateString()}
                            </div>
                        </div>

                        <div className="flex space-x-2">
                            {isMatured ? (
                                <>
                                  <button 
                                    onClick={() => openRolloverModal(fd)}
                                    className="flex-1 bg-[#0052CC] text-white text-xs font-bold py-3 rounded-xl flex items-center justify-center shadow-md active:scale-95 transition-transform"
                                  >
                                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                                      Renew
                                  </button>
                                  <button 
                                    onClick={() => openSettleModal(fd)}
                                    className="flex-1 bg-white border-2 border-orange-100 text-orange-600 text-xs font-bold py-3 rounded-xl flex items-center justify-center shadow-sm hover:bg-orange-50 active:scale-95 transition-all"
                                  >
                                      <Download className="w-3.5 h-3.5 mr-1.5" />
                                      Cash Out
                                  </button>
                                </>
                            ) : (
                                <button 
                                  onClick={() => openRolloverModal(fd)}
                                  className="flex-1 bg-gray-50 text-gray-600 text-xs font-bold py-3 rounded-xl hover:bg-gray-100 transition-colors"
                                >
                                    Manage / Renew
                                </button>
                            )}
                            
                            <button 
                                onClick={() => onUpdate(fds.filter(f => f.id !== fd.id))}
                                className="w-12 bg-white border border-gray-100 text-gray-400 rounded-xl flex items-center justify-center hover:text-red-500 hover:border-red-100 transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
              );
          })}
      </div>

      {/* --- ROLLOVER CONFIRMATION MODAL --- */}
      {rolloverTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setRolloverTarget(null)} />
            
            <div className="bg-white w-full max-w-sm rounded-3xl p-6 relative z-10 animate-in zoom-in-95 duration-200 shadow-2xl">
                <button onClick={() => setRolloverTarget(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                    <X className="w-6 h-6" />
                </button>

                <div className="text-center mb-6">
                    <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3 text-[#0052CC]">
                        <RefreshCw className="w-6 h-6" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800">Rollover & Compound</h2>
                    <p className="text-xs text-gray-400 mt-1">Reinvesting your capital plus interest.</p>
                </div>

                <div className="bg-gray-50 rounded-2xl p-4 space-y-3 mb-6 border border-gray-100">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Principal</span>
                        <span className="font-bold text-gray-800">${rolloverTarget.principal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 flex items-center"><Plus className="w-3 h-3 mr-1"/> Interest Earned</span>
                        <div className="flex items-center bg-white border border-green-200 rounded px-2 py-0.5">
                            <span className="text-green-600 font-bold mr-1">$</span>
                            <input 
                                type="number" 
                                value={rolloverInterest}
                                onChange={(e) => setRolloverInterest(Number(e.target.value))}
                                className="w-16 text-right font-bold text-green-600 outline-none text-sm"
                            />
                        </div>
                    </div>
                    <div className="h-px bg-gray-200 w-full" />
                    <div className="flex justify-between items-center text-lg">
                        <span className="font-bold text-[#0052CC]">New Principal</span>
                        <span className="font-bold text-[#0052CC] font-roboto">
                            ${(rolloverTarget.principal + Number(rolloverInterest)).toLocaleString()}
                        </span>
                    </div>
                </div>

                <div className="space-y-4 mb-6">
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Confirm New Rate (%)</label>
                        <div className="relative">
                            <input 
                                type="number" 
                                value={rolloverNewRate}
                                onChange={(e) => setRolloverNewRate(Number(e.target.value))}
                                className="w-full bg-gray-50 p-3 rounded-xl font-bold text-gray-800 outline-none focus:ring-2 focus:ring-[#0052CC]" 
                            />
                            <Percent className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Duration</label>
                        <div className="grid grid-cols-4 gap-2">
                            {[1, 3, 6, 12].map(m => (
                                <button
                                  key={m}
                                  onClick={() => setRolloverDuration(m)}
                                  className={`py-2 rounded-lg text-sm font-bold transition-all ${rolloverDuration === m ? 'bg-[#0052CC] text-white shadow-md' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                                >
                                    {m}M
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <button 
                  onClick={confirmRollover}
                  className="w-full bg-[#0052CC] text-white font-bold py-4 rounded-xl shadow-xl shadow-blue-200 active:scale-95 transition-all flex items-center justify-center"
                >
                    <Check className="w-5 h-5 mr-2" />
                    Confirm & Renew
                </button>
            </div>
        </div>
      )}

      {/* --- SETTLE (CASH OUT) MODAL --- */}
      {settleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setSettleTarget(null)} />
            
            <div className="bg-white w-full max-w-sm rounded-3xl p-6 relative z-10 animate-in zoom-in-95 duration-200 shadow-2xl">
                <button onClick={() => setSettleTarget(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                    <X className="w-6 h-6" />
                </button>

                <div className="text-center mb-6">
                    <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-3 text-orange-500">
                        <Landmark className="w-6 h-6" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800">Maturity Settlement</h2>
                    <p className="text-xs text-gray-400 mt-1">Funds will be released to your account.</p>
                </div>

                <div className="bg-gray-50 rounded-2xl p-4 space-y-3 mb-6 border border-gray-100">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Principal</span>
                        <span className="font-bold text-gray-800">${settleTarget.principal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 flex items-center"><Plus className="w-3 h-3 mr-1"/> Interest (Final)</span>
                        <div className="flex items-center bg-white border border-green-200 rounded px-2 py-0.5">
                            <span className="text-green-600 font-bold mr-1">$</span>
                            <input 
                                type="number" 
                                value={settleFinalInterest}
                                onChange={(e) => setSettleFinalInterest(Number(e.target.value))}
                                className="w-20 text-right font-bold text-green-600 outline-none text-sm"
                            />
                        </div>
                    </div>
                    <div className="h-px bg-gray-200 w-full" />
                    <div className="flex justify-between items-center text-lg">
                        <span className="font-bold text-orange-600">Total to Deposit</span>
                        <span className="font-bold text-orange-600 font-roboto">
                            ${(settleTarget.principal + Number(settleFinalInterest)).toLocaleString()}
                        </span>
                    </div>
                </div>

                <div className="mb-6">
                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Deposit To</label>
                    <select 
                      value={settleDestId}
                      onChange={(e) => setSettleDestId(e.target.value)}
                      className="w-full bg-gray-50 p-4 rounded-xl font-bold text-gray-800 outline-none focus:ring-2 focus:ring-orange-100"
                    >
                        {accounts.map(acc => (
                            <option key={acc.id} value={acc.id}>
                                {acc.name} ({acc.currency} {acc.type})
                            </option>
                        ))}
                    </select>
                    {settleDestId && (() => {
                        const sel = accounts.find(a => a.id === settleDestId);
                        return sel && sel.currency !== settleTarget.currency ? (
                            <div className="flex items-center text-xs text-orange-500 mt-2 font-medium">
                                <AlertCircle className="w-3 h-3 mr-1" /> Currency mismatch ({settleTarget.currency} to {sel.currency})
                            </div>
                        ) : null;
                    })()}
                </div>

                <button 
                  onClick={confirmSettle}
                  className="w-full bg-orange-500 text-white font-bold py-4 rounded-xl shadow-xl shadow-orange-200 active:scale-95 transition-all flex items-center justify-center hover:bg-orange-600"
                >
                    <Check className="w-5 h-5 mr-2" />
                    Confirm Transfer
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default FDManager;