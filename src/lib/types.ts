import type { Timestamp } from "firebase/firestore";

type TradeDate = Timestamp | Date | number | string | null | undefined;
type SolUsdRateSource = "user" | "live-at-entry" | "imported" | "unknown";
export type TradeMode = "real" | "paper";
type QuoteCurrency = "SOL" | "USD" | "USDC" | "USDT" | "ETH" | "BTC" | "EUR" | "GBP" | "OTHER";

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
  entryLiquidityUsd?: number;
  exitLiquidityUsd?: number;
  entryMarketCapUsd?: number;
  exitMarketCapUsd?: number;
  slippagePct?: number;
  dex?: string;
  executionType?: "discretionary" | "momentum" | "sniper" | "copy" | "other";
  wouldTakeAgain?: boolean;
  tradeQualityScore?: number;
  processGrade?: "A" | "B" | "C" | "D";
  confidenceAtEntry?: number;
  price?: number;
  boughtSol: number;
  boughtUsd?: number;
  soldSol?: number;
  soldUsd?: number;
  pnlSol: number;
  pnlUsd?: number;
  mistakes: string[];
  goodTags?: string[];
  isPaper?: boolean;
  notes?: string;
  screenshotUrl?: string;
  durationMinutes?: number;
  entryTime?: string;
  exitTime?: string;
  initialRiskSol?: number;
  stopPrice?: number;
  feesSol?: number;
  entryTimezoneOffset?: number;
  tradedAt?: number;
  solUsdRate?: number;
  solUsdRateSource?: SolUsdRateSource;
  tradeMode?: TradeMode;
  quoteCurrency?: QuoteCurrency;
  quoteSymbol?: string;
  boughtQuote?: number;
  soldQuote?: number;
  pnlQuote?: number;
  quoteUsdRate?: number;
  venue?: string;
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

export type DailyJournalEntryType = "free" | "pre_trade" | "post_trade" | "end_of_day";

export interface DailyJournalEntry {
  id: string;
  title: string;
  contentHtml: string;
  plainText: string;
  entryType: DailyJournalEntryType;
  entryDate: string;
  emotions: string[];
  emotionIntensity?: number;
  energyLevel?: number;
  confidenceLevel?: number;
  tags: string[];
  linkedTradeIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export type ResearchStage = "idea" | "researching" | "planned" | "active" | "invalidated" | "archived";

export interface ResearchSnapshot {
  id: string;
  createdAt: number;
  note: string;
  priceUsd?: number;
  marketCapUsd?: number;
  liquidityUsd?: number;
  sourceUrl?: string;
}

export interface ResearchDecision {
  id: string;
  createdAt: number;
  mood: "calm" | "confident" | "uncertain" | "fearful" | "fomo";
  note: string;
}

export interface ResearchItem {
  ca: string;
  name: string;
  symbol: string;
  stage: ResearchStage;
  thesis: string;
  bullCase: string;
  bearCase: string;
  catalysts: string[];
  risks: string[];
  invalidation: string;
  entryPlan: string;
  stopPlan: string;
  targetPlan: string;
  sizeSol?: number;
  horizon: string;
  confidence: number;
  tags: string[];
  sources: string[];
  snapshots: ResearchSnapshot[];
  decisions: ResearchDecision[];
  updatedAt: number;
  createdAt: number;
}
