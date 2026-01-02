import React, { useMemo, useState } from 'react';
import { 
  Area, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, BarChart, Bar, ComposedChart, Line, Legend, ReferenceLine 
} from 'recharts';
import { Account, FixedDeposit, HistoricalDataPoint } from '../types';
import { MOCK_RATES } from '../constants';
import { PieChart as PieIcon, TrendingUp, CalendarClock, Target, Pencil, X, Check, FileText } from 'lucide-react';
import MonthlyReport from './MonthlyReport';
import Confetti from './Confetti';

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

  // Current Net Worth for Progress Calculation
  const currentNetWorth = useMemo(() => {
     if (history.length === 0) return 0;
     return history[history.length - 1].totalValueHKD;
  }, [history]);

  const progressPercentage = Math.min(100, Math.round((currentNetWorth / wealthGoal) * 100));

  // 1. Asset Distribution Data (Cash, FDs, HK Stock, US Stock, AU Stock)
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
            else hkStock += val; // Default fallback
        }
    });

    fixedDeposits.forEach(f => {
        fd += toHKD(f.principal, f.currency);
    });

    return [
        { name: 'Cash', value: Math.round(cash), color: '#36B37E' }, // Green
        { name: 'Fixed Dep.', value: Math.round(fd), color: '#FFC107' }, // Amber
        { name: 'HK Stocks', value: Math.round(hkStock), color: '#0052CC' }, // Blue
        { name: 'US Stocks', value: Math.round(usStock), color: '#6554C0' }, // Purple
        { name: 'AU Stocks', value: Math.round(auStock), color: '#00B8D9' }  // Cyan
    ].filter(i => i.value > 0);
  }, [accounts, fixedDeposits]);

  // 2. Trend Data with 6-Month Moving Average
  const trendData = useMemo(() => {
      if (history.length === 0) return [];
      
      return history.map((point, index, array) => {
          // Calculate Moving Average (up to 6 months back)
          const start = Math.max(0, index - 5);
          const subset = array.slice(start, index + 1);
          const avg = subset.reduce((sum, item) => sum + item.totalValueHKD, 0) / subset.length;
          
          return {
              ...point,
              ma: Math.round(avg)
          };
      });
  }, [history]);

  // 3. FD Maturity Timeline (Next 12 Months)
  const maturityData = useMemo(() => {
      const next12Months = [];
      const today = new Date();
      
      // Initialize buckets
      for (let i = 0; i < 12; i++) {
          const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
          const key = d.toISOString().slice(0, 7); // YYYY-MM
          const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }); // Oct 23
          next12Months.push({ key, label, amount: 0 });
      }

      fixedDeposits.forEach(fd => {
          const matDate = fd.maturityDate.slice(0, 7); // Extract YYYY-MM
          const bucket = next12Months.find(m => m.key === matDate);
          if (bucket) {
              bucket.amount += toHKD(fd.principal, fd.currency);
          }
      });

      return next12Months.map(m => ({ ...m, amount: Math.round(m.amount) }));
  }, [fixedDeposits]);

  return (
    <div className="p-6 pb-24 space-y-8 relative">
       <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />

       <div className="mb-2">
         <h1 className="text-2xl font-bold text-gray-800">Wealth Insights</h1>
         <p className="text-sm text-gray-400">Track your journey to financial freedom.</p>
       </div>

       {/* Goal Progress Card */}
       <div className="bg-gradient-to-r from-[#0052CC] to-[#0065FF] rounded-2xl p-5 text-white shadow-lg shadow-blue-200 relative overflow-hidden">
           <div className="absolute top-0 right-0 w-24 h-24 bg-white opacity-5 rounded-full -mr-10 -mt-10 pointer-events-none"></div>
           
           <div className="flex justify-between items-start mb-2 relative z-10">
              <div>
                  <div className="flex items-center space-x-2 text-blue-100 text-xs font-bold uppercase tracking-wider mb-1">
                      <Target className="w-3.5 h-3.5" />
                      <span>Life Goal</span>
                  </div>
                  <div className="text-2xl font-bold font-roboto flex items-center">
                      ${wealthGoal.toLocaleString()}
                      <button onClick={() => setIsEditingGoal(true)} className="ml-2 p-1 hover:bg-white/20 rounded-full transition-colors">
                          <Pencil className="w-3.5 h-3.5 text-blue-200" />
                      </button>
                  </div>
              </div>
              <div className="text-right">
                  <div className="text-3xl font-bold">{progressPercentage}%</div>
                  <div className="text-xs text-blue-100">completed</div>
              </div>
           </div>

           {/* Progress Bar */}
           <div className="relative h-2 bg-black/20 rounded-full overflow-hidden mt-3">
               <div 
                 className="absolute top-0 left-0 h-full bg-white transition-all duration-1000 ease-out rounded-full"
                 style={{ width: `${progressPercentage}%` }}
               />
           </div>
           
           <div className="mt-2 text-xs text-blue-100 font-medium text-center">
              ${(wealthGoal - currentNetWorth).toLocaleString()} away from your target.
           </div>
       </div>

       {/* 1. Net Worth Trend & GOAL LINE */}
       <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-bold text-gray-500 mb-4 uppercase tracking-wide flex items-center">
            <TrendingUp className="w-4 h-4 mr-2" /> Progress to Goal
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0052CC" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#0052CC" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip 
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)'}}
                    formatter={(val: number, name: string) => [
                        `$${val.toLocaleString()}`, 
                        name === 'ma' ? '6-Mo Avg' : 'Net Worth'
                    ]}
                />
                <Legend iconType="circle" wrapperStyle={{fontSize: '12px', paddingTop: '10px'}} />
                
                {/* GOAL LINE */}
                <ReferenceLine 
                    y={wealthGoal} 
                    label={{ value: 'GOAL', position: 'right', fill: '#4CAF50', fontSize: 10, fontWeight: 'bold' }} 
                    stroke="#4CAF50" 
                    strokeDasharray="3 3" 
                    strokeWidth={1.5}
                />

                {/* Area: Actual Wealth */}
                <Area 
                    type="monotone" 
                    dataKey="totalValueHKD" 
                    name="Net Worth"
                    stroke="#0052CC" 
                    strokeWidth={2} 
                    fillOpacity={1} 
                    fill="url(#colorValue)" 
                />
                
                {/* Line: Moving Average */}
                <Line 
                    type="monotone" 
                    dataKey="ma" 
                    name="6-Mo Avg"
                    stroke="#FFC107" 
                    strokeWidth={2} 
                    dot={false}
                    strokeDasharray="5 5"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-gray-400 text-center mt-2">
             Keep the blue line climbing towards the green dashed line!
          </p>
       </div>

       {/* 2. Asset Distribution */}
       <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-bold text-gray-500 mb-4 uppercase tracking-wide flex items-center">
            <PieIcon className="w-4 h-4 mr-2" /> Asset Allocation
          </h3>
          <div className="flex flex-col sm:flex-row items-center">
              <div className="h-64 w-full sm:w-1/2 relative">
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={distributionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {distributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val: number) => `$${val.toLocaleString()}`} />
                    </PieChart>
                 </ResponsiveContainer>
                 {/* Center Text */}
                 <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                     <div className="text-xs text-gray-400 font-medium">Total</div>
                     <div className="text-sm font-bold text-gray-800">Assets</div>
                 </div>
              </div>
              
              {/* Custom Legend */}
              <div className="w-full sm:w-1/2 mt-4 sm:mt-0 space-y-3 pl-0 sm:pl-6">
                  {distributionData.map((entry) => (
                      <div key={entry.name} className="flex justify-between items-center text-sm">
                          <div className="flex items-center">
                              <div className="w-3 h-3 rounded-full mr-2" style={{backgroundColor: entry.color}}></div>
                              <span className="text-gray-600 font-medium">{entry.name}</span>
                          </div>
                          <span className="font-bold text-gray-800 font-roboto">
                              ${(entry.value / 1000).toFixed(0)}k
                          </span>
                      </div>
                  ))}
              </div>
          </div>
       </div>

       {/* 3. FD Maturity Timeline */}
       <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
           <h3 className="text-sm font-bold text-gray-500 mb-4 uppercase tracking-wide flex items-center">
             <CalendarClock className="w-4 h-4 mr-2" /> Unlocking Cash (Next 12 Mo)
           </h3>
           <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={maturityData}>
                      <XAxis dataKey="label" tick={{fontSize: 10}} axisLine={false} tickLine={false} interval={0} angle={-45} textAnchor="end" height={50} />
                      <YAxis hide />
                      <Tooltip 
                        cursor={{fill: '#F3F4F6'}}
                        contentStyle={{borderRadius: '8px', border: 'none'}}
                        formatter={(val: number) => [`$${val.toLocaleString()}`, 'Unlocking']}
                      />
                      <Bar 
                        dataKey="amount" 
                        fill="#0052CC" 
                        radius={[4, 4, 0, 0]} 
                      />
                  </BarChart>
              </ResponsiveContainer>
           </div>
           {/* Summary Text */}
           {maturityData.some(d => d.amount > 0) ? (
             <div className="text-xs text-gray-500 mt-2 text-center bg-gray-50 p-2 rounded-lg">
                Highest unlock in <span className="font-bold text-gray-800">{maturityData.reduce((prev, current) => (prev.amount > current.amount) ? prev : current).label}</span>
             </div>
           ) : (
             <div className="text-xs text-gray-400 text-center italic">No maturities in the next 12 months.</div>
           )}
       </div>

       {/* --- NEW BUTTON: MONTHLY REPORT --- */}
       <button 
        onClick={() => setShowReport(true)}
        className="w-full bg-white border border-gray-200 text-gray-600 font-bold py-4 rounded-xl shadow-sm hover:bg-gray-50 active:scale-95 transition-all flex items-center justify-center mt-4"
       >
         <FileText className="w-5 h-5 mr-2 text-[#0052CC]" />
         View Monthly Settlement Report
       </button>

       {/* EDIT GOAL MODAL */}
       {isEditingGoal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsEditingGoal(false)} />
              
              <div className="bg-white w-full max-w-sm rounded-3xl p-6 relative z-10 animate-in zoom-in-95 duration-200 shadow-2xl">
                  <button onClick={() => setIsEditingGoal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                      <X className="w-6 h-6" />
                  </button>

                  <div className="text-center mb-6">
                      <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3 text-[#0052CC]">
                          <Target className="w-6 h-6" />
                      </div>
                      <h2 className="text-xl font-bold text-gray-800">Set Wealth Goal</h2>
                      <p className="text-xs text-gray-400 mt-1">Aim high! Update your target net worth.</p>
                  </div>

                  <div className="mb-6">
                      <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Target Amount (HKD)</label>
                      <input 
                          type="number"
                          autoFocus
                          value={tempGoal}
                          onChange={(e) => setTempGoal(e.target.value)}
                          className="w-full bg-gray-50 p-4 rounded-xl text-2xl font-bold text-gray-800 outline-none focus:ring-2 focus:ring-[#0052CC] font-roboto"
                          placeholder="2000000"
                      />
                  </div>

                  <button 
                    onClick={handleSaveGoal}
                    className="w-full bg-[#0052CC] text-white font-bold py-4 rounded-xl shadow-xl shadow-blue-200 active:scale-95 transition-all flex items-center justify-center"
                  >
                      <Check className="w-5 h-5 mr-2" />
                      Update Goal
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
            onNavigateToFD={() => { setShowReport(false); }} // Ideally navigate to FD manager, but simplistic for now
         />
       )}
    </div>
  );
};

export default Insights;