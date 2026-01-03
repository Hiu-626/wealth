import React, { useMemo, useState, useEffect } from 'react';
import { 
  Area, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, BarChart, Bar, ComposedChart, Line, Legend, ReferenceLine 
} from 'recharts';
import { Account, FixedDeposit, HistoricalDataPoint } from '../types';
import { MOCK_RATES } from '../constants';
import { PieChart as PieIcon, TrendingUp, CalendarClock, Target, Pencil, X, Check, FileText, Zap, BarChart3, TrendingDown, Waves } from 'lucide-react';
import MonthlyReport from './MonthlyReport';
import Confetti from './Confetti';

// --- Animated Counter Component ---
const CountUp: React.FC<{ end: number; duration?: number; prefix?: string; suffix?: string; decimals?: number }> = ({ 
  end, duration = 1500, prefix = '', suffix = '', decimals = 0 
}) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const increment = end / (duration / 16); // 60fps
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        clearInterval(timer);
        setCount(end);
      } else {
        setCount(start);
      }
    }, 16);
    return () => clearInterval(timer);
  }, [end, duration]);

  return <>{prefix}{count.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</>;
};

interface InsightsProps {
  accounts: Account[];
  fixedDeposits: FixedDeposit[];
  history: HistoricalDataPoint[];
  wealthGoal: number;
  onUpdateGoal: (goal: number) => void;
}

