export type Currency = 'HKD' | 'AUD' | 'USD';

export enum AccountType {
  CASH = 'Cash',
  STOCK = 'Stock',
  CRYPTO = 'Crypto'
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: Currency;
  balance: number; // For cash, this is the amount. For stock, this is calculated value.
  
  // Stock specific
  symbol?: string;
  quantity?: number;
  lastPrice?: number;
}

export interface FixedDeposit {
  id: string;
  bankName: string;
  principal: number;
  currency: Currency;
  maturityDate: string; // ISO Date string
  actionOnMaturity: 'Renew' | 'Transfer Out';
  interestRate?: number; // Annual percentage (e.g. 4.5)
  autoRoll?: boolean; // Whether to add interest to principal on renewal
}

export interface HistoricalDataPoint {
  date: string;
  totalValueHKD: number;
}

export interface AppState {
  accounts: Account[];
  fixedDeposits: FixedDeposit[];
  history: HistoricalDataPoint[];
  lastUpdated: string; // ISO Date string
  wealthGoal?: number; // Target Net Worth in HKD
}

export type ViewState = 'overview' | 'update' | 'insights' | 'fd-manager';