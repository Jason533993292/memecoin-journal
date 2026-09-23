import { Timestamp } from "firebase/firestore";

export type TradeDate = any;

export interface Trade {
  id: string;
  ca: string;
  name: string;
  symbol: string;
  wallet: string;
  result: 'Win' | 'Loss' | 'BE';
  setupType?: string;
  mcap?: number;
  liquidity?: number;
  price?: number;
  boughtSol: number;
  boughtUsd?: number;
  soldSol?: number;
  soldUsd?: number;
  pnlSol: number;
  pnlUsd: number;
  mistakes: string[];
  notes?: string;
  screenshotUrl?: string;
  durationMinutes?: number;
  entryTime?: string;
  exitTime?: string;
  initialRiskSol?: number;
  stopPrice?: number;
  feesSol?: number;
  entryTimezoneOffset?: number;
  date?: TradeDate;
  createdAt?: number;
}

export interface Wallet {
  id: string;
  name: string;
  balanceSol: number;
  address: string;
  updatedAt?: number;
}

export interface WalletTransaction {
  id: string;
  walletId: string;
  walletName: string;
  type: 'deposit' | 'paycheck';
  amountSol: number;
  amountUsd?: number;
  notes?: string;
  date?: TradeDate;
  createdAt?: number;
}

export interface JournalRules {
  riskManagement: string[];
  tradePlan: string[];
}

export interface GoalSettings {
  weeklyPnlSolTarget: number;
  monthlyPnlSolTarget: number;
  targetWinRate: number;
  maxDailyLossSol: number;
  maxDailyTrades: number;
}

export interface AiCoachBrief {
  advice: string;
  disciplineScore?: number;
  topMistake?: string;
  timestamp?: number;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  description?: string;
}