const Insights: React.FC<InsightsProps> = ({ accounts, fixedDeposits, history, wealthGoal, onUpdateGoal }) => {
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [tempGoal, setTempGoal] = useState(wealthGoal.toString());

  // Helper: Currency Conversion
  const toHKD = (amount: number, currency: string) => {
    if (currency === 'HKD') return amount;
    if (currency === 'AUD') return amount * MOCK_RATES.AUD;
    if (currency === 'USD') return amount * MOCK_RATES.USD;
    return amount;
  };

  const handleSaveGoal = () => {
    const val = parseFloat(tempGoal);
    if (val > 0) {
      onUpdateGoal(val);
      setIsEditingGoal(false);
    }
  };

  const handleCloseReport = () => {
      setShowReport(false);
      setShowConfetti(true); // Reward on close
  };

  // --- DATA CALCULATIONS ---

  // 1. Current Net Worth
  const currentNetWorth = useMemo(() => {
     if (history.length === 0) return 0;
     return history[history.length - 1].totalValueHKD;
  }, [history]);

  const progressPercentage = Math.min(100, (currentNetWorth / wealthGoal) * 100);

  // 2. Income Stream Calculation (Estimated Monthly)
  const incomeStream = useMemo(() => {
    // A. FD Interest (Exact)
    const fdInterestMonthly = fixedDeposits.reduce((sum, fd) => {
      const principalHKD = toHKD(fd.principal, fd.currency);
      const rate = fd.interestRate || 0;
      return sum + (principalHKD * (rate / 100) / 12);
    }, 0);

    // B. Stock Dividend Yield (Estimated)
    // Assumptions: HK/AU Stocks ~4% yield, US Stocks ~1.5% yield
    const stockDividendMonthly = accounts.filter(a => a.type === 'Stock').reduce((sum, acc) => {
      const val = toHKD(acc.balance, acc.currency);
      let yieldRate = 0;
      if (acc.currency === 'USD') yieldRate = 0.015; // Growth focused
      else yieldRate = 0.04; // Yield focused (HK/AU)
      return sum + (val * yieldRate / 12);
    }, 0);

    return Math.round(fdInterestMonthly + stockDividendMonthly);
  }, [accounts, fixedDeposits]);

  // 3. Asset Distribution
  const distributionData = useMemo(() => {
    let cash = 0, fd = 0, hkStock = 0, usStock = 0, auStock = 0;

    accounts.forEach(acc => {
        const val = toHKD(acc.balance, acc.currency);
        if (acc.type === 'Cash') {
            cash += val;
        } else if (acc.type === 'Stock') {
            if (acc.currency === 'HKD') hkStock += val;
            else if (acc.currency === 'USD') usStock += val;
            else if (acc.currency === 'AUD') auStock += val;
            else hkStock += val;
        }
    });

    fixedDeposits.forEach(f => {
        fd += toHKD(f.principal, f.currency);
    });

    return [
        { name: 'Cash', value: Math.round(cash), color: '#10B981' }, // Emerald
        { name: 'Fixed Dep.', value: Math.round(fd), color: '#F59E0B' }, // Amber
        { name: 'HK Stocks', value: Math.round(hkStock), color: '#3B82F6' }, // Blue
        { name: 'US Stocks', value: Math.round(usStock), color: '#8B5CF6' }, // Violet
        { name: 'AU Stocks', value: Math.round(auStock), color: '#06B6D4' }  // Cyan
    ].filter(i => i.value > 0);
  }, [accounts, fixedDeposits]);

  // 4. Trend Data with Benchmark (S&P 500 Simulation)
  const trendData = useMemo(() => {
      if (history.length === 0) return [];
      
      const startValue = history[0].totalValueHKD;
      
      // Simulate S&P 500 (approx 0.8% monthly average growth for benchmark visualization)
      const benchmarkRate = 0.008; 

      return history.map((point, index, array) => {
          // 6-Month Moving Average
          const start = Math.max(0, index - 5);
          const subset = array.slice(start, index + 1);
          const avg = subset.reduce((sum, item) => sum + item.totalValueHKD, 0) / subset.length;
          
          // Benchmark calculation: Compounded monthly from the start date
          const benchmarkValue = startValue * Math.pow(1 + benchmarkRate, index);

          return {
              ...point,
              ma: Math.round(avg),
              benchmark: Math.round(benchmarkValue)
          };
      });
  }, [history]);

  // 5. FD Maturity Timeline
  const maturityData = useMemo(() => {
      const next12Months = [];
      const today = new Date();
      for (let i = 0; i < 12; i++) {
          const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
          const key = d.toISOString().slice(0, 7);
          const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
          next12Months.push({ key, label, amount: 0 });
      }

      fixedDeposits.forEach(fd => {
          const matDate = fd.maturityDate.slice(0, 7);
          const bucket = next12Months.find(m => m.key === matDate);
          if (bucket) {
              bucket.amount += toHKD(fd.principal, fd.currency);
          }
      });
      return next12Months.map(m => ({ ...m, amount: Math.round(m.amount) }));
  }, [fixedDeposits]);

  return (
    <div className="p-6 pb-24 space-y-8 relative font-sans">
       <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />

       <div className="flex justify-between items-end">
         <div>
            <h1 className="text-2xl font-black text-gray-800 tracking-tight">Wealth Insights</h1>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Financial Engineering</p>
         </div>
         <button 
            onClick={() => setShowReport(true)}
            className="bg-white border-2 border-blue-50 text-blue-600 p-2 rounded-xl hover:bg-blue-50 active:scale-95 transition-all shadow-sm"
         >
             <FileText className="w-5 h-5" />
         </button>
       </div>

       {/* --- 1. INCOME STREAM CARD (NEW) --- */}
       <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-3xl p-1 shadow-lg shadow-emerald-200 relative overflow-hidden group">
            {/* Animated Background Effect */}
            <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:250%_250%] animate-[shimmer_3s_infinite]" />
            
            <div className="bg-white/10 backdrop-blur-md rounded-[1.3rem] p-5 relative z-10">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center space-x-2 text-emerald-100 mb-1">
                            <Zap className="w-4 h-4 fill-current" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Est. Passive Income</span>
                        </div>
                        <div className="text-3xl font-black text-white font-roboto drop-shadow-md">
                            <CountUp end={incomeStream} prefix="$" />
                            <span className="text-sm font-bold text-emerald-100 ml-1">/mo</span>
                        </div>
                    </div>
                    <div className="bg-white/20 p-2 rounded-full">
                        <Waves className="w-6 h-6 text-white" />
                    </div>
                </div>
                <p className="text-[10px] text-emerald-50 mt-3 font-medium opacity-80">
                    *Combined estimate from FD interest & stock dividends.
                </p>
            </div>
       </div>

       {/* --- 2. GOAL PROGRESS (GLASSMORPHISM) --- */}
       <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-indigo-200 group">
           {/* Background Image/Gradient */}
           <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-blue-600 to-blue-500" />
           <div className="absolute -top-10 -right-10 w-40 h-40 bg-purple-500 rounded-full blur-[50px] opacity-40 group-hover:opacity-60 transition-opacity duration-700" />
           <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black/20 to-transparent" />

           <div className="relative p-6 z-10">
               <div className="flex justify-between items-start mb-4">
                  <div>
                      <div className="flex items-center space-x-2 text-indigo-100 text-[10px] font-black uppercase tracking-widest mb-1">
                          <Target className="w-3 h-3" />
                          <span>Financial Freedom</span>
                      </div>
                      <div className="text-2xl font-black text-white font-roboto flex items-center drop-shadow-sm">
                          <CountUp end={wealthGoal} prefix="$" />
                          <button onClick={() => setIsEditingGoal(true)} className="ml-2 p-1.5 bg-white/10 hover:bg-white/20 rounded-full transition-all backdrop-blur-sm">
                              <Pencil className="w-3 h-3 text-white" />
                          </button>
                      </div>
                  </div>
                  <div className="text-right">
                      <div className="text-4xl font-black text-white drop-shadow-md">
                          <CountUp end={progressPercentage} suffix="%" decimals={1} />
                      </div>
                  </div>
               </div>

               {/* Glassy Progress Bar */}
               <div className="relative h-3 bg-black/20 rounded-full overflow-hidden backdrop-blur-sm border border-white/5">
                   <div 
                     className="absolute top-0 left-0 h-full bg-gradient-to-r from-green-300 to-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)] transition-all duration-[2000ms] ease-out rounded-full"
                     style={{ width: `${progressPercentage}%` }}
                   />
               </div>
               
               <div className="mt-3 flex justify-between items-center text-xs text-indigo-100 font-bold">
                  <span>Current: $<CountUp end={currentNetWorth} /></span>
                  <span>${(wealthGoal - currentNetWorth).toLocaleString()} to go</span>
               </div>
           </div>
       </div>

       {/* --- 3. TREND CHART (WITH BENCHMARK) --- */}
       <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center">
                <TrendingUp className="w-4 h-4 mr-2" /> Performance
            </h3>
            <div className="flex items-center space-x-3 text-[10px] font-bold">
                <span className="flex items-center text-gray-500"><span className="w-2 h-2 rounded-full bg-blue-600 mr-1"></span>You</span>
                <span className="flex items-center text-gray-400"><span className="w-2 h-2 rounded-full bg-gray-300 mr-1"></span>S&P 500 Est.</span>
            </div>
          </div>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{fontSize: 10, fill: '#9CA3AF', fontWeight: 'bold'}} axisLine={false} tickLine={false} dy={10} />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip 
                    contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)', fontFamily: 'Inter'}}
                    itemStyle={{fontWeight: 'bold', fontSize: '12px'}}
                    labelStyle={{fontSize: '10px', color: '#9CA3AF', marginBottom: '5px', fontWeight: 'bold'}}
                    formatter={(val: number, name: string) => {
                        if (name === 'benchmark') return [`$${val.toLocaleString()}`, 'S&P 500 Est.'];
                        if (name === 'totalValueHKD') return [`$${val.toLocaleString()}`, 'Net Worth'];
                        return [val, name];
                    }}
                />
                
                {/* Benchmark Line (Gray, Dashed) */}
                <Line 
                    type="monotone" 
                    dataKey="benchmark" 
                    stroke="#D1D5DB" 
                    strokeWidth={2} 
                    dot={false}
                    strokeDasharray="4 4"
                    activeDot={false}
                />

                {/* Actual Wealth Area */}
                <Area 
                    type="monotone" 
                    dataKey="totalValueHKD" 
                    stroke="#2563EB" 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#colorValue)" 
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-blue-50 rounded-xl p-3 mt-4 flex items-start gap-3">
             <BarChart3 className="w-4 h-4 text-blue-600 mt-0.5" />
             <p className="text-[10px] text-blue-800 font-medium leading-relaxed">
                 <span className="font-bold">Benchmarking:</span> The gray line simulates if your initial capital grew at 0.8%/month (S&P 500 avg). 
                 {trendData.length > 0 && trendData[trendData.length-1].totalValueHKD > trendData[trendData.length-1].benchmark 
                    ? <span className="text-green-600 font-bold block mt-1">Great job! You are outperforming the market index.</span> 
                    : <span className="text-gray-500 font-bold block mt-1">Market is tough. Keep optimizing your allocation.</span>}
             </p>
          </div>
       </div>

       {/* --- 4. ASSET ALLOCATION (CENTER TEXT OPTIMIZED) --- */}
       <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-100">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center">
            <PieIcon className="w-4 h-4 mr-2" /> Asset Mix
          </h3>
          <div className="flex flex-col sm:flex-row items-center">
              <div className="h-64 w-full sm:w-1/2 relative">
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={distributionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={85}
                        paddingAngle={4}
                        cornerRadius={6}
                        dataKey="value"
                        stroke="none"
                      >
                        {distributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)'}}
                        itemStyle={{fontWeight: 'bold', color: '#1F2937'}}
                        formatter={(val: number) => `$${val.toLocaleString()}`} 
                      />
                    </PieChart>
                 </ResponsiveContainer>
                 {/* Center Content: Animated Total Net Worth */}
                 <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none flex flex-col justify-center items-center">
                     <div className="text-[10px] text-gray-400 font-black uppercase tracking-wider mb-0.5">Total Net Worth</div>
                     <div className="text-xl font-black text-gray-800 font-roboto tracking-tight">
                         <CountUp end={currentNetWorth / 1000000} decimals={2} prefix="$" suffix="M" />
                     </div>
                 </div>
              </div>
              
              {/* Custom Legend */}
              <div className="w-full sm:w-1/2 mt-4 sm:mt-0 space-y-3 pl-0 sm:pl-6">
                  {distributionData.map((entry) => (
                      <div key={entry.name} className="flex justify-between items-center text-sm">
                          <div className="flex items-center">
                              <div className="w-3 h-3 rounded-full mr-2 shadow-sm" style={{backgroundColor: entry.color}}></div>
                              <span className="text-gray-500 font-bold text-xs uppercase tracking-wide">{entry.name}</span>
                          </div>
                          <span className="font-black text-gray-800 font-roboto">
                              {((entry.value / currentNetWorth) * 100).toFixed(0)}%
                          </span>
                      </div>
                  ))}
              </div>
          </div>
       </div>

       {/* --- 5. UNLOCKING CASH --- */}
       <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-100">
           <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center">
             <CalendarClock className="w-4 h-4 mr-2" /> 12-Month Liquidity Map
           </h3>
           <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={maturityData}>
                      <XAxis dataKey="label" tick={{fontSize: 9, fontWeight: 'bold', fill: '#9CA3AF'}} axisLine={false} tickLine={false} interval={0} angle={-45} textAnchor="end" height={40} />
                      <Tooltip 
                        cursor={{fill: '#F3F4F6', radius: 4}}
                        contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.05)'}}
                        formatter={(val: number) => [`$${val.toLocaleString()}`, 'Unlocking']}
                      />
                      <Bar 
                        dataKey="amount" 
                        fill="#3B82F6" 
                        radius={[6, 6, 6, 6]} 
                        barSize={12}
                      />
                  </BarChart>
              </ResponsiveContainer>
           </div>
       </div>

       {/* EDIT GOAL MODAL */}
       {isEditingGoal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity animate-in fade-in" onClick={() => setIsEditingGoal(false)} />
              
              <div className="bg-white w-full max-w-sm rounded-[2rem] p-8 relative z-10 animate-in zoom-in-95 duration-200 shadow-2xl">
                  <button onClick={() => setIsEditingGoal(false)} className="absolute top-6 right-6 text-gray-300 hover:text-gray-600 transition-colors">
                      <X className="w-6 h-6" />
                  </button>

                  <div className="text-center mb-8">
                      <div className="w-16 h-16 bg-blue-50 rounded-3xl rotate-3 flex items-center justify-center mx-auto mb-4 text-blue-600 shadow-sm">
                          <Target className="w-8 h-8" />
                      </div>
                      <h2 className="text-2xl font-black text-gray-800 tracking-tight">Set Wealth Goal</h2>
                      <p className="text-xs font-bold text-gray-400 uppercase mt-2 tracking-wide">Visualize your target</p>
                  </div>

                  <div className="mb-8">
                      <label className="text-xs font-black text-gray-400 uppercase mb-2 block ml-1">Target Net Worth (HKD)</label>
                      <input 
                          type="number"
                          autoFocus
                          value={tempGoal}
                          onChange={(e) => setTempGoal(e.target.value)}
                          className="w-full bg-gray-50 p-5 rounded-2xl text-3xl font-black text-blue-600 outline-none focus:ring-4 focus:ring-blue-100 font-roboto text-center"
                          placeholder="2000000"
                      />
                  </div>

                  <button 
                    onClick={handleSaveGoal}
                    className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-blue-200 active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-blue-700"
                  >
                      <Check className="w-5 h-5" />
                      UPDATE TARGET
                  </button>
              </div>
          </div>
       )}

       {/* MONTHLY REPORT MODAL */}
       {showReport && (
         <MonthlyReport 
            accounts={accounts}
            fixedDeposits={fixedDeposits}
            history={history}
            wealthGoal={wealthGoal}
            onClose={handleCloseReport}
            onNavigateToFD={() => { setShowReport(false); }} 
         />
       )}
    </div>
  );
};

export default Insights;