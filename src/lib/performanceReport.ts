import type { Trade } from "./types";

export type PerformanceReportPeriod = "week" | "month";

export type PerformanceReport = {
  label: string;
  count: number;
  wins: number;
  winRate: number | null;
  pnlSol: number;
  pnlUsd: number;
  averageSol: number;
  averageUsd: number;
  feesSol: number;
  feesUsd: number;
  previousPnlSol: number;
  previousPnlUsd: number;
  bestSetup: { name: string; count: number; pnlSol: number; pnlUsd: number } | null;
  repeatedMistake: { name: string; count: number } | null;
};

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function tradeTime(trade: Trade) {
  const value = trade.tradedAt ?? trade.date ?? trade.createdAt;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Date.parse(value) || 0;
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") return value.toMillis();
  return 0;
}

function tradePnlUsd(trade: Trade, solPrice: number) {
  if (typeof trade.pnlUsd === "number" && Number.isFinite(trade.pnlUsd)) return trade.pnlUsd;
  return (trade.pnlSol || 0) * (trade.solUsdRate || solPrice);
}

export function buildPerformanceReport(trades: Trade[], period: PerformanceReportPeriod, now = new Date(), solPrice = 150): PerformanceReport {
  const currentEnd = now.getTime() + 1;
  const currentStart = period === "week"
    ? startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6))
    : new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const previousStart = period === "week"
    ? startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13))
    : new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  const current = trades.filter((trade) => { const time = tradeTime(trade); return time >= currentStart && time < currentEnd; });
  const previous = trades.filter((trade) => { const time = tradeTime(trade); return time >= previousStart && time < currentStart; });
  const pnlSol = current.reduce((sum, trade) => sum + (trade.pnlSol || 0), 0);
  const pnlUsd = current.reduce((sum, trade) => sum + tradePnlUsd(trade, solPrice), 0);
  const setupMap = new Map<string, { count: number; pnlSol: number; pnlUsd: number }>();
  const mistakeMap = new Map<string, number>();
  for (const trade of current) {
    const setup = trade.setupType || "General / Discretionary";
    const existing = setupMap.get(setup) ?? { count: 0, pnlSol: 0, pnlUsd: 0 };
    setupMap.set(setup, { count: existing.count + 1, pnlSol: existing.pnlSol + (trade.pnlSol || 0), pnlUsd: existing.pnlUsd + tradePnlUsd(trade, solPrice) });
    for (const mistake of new Set(trade.mistakes || [])) mistakeMap.set(mistake, (mistakeMap.get(mistake) ?? 0) + 1);
  }
  const bestSetupEntry = [...setupMap.entries()].sort((a, b) => b[1].pnlSol - a[1].pnlSol)[0];
  const mistakeEntry = [...mistakeMap.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  const wins = current.filter((trade) => trade.pnlSol > 0).length;
  return {
    label: period === "week" ? "Last 7 days" : now.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
    count: current.length,
    wins,
    winRate: current.length ? (wins / current.length) * 100 : null,
    pnlSol,
    pnlUsd,
    averageSol: current.length ? pnlSol / current.length : 0,
    averageUsd: current.length ? pnlUsd / current.length : 0,
    feesSol: current.reduce((sum, trade) => sum + (trade.feesSol || 0), 0),
    feesUsd: current.reduce((sum, trade) => sum + (trade.feesSol || 0) * (trade.solUsdRate || solPrice), 0),
    previousPnlSol: previous.reduce((sum, trade) => sum + (trade.pnlSol || 0), 0),
    previousPnlUsd: previous.reduce((sum, trade) => sum + tradePnlUsd(trade, solPrice), 0),
    bestSetup: bestSetupEntry ? { name: bestSetupEntry[0], ...bestSetupEntry[1] } : null,
    repeatedMistake: mistakeEntry ? { name: mistakeEntry[0], count: mistakeEntry[1] } : null,
  };
}

