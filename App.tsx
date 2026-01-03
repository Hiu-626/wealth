import React, { useState, useEffect } from 'react';
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

  const handleUpdateAccounts = (newAccounts: Account[]) => {
    if (!data) return;
    
    // 1. Calculate new total for history
    const totalWealth = calculateTotalWealthHKD(newAccounts, data.fixedDeposits);
    const todayStr = new Date().toISOString().slice(0, 7); // YYYY-MM
    
    // 2. Update history (replace if same month, else push)
    const newHistory = [...(data.history || [])];
    const existingIndex = newHistory.findIndex(h => h.date === todayStr);
    
    if (existingIndex >= 0) {
      newHistory[existingIndex] = { ...newHistory[existingIndex], totalValueHKD: totalWealth };
    } else {
      newHistory.push({ date: todayStr, totalValueHKD: totalWealth });
    }

    // 3. Create new state object
    const newState: AppState = {
      ...data,
      accounts: newAccounts,
      history: newHistory,
      lastUpdated: new Date().toISOString()
    };

    // 4. Save and Update State
    saveStoredData(newState);
    setData(newState);
    
    // 5. Navigate back to Overview immediately
    setCurrentView('overview');
  };

  const handleUpdateFDs = (newFDs: FixedDeposit[]) => {
    if (!data) return;
    const newState = { ...data, fixedDeposits: newFDs };
    setData(newState);
    saveStoredData(newState);
  };

  // Handle Moving FD Principal + Interest to a Bank Account
  const handleSettleFD = (fdId: string, targetAccountId: string, finalAmount: number) => {
    if (!data) return;

    // 1. Update Account Balance
    const newAccounts = data.accounts.map(acc => {
      if (acc.id === targetAccountId) {
        return { ...acc, balance: acc.balance + finalAmount };
      }
      return acc;
    });

    // 2. Remove FD
    const newFDs = data.fixedDeposits.filter(fd => fd.id !== fdId);

    // 3. Recalculate Total & History
    const totalWealth = calculateTotalWealthHKD(newAccounts, newFDs);
    const todayStr = new Date().toISOString().slice(0, 7);
    
    const newHistory = [...data.history];
    const existingIndex = newHistory.findIndex(h => h.date === todayStr);
    
    if (existingIndex >= 0) {
      newHistory[existingIndex] = { date: todayStr, totalValueHKD: totalWealth };
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
          // Adding key forces React to re-mount the component when lastUpdated changes, ensuring fresh data display
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