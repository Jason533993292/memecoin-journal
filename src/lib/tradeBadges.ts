import type { Trade } from "@/lib/types";

export type TradeBadgeKind = "paper" | "live" | Trade["result"];

export const TRADE_BADGE_LABELS: Record<TradeBadgeKind, string> = {
  paper: "Paper",
  live: "Live",
  Win: "Win",
  Loss: "Loss",
  BE: "Breakeven",
};

export const TRADE_BADGE_STYLES: Record<TradeBadgeKind, string> = {
  paper: "paper-trade-badge trade-status-paper",
  live: "trade-status-live",
  Win: "trade-status-win",
  Loss: "trade-status-loss",
  BE: "trade-status-breakeven",
};
