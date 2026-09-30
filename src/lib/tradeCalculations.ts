import type { Trade, TradeMode } from "./types";

export type UsdValueSource = "stored" | "estimated" | "unavailable";

export interface UsdValueStatus {
  value: number | null;
  source: UsdValueSource;
}

export interface TradeOutcome {
  pnlSol: number;
  pnlUsd: number | null;
  feesSol: number;
  result: Trade["result"];
}

export interface TradeSummary {
  count: number;
  totalPnlSol: number;
  totalPnlUsd: number;
  medianPnlSol: number;
  maxDrawdownSol: number;
  totalFeesSol: number;
}

function getTimestamp(trade: Trade): number {
  if (typeof trade.tradedAt === "number" && Number.isFinite(trade.tradedAt)) return trade.tradedAt;
  const date = trade.date;
  if (date instanceof Date) return date.getTime();
  if (date && typeof date === "object" && "seconds" in date && typeof date.seconds === "number") {
    return date.seconds * 1000;
  }
  if (typeof date === "number") return date;
  if (typeof date === "string") {
    const parsed = Date.parse(date);
    if (Number.isFinite(parsed)) return parsed;
  }
  return trade.createdAt ?? 0;
}

export function normalizeTrade(trade: Trade): Trade {
  const tradedAt = typeof trade.tradedAt === "number" && Number.isFinite(trade.tradedAt)
    ? trade.tradedAt
    : getTimestamp(trade);

  return {
    ...trade,
    tradedAt: tradedAt > 0 ? tradedAt : undefined,
    tradeMode: trade.tradeMode ?? (trade.isPaper ? "paper" : "real"),
    goodTags: trade.goodTags ?? [],
    mistakes: trade.mistakes ?? [],
  };
}

export function getUsdValueStatus(trade: Trade, currentSolPrice: number): UsdValueStatus {
  if (typeof trade.pnlUsd === "number" && Number.isFinite(trade.pnlUsd)) {
    return { value: trade.pnlUsd, source: "stored" };
  }
  if (Number.isFinite(currentSolPrice) && currentSolPrice > 0) {
    return { value: (trade.pnlSol || 0) * currentSolPrice, source: "estimated" };
  }
  return { value: null, source: "unavailable" };
}

export function calculateTradeOutcome(trade: Trade, currentSolPrice: number): TradeOutcome {
  const usd = getUsdValueStatus(trade, currentSolPrice);
  return {
    pnlSol: trade.pnlSol || 0,
    pnlUsd: usd.value,
    feesSol: trade.feesSol || 0,
    result: trade.result,
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[midpoint - 1] + sorted[midpoint]) / 2
    : sorted[midpoint];
}

export function summarizeTrades(trades: Trade[], currentSolPrice: number, mode?: TradeMode): TradeSummary {
  const selected = mode ? trades.filter((trade) => normalizeTrade(trade).tradeMode === mode) : trades;
  let equity = 0;
  let peak = 0;
  let maxDrawdownSol = 0;
  let totalPnlSol = 0;
  let totalPnlUsd = 0;
  let totalFeesSol = 0;

  for (const trade of selected) {
    const outcome = calculateTradeOutcome(trade, currentSolPrice);
    totalPnlSol += outcome.pnlSol;
    totalPnlUsd += outcome.pnlUsd ?? 0;
    totalFeesSol += outcome.feesSol;
    equity += outcome.pnlSol;
    peak = Math.max(peak, equity);
    maxDrawdownSol = Math.max(maxDrawdownSol, peak - equity);
  }

  return {
    count: selected.length,
    totalPnlSol,
    totalPnlUsd,
    medianPnlSol: median(selected.map((trade) => trade.pnlSol || 0)),
    maxDrawdownSol,
    totalFeesSol,
  };
}
