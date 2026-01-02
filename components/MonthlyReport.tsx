import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { Account, FixedDeposit, HistoricalDataPoint } from '../types';
import { MOCK_RATES } from '../constants';
import { Download, X, TrendingUp, TrendingDown, Coffee, Globe, AlertTriangle, ArrowRight, CheckCircle, Loader2, PartyPopper } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Cell, Pie, PieChart } from 'recharts';

interface MonthlyReportProps {
  accounts: Account[];
  fixedDeposits: FixedDeposit[];
  history: HistoricalDataPoint[];
  wealthGoal: number;
  onClose: () => void;
  onNavigateToFD: () => void;
}

const MonthlyReport: React.FC<MonthlyReportProps> = ({ 
  accounts, fixedDeposits, history, wealthGoal, onClose, onNavigateToFD 
}) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // --- Helper Functions ---
  const toHKD = (amount: number, currency: string) => {
    if (currency === 'HKD') return amount;
    if (currency === 'AUD') return amount * MOCK_RATES.AUD;
    if (currency === 'USD') return amount * MOCK_RATES.USD;
    return amount;
  };

  // --- Data Calculations ---
  
  // 1. Wealth & Change
  const currentMonthData = history[history.length - 1] || { totalValueHKD: 0 };
  const prevMonthData = history.length > 1 ? history[history.length - 2] : { totalValueHKD: currentMonthData.totalValueHKD }; // Fallback to current if no history
  
  const currentNetWorth = currentMonthData.totalValueHKD;
  const netChange = currentNetWorth - prevMonthData.totalValueHKD;
  const isPositive = netChange >= 0;

  // 2. Passive Income (Estimated from FDs)
  const monthlyPassiveIncome = fixedDeposits.reduce((sum, fd) => {
      const rate = fd.interestRate || 0;
      const principalHKD = toHKD(fd.principal, fd.currency);
      return sum + (principalHKD * (rate / 100) / 12);
  }, 0);
  
  const lunchCount = Math.floor(monthlyPassiveIncome / 60);

  // 3. Detect CLEARED Stocks (Qty = 0)
  const soldStocks = accounts.filter(a => a.type === 'Stock' && (a.quantity || 0) === 0);

  // 4. Geo Distribution
  let hkdAssets = 0;
  let audAssets = 0;
  accounts.forEach(acc => {
      const val = toHKD(acc.balance, acc.currency);
      if (acc.currency === 'HKD') hkdAssets += val;
      else audAssets += val;
  });
  fixedDeposits.forEach(fd => {
      const val = toHKD(fd.principal, fd.currency);
      if (fd.currency === 'HKD') hkdAssets += val;
      else audAssets += val;
  });
  const totalAssets = hkdAssets + audAssets;
  const audPercentage = Math.round((audAssets / totalAssets) * 100);

  // 5. Cash Ratio Warning
  let totalCash = 0;
  accounts.filter(a => a.type === 'Cash').forEach(a => totalCash += toHKD(a.balance, a.currency));
  const cashRatio = totalCash / totalAssets;
  const showCashWarning = cashRatio > 0.4;

  // 6. Goal Projection
  const remaining = wealthGoal - currentNetWorth;
  let avgGrowth = 0;
  if (history.length >= 2) {
     const months = Math.min(history.length - 1, 3);
     const startVal = history[history.length - 1 - months].totalValueHKD;
     avgGrowth = (currentNetWorth - startVal) / months;
  }
  const projectedMonths = avgGrowth > 0 ? Math.ceil(remaining / avgGrowth) : null;


  // --- Handlers ---
  const handleDownload = async () => {
    if (!reportRef.current) return;
    setIsDownloading(true);
    try {
        const canvas = await html2canvas(reportRef.current, { 
            scale: 2, // Retina quality
            useCORS: true,
            backgroundColor: '#F8F9FA'
        });
        const image = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = image;
        link.download = `WealthSnapshot_${new Date().toISOString().slice(0, 10)}.png`;
        link.click();
    } catch (e) {
        console.error("Download failed", e);
    } finally {
        setIsDownloading(false);
    }
  };

  const currentDateStr = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Chart Data (Last 6 months)
  const chartData = history.slice(-6);

  // Asset Mix Data for Pie
  const pieData = [
      { name: 'HK Assets', value: hkdAssets, color: '#0052CC' },
      { name: 'AU/US Assets', value: audAssets, color: '#00B8D9' }
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-100/90 backdrop-blur-md pb-10">
      {/* Navbar for Modal */}
      <div className="sticky top-0 z-50 flex justify-between items-center p-4 bg-white/80 backdrop-blur-md border-b border-gray-200 max-w-md mx-auto">
        <button onClick={onClose} className="p-2 -ml-2 text-gray-500 hover:text-gray-800">
            <X className="w-6 h-6" />
        </button>
        <span className="font-bold text-gray-800">Monthly Report</span>
        <button onClick={handleDownload} disabled={isDownloading} className="p-2 -mr-2 text-[#0052CC] font-bold disabled:opacity-50">
            {isDownloading ? <Loader2 className="w-5 h-5 animate-spin"/> : <Download className="w-5 h-5" />}
        </button>
      </div>

      {/* --- REPORT CONTENT START --- */}
      <div className="max-w-md mx-auto p-4 space-y-6" ref={reportRef}>
          
          {/* SECTION A: HERO */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-[#0052CC]" />
              <div className="uppercase tracking-widest text-[10px] font-bold text-gray-400 mb-2">{currentDateStr} REPORT</div>
              <div className="text-4xl font-bold text-gray-800 font-roboto mb-2">
                  ${currentNetWorth.toLocaleString()}
              </div>
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${isPositive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {isPositive ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                  {isPositive ? '+' : ''}${netChange.toLocaleString()} ({isPositive ? '+' : ''}{((netChange / (prevMonthData.totalValueHKD || 1)) * 100).toFixed(1)}%)
              </div>
              
              <div className="mt-6 pt-6 border-t border-gray-100 text-sm font-medium text-gray-600 italic">
                  {isPositive 
                    ? "✨ Small steps lead to big destinations. Your assets outpaced inflation this month!" 
                    : "📉 Markets fluctuate, but your strategy remains solid. Keep holding."}
              </div>
          </div>

          {/* SECTION E: PORTFOLIO MOVES (The Celebration) */}
          {soldStocks.length > 0 && (
             <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-3xl p-6 border border-green-100 relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-4 opacity-10">
                     <PartyPopper className="w-24 h-24 text-green-500" />
                 </div>
                 <h3 className="text-xs font-bold text-green-700 uppercase tracking-wide mb-3 flex items-center">
                     <CheckCircle className="w-4 h-4 mr-1.5" /> Portfolio Moves
                 </h3>
                 <div className="text-sm text-gray-700 mb-4">
                     🎉 <span className="font-bold">Successfully Cashed Out!</span> You cleared positions in <span className="font-bold text-gray-900">{soldStocks.map(s => s.symbol?.split('.')[0]).join(', ')}</span>.
                 </div>
                 
                 {/* Visual Flow */}
                 <div className="bg-white/60 rounded-xl p-3 flex items-center justify-between">
                     <div className="flex flex-col items-center">
                         <div className="bg-gray-200 text-gray-500 font-bold text-xs px-2 py-1 rounded mb-1">{soldStocks[0].symbol?.split('.')[0]}</div>
                         <div className="text-[9px] text-gray-400 uppercase">Stock</div>
                     </div>
                     <div className="flex-1 border-t-2 border-dashed border-green-300 mx-2 relative">
                         <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-green-300 rounded-full" />
                         <ArrowRight className="w-4 h-4 text-green-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                     </div>
                     <div className="flex flex-col items-center">
                         <div className="bg-green-100 text-green-700 font-bold text-xs px-2 py-1 rounded mb-1">Cash</div>
                         <div className="text-[9px] text-gray-400 uppercase">Secure</div>
                     </div>
                 </div>
                 <div className="text-[10px] text-green-700 mt-2 text-center font-medium">
                     Proceeds are now earning interest in your accounts.
                 </div>
             </div>
          )}

          {/* SECTION B: PASSIVE INCOME */}
          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-3xl p-6 border border-yellow-100 relative">
               <div className="flex justify-between items-start mb-4">
                   <div>
                       <div className="text-xs font-bold text-yellow-700 uppercase tracking-wide">Last Month Passive Income</div>
                       <div className="text-3xl font-bold text-gray-800 font-roboto mt-1">
                           ${Math.round(monthlyPassiveIncome).toLocaleString()}
                       </div>
                   </div>
                   <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-yellow-500 shadow-sm">
                       <Coffee className="w-5 h-5" />
                   </div>
               </div>
               <div className="text-xs text-yellow-800 font-medium flex items-center bg-white/60 p-2 rounded-lg inline-block">
                   🍱 Equivalant to <span className="font-bold mx-1">{lunchCount}</span> free lunches!
               </div>
          </div>

          {/* SECTION C: ASSETS & GEO */}
          <div className="grid grid-cols-2 gap-4">
               {/* Geo Card */}
               <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center justify-center">
                   <div className="h-20 w-20 relative mb-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={pieData} innerRadius={25} outerRadius={35} dataKey="value" stroke="none">
                                    {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                        <Globe className="w-4 h-4 text-gray-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                   </div>
                   <div className="text-center">
                       <div className="text-2xl font-bold text-gray-800">{audPercentage}%</div>
                       <div className="text-[10px] font-bold text-gray-400 uppercase">Overseas Exposure</div>
                   </div>
               </div>

               {/* Growth Chart Mini */}
               <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-end">
                   <div className="h-20 mb-2">
                       <ResponsiveContainer width="100%" height="100%">
                           <AreaChart data={chartData}>
                               <defs>
                                   <linearGradient id="colorMini" x1="0" y1="0" x2="0" y2="1">
                                       <stop offset="5%" stopColor="#0052CC" stopOpacity={0.2}/>
                                       <stop offset="95%" stopColor="#0052CC" stopOpacity={0}/>
                                   </linearGradient>
                               </defs>
                               <Area type="monotone" dataKey="totalValueHKD" stroke="#0052CC" strokeWidth={2} fill="url(#colorMini)" />
                           </AreaChart>
                       </ResponsiveContainer>
                   </div>
                   <div className="text-[10px] font-bold text-gray-400 uppercase text-center">6-Month Trend</div>
               </div>
          </div>

          {/* SECTION D: LOOKING AHEAD */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
               <div className="flex justify-between items-center mb-4">
                   <h3 className="font-bold text-gray-800">Looking Ahead</h3>
                   <button onClick={onNavigateToFD} className="text-xs font-bold text-[#0052CC] flex items-center">
                       FD Manager <ArrowRight className="w-3 h-3 ml-1" />
                   </button>
               </div>
               
               {/* Cash Warning */}
               {showCashWarning && (
                   <div className="flex items-start bg-red-50 p-3 rounded-xl mb-4 text-red-700">
                       <AlertTriangle className="w-4 h-4 mr-2 mt-0.5 shrink-0" />
                       <div className="text-xs font-medium">
                           <span className="font-bold">High Cash Drag!</span> Cash is {Math.round(cashRatio*100)}% of portfolio. Consider locking some into FDs.
                       </div>
                   </div>
               )}

               {/* Goal Pulse */}
               <div className="bg-blue-50 p-4 rounded-xl">
                   <div className="flex justify-between items-center mb-2">
                       <span className="text-xs font-bold text-blue-500 uppercase">Goal Progress</span>
                       <span className="text-xs font-bold text-blue-700">{Math.round((currentNetWorth/wealthGoal)*100)}%</span>
                   </div>
                   <div className="w-full bg-blue-200 h-1.5 rounded-full overflow-hidden mb-2">
                       <div className="bg-[#0052CC] h-full rounded-full" style={{width: `${(currentNetWorth/wealthGoal)*100}%`}}></div>
                   </div>
                   {projectedMonths ? (
                       <div className="text-xs text-blue-600 font-medium">
                           At this pace, you'll hit your goal in ~<span className="font-bold">{projectedMonths} months</span>.
                       </div>
                   ) : (
                       <div className="text-xs text-blue-600 font-medium">
                           Keep saving to estimate completion date.
                       </div>
                   )}
               </div>
          </div>
      </div>
      {/* --- REPORT CONTENT END --- */}

      {/* FOOTER ACTIONS */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-gray-100 via-gray-100 to-transparent max-w-md mx-auto z-50">
          <button 
            onClick={onClose}
            className="w-full bg-[#0052CC] text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-200 active:scale-95 transition-all flex items-center justify-center"
          >
              <CheckCircle className="w-5 h-5 mr-2" />
              Got it! Keep Pushing.
          </button>
      </div>

    </div>
  );
};

export default MonthlyReport;