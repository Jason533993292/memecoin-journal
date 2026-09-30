const SOLANA_ADDRESS_PATTERN = /[1-9A-HJ-NP-Za-km-z]{32,44}/;
const NUMBER_PATTERN = /(?<![A-Za-z])[0-9]+(?:\.[0-9]+)?/g;

export interface QuickTradePasteResult {
  contractAddress?: string;
  bought?: string;
  sold?: string;
}

export interface TradeAmountInput {
  boughtSol: string;
  soldSol: string;
  pnlSol: string;
  boughtUsd: string;
  soldUsd: string;
  pnlUsd: string;
  solPrice: number;
}

export interface TradeAmountResult {
  boughtSol: number;
  soldSol: number;
  pnlSol: number;
  boughtUsd: number;
  soldUsd: number;
  pnlUsd: number;
}

const TRADE_CREATE_FIELDS = new Set([
  "ca", "name", "symbol", "wallet", "result", "setupType", "mcap",
  "liquidity", "entryLiquidityUsd", "exitLiquidityUsd", "entryMarketCapUsd",
  "exitMarketCapUsd", "slippagePct", "dex", "executionType", "wouldTakeAgain",
  "tradeQualityScore", "price", "boughtSol", "boughtUsd", "soldSol", "soldUsd",
  "pnlSol", "pnlUsd", "mistakes", "goodTags", "isPaper", "notes", "screenshotUrl",
  "durationMinutes", "entryTime", "exitTime", "initialRiskSol", "stopPrice", "feesSol",
  "entryTimezoneOffset", "tradedAt", "solUsdRate", "solUsdRateSource", "tradeMode",
  "date", "createdAt",
]);

const OPTIONAL_NUMBER_LIMITS: Record<string, [number, number]> = {
  createdAt: [0, 10_000_000_000_000],
  boughtUsd: [0, 100_000_000_000],
  soldSol: [0, 100_000_000],
  soldUsd: [0, 100_000_000_000],
  mcap: [0, 1_000_000_000_000],
  liquidity: [0, 1_000_000_000_000],
  entryLiquidityUsd: [0, 1_000_000_000_000],
  exitLiquidityUsd: [0, 1_000_000_000_000],
  entryMarketCapUsd: [0, 1_000_000_000_000],
  exitMarketCapUsd: [0, 1_000_000_000_000],
  slippagePct: [0, 100],
  price: [0, 1_000_000_000],
  initialRiskSol: [0, 100_000_000],
  stopPrice: [0, 1_000_000_000],
  feesSol: [0, 100_000_000],
  durationMinutes: [0, 525_600],
  entryTimezoneOffset: [-840, 840],
  tradedAt: [0, 10_000_000_000_000],
  solUsdRate: [0, 1_000_000_000],
  tradeQualityScore: [0, 100],
};

const OPTIONAL_STRING_LIMITS: Record<string, number> = {
  notes: 4_000,
  dex: 80,
  entryTime: 80,
  exitTime: 80,
  screenshotUrl: 500_000,
  executionType: 20,
};

function validateStringField(data: Record<string, unknown>, field: string, maxLength: number, minLength = 0): string | null {
  const value = data[field];
  if (typeof value !== "string" || value.length < minLength || value.length > maxLength) {
    return `${field} must be text${minLength ? ` with at least ${minLength} character` : ""} and no more than ${maxLength} characters.`;
  }
  return null;
}

