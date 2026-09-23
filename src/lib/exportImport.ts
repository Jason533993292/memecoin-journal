import { Trade } from "./types";
import { getTradeDate, escapeCsvField } from "./utils";

export const CSV_HEADERS = [
  "Date",
  "Name",
  "Symbol",
  "Contract Address",
  "Wallet",
  "Result",
  "Bought SOL",
  "Sold SOL",
  "Net PnL SOL",
  "Net PnL USD",
  "Setup Type",
  "Duration Mins",
  "MCap USD",
  "Liquidity USD",
  "Price USD",
  "Mistakes / Tags",
  "Notes",
  "Initial Risk SOL",
  "Fees SOL"
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

export function exportTradesToCSV(trades: Trade[]) {
  if (trades.length === 0) {
    return;
  }

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
      t.soldSol || 0,
      t.pnlSol || 0,
      t.pnlUsd || 0,
      escapeCsvField(t.setupType || "General"),
      t.durationMinutes || "",
      t.mcap || 0,
      t.liquidity || 0,
      t.price || 0,
      escapeCsvField((t.mistakes || []).join("; ")),
      escapeCsvField(t.notes || ""),
      t.initialRiskSol || "",
      t.feesSol || ""
    ].join(",");
  });

  const csvContent = "data:text/csv;charset=utf-8," + [CSV_HEADERS.join(","), ...rows].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `memecoin-journal-trades-${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportTradesToJSON(trades: Trade[]) {
  if (trades.length === 0) {
    return;
  }

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(trades, null, 2));
  const link = document.createElement("a");
  link.setAttribute("href", dataStr);
  link.setAttribute("download", `memecoin-journal-backup-${new Date().toISOString().split("T")[0]}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
