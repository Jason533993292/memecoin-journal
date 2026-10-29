export interface TradeFilterPreset {
  id: string;
  name: string;
  searchQuery: string;
  result: "All" | "Win" | "Loss" | "BE";
  wallet: string;
  setup: string;
  mistake: string;
  dateRange: "all" | "today" | "7d" | "30d";
  sortBy: "date-desc" | "date-asc" | "pnl-desc" | "pnl-asc" | "size-desc";
  currency: "SOL" | "USD";
  view: "table" | "cards";
}

const results = new Set(["All", "Win", "Loss", "BE"]);
const dateRanges = new Set(["all", "today", "7d", "30d"]);
const sortOrders = new Set(["date-desc", "date-asc", "pnl-desc", "pnl-asc", "size-desc"]);

export function parseTradeFilterPresets(raw: string | null): TradeFilterPreset[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.filter(isPreset).slice(0, 10);
  } catch { return []; }
}

function isPreset(value: unknown): value is TradeFilterPreset {
  if (!value || typeof value !== "object") return false;
  const preset = value as Record<string, unknown>;
  return typeof preset.id === "string" && preset.id.length <= 100
    && typeof preset.name === "string" && preset.name.length > 0 && preset.name.length <= 40
    && typeof preset.searchQuery === "string" && preset.searchQuery.length <= 200
    && typeof preset.result === "string" && results.has(preset.result)
    && typeof preset.wallet === "string" && preset.wallet.length <= 120
    && typeof preset.setup === "string" && preset.setup.length <= 120
    && typeof preset.mistake === "string" && preset.mistake.length <= 120
    && typeof preset.dateRange === "string" && dateRanges.has(preset.dateRange)
    && typeof preset.sortBy === "string" && sortOrders.has(preset.sortBy)
    && (preset.currency === "SOL" || preset.currency === "USD")
    && (preset.view === "table" || preset.view === "cards");
}
