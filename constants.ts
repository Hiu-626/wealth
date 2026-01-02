export const THEME = {
  bg: '#F8F9FA',
  primary: '#0052CC',
  alert: '#FF5252',
  warning: '#FFC107',
  success: '#4CAF50',
  text: '#172B4D',
  textLight: '#6B778C'
};

export const MOCK_RATES = {
  AUD: 5.1, // 1 AUD = 5.1 HKD
  USD: 7.8, // 1 USD = 7.8 HKD
  HKD: 1
};

export const INITIAL_DATA = {
  accounts: [
    { id: '1', name: 'HSBC HK', type: 'Cash', currency: 'HKD', balance: 150000 },
    { id: '2', name: 'CommBank AU', type: 'Cash', currency: 'AUD', balance: 5000 },
    { id: '3', name: 'Interactive Brokers', type: 'Stock', currency: 'HKD', balance: 45000, symbol: '0700.HK', quantity: 100, lastPrice: 450 },
  ],
  fixedDeposits: [
    { id: '101', bankName: 'Standard Chartered', principal: 100000, currency: 'HKD', maturityDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), actionOnMaturity: 'Renew', interestRate: 4.1, autoRoll: true }, // 5 days from now
    { id: '102', bankName: 'Virtual Bank (Mox)', principal: 50000, currency: 'HKD', maturityDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(), actionOnMaturity: 'Transfer Out', interestRate: 3.8, autoRoll: false }, // 25 days from now
  ],
  history: [
    { date: '2023-05', totalValueHKD: 180000 },
    { date: '2023-06', totalValueHKD: 185000 },
    { date: '2023-07', totalValueHKD: 182000 },
    { date: '2023-08', totalValueHKD: 195000 },
    { date: '2023-09', totalValueHKD: 210000 },
    { date: '2023-10', totalValueHKD: 215000 },
  ]
};