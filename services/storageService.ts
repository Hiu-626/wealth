import { AppState, Account, FixedDeposit, HistoricalDataPoint } from '../types';
import { INITIAL_DATA } from '../constants';

const STORAGE_KEY = 'wealth_snapshot_v1';

export const getStoredData = (): AppState => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    return JSON.parse(stored);
  }
  
  // Initialize with defaults
  const defaults: AppState = {
    accounts: INITIAL_DATA.accounts as Account[],
    fixedDeposits: INITIAL_DATA.fixedDeposits as FixedDeposit[],
    history: INITIAL_DATA.history as HistoricalDataPoint[],
    lastUpdated: new Date().toISOString(),
    wealthGoal: 2000000 // Default goal: 2 Million HKD
  };
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
  return defaults;
};

export const saveStoredData = (data: AppState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const calculateTotalWealthHKD = (accounts: Account[], fixedDeposits: FixedDeposit[]): number => {
  let total = 0;
  
  // Constants for conversion (in a real app, these would be dynamic)
  const RATE_AUD_TO_HKD = 5.1;
  const RATE_USD_TO_HKD = 7.8;

  const toHKD = (amount: number, currency: string) => {
    if (currency === 'HKD') return amount;
    if (currency === 'AUD') return amount * RATE_AUD_TO_HKD;
    if (currency === 'USD') return amount * RATE_USD_TO_HKD;
    return amount;
  };

  accounts.forEach(acc => {
    total += toHKD(acc.balance, acc.currency);
  });

  fixedDeposits.forEach(fd => {
    total += toHKD(fd.principal, fd.currency);
  });

  return Math.round(total);
};