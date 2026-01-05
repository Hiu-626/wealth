import React, { useState, useMemo } from 'react';
import { Account, FixedDeposit } from '../types';
import { THEME, MOCK_RATES } from '../constants';
import { calculateTotalWealthHKD } from '../services/storageService';
import { CheckCircle, Clock, Settings, Database, Smartphone, Download, X, CloudOff, Building2, TrendingUp, Globe } from 'lucide-react';

interface OverviewProps {
  accounts: Account[];
  fixedDeposits: FixedDeposit[];
  lastUpdated: string;
  onNavigateToFD: () => void;
  onNavigateToUpdate: () => void;
}

const Overview: React.FC<OverviewProps> = ({ 
  accounts, 
  fixedDeposits, 
  lastUpdated, 
  onNavigateToFD,
  onNavigateToUpdate
}) => {
  const [showInAUD, setShowInAUD] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // --- Total Calculation (關鍵修正點) ---
  const totalHKD = useMemo(() => {
    // 核心邏輯：在計算總資產時，必須過濾掉類型為 'Savings' 的存款
    // 因為這筆錢 (例如 A$ 1,000) 實際上還留在 Banking 的餘額裡
    const filteredFDs = fixedDeposits.filter(fd => fd.type !== 'Savings');
    
    // 使用過濾後的列表進行計算，防止 5100 + 1000 = 6100 的錯誤
    return calculateTotalWealthHKD(accounts, filteredFDs);
  }, [accounts, fixedDeposits]);

  const totalAUD = Math.round(totalHKD / MOCK_RATES.AUD);

  const daysSinceUpdate = Math.floor((new Date().getTime() - new Date(lastUpdated).getTime()) / (1000 * 3600 * 24));
  const isStale = daysSinceUpdate > 30;

  // --- Grouping Logic for "Accounts" Section ---
  const assetGroups = useMemo(() => {
    // 1. Banking (Cash)
    const hkBankTotal = accounts
      .filter(a => a.type === 'Cash' && a.currency === 'HKD')
      .reduce((sum, a) => sum + a.balance, 0);

    const auBankTotal = accounts
      .filter(a => a.type === 'Cash' && a.currency === 'AUD')
      .reduce((sum, a) => sum + a.balance, 0);

    // 2. Interactive Brokers (Stocks)
    const hkStockTotal = accounts
      .filter(a => a.type === 'Stock' && a.currency === 'HKD')
      .reduce((sum, a) => sum + a.balance, 0);

    const auStockTotal = accounts
      .filter(a => a.type === 'Stock' && a.currency === 'AUD')
      .reduce((sum, a) => sum + a.balance, 0);

    const usStockTotal = accounts
      .filter(a => a.type === 'Stock' && a.currency === 'USD')
      .reduce((sum, a) => sum + a.balance, 0);

    return {
      banking: { hk: hkBankTotal, au: auBankTotal },
      stocks: { hk: hkStockTotal, au: auStockTotal, us: usStockTotal }
    };
  }, [accounts]);


  // --- FD Logic (Urgent Tasks 依然顯示所有快到期的項目，包含活期) ---
  const urgentFDs = fixedDeposits.filter(fd => {
    const daysLeft = Math.ceil((new Date(fd.maturityDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
    return daysLeft <= 30;
  }).sort((a, b) => new Date(a.maturityDate).getTime() - new Date(b.maturityDate).getTime());

  // --- Export Data Logic ---
  const handleExportCSV = () => {
    const headers = ['Type', 'Name', 'Currency', 'Balance/Principal', 'Symbol/Bank', 'Maturity'];
    const accRows = accounts.map(a => [a.type, a.name, a.currency, a.balance, a.symbol || '', '']);
    const fdRows = fixedDeposits.map(f => ['FixedDeposit', f.bankName, f.currency, f.principal, '', f.maturityDate]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
        + [headers.join(','), ...accRows.map(e => e.join(',')), ...fdRows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `wealth_snapshot_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  return (
    <div className="p-6 space-y-6 pb-24 relative">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
           <h1 className="text-2xl font-bold text-gray-800 tracking-tight">WealthSnapshot</h1>
           <div className={`text-xs font-medium ${isStale ? 'text-red-500' : 'text-gray-400'}`}>
             {isStale ? 'Update needed!' : `Updated ${daysSinceUpdate}d ago`}
           </div>
        </div>
        <button 
          onClick={() => setShowSettings(true)}
          className="p-2 bg-white rounded-full shadow-sm border border-gray-100 text-gray-400 hover:text-[#0052CC] active:scale-95 transition-all"
        >
            <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Total Wealth Card (現在會正確顯示 $5,100 而非 $6,100) */}
      <div 
        className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 active:scale-95 transition-transform cursor-pointer"
        onClick={() => setShowInAUD(!showInAUD)}
      >
        <p className="text-gray-500 text-sm font-medium mb-1">Total Net Worth</p>
        <div className="flex items-baseline space-x-2">
          <span className="text-4xl font-bold text-[#0052CC] font-roboto">
            {showInAUD ? '$' + totalAUD.toLocaleString() : '$' + totalHKD.toLocaleString()}
          </span>
          <span className="text-gray-400 font-medium">{showInAUD ? 'AUD' : 'HKD'}</span>
        </div>
        <div className="mt-4 flex items-center text-xs text-gray-400">
           Tap to switch currency
        </div>
      </div>

      {/* Urgent Tasks */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-bold text-gray-800">Urgent Tasks</h2>
          <button onClick={onNavigateToFD} className="text-sm text-[#0052CC] font-medium">Manage FDs</button>
        </div>

        {urgentFDs.length === 0 ? (
          <div className="bg-green-50 rounded-xl p-4 border border-green-100 flex items-center text-green-700">
            <CheckCircle className="w-5 h-5 mr-3" />
            <span className="text-sm font-medium">All fixed deposits are secure.</span>
          </div>
        ) : (
          <div className="space-y-3">
            {urgentFDs.map(fd => {
              const daysLeft = Math.ceil((new Date(fd.maturityDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
              const isCritical = daysLeft <= 7;
              
              return (
                <div 
                  key={fd.id}
                  className={`relative rounded-xl p-4 border-l-4 shadow-sm flex justify-between items-center bg-white ${
                    isCritical ? 'border-l-[#FF5252]' : 'border-l-[#FFC107]'
                  }`}
                >
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                        <h3 className="font-bold text-gray-800">{fd.bankName}</h3>
                        {fd.type === 'Savings' && <span className="text-[9px] bg-amber-100 text-amber-600 px-1 rounded font-black">SAVINGS</span>}
                        {isCritical && <span className="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded-full font-bold">EXPIRING</span>}
                    </div>
                    <p className="text-gray-500 text-sm font-roboto">
                      {fd.currency} {fd.principal.toLocaleString()}
                    </p>
                    <div className="flex items-center mt-2 text-xs text-gray-400">
                        <Clock className="w-3 h-3 mr-1" />
                        Due in {daysLeft} days
                    </div>
                  </div>
                  
                  <button 
                    onClick={onNavigateToFD}
                    className={`px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors ${
                        isCritical ? 'bg-[#FF5252] text-white' : 'bg-yellow-50 text-yellow-700'
                    }`}
                  >
                    Action
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* --- NEW ACCOUNTS SUMMARY --- */}
      <div className="space-y-6">
        
        {/* Banking Section */}
        <div>
           <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
             <Building2 className="w-4 h-4 mr-2 text-gray-400" /> Banking
           </h2>
           <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
               {/* HK Banks */}
               <div className="p-4 flex justify-between items-center">
                   <div className="flex items-center">
                       <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-lg mr-3">🇭🇰</div>
                       <div>
                           <div className="font-bold text-gray-700">HK Banks</div>
                           <div className="text-xs text-gray-400">Total Liquid Cash</div>
                       </div>
                   </div>
                   <div className="text-right">
                       <div className="font-bold text-gray-800 font-roboto text-lg">
                           ${assetGroups.banking.hk.toLocaleString()}
                       </div>
                       <div className="text-[10px] font-bold text-gray-400">HKD</div>
                   </div>
               </div>
               
               <div className="h-px bg-gray-50 mx-4" />

               {/* AU Banks */}
               <div className="p-4 flex justify-between items-center">
                   <div className="flex items-center">
                       <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-lg mr-3">🇦🇺</div>
                       <div>
                           <div className="font-bold text-gray-700">AU Banks</div>
                           <div className="text-xs text-gray-400">Total Liquid Cash</div>
                       </div>
                   </div>
                   <div className="text-right">
                       <div className="font-bold text-gray-800 font-roboto text-lg">
                           A$ {assetGroups.banking.au.toLocaleString()}
                       </div>
                       <div className="text-[10px] font-bold text-gray-400">AUD</div>
                   </div>
               </div>
           </div>
        </div>

        {/* Interactive Brokers / Investments Section */}
        <div>
           <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
             <TrendingUp className="w-4 h-4 mr-2 text-gray-400" /> Interactive Brokers
           </h2>
           <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
               
               {/* HK Stocks */}
               <div className="p-4 flex justify-between items-center">
                   <div className="flex items-center">
                       <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 mr-3">
                           <Building2 className="w-4 h-4" />
                       </div>
                       <div>
                           <div className="font-bold text-gray-700">HK Stocks</div>
                           <div className="text-xs text-gray-400">HKEX Holdings</div>
                       </div>
                   </div>
                   <div className="text-right">
                       <div className="font-bold text-gray-800 font-roboto text-lg">
                           ${assetGroups.stocks.hk.toLocaleString()}
                       </div>
                       <div className="text-[10px] font-bold text-gray-400">HKD</div>
                   </div>
               </div>

               <div className="h-px bg-gray-50 mx-4" />

               {/* AU Stocks */}
               <div className="p-4 flex justify-between items-center">
                   <div className="flex items-center">
                       <div className="w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center text-teal-500 mr-3">
                           <Globe className="w-4 h-4" />
                       </div>
                       <div>
                           <div className="font-bold text-gray-700">AU Stocks</div>
                           <div className="text-xs text-gray-400">ASX Holdings</div>
                       </div>
                   </div>
                   <div className="text-right">
                       <div className="font-bold text-gray-800 font-roboto text-lg">
                           A$ {assetGroups.stocks.au.toLocaleString()}
                       </div>
                       <div className="text-[10px] font-bold text-gray-400">AUD</div>
                   </div>
               </div>

               {/* US Stocks (Conditional) */}
               {assetGroups.stocks.us > 0 && (
                 <>
                   <div className="h-px bg-gray-50 mx-4" />
                   <div className="p-4 flex justify-between items-center">
                       <div className="flex items-center">
                           <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-500 mr-3">
                               <Globe className="w-4 h-4" />
                           </div>
                           <div>
                               <div className="font-bold text-gray-700">US Stocks</div>
                               <div className="text-xs text-gray-400">NYSE/NASDAQ</div>
                           </div>
                       </div>
                       <div className="text-right">
                           <div className="font-bold text-gray-800 font-roboto text-lg">
                               US$ {assetGroups.stocks.us.toLocaleString()}
                           </div>
                           <div className="text-[10px] font-bold text-gray-400">USD</div>
                       </div>
                   </div>
                 </>
               )}
           </div>

           <button onClick={onNavigateToUpdate} className="w-full text-center text-sm text-[#0052CC] font-bold py-4 mt-2 hover:bg-gray-50 rounded-xl transition-colors">
                Update Balances
           </button>
        </div>

      </div>

      {/* --- SETTINGS / SYSTEM STATUS MODAL --- */}
      {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setShowSettings(false)} />
              
              <div className="bg-white w-full max-w-sm rounded-3xl p-6 relative z-10 animate-in zoom-in-95 duration-200 shadow-2xl">
                  <button onClick={() => setShowSettings(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                      <X className="w-6 h-6" />
                  </button>

                  <h2 className="text-xl font-bold text-gray-800 mb-6">System Status</h2>
                  
                  <div className="space-y-4">
                      {/* PWA Status */}
                      <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl">
                          <div className="flex items-center">
                              <div className="w-10 h-10 bg-blue-100 text-[#0052CC] rounded-full flex items-center justify-center mr-3">
                                  <Smartphone className="w-5 h-5" />
                              </div>
                              <div>
                                  <div className="font-bold text-gray-800 text-sm">Application</div>
                                  <div className="text-xs text-green-600 font-bold flex items-center">
                                      <CheckCircle className="w-3 h-3 mr-1" /> PWA Ready
                                  </div>
                              </div>
                          </div>
                          <div className="text-[10px] bg-blue-100 text-[#0052CC] px-2 py-1 rounded font-bold">
                              v1.1.0
                          </div>
                      </div>

                      {/* Database Status */}
                      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                          <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex justify-between items-center">
                              <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Database Connection</span>
                          </div>
                          
                          {/* Local Storage (Active) */}
                          <div className="p-4 flex items-center justify-between border-b border-gray-50">
                              <div className="flex items-center">
                                  <Database className="w-4 h-4 text-gray-400 mr-3" />
                                  <span className="text-sm font-bold text-gray-700">Local Device</span>
                              </div>
                              <span className="flex items-center text-xs text-green-600 font-bold">
                                  <span className="w-2 h-2 bg-green-500 rounded-full mr-1.5 animate-pulse"></span>
                                  Active
                              </span>
                          </div>

                          {/* Google Sheets (Pending) */}
                          <div className="p-4 flex items-center justify-between bg-gray-50/50">
                              <div className="flex items-center opacity-50">
                                  <CloudOff className="w-4 h-4 text-gray-400 mr-3" />
                                  <span className="text-sm font-bold text-gray-700">Google Sheets</span>
                              </div>
                              <span className="text-xs text-orange-500 font-bold bg-orange-50 px-2 py-1 rounded">
                                  Coming Soon
                              </span>
                          </div>
                      </div>

                      {/* Export Actions */}
                      <div className="pt-2">
                           <button 
                             onClick={handleExportCSV}
                             className="w-full flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl transition-colors text-sm"
                           >
                               <Download className="w-4 h-4 mr-2" />
                               Export Data to CSV
                           </button>
                           <p className="text-[10px] text-center text-gray-400 mt-2">
                               Manual backup until cloud sync is enabled.
                           </p>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Overview;