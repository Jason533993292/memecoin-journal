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
  paper: "border-indigo-300 bg-indigo-50 text-indigo-800",
  live: "border-sky-300 bg-sky-50 text-sky-800",
  Win: "border-emerald-300 bg-emerald-50 text-emerald-800",
  Loss: "border-rose-300 bg-rose-50 text-rose-800",
  BE: "border-neutral-300 bg-neutral-100 text-neutral-800",
};
