import type { Trade } from "./types";

function getTradeTimestamp(trade: Partial<Trade>): number {
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

function getTradeDate(trade: Partial<Trade>): Date {
  return new Date(getTradeTimestamp(trade));
}

function escapeCsvField(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '""';
  const escaped = String(value).replace(/"/g, '""');
  const safe = /^[=+\-@\t\r]/.test(escaped) ? `'${escaped}` : escaped;
  return `"${safe}"`;
}

export const CSV_HEADERS = [
  "Date",
  "Name",
  "Symbol",
  "Contract Address",
  "Wallet",
  "Result",
  "Bought SOL",
  "Bought USD",
  "Sold SOL",
  "Sold USD",
  "Net PnL SOL",
  "Net PnL USD",
  "Setup Type",
  "Duration Mins",
  "MCap USD",
  "Liquidity USD",
  "Price USD",
  "Mistakes / Tags", "Good Tags", "Notes", "Initial Risk SOL", "Fees SOL",
  "Entry Liquidity USD", "Exit Liquidity USD", "Entry MCap USD", "Exit MCap USD",
  "Slippage %", "Stop Price", "Dex", "Execution Type", "Would Take Again", "Quality Score",
  "Screenshot URL", "Timezone Offset", "SOL/USD Rate", "SOL/USD Rate Source", "Trade Mode", "Traded At", "Created At"
];

/**
 * Parses CSV text taking quotes, escaped quotes, and commas into account.
 */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip next quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = "";
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentField.trim());
      if (currentRow.some((f) => f.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = "";
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

export function buildTradesCsv(trades: Trade[]): string {
  const rows = trades.map((t) => {
    const dateStr = getTradeDate(t).toISOString();

    return [
      dateStr,
      escapeCsvField(t.name),
      escapeCsvField(t.symbol),
      escapeCsvField(t.ca),
      escapeCsvField(t.wallet),
      t.result || "Win",
      t.boughtSol || 0,
      t.boughtUsd ?? "",
      t.soldSol || 0,
      t.soldUsd ?? "",
      t.pnlSol || 0,
      t.pnlUsd ?? 0,
      escapeCsvField(t.setupType || "General"),
      t.durationMinutes || "",
      t.mcap || 0,
      t.liquidity || 0,
      t.price || 0,
      escapeCsvField((t.mistakes || []).join("; ")), escapeCsvField((t.goodTags || []).join("; ")),
      escapeCsvField(t.notes || ""), t.initialRiskSol || "", t.feesSol || "",
      t.entryLiquidityUsd || "", t.exitLiquidityUsd || "", t.entryMarketCapUsd || "", t.exitMarketCapUsd || "",
      t.slippagePct ?? "", t.stopPrice ?? "", escapeCsvField(t.dex || ""), escapeCsvField(t.executionType || ""),
      t.wouldTakeAgain === undefined ? "" : String(t.wouldTakeAgain), t.tradeQualityScore ?? "",
      escapeCsvField(t.screenshotUrl || ""), t.entryTimezoneOffset ?? "", t.solUsdRate ?? "",
      escapeCsvField(t.solUsdRateSource || ""), t.tradeMode || (t.isPaper ? "paper" : "real"),
      t.tradedAt || getTradeDate(t).getTime(), t.createdAt ?? ""
    ].join(",");
  });

  return [CSV_HEADERS.join(","), ...rows].join("\n");
}

export function exportTradesToCSV(trades: Trade[]) {
  if (trades.length === 0) return;

  const link = document.createElement("a");
  const url = URL.createObjectURL(new Blob([buildTradesCsv(trades)], { type: "text/csv;charset=utf-8" }));
  link.href = url;
  link.download = `memecoin-journal-trades-${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function serializeTradesToJson(trades: Trade[]): string {
  const backup = trades.map((trade) => {
    const copy: Partial<Trade> = { ...trade };
    delete copy.id;
    delete copy.date;
    return { ...copy, tradedAt: getTradeTimestamp(trade) };
  });
  return JSON.stringify(backup, null, 2);
}

export function exportTradesToJSON(trades: Trade[]) {
  if (trades.length === 0) {
    return;
  }

  const dataStr = URL.createObjectURL(new Blob([serializeTradesToJson(trades)], { type: "application/json;charset=utf-8" }));
  const link = document.createElement("a");
  link.setAttribute("href", dataStr);
  link.setAttribute("download", `memecoin-journal-backup-${new Date().toISOString().split("T")[0]}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(dataStr);
}

export type TradeImportFormat = "csv" | "json";
export type ImportedTrade = Omit<Trade, "id" | "date"> & { tradedAt: number };

export function tradeImportKey(trade: Partial<Trade>): string {
  return [
    (trade.ca || "").trim().toLowerCase(),
    getTradeTimestamp(trade),
    trade.boughtSol ?? "",
    trade.soldSol ?? "",
    trade.pnlSol ?? "",
  ].join("|");
}

export function filterNewTradeImports<T extends Partial<Trade>>(
  imported: T[],
  existing: Partial<Trade>[]
): T[] {
  const seen = new Set(existing.map(tradeImportKey));
  return imported.filter((trade) => {
    const key = tradeImportKey(trade);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const number = (value: unknown, fallback = 0) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const tags = (value: unknown) => Array.isArray(value) ? value.filter((tag): tag is string => typeof tag === "string").slice(0, 20) : typeof value === "string" ? value.split(";").map((tag) => tag.trim()).filter(Boolean).slice(0, 20) : [];

const optionalNumber = (value: unknown) => {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

function timestamp(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (value && typeof value === "object" && "seconds" in value && typeof value.seconds === "number") {
    return value.seconds * 1000;
  }
  return NaN;
}

function optionalText(value: unknown, maxLength: number) {
  return typeof value === "string" && value.length > 0 ? value.slice(0, maxLength) : undefined;
}

function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined)) as T;
}

export function parseTradeImport(text: string, format: TradeImportFormat): ImportedTrade[] {
  const rows: Record<string, unknown>[] = format === "json"
    ? (() => {
        const parsed: unknown = JSON.parse(text);
        if (!Array.isArray(parsed)) throw new Error("JSON backup must be an array.");
        return parsed.map((item, index) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) {
            throw new Error(`Invalid trade data on row ${index + 1}.`);
          }
          return item as Record<string, unknown>;
        });
      })()
    : (() => { const [headers, ...data] = parseCSV(text); if (!headers || !data.length) throw new Error("CSV file is empty."); return data.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]))); })();
  if (!rows.length || rows.length > 500) throw new Error(rows.length ? "Import up to 500 trades at a time." : "No trades found.");
  return rows.map((raw, index) => {
    const dateValue = raw.tradedAt ?? raw["Traded At"] ?? raw.date ?? raw.Date;
    const tradedAt = timestamp(dateValue);
    const boughtSol = number(raw.boughtSol ?? raw["Bought SOL"], NaN);
    const pnlSol = number(raw.pnlSol ?? raw["Net PnL SOL"], NaN);
    const pnlUsd = number(raw.pnlUsd ?? raw["Net PnL USD"], NaN);
    const result = String(raw.result ?? raw.Result ?? "");
    if (!Number.isFinite(tradedAt) || !Number.isFinite(boughtSol) || !Number.isFinite(pnlSol) || !Number.isFinite(pnlUsd) || !["Win", "Loss", "BE"].includes(result)) throw new Error(`Invalid trade data on row ${index + 1}.`);
    const tradeMode = raw.tradeMode === "paper" || raw["Trade Mode"] === "paper" ? "paper" : "real";
    const importedTrade = compact({
      ca: String(raw.ca ?? raw["Contract Address"] ?? "").slice(0, 64),
      name: (String(raw.name ?? raw.Name ?? "").trim() || "Token").slice(0, 120),
      symbol: (String(raw.symbol ?? raw.Symbol ?? "").trim() || "MEME").slice(0, 40),
      wallet: (String(raw.wallet ?? raw.Wallet ?? "").trim() || "Main").slice(0, 80),
      result: result as Trade["result"],
      setupType: (String(raw.setupType ?? raw["Setup Type"] ?? "").trim() || "General").slice(0, 120),
      boughtSol,
      boughtUsd: optionalNumber(raw.boughtUsd ?? raw["Bought USD"]),
      soldSol: optionalNumber(raw.soldSol ?? raw["Sold SOL"]),
      soldUsd: optionalNumber(raw.soldUsd ?? raw["Sold USD"]),
      pnlSol,
      pnlUsd,
      mcap: optionalNumber(raw.mcap ?? raw["MCap USD"]),
      liquidity: optionalNumber(raw.liquidity ?? raw["Liquidity USD"]),
      price: optionalNumber(raw.price ?? raw["Price USD"]),
      mistakes: tags(raw.mistakes ?? raw["Mistakes / Tags"]),
      goodTags: tags(raw.goodTags ?? raw["Good Tags"]),
      notes: String(raw.notes ?? raw.Notes ?? "").slice(0, 4_000),
      screenshotUrl: optionalText(raw.screenshotUrl ?? raw["Screenshot URL"], 500_000),
      durationMinutes: optionalNumber(raw.durationMinutes ?? raw["Duration Mins"]),
      initialRiskSol: optionalNumber(raw.initialRiskSol ?? raw["Initial Risk SOL"]),
      stopPrice: optionalNumber(raw.stopPrice ?? raw["Stop Price"]),
      feesSol: optionalNumber(raw.feesSol ?? raw["Fees SOL"]),
      entryLiquidityUsd: optionalNumber(raw.entryLiquidityUsd ?? raw["Entry Liquidity USD"]),
      exitLiquidityUsd: optionalNumber(raw.exitLiquidityUsd ?? raw["Exit Liquidity USD"]),
      entryMarketCapUsd: optionalNumber(raw.entryMarketCapUsd ?? raw["Entry MCap USD"]),
      exitMarketCapUsd: optionalNumber(raw.exitMarketCapUsd ?? raw["Exit MCap USD"]),
      slippagePct: optionalNumber(raw.slippagePct ?? raw["Slippage %"]),
      dex: optionalText(raw.dex ?? raw.Dex, 80),
      executionType: optionalText(raw.executionType ?? raw["Execution Type"], 40) as Trade["executionType"],
      wouldTakeAgain: typeof raw.wouldTakeAgain === "boolean" ? raw.wouldTakeAgain : raw["Would Take Again"] === "true" ? true : raw["Would Take Again"] === "false" ? false : undefined,
      tradeQualityScore: optionalNumber(raw.tradeQualityScore ?? raw["Quality Score"]),
      entryTimezoneOffset: optionalNumber(raw.entryTimezoneOffset ?? raw["Timezone Offset"]),
      solUsdRate: optionalNumber(raw.solUsdRate ?? raw["SOL/USD Rate"]),
      solUsdRateSource: optionalText(raw.solUsdRateSource ?? raw["SOL/USD Rate Source"], 40) as Trade["solUsdRateSource"],
      tradeMode,
      isPaper: typeof raw.isPaper === "boolean" ? raw.isPaper : tradeMode === "paper" ? true : undefined,
      tradedAt,
      createdAt: optionalNumber(raw.createdAt ?? raw["Created At"]) ?? tradedAt,
    }) as ImportedTrade;

    const boundedValues: Array<[number | undefined, number, number]> = [
      [importedTrade.boughtSol, 0, 100_000_000],
      [importedTrade.pnlSol, -100_000_000, 100_000_000],
      [importedTrade.pnlUsd, -100_000_000_000, 100_000_000_000],
      [importedTrade.boughtUsd, 0, 100_000_000_000],
      [importedTrade.soldSol, 0, 100_000_000],
      [importedTrade.soldUsd, 0, 100_000_000_000],
      [importedTrade.feesSol, 0, 100_000_000],
      [importedTrade.solUsdRate, 0, 1_000_000_000],
      [importedTrade.createdAt, 0, 10_000_000_000_000],
    ];
    const invalidBoundedValue = boundedValues.some(([value, minimum, maximum]) =>
      value !== undefined && (value < minimum || value > maximum)
    );
    if (invalidBoundedValue) {
      throw new Error(`Invalid trade data on row ${index + 1}.`);
    }

    return importedTrade;
  });
}
