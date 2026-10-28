export const TRADE_DRAFT_VERSION = 1;

export type TradeDraftData = {
  ca: string;
  wallet: string;
  result: "Win" | "Loss" | "BE" | "";
  setupType: string;
  customSetup: string;
  durationMinutes?: number;
  tradedAtInput: string;
  initialRiskSol: string;
  feesSol: string;
  stopPrice: string;
  entryLiquidityUsd: string;
  exitLiquidityUsd: string;
  entryMarketCapUsd: string;
  exitMarketCapUsd: string;
  slippagePct: string;
  quoteCurrency: string;
  quoteUsdRate: string;
  venue: string;
  otherQuoteSymbol: string;
  otherVenue: string;
  boughtQuote: string;
  soldQuote: string;
  pnlQuote: string;
  screenshotUrl: string;
  selectedGoodTags: string[];
  selectedMistakes: string[];
  notes: string;
  processGrade?: "A" | "B" | "C" | "D";
  confidenceAtEntry: string;
  fills?: import("./types").TradeFill[];
};

export type StoredTradeDraft = {
  version: typeof TRADE_DRAFT_VERSION;
  savedAt: number;
  data: TradeDraftData;
};

export function tradeDraftStorageKey(userId: string): string {
  return `memecoin_journal_${userId}_new_trade_draft`;
}

export function hasMeaningfulTradeDraft(data: TradeDraftData): boolean {
  return Boolean(
    data.ca.trim()
      || data.boughtQuote.trim()
      || data.soldQuote.trim()
      || data.pnlQuote.trim()
      || data.notes.trim()
      || data.screenshotUrl
      || data.selectedGoodTags.length
      || data.selectedMistakes.length
      || Boolean(data.fills?.length)
  );
}

export function parseStoredTradeDraft(value: string | null): StoredTradeDraft | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<StoredTradeDraft>;
    if (parsed.version !== TRADE_DRAFT_VERSION || !Number.isFinite(parsed.savedAt) || !parsed.data || typeof parsed.data !== "object") return null;
    const data = parsed.data as Partial<TradeDraftData>;
    if (typeof data.ca !== "string" || typeof data.notes !== "string" || !Array.isArray(data.selectedGoodTags) || !Array.isArray(data.selectedMistakes)) return null;
    return parsed as StoredTradeDraft;
  } catch {
    return null;
  }
}
