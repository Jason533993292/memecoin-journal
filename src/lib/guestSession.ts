import type { Trade } from "./types";

export const GUEST_TRADES_KEY = "memecoin_journal_guest_trades_v1";
const MAX_GUEST_TRADES = 200;

function isGuestTrade(value: unknown): value is Trade {
  if (!value || typeof value !== "object") return false;
  const trade = value as Partial<Trade>;
  return typeof trade.id === "string"
    && trade.id.length <= 80
    && typeof trade.name === "string"
    && typeof trade.symbol === "string"
    && typeof trade.ca === "string"
    && (trade.result === "Win" || trade.result === "Loss" || trade.result === "BE")
    && Number.isFinite(trade.boughtSol)
    && Number.isFinite(trade.pnlSol)
    && Array.isArray(trade.mistakes);
}

export function readGuestTrades(storage?: Storage | null): Trade[] {
  if (!storage) return [];
  try {
    const parsed: unknown = JSON.parse(storage.getItem(GUEST_TRADES_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter(isGuestTrade).slice(0, MAX_GUEST_TRADES) : [];
  } catch {
    return [];
  }
}

export function writeGuestTrades(trades: Trade[], storage?: Storage | null): boolean {
  if (!storage) return false;
  try {
    storage.setItem(GUEST_TRADES_KEY, JSON.stringify(trades.slice(0, MAX_GUEST_TRADES)));
    return true;
  } catch {
    return false;
  }
}

export function clearGuestTrades(storage?: Storage | null) {
  storage?.removeItem(GUEST_TRADES_KEY);
}
