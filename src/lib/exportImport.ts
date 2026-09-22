import { Trade } from "./types";

export function exportTradesToCSV(trades: Trade[]) {
  if (trades.length === 0) {
    alert("No trades to export.");
    return;
  }

  const headers = [
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
    "MCap USD",
    "Liquidity USD",
    "Price USD",
    "Mistakes / Tags",
    "Notes"
  ];

  const rows = trades.map((t) => {
    const dateStr = t.date?.seconds
      ? new Date(t.date.seconds * 1000).toISOString()
      : new Date(t.createdAt || Date.now()).toISOString();

    const escapeCsv = (str: string | undefined | null) => {
      if (!str) return '""';
      return `"${str.replace(/"/g, '""')}"`;
    };

    return [
      dateStr,
      escapeCsv(t.name),
      escapeCsv(t.symbol),
      escapeCsv(t.ca),
      escapeCsv(t.wallet),
      t.result || "Win",
      t.boughtSol || 0,
      t.soldSol || 0,
      t.pnlSol || 0,
      t.pnlUsd || 0,
      t.mcap || 0,
      t.liquidity || 0,
      t.price || 0,
      escapeCsv((t.mistakes || []).join("; ")),
      escapeCsv(t.notes || "")
    ].join(",");
  });

  const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
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
    alert("No trades to export.");
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
