import React, { useState, useEffect, useMemo } from 'react';
import { AppState, ViewState, Account, FixedDeposit } from './types';
import { getStoredData, saveStoredData, calculateTotalWealthHKD } from './services/storageService';
import Layout from './components/Layout';
import Overview from './components/Overview';
import UpdatePage from './components/UpdatePage';
import Insights from './components/Insights';
import FDManager from './components/FDManager';

const App: React.FC = () => {
  const [data, setData] = useState<AppState | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>('overview');

  useEffect(() => {
    const loadedData = getStoredData();
    setData(loadedData);
  }, []);

  // --- 關鍵修復：自定義計算總資產函數，防止重複計算 ---
  const calculateCorrectedTotalWealth = (accounts: Account[], fds: FixedDeposit[]) => {
    // 1. 先計算所有銀行帳戶的現金總和
    const accountsTotal = accounts.reduce((sum, acc) => sum + acc.balance, 0);

    // 2. 只加上「定期 (Fixed)」的本金
    // 「活期 (Savings)」的本金被視為已包含在 accountsTotal 中，所以排除
    const effectiveFDs = fds.filter(fd => fd.type !== 'Savings');
    
    // 調用原本的 service 進行匯率換算，但只傳入「非活期」的存款
    return calculateTotalWealthHKD(accounts, effectiveFDs);
  };

  const handleUpdateAccounts = (newAccounts: Account[]) => {
    if (!data) return;
    
    // 使用修正後的邏輯計算，防止 $6,100 的情況發生
    const totalWealth = calculateCorrectedTotalWealth(newAccounts, data.fixedDeposits);
    const todayStr = new Date().toISOString().slice(0, 7); // YYYY-MM
    
    const newHistory = [...(data.history || [])];
    const existingIndex = newHistory.findIndex(h => h.date === todayStr);
    
    if (existingIndex >= 0) {
      newHistory[existingIndex] = { ...newHistory[existingIndex], totalValueHKD: totalWealth };
    } else {
      newHistory.push({ date: todayStr, totalValueHKD: totalWealth });
    }

    const newState: AppState = {
      ...data,
      accounts: newAccounts,
      history: newHistory,
      lastUpdated: new Date().toISOString()
    };

    saveStoredData(newState);
    setData(newState);
    setCurrentView('overview');
  };

  const handleUpdateFDs = (newFDs: FixedDeposit[]) => {
    if (!data) return;
    
    // 當存款紀錄更新（例如新增了一筆活期）時，也要重新計算歷史紀錄中的總資產
    const totalWealth = calculateCorrectedTotalWealth(data.accounts, newFDs);
    const todayStr = new Date().toISOString().slice(0, 7);
    
    const newHistory = [...(data.history || [])];
    const existingIndex = newHistory.findIndex(h => h.date === todayStr);
    
    if (existingIndex >= 0) {
      newHistory[existingIndex] = { ...newHistory[existingIndex], totalValueHKD: totalWealth };
    } else {
      newHistory.push({ date: todayStr, totalValueHKD: totalWealth });
    }

    const newState = { 
      ...data, 
      fixedDeposits: newFDs,
      history: newHistory,
      lastUpdated: new Date().toISOString() 
    };
    setData(newState);
    saveStoredData(newState);
  };

  const handleSettleFD = (fdId: string, targetAccountId: string, finalAmount: number) => {
    if (!data) return;

    // 1. 更新帳戶餘額
    // 注意：如果是活期，FDManager 傳過來的 finalAmount 應該只是利息 (e.g. 10)
    // 如果是定期，finalAmount 則是本金+利息
    const newAccounts = data.accounts.map(acc => {
      if (acc.id === targetAccountId) {
        return { ...acc, balance: acc.balance + finalAmount };
      }
      return acc;
    });

    // 2. 移除該筆 FD
    const newFDs = data.fixedDeposits.filter(fd => fd.id !== fdId);

    // 3. 使用修正後的邏輯計算總值
    const totalWealth = calculateCorrectedTotalWealth(newAccounts, newFDs);
    const todayStr = new Date().toISOString().slice(0, 7);
    
    const newHistory = [...data.history];
    const existingIndex = newHistory.findIndex(h => h.date === todayStr);
    
    if (existingIndex >= 0) {
      newHistory[existingIndex] = { ...newHistory[existingIndex], totalValueHKD: totalWealth };
    } else {
      newHistory.push({ date: todayStr, totalValueHKD: totalWealth });
    }

    const newState: AppState = {
      ...data,
      accounts: newAccounts,
      fixedDeposits: newFDs,
      history: newHistory,
      lastUpdated: new Date().toISOString()
    };

    setData(newState);
    saveStoredData(newState);
  };

  const handleUpdateGoal = (newGoal: number) => {
    if (!data) return;
    const newState = { ...data, wealthGoal: newGoal };
    setData(newState);
    saveStoredData(newState);
  };

  if (!data) return <div className="flex h-screen items-center justify-center text-[#0052CC] font-bold animate-pulse">Loading WealthSnapshot...</div>;

  return (
    <Layout currentView={currentView} onNavigate={setCurrentView}>
      {currentView === 'overview' && (
        <Overview 
          key={data.lastUpdated}
          accounts={data.accounts}
          fixedDeposits={data.fixedDeposits}
          lastUpdated={data.lastUpdated}
          onNavigateToFD={() => setCurrentView('fd-manager')}
          onNavigateToUpdate={() => setCurrentView('update')}
        />
      )}
      
      {currentView === 'update' && (
        <UpdatePage 
          accounts={data.accounts}
          onSave={handleUpdateAccounts}
        />
      )}
      
      {currentView === 'insights' && (
        <Insights 
          accounts={data.accounts}
          fixedDeposits={data.fixedDeposits}
          history={data.history}
          wealthGoal={data.wealthGoal || 2000000}
          onUpdateGoal={handleUpdateGoal}
        />
      )}

      {currentView === 'fd-manager' && (
        <FDManager 
          fds={data.fixedDeposits} 
          accounts={data.accounts}
          onUpdate={handleUpdateFDs}
          onSettle={handleSettleFD}
          onBack={() => setCurrentView('overview')}
        />
      )}
    </Layout>
  );
};

export default App;