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