/** Returns a user-readable reason a trade create would fail the deployed Firestore schema rules. */
export function getTradeCreateValidationError(value: Record<string, unknown>): string | null {
  const unknownField = Object.keys(value).find((field) => !TRADE_CREATE_FIELDS.has(field));
  if (unknownField) return `Unsupported trade field: ${unknownField}. Please refresh the page and try again.`;

  for (const [field, maxLength, minLength] of [
    ["ca", 64, 0], ["name", 120, 1], ["symbol", 40, 1], ["wallet", 80, 1], ["setupType", 120, 1],
  ] as const) {
    const error = validateStringField(value, field, maxLength, minLength);
    if (error) return error;
  }

  if (!["Win", "Loss", "BE"].includes(String(value.result))) {
    return "Choose Win, Loss, or Break-Even before saving.";
  }

  for (const field of ["boughtSol", "pnlSol", "pnlUsd"] as const) {
    const amount = value[field];
    const min = field === "pnlSol" || field === "pnlUsd" ? -100_000_000_000 : 0;
    const max = field === "pnlUsd" ? 100_000_000_000 : 100_000_000;
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < min || amount > max) {
      return `${field} is outside the range Firestore accepts. Check the trade amounts.`;
    }
  }

  const mistakes = value.mistakes;
  if (!Array.isArray(mistakes) || mistakes.length > 20 || mistakes.some((tag) => typeof tag !== "string" || tag.length > 80)) {
    return "Mistake tags must be text, with no more than 20 tags of 80 characters each.";
  }
  if (value.goodTags != null && (!Array.isArray(value.goodTags) || value.goodTags.length > 20 || value.goodTags.some((tag) => typeof tag !== "string" || tag.length > 80))) {
    return "Execution tags must be text, with no more than 20 tags of 80 characters each.";
  }

  for (const [field, [min, max]] of Object.entries(OPTIONAL_NUMBER_LIMITS)) {
    const amount = value[field];
    if (amount != null && (typeof amount !== "number" || !Number.isFinite(amount) || amount < min || amount > max)) {
      return `${field} must be between ${min} and ${max}.`;
    }
  }

  for (const [field, maxLength] of Object.entries(OPTIONAL_STRING_LIMITS)) {
    const error = value[field] == null ? null : validateStringField(value, field, maxLength);
    if (error) return error;
  }
  if (value.executionType != null && !["discretionary", "momentum", "sniper", "copy", "other"].includes(String(value.executionType))) {
    return "Execution type is not a supported option.";
  }
  if (value.wouldTakeAgain != null && typeof value.wouldTakeAgain !== "boolean") return "Would-take-again must be yes or no.";
  if (value.isPaper != null && typeof value.isPaper !== "boolean") return "Paper-trade status must be yes or no.";
  if (value.solUsdRateSource != null && !["user", "live-at-entry", "imported", "unknown"].includes(String(value.solUsdRateSource))) {
    return "SOL price source is not a supported option.";
  }
  if (value.tradeMode != null && !["real", "paper"].includes(String(value.tradeMode))) return "Trade mode is not a supported option.";
  if (typeof value.notes !== "string" || value.notes.length > 4_000) return "Notes must be text and no more than 4,000 characters.";
  if (typeof value.createdAt !== "number" || !Number.isFinite(value.createdAt)) return "Trade creation time is missing. Refresh and try again.";

  return null;
}

function parseOptionalAmount(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    throw new RangeError("Amounts must be finite numbers.");
  }
  return parsed;
}

function parseRequiredAmount(value: string, field: string): number {
  const parsed = parseOptionalAmount(value);
  if (parsed === undefined) {
    throw new RangeError(`${field} is required.`);
  }
  return parsed;
}

export function parseQuickTradePaste(value: string): QuickTradePasteResult {
  const contractAddress = value.match(SOLANA_ADDRESS_PATTERN)?.[0];
  const withoutAddress = contractAddress ? value.replace(contractAddress, " ") : value;
  const labelledBought = withoutAddress.match(/(?:bought|buy|spent|entry)\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?)/i)?.[1];
  const labelledSold = withoutAddress.match(/(?:sold|sell|received|exit)\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?)/i)?.[1];
  const numbers = [...withoutAddress.matchAll(NUMBER_PATTERN)].map((match) => match[0]);

  return {
    contractAddress,
    bought: labelledBought || numbers[0],
    sold: labelledSold || numbers[1],
  };
}

export function buildTradeAmounts(input: TradeAmountInput): TradeAmountResult {
  const boughtSol = parseRequiredAmount(input.boughtSol, "Bought SOL");
  const pnlSol = parseRequiredAmount(input.pnlSol, "Net P&L SOL");
  const soldSolInput = parseOptionalAmount(input.soldSol);
  const boughtUsdInput = parseOptionalAmount(input.boughtUsd);
  const pnlUsdInput = parseOptionalAmount(input.pnlUsd);
  const soldUsdInput = parseOptionalAmount(input.soldUsd);
  const solPrice = Number.isFinite(input.solPrice) && input.solPrice > 0 ? input.solPrice : 0;

  const boughtUsd = boughtUsdInput ?? boughtSol * solPrice;
  const pnlUsd = pnlUsdInput ?? pnlSol * solPrice;
  const soldSol = soldSolInput ?? Math.max(0, boughtSol + pnlSol);
  const soldUsd = soldUsdInput ?? Math.max(0, boughtUsd + pnlUsd);

  if (boughtSol < 0 || pnlSol < -100_000_000 || boughtUsd < 0 || soldSol < 0 || soldUsd < 0) {
    throw new RangeError("Trade amounts cannot be negative except for Net P&L.");
  }

  return { boughtSol, soldSol, pnlSol, boughtUsd, soldUsd, pnlUsd };
}
