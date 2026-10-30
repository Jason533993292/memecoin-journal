"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { Trade } from "../lib/types";
import { db, auth } from "../lib/firebase";
import { doc, deleteDoc, collection, Timestamp, writeBatch } from "firebase/firestore";
import {
  Search,
  Trash2,
  Edit2,
  Upload,
  LayoutGrid,
  Table as TableIcon,
  FileSpreadsheet,
  Image as ImageIcon,
  Clock,
  BookOpen,
  BookmarkPlus,
} from "lucide-react";
import { exportTradesToCSV, exportTradesToJSON, filterNewTradeImports, parseTradeImport } from "../lib/exportImport";
import { formatSol, getTradeTimestamp } from "../lib/utils";
import { useCurrentTime, useLocalStorageValue, writeLocalStorageValue } from "../lib/useLocalStorage";
import { useToast } from "./Toast";
import { getTradeBoughtUsd, getTradeSoldUsd, getUsdValueStatus } from "../lib/tradeCalculations";
import ImageLightboxModal from "./ImageLightboxModal";
import { deleteSupabaseTrade, importSupabaseTrades, usesSupabaseJournal } from "../lib/journalBackend";
import type { ImportedTrade } from "../lib/exportImport";
import { parseTradeFilterPresets, type TradeFilterPreset } from "../lib/tradeFilterPresets";
import { publishTradeSync } from "../lib/tradeSync";
import TradeBadge from "./TradeBadge";
import EmptyState from "./EmptyState";

interface TradeJournalViewProps {
  userId: string;
  trades: Trade[];
  solPrice?: number;
  onOpenNewTrade: () => void;
  onTradeDeleted: () => void;
  onUndoAvailable?: (trade: Trade) => void;
  onOpenEditTrade: (trade: Trade) => void;
  onSelectTrade: (trade: Trade) => void;
  readOnly?: boolean;
}

const JOURNAL_PAGE_SIZE = 30;

export default function TradeJournalView({
  userId,
  trades,
  solPrice = 150,
  onOpenNewTrade,
  onTradeDeleted,
  onUndoAvailable,
  onOpenEditTrade,
  onSelectTrade,
  readOnly = false,
}: TradeJournalViewProps) {
  const now = useCurrentTime();
  const lastBackupKey = `memecoin_journal_${userId}_last_backup_at`;
  const backupSnoozeKey = `memecoin_journal_${userId}_backup_snoozed_until`;
  const savedViewsKey = `memecoin_journal_${userId}_trade_filter_views`;
  const lastBackupAt = Number(useLocalStorageValue(lastBackupKey) || 0);
  const backupSnoozedUntil = Number(useLocalStorageValue(backupSnoozeKey) || 0);
  const savedViewsRaw = useLocalStorageValue(savedViewsKey);
  const savedViews = useMemo(() => parseTradeFilterPresets(savedViewsRaw), [savedViewsRaw]);
  const backupReminderDue =
    !readOnly &&
    now > 0 &&
    trades.length > 0 &&
    now >= backupSnoozedUntil &&
    (!lastBackupAt || now - lastBackupAt >= 30 * 24 * 60 * 60 * 1000);
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterResult, setFilterResult] = useState<string>("All");
  const [filterWallet, setFilterWallet] = useState<string>("All");
  const [filterSetup, setFilterSetup] = useState<string>("All");
  const [filterMistake, setFilterMistake] = useState<string>("All");
  const [dateRange, setDateRange] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date-desc" | "date-asc" | "pnl-desc" | "pnl-asc" | "size-desc">("date-desc");
  const [viewMode, setViewMode] = useState<"table" | "cards">("cards");
  const [currencyMode, setCurrencyMode] = useState<"SOL" | "USD">("SOL");
  const [tradeToDelete, setTradeToDelete] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<{
    fileName: string;
    trades: ImportedTrade[];
    duplicateCount: number;
  } | null>(null);
  const [importing, setImporting] = useState(false);
  const [showSaveView, setShowSaveView] = useState(false);
  const [savedViewName, setSavedViewName] = useState("");
  const [page, setPage] = useState(1);

  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const moreFiltersRef = useRef<HTMLDetailsElement | null>(null);

  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      const details = moreFiltersRef.current;
      if (details?.open && !details.contains(event.target as Node)) details.removeAttribute("open");
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") moreFiltersRef.current?.removeAttribute("open");
    };
    window.addEventListener("pointerdown", dismiss);
    window.addEventListener("keydown", dismissOnEscape);
    return () => {
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("keydown", dismissOnEscape);
    };
  }, []);

  // Collect unique mistakes across all trades
  const uniqueMistakes = useMemo(() => {
    const set = new Set<string>();
    trades.forEach((t) => {
      t.mistakes?.forEach((m) => set.add(m));
    });
    return Array.from(set);
  }, [trades]);

  // Collect unique setup types across all trades
  const uniqueSetups = useMemo(() => {
    const set = new Set<string>();
    trades.forEach((t) => {
      if (t.setupType) set.add(t.setupType);
    });
    return Array.from(set);
  }, [trades]);

  const resultCounts = useMemo(() => ({
    All: trades.length,
    Win: trades.filter((trade) => trade.result === "Win").length,
    Loss: trades.filter((trade) => trade.result === "Loss").length,
    BE: trades.filter((trade) => trade.result === "BE").length,
  }), [trades]);

  // Delete trade
  const requestDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setTradeToDelete(id);
  };

  const confirmDelete = async () => {
    if (!tradeToDelete) return;
    const id = tradeToDelete;
    setTradeToDelete(null);
    const deletedTrade = trades.find((trade) => trade.id === id);
    
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Please sign in to delete this trade.");
      if (usesSupabaseJournal()) {
        await deleteSupabaseTrade(currentUser.uid, id);
      } else {
        const tradeDocRef = doc(db, "users", currentUser.uid, "trades", id);
        await deleteDoc(tradeDocRef);
      }
      publishTradeSync({ type: "deleted", tradeId: id, sentAt: Date.now() });
      onTradeDeleted();
      if (deletedTrade) onUndoAvailable?.(deletedTrade);
    } catch (err) {
      console.error("Error deleting trade:", err);
      showToast("Failed to delete trade", "error");
    }
  };

  // Handle JSON/CSV Import
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast("Import file is too large", "error", "Choose a CSV or JSON file smaller than 5 MB.");
      e.target.value = "";
      return;
    }

    try {
      const text = await file.text();
      const imported = parseTradeImport(text, file.name.toLowerCase().endsWith(".json") ? "json" : "csv");
      const uniqueImported = filterNewTradeImports(imported, trades);

      if (uniqueImported.length > 0) {
        setPendingImport({
          fileName: file.name,
          trades: uniqueImported,
          duplicateCount: imported.length - uniqueImported.length,
        });
      } else {
        showToast("No new trades to import", "info", "Every trade in this file is already in the journal.");
      }
    } catch (err) {
      console.error(err);
      showToast(
        "Import could not be prepared",
        "error",
        err instanceof Error ? err.message : "Check the file and try again."
      );
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const confirmImport = async () => {
    if (!pendingImport || importing) return;
    setImporting(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Please sign in to import trades.");
      if (usesSupabaseJournal()) {
        await importSupabaseTrades(
          currentUser.uid,
          pendingImport.trades.map((item) => ({ ...item, date: new Date(item.tradedAt) }))
        );
      } else {
        const batch = writeBatch(db);
        for (const item of pendingImport.trades) {
          const tradeRef = doc(collection(db, "users", currentUser.uid, "trades"));
          batch.set(tradeRef, { ...item, date: Timestamp.fromMillis(item.tradedAt) });
        }
        await batch.commit();
      }
      const count = pendingImport.trades.length;
      const skipped = pendingImport.duplicateCount;
      showToast(
        `Imported ${count} trade${count === 1 ? "" : "s"}.`,
        "success",
        skipped > 0 ? `${skipped} duplicate${skipped === 1 ? " was" : "s were"} skipped.` : "The import completed as one atomic operation."
      );
      setPendingImport(null);
      onTradeDeleted();
    } catch (err) {
      console.error(err);
      showToast(
        "Nothing was imported",
        "error",
        err instanceof Error ? err.message : "The atomic import failed. Your existing journal was not changed."
      );
    } finally {
      setImporting(false);
    }
  };

  // Filter & Sort Trades
  const filteredTrades = useMemo(() => {
    const currentDate = new Date(now);
    const todayStart = now
      ? new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()).getTime()
      : 0;

    return trades
      .filter((trade) => {
        const matchesSearch =
          trade.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          trade.symbol?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          trade.ca?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (trade.setupType && trade.setupType.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (trade.notes && trade.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (trade.mistakes && trade.mistakes.some((m) => m.toLowerCase().includes(searchQuery.toLowerCase()))) ||
          (trade.goodTags && trade.goodTags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase())));

        const matchesResult = filterResult === "All" || trade.result === filterResult;
        const matchesWallet = filterWallet === "All" || trade.wallet === filterWallet;
        const matchesSetup = filterSetup === "All" || trade.setupType === filterSetup;
        const matchesMistake = filterMistake === "All" || (trade.mistakes && trade.mistakes.includes(filterMistake));

        // Date range filter
        let matchesDate = true;
        const tradeTimestamp = getTradeTimestamp(trade);
        if (dateRange === "today") {
          matchesDate = tradeTimestamp >= todayStart;
        } else if (dateRange === "7d") {
          matchesDate = now - tradeTimestamp <= 7 * 24 * 60 * 60 * 1000;
        } else if (dateRange === "30d") {
          matchesDate = now - tradeTimestamp <= 30 * 24 * 60 * 60 * 1000;
        }

        return matchesSearch && matchesResult && matchesWallet && matchesSetup && matchesMistake && matchesDate;
      })
      .sort((a, b) => {
        const timeA = getTradeTimestamp(a);
        const timeB = getTradeTimestamp(b);

        if (sortBy === "date-desc") return timeB - timeA;
        if (sortBy === "date-asc") return timeA - timeB;
        if (sortBy === "pnl-desc") return (b.pnlSol || 0) - (a.pnlSol || 0);
        if (sortBy === "pnl-asc") return (a.pnlSol || 0) - (b.pnlSol || 0);
        if (sortBy === "size-desc") return (b.boughtSol || 0) - (a.boughtSol || 0);
        return 0;
      });
  }, [trades, searchQuery, filterResult, filterWallet, filterSetup, filterMistake, dateRange, sortBy, now]);
  const pageCount = Math.max(1, Math.ceil(filteredTrades.length / JOURNAL_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleTrades = useMemo(() => filteredTrades.slice((currentPage - 1) * JOURNAL_PAGE_SIZE, currentPage * JOURNAL_PAGE_SIZE), [filteredTrades, currentPage]);

  const applySavedView = (preset: TradeFilterPreset) => {
    setPage(1);
    setSearchQuery(preset.searchQuery); setFilterResult(preset.result); setFilterWallet(preset.wallet); setFilterSetup(preset.setup);
    setFilterMistake(preset.mistake); setDateRange(preset.dateRange); setSortBy(preset.sortBy); setCurrencyMode(preset.currency); setViewMode(preset.view);
    showToast(`View “${preset.name}” applied`, "success");
  };
  const saveCurrentView = () => {
    const name = savedViewName.trim().slice(0, 40);
    if (!name) return;
    const preset: TradeFilterPreset = { id: crypto.randomUUID(), name, searchQuery: searchQuery.slice(0, 200), result: filterResult as TradeFilterPreset["result"], wallet: filterWallet.slice(0, 120), setup: filterSetup.slice(0, 120), mistake: filterMistake.slice(0, 120), dateRange: dateRange as TradeFilterPreset["dateRange"], sortBy, currency: currencyMode, view: viewMode };
    const next = [preset, ...savedViews.filter((item) => item.name.toLowerCase() !== name.toLowerCase())].slice(0, 10);
    if (writeLocalStorageValue(savedViewsKey, JSON.stringify(next))) { setSavedViewName(""); setShowSaveView(false); showToast("Journal view saved", "success", "This view is stored in this browser for your account."); }
    else showToast("View could not be saved", "error", "Browser storage is unavailable.");
  };
  const deleteSavedView = (id: string) => {
    writeLocalStorageValue(savedViewsKey, JSON.stringify(savedViews.filter((preset) => preset.id !== id)));
    showToast("Saved view removed", "info");
  };

  const downloadBackup = () => {
    exportTradesToJSON(trades);
    writeLocalStorageValue(lastBackupKey, String(Date.now()));
    writeLocalStorageValue(backupSnoozeKey, null);
    showToast("Journal backup downloaded", "success", "Keep the JSON file somewhere safe and private.");
  };

  const formatDuration = (mins?: number) => {
    if (!mins) return null;
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remainder = mins % 60;
    return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
  };

  return (
    <div className="journal-page">
      {/* Hidden file input for import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportFile}
        accept=".json,.csv"
        className="hidden"
      />

      {/* Breadcrumb & Title */}
      <div className="pt-6">
        <div className="flex items-center gap-2 text-xs text-[#787774] mb-2">
          <span>Journal</span>
          <span>/</span>
          <span className="text-[#37352f] font-medium">Trade Journal</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#2383e2]">
              <BookOpen size={20} />
            </span>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#37352f]">
                Trade Journal
              </h1>
              <p className="text-xs text-[#787774] mt-0.5">
                Log, filter by setup strategy, inspect chart screenshots, and analyze execution.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportTradesToCSV(filteredTrades)}
              disabled={filteredTrades.length === 0}
              title="Export filtered trades as CSV spreadsheet"
              className="bg-[#f7f6f3] hover:bg-[#eeece8] border border-[#e3e2de] text-[#37352f] px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet size={13} />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            <button
              onClick={downloadBackup}
              disabled={trades.length === 0}
              title="Export a full-fidelity JSON backup of every trade"
              className="bg-[#f7f6f3] hover:bg-[#eeece8] border border-[#e3e2de] text-[#37352f] px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet size={13} />
              <span className="hidden sm:inline">Backup JSON</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              title="Import trades from CSV or JSON file"
              className="bg-[#f7f6f3] hover:bg-[#eeece8] border border-[#e3e2de] text-[#37352f] px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Upload size={13} />
              <span className="hidden sm:inline">Import</span>
            </button>

            <button
              onClick={onOpenNewTrade}
              className="bg-[#1a73ca] hover:bg-[#155fa8] text-white px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <span>+ Log Trade</span>
            </button>
          </div>
        </div>
      </div>

      {backupReminderDue && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/60 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
          <div>
            <p className="font-semibold">Keep an independent copy of your journal</p>
            <p className="mt-0.5 text-xs text-amber-900/80">
              Download a private JSON backup. The file stays on this device unless you choose to move it.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => writeLocalStorageValue(backupSnoozeKey, String(Date.now() + 7 * 24 * 60 * 60 * 1000))}
              className="rounded-lg px-3 py-2 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100"
            >
              Remind me next week
            </button>
            <button
              type="button"
              onClick={downloadBackup}
              className="rounded-lg bg-amber-950 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-900"
            >
              Download backup
            </button>
          </div>
        </div>
      )}

      {/* Database Controls Toolbar */}
      <div data-tour="journal-filters" className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e9e9e7] pb-3 text-xs text-[#787774]">
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-0.5 bg-[#f7f6f3] p-0.5 rounded-md border border-[#e9e9e7]">
            <button
              onClick={() => setViewMode("table")}
              className={`p-1 rounded text-xs transition-all flex items-center gap-1 ${
                viewMode === "table" ? "bg-white text-[#37352f] shadow-xs font-semibold" : "text-[#787774] hover:text-[#37352f]"
              }`}
              title="Table View"
            >
              <TableIcon size={13} />
              <span className="hidden sm:inline text-[11px]">Table</span>
            </button>
            <button
              onClick={() => setViewMode("cards")}
              className={`p-1 rounded text-xs transition-all flex items-center gap-1 ${
                viewMode === "cards" ? "bg-white text-[#37352f] shadow-xs font-semibold" : "text-[#787774] hover:text-[#37352f]"
              }`}
              title="Cards View"
            >
              <LayoutGrid size={13} />
              <span className="hidden sm:inline text-[11px]">Cards</span>
            </button>
          </div>

          {/* Result Filter Tabs */}
          <div className="flex items-center gap-1 bg-[#f7f6f3] p-0.5 rounded-md border border-[#e9e9e7]">
            {["All", "Win", "Loss", "BE"].map((tab) => (
              <button
                key={tab}
                onClick={() => { setPage(1); setFilterResult(tab); }}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                  filterResult === tab
                    ? "bg-white text-[#37352f] shadow-xs font-semibold"
                    : "text-[#787774] hover:text-[#37352f]"
                }`}
              >
                {tab} ({resultCounts[tab as keyof typeof resultCounts]})
              </button>
            ))}
          </div>

          {/* Less-used filters */}
          <details ref={moreFiltersRef} className="relative">
            <summary className="cursor-pointer list-none bg-[#f7f6f3] border border-[#e9e9e7] rounded-md px-2.5 py-1 text-[11px] text-[#37352f]">
              More filters{[filterSetup, filterWallet, filterMistake].filter((value) => value !== "All").length > 0
                ? ` (${[filterSetup, filterWallet, filterMistake].filter((value) => value !== "All").length})`
                : ""}
            </summary>
            <div className="absolute left-0 top-full z-30 mt-2 w-64 space-y-2 rounded-xl border border-[#e3e2de] bg-white p-3 shadow-xl">
          <select
            aria-label="Filter by setup"
            value={filterSetup}
            onChange={(e) => { setPage(1); setFilterSetup(e.target.value); }}
            className="w-full bg-[#f7f6f3] border border-[#e9e9e7] rounded-md px-2 py-1.5 text-[11px] text-[#37352f] focus:outline-none"
          >
            <option value="All">All Setups</option>
            {uniqueSetups.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {/* Wallet Dropdown Filter */}
          <select
            aria-label="Filter by wallet"
            value={filterWallet}
            onChange={(e) => { setPage(1); setFilterWallet(e.target.value); }}
            className="w-full bg-[#f7f6f3] border border-[#e9e9e7] rounded-md px-2 py-1.5 text-[11px] text-[#37352f] focus:outline-none"
          >
            <option value="All">All Wallets</option>
            <option value="Main">Main (Phantom)</option>
            <option value="Sniper">Sniper (BullX / Axiom)</option>
            <option value="Degen">Degen Bag</option>
            <option value="Moonbag">Moonbag</option>
          </select>

          {/* Mistakes Filter */}
          {uniqueMistakes.length > 0 && (
            <select
              aria-label="Filter by emotion tag"
              value={filterMistake}
              onChange={(e) => { setPage(1); setFilterMistake(e.target.value); }}
              className="w-full bg-[#f7f6f3] border border-[#e9e9e7] rounded-md px-2 py-1.5 text-[11px] text-[#37352f] focus:outline-none"
            >
              <option value="All">All Emotion Tags</option>
              {uniqueMistakes.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}
            </div>
          </details>

          {/* Currency Toggle */}
          <div className="flex items-center gap-0.5 bg-[#f7f6f3] p-0.5 rounded-md border border-[#e9e9e7]">
            <button
              onClick={() => setCurrencyMode("SOL")}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                currencyMode === "SOL"
                  ? "bg-white text-[#37352f] shadow-xs font-semibold"
                  : "text-[#787774] hover:text-[#37352f]"
              }`}
            >
              SOL
            </button>
            <button
              onClick={() => setCurrencyMode("USD")}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                currencyMode === "USD"
                  ? "bg-white text-[#37352f] shadow-xs font-semibold"
                  : "text-[#787774] hover:text-[#37352f]"
              }`}
            >
              USD
            </button>
          </div>
          {/* Date Range Filter */}
          <select
            aria-label="Filter by date range"
            value={dateRange}
            onChange={(e) => { setPage(1); setDateRange(e.target.value); }}
            className="bg-[#f7f6f3] border border-[#e9e9e7] rounded-md px-2 py-1 text-[11px] text-[#37352f] focus:outline-none"
          >
            <option value="all">All Time</option>
            <option value="today">Today (24h)</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          {savedViews.length > 0 && <select aria-label="Apply a saved journal view" defaultValue="" onChange={(event) => { const preset = savedViews.find((item) => item.id === event.target.value); if (preset) applySavedView(preset); event.target.value = ""; }} className="bg-[#f7f6f3] border border-[#e9e9e7] rounded-md px-2 py-1 text-[11px] text-[#37352f] focus:outline-none"><option value="">Saved views…</option>{savedViews.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</select>}
          <button type="button" onClick={() => setShowSaveView((open) => !open)} className="flex items-center gap-1 rounded-md border border-[#e9e9e7] bg-[#f7f6f3] px-2 py-1 text-[11px] text-[#37352f]"><BookmarkPlus size={12}/> Save view</button>
        </div>

        {/* Search and Sort */}
        <div className="flex items-center gap-2">
          <select
            aria-label="Sort trades"
            value={sortBy}
            onChange={(e) => { setPage(1); setSortBy(e.target.value as typeof sortBy); }}
            className="bg-[#fbfbfa] border border-[#e3e2de] rounded-md px-2 py-1 text-xs text-[#37352f] focus:outline-none"
          >
            <option value="date-desc">Newest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="pnl-desc">Highest P&L</option>
            <option value="pnl-asc">Lowest P&L</option>
            <option value="size-desc">Largest Position</option>
          </select>

          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9b9a97]" />
            <input
              aria-label="Search trades"
              type="text"
              value={searchQuery}
              onChange={(e) => { setPage(1); setSearchQuery(e.target.value); }}
              placeholder="Search by coin, setup, or notes..."
              className="bg-[#fbfbfa] border border-[#e3e2de] rounded-md pl-7 pr-3 py-1 text-xs text-[#37352f] focus:outline-none focus:border-[#2383e2] w-40 sm:w-56"
            />
          </div>
        </div>
      </div>
      {showSaveView && <div className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-xs"><label className="font-medium text-[#37352f]">View name <input autoFocus value={savedViewName} onChange={(event) => setSavedViewName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") saveCurrentView(); if (event.key === "Escape") setShowSaveView(false); }} maxLength={40} placeholder="e.g. Recent breakout losses" className="ml-2 w-56 rounded-md border border-blue-200 bg-white px-2.5 py-1.5 outline-none"/></label><button type="button" onClick={saveCurrentView} disabled={!savedViewName.trim()} className="rounded-md bg-[#2383e2] px-3 py-1.5 font-semibold text-white disabled:opacity-40">Save</button><button type="button" onClick={() => setShowSaveView(false)} className="px-2 py-1.5 text-[#5a5957]">Cancel</button>{savedViews.length > 0 && <details className="ml-auto"><summary className="cursor-pointer text-[#5a5957]">Manage {savedViews.length}</summary><div className="mt-2 space-y-1 rounded-lg border border-[#e3e2de] bg-white p-2">{savedViews.map((preset) => <div key={preset.id} className="flex items-center justify-between gap-3"><span className="max-w-48 truncate">{preset.name}</span><button type="button" onClick={() => deleteSavedView(preset.id)} className="text-rose-700">Remove</button></div>)}</div></details>}</div>}

      {/* Main Content: Table or Cards View or Empty State */}
      {trades.length === 0 ? (
        <div data-tour="journal-results" className="bg-[#fbfbfa] border border-[#e9e9e7] rounded-2xl p-8 sm:p-10 text-center max-w-2xl mx-auto my-6 space-y-5">
          <div className="w-16 h-16 bg-blue-50 text-[#2383e2] rounded-2xl flex items-center justify-center mx-auto shadow-xs">
            <BookOpen size={28} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#37352f]">Your Trading Journal is Empty</h2>
            <p className="text-xs text-[#787774] mt-1.5 max-w-md mx-auto leading-relaxed">
              Start building your edge. Paste any Solana contract address, attach chart setups, track discipline tags, and calculate win rates.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left max-w-lg mx-auto text-xs pt-2">
            <div className="p-3 bg-white border border-[#e9e9e7] rounded-xl">
              <span className="font-semibold text-[#37352f] block mb-1">1. Enter CA</span>
              <p className="text-[#787774] text-[11px]">Autofetches price, liquidity & MCap via DexScreener API.</p>
            </div>
            <div className="p-3 bg-white border border-[#e9e9e7] rounded-xl">
              <span className="font-semibold text-[#37352f] block mb-1">2. Attach Chart</span>
              <p className="text-[#787774] text-[11px]">Paste Cmd+V screenshot of your setup & entry candle.</p>
            </div>
            <div className="p-3 bg-white border border-[#e9e9e7] rounded-xl">
              <span className="font-semibold text-[#37352f] block mb-1">3. AI Insights</span>
              <p className="text-[#787774] text-[11px]">Your selected AI provider reviews tilt patterns and execution.</p>
            </div>
          </div>

          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={onOpenNewTrade}
              className="bg-[#1a73ca] hover:bg-[#155fa8] text-white px-5 py-2.5 rounded-lg text-xs font-semibold shadow-sm transition-all"
            >
              + Log Your First Trade (Hotkey: N)
            </button>
          </div>
        </div>
      ) : filteredTrades.length === 0 ? (
        <div data-tour="journal-results">
          <EmptyState icon={<Search size={20} />} title="No matching trades" detail="Your trades are safe. Clear the search or filters to return to the complete journal." actionLabel="Clear filters" onAction={() => { setSearchQuery(""); setFilterResult("All"); setFilterSetup("All"); setFilterWallet("All"); setFilterMistake("All"); setDateRange("all"); setPage(1); }} />
        </div>
      ) : viewMode === "cards" ? (
        /* Cards Grid View */
        <div data-tour="journal-results" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleTrades.map((trade, tradeIndex) => {
            const timestamp = getTradeTimestamp(trade);
            const dateStr = timestamp
              ? new Date(timestamp).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Just now";

            return (
              <div
                key={trade.id}
                data-tour={tradeIndex === 0 ? "journal-example" : undefined}
                onClick={() => onSelectTrade(trade)}
                className="trade-journal-card bg-white border border-[#e9e9e7] rounded-xl p-4 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-3 group"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center text-xs font-bold text-neutral-700">
                        {trade.symbol?.substring(0, 1)}
                      </span>
                      <div>
                        <h3 className="font-bold text-xs text-[#37352f] group-hover:text-[#2383e2] transition-colors">
                          {trade.name || trade.symbol}
                        </h3>
                        <span className="text-[10px] text-[#9b9a97]">${trade.symbol}</span>
                        {(trade.venue || (trade.quoteCurrency && trade.quoteCurrency !== "SOL")) && <span className="block text-[9px] text-[#9b9a97]">{trade.venue || "Venue not set"} · {trade.quoteSymbol || trade.quoteCurrency}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <TradeBadge kind={trade.wallet === "Paper" || trade.isPaper ? "paper" : "live"} compact />
                      {trade.screenshotUrl && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setLightboxImage({
                              url: trade.screenshotUrl!,
                              title: `${trade.name || trade.symbol} Chart Setup`,
                            });
                          }}
                          className="p-1 text-purple-600 hover:text-purple-700 rounded hover:bg-purple-50 transition-colors"
                          title="View Chart Screenshot"
                        >
                          <ImageIcon size={13} />
                        </button>
                      )}
                      <TradeBadge kind={trade.result} compact />
                    </div>
                  </div>

                  {/* Setup & Duration info */}
                  {(trade.setupType || trade.durationMinutes) && (
                    <div className="flex flex-wrap items-center gap-1 mb-2 text-[10px]">
                      {trade.setupType && (
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-[#2383e2] font-medium">
                          {trade.setupType}
                        </span>
                      )}
                      {trade.durationMinutes && (
                        <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-900 font-medium flex items-center gap-0.5">
                          <Clock size={10} />
                          <span>{formatDuration(trade.durationMinutes)}</span>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Financial Metrics */}
                  <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-[#f1f1ef]">
                    <div>
                      <span className="text-[10px] text-[#9b9a97] block">Size ({currencyMode})</span>
                      <span className="whitespace-nowrap font-mono text-[11px] font-medium">
                        {currencyMode === "SOL"
                          ? (trade.boughtSol || 0).toFixed(2)
                          : (getTradeBoughtUsd(trade, solPrice).value ?? 0).toFixed(2)} {currencyMode}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#9b9a97] block">Net P&L</span>
                      <span
                        className={`whitespace-nowrap font-mono text-[11px] font-bold ${
                          (trade.pnlSol || 0) > 0
                            ? "text-emerald-600"
                            : (trade.pnlSol || 0) < 0
                            ? "text-rose-600"
                            : "text-[#787774]"
                        }`}
                      >
                        {currencyMode === "SOL" ? ((trade.pnlSol || 0) > 0 ? `+${formatSol(trade.pnlSol || 0)} SOL` : `${formatSol(trade.pnlSol || 0)} SOL`) : (() => { const value = getUsdValueStatus(trade, solPrice).value ?? 0; return value > 0 ? `+$${value.toFixed(2)}` : value < 0 ? `-$${Math.abs(value).toFixed(2)}` : "$0.00"; })()}
                      </span>
                    </div>
                  </div>

                  {/* Tags (Good Tags & Mistakes) */}
                  {((trade.goodTags && trade.goodTags.length > 0) || (trade.mistakes && trade.mistakes.length > 0)) && (
                    <div className="flex flex-wrap gap-1 mt-2.5">
                      {trade.goodTags?.slice(0, 2).map((g, idx) => (
                        <span
                          key={`good-${idx}`}
                          className="rounded border border-[#e3e2de] bg-[#f7f6f3] px-1.5 py-0.5 text-[10px] font-medium text-[#5a5957]"
                        >
                          {g}
                        </span>
                      ))}
                      {trade.mistakes?.slice(0, 2).map((m, idx) => (
                        <span
                          key={`mistake-${idx}`}
                          className="rounded border border-[#e3e2de] bg-[#f7f6f3] px-1.5 py-0.5 text-[10px] font-medium text-rose-700"
                        >
                          {m}
                        </span>
                      ))}
                      {((trade.goodTags?.length || 0) + (trade.mistakes?.length || 0) > 4) && (
                        <span className="text-[10px] text-[#9b9a97]">+{((trade.goodTags?.length || 0) + (trade.mistakes?.length || 0)) - 4}</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#787774] pt-2 border-t border-[#f7f6f5]">
                  <span>{dateStr}</span>
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {!readOnly && <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenEditTrade(trade);
                      }}
                      className="trade-card-action p-1.5 rounded-lg transition-all hover:bg-blue-50 hover:text-[#2383e2] hover:shadow-sm"
                      aria-label="Edit trade"
                    >
                      <Edit2 size={13} />
                    </button>}
                    {!readOnly && <button
                      onClick={(e) => requestDelete(e, trade.id)}
                      className="trade-card-action p-1.5 rounded-lg transition-all hover:bg-rose-50 hover:text-rose-600 hover:shadow-sm"
                      aria-label="Delete trade"
                    >
                      <Trash2 size={13} />
                    </button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Notion Database Table View */
        <div data-tour="journal-results" className="border border-[#e9e9e7] rounded-lg overflow-hidden bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="notion-table-th">Date</th>
                  <th className="notion-table-th">Token</th>
                  <th className="notion-table-th">Setup</th>
                  <th className="notion-table-th">Duration</th>
                  <th className="notion-table-th">Chart</th>
                  <th className="notion-table-th">Wallet</th>
                  <th className="notion-table-th">Result</th>
                  <th className="notion-table-th">Bought ({currencyMode})</th>
                  <th className="notion-table-th">Sold ({currencyMode})</th>
                  <th className="notion-table-th">Net P&L ({currencyMode})</th>
                  <th className="notion-table-th">Discipline Tags</th>
                  <th className="notion-table-th">Notes</th>
                  <th className="notion-table-th text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleTrades.map((trade, tradeIndex) => {
                  const timestamp = getTradeTimestamp(trade);
                  const dateStr = timestamp
                    ? new Date(timestamp).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Just now";

                  return (
                    <tr
                      key={trade.id}
                      data-tour={tradeIndex === 0 ? "journal-example" : undefined}
                      onClick={() => onSelectTrade(trade)}
                      className="hover:bg-[#fcfbf9] transition-colors group cursor-pointer"
                    >
                      {/* Date */}
                      <td className="notion-table-td text-[#787774] font-mono text-[11px] whitespace-nowrap">
                        {dateStr}
                      </td>

                      {/* Name & Symbol */}
                      <td className="notion-table-td font-semibold text-[#37352f]">
                        <div className="flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center text-[10px] font-bold text-neutral-700">
                            {trade.symbol?.substring(0, 1)}
                          </span>
                          <span className="group-hover:text-[#2383e2] transition-colors whitespace-nowrap">
                            {trade.name || trade.symbol}
                          </span>
                          <span className="text-[11px] font-normal text-[#9b9a97]">
                            ${trade.symbol}
                          </span>
                        </div>
                        {(trade.venue || (trade.quoteCurrency && trade.quoteCurrency !== "SOL")) && <div className="ml-6 text-[9px] text-[#9b9a97]">{trade.venue || "Venue not set"} · {trade.quoteSymbol || trade.quoteCurrency}</div>}
                      </td>

                      {/* Setup Strategy */}
                      <td className="notion-table-td">
                        {trade.setupType ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-[#2383e2] whitespace-nowrap">
                            {trade.setupType}
                          </span>
                        ) : (
                          <span className="text-[#9b9a97] text-[11px]">—</span>
                        )}
                      </td>

                      {/* Trade Duration */}
                      <td className="notion-table-td font-mono text-[11px] text-[#787774] whitespace-nowrap">
                        {trade.durationMinutes ? (
                          <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 font-medium">
                            {formatDuration(trade.durationMinutes)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>

                      {/* Chart Screenshot */}
                      <td className="notion-table-td">
                        {trade.screenshotUrl ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setLightboxImage({
                                url: trade.screenshotUrl!,
                                title: `${trade.name || trade.symbol} Chart Setup`,
                              });
                            }}
                            className="p-1 rounded bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 flex items-center gap-1 text-[10px] font-semibold transition-colors"
                            title="View Chart Screenshot"
                          >
                            <ImageIcon size={12} />
                            <span>Chart</span>
                          </button>
                        ) : (
                          <span className="text-[#c4c4c2] text-[11px]">—</span>
                        )}
                      </td>

                      {/* Wallet */}
                      <td className="notion-table-td text-[#787774] text-[11px]">
                        <span className="inline-flex items-center gap-1.5">
                          <TradeBadge kind={trade.wallet === "Paper" || trade.isPaper ? "paper" : "live"} compact />
                          {trade.wallet !== "Paper" && !trade.isPaper && <span>{trade.wallet || "Main"}</span>}
                        </span>
                      </td>

                      {/* Result */}
                      <td className="notion-table-td">
                        <TradeBadge kind={trade.result} compact />
                      </td>

                      {/* Bought SOL */}
                      <td className="notion-table-td font-mono text-[#37352f]">
                        {currencyMode === "SOL" ? formatSol(trade.boughtSol || 0) : "$" + (getTradeBoughtUsd(trade, solPrice).value ?? 0).toFixed(2)}
                      </td>

                      {/* Sold SOL */}
                      <td className="notion-table-td font-mono text-[#37352f]">
                        {currencyMode === "SOL" ? formatSol(trade.soldSol || 0) : "$" + (getTradeSoldUsd(trade, solPrice).value ?? 0).toFixed(2)}
                      </td>

                      {/* Net PnL SOL */}
                      <td
                        className={`notion-table-td font-mono font-bold ${
                          (trade.pnlSol || 0) > 0
                            ? "text-emerald-600"
                            : (trade.pnlSol || 0) < 0
                            ? "text-rose-600"
                            : "text-[#787774]"
                        }`}
                      >
                        {currencyMode === "SOL" ? ((trade.pnlSol || 0) > 0 ? `+${formatSol(trade.pnlSol || 0)}` : formatSol(trade.pnlSol || 0)) : (() => { const value = getUsdValueStatus(trade, solPrice).value ?? 0; return value > 0 ? `+$${value.toFixed(2)}` : value < 0 ? `-$${Math.abs(value).toFixed(2)}` : "$0.00"; })()}
                      </td>

                      {/* Tags */}
                      <td className="notion-table-td max-w-xs">
                        <div className="flex flex-wrap gap-1">
                          {trade.goodTags?.map((g, idx) => (
                            <span
                              key={`tgood-${idx}`}
                              className="rounded border border-[#e3e2de] bg-[#f7f6f3] px-1.5 py-0.5 text-[10px] font-medium text-[#5a5957]"
                            >
                              {g}
                            </span>
                          ))}
                          {trade.mistakes?.map((m, idx) => (
                            <span
                              key={`tmistake-${idx}`}
                              className="rounded border border-[#e3e2de] bg-[#f7f6f3] px-1.5 py-0.5 text-[10px] font-medium text-rose-700"
                            >
                              {m}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Notes */}
                      <td className="notion-table-td text-[#787774] max-w-xs truncate" title={trade.notes}>
                        {trade.notes || "—"}
                      </td>

                      {/* Actions */}
                      <td className="notion-table-td text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          {!readOnly && <button
                            onClick={() => onOpenEditTrade(trade)}
                            className="trade-card-action p-1.5 rounded-lg transition-all hover:bg-blue-50 hover:text-[#2383e2] hover:shadow-sm"
                            aria-label="Edit trade"
                          >
                            <Edit2 size={13} />
                          </button>}
                          {!readOnly && <button
                            onClick={(e) => requestDelete(e, trade.id)}
                            className="trade-card-action p-1.5 rounded-lg transition-all hover:bg-rose-50 hover:text-rose-600 hover:shadow-sm"
                            aria-label="Delete trade"
                          >
                            <Trash2 size={13} />
                          </button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filteredTrades.length > JOURNAL_PAGE_SIZE && <nav aria-label="Trade journal pages" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#e9e9e7] bg-white px-4 py-3 text-xs"><p className="text-[#787774]">Showing {(currentPage - 1) * JOURNAL_PAGE_SIZE + 1}–{Math.min(currentPage * JOURNAL_PAGE_SIZE, filteredTrades.length)} of {filteredTrades.length} trades</p><div className="flex items-center gap-2"><button type="button" onClick={() => setPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="rounded-md border border-[#e3e2de] px-3 py-1.5 font-semibold text-[#37352f] disabled:opacity-40">Previous</button><span className="min-w-20 text-center font-mono text-[#5a5957]">{currentPage} / {pageCount}</span><button type="button" onClick={() => setPage(Math.min(pageCount, currentPage + 1))} disabled={currentPage === pageCount} className="rounded-md border border-[#e3e2de] px-3 py-1.5 font-semibold text-[#37352f] disabled:opacity-40">Next</button></div></nav>}

      {/* Lightbox for Chart Screenshots */}
      {lightboxImage && (
        <ImageLightboxModal
          isOpen={!!lightboxImage}
          onClose={() => setLightboxImage(null)}
          imageUrl={lightboxImage.url}
          title={lightboxImage.title}
        />
      )}
      {/* Import Preview */}
      {pendingImport && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="trade-import-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          onClick={() => !importing && setPendingImport(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-[#e3e2de] bg-white p-5 text-[#37352f] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="trade-import-title" className="text-base font-bold">Review trade import</h3>
            <p className="mt-1 text-xs text-[#787774]">
              {pendingImport.fileName} passed validation. Nothing is written until you confirm.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-blue-50 p-3"><div className="text-xl font-bold text-blue-700">{pendingImport.trades.length}</div><div className="text-[11px] text-blue-800">new trades</div></div>
              <div className="rounded-xl bg-amber-50 p-3"><div className="text-xl font-bold text-amber-800">{pendingImport.duplicateCount}</div><div className="text-[11px] text-amber-900">duplicates skipped</div></div>
              <div className="rounded-xl bg-emerald-50 p-3"><div className="text-xl font-bold text-emerald-700">1</div><div className="text-[11px] text-emerald-800">atomic write</div></div>
            </div>
            <div className="mt-4 max-h-44 overflow-y-auto rounded-xl border border-[#e9e9e7]">
              {pendingImport.trades.slice(0, 10).map((trade, index) => (
                <div key={`${trade.ca}-${trade.tradedAt}-${index}`} className="flex items-center justify-between border-b border-[#f1f1ef] px-3 py-2 text-xs last:border-0">
                  <span className="font-semibold">{trade.name} <span className="font-normal text-[#787774]">${trade.symbol}</span></span>
                  <span className={trade.pnlSol >= 0 ? "font-mono text-emerald-700" : "font-mono text-rose-700"}>{trade.pnlSol >= 0 ? "+" : ""}{formatSol(trade.pnlSol)} SOL</span>
                </div>
              ))}
              {pendingImport.trades.length > 10 && <div className="px-3 py-2 text-center text-[11px] text-[#787774]">and {pendingImport.trades.length - 10} more…</div>}
            </div>
            <p className="mt-3 text-[11px] text-[#787774]">If any row fails to save, the whole import is rejected and your existing journal remains unchanged.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={importing} onClick={() => setPendingImport(null)} className="rounded-lg border border-[#e3e2de] px-4 py-2 text-xs font-semibold disabled:opacity-50">Cancel</button>
              <button type="button" disabled={importing} onClick={() => void confirmImport()} className="rounded-lg bg-[#1a73ca] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{importing ? "Importing…" : `Import ${pendingImport.trades.length} trades`}</button>
            </div>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {tradeToDelete && (
        <div 
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-trade-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          onClick={() => setTradeToDelete(null)}
        >
          <div 
            className="bg-white border border-[#e9e9e7] rounded-xl p-6 w-full max-w-sm shadow-xl relative animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-4 border border-rose-100">
              <Trash2 size={18} />
            </div>
            <h3 id="delete-trade-title" className="text-base font-bold text-[#37352f] mb-1">Delete this trade?</h3>
            <p className="text-xs text-[#787774] mb-6">
              This removes the trade from your journal and analytics. You can restore it for 10 seconds using the confirmation toast.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTradeToDelete(null)}
                className="flex-1 px-4 py-2 bg-[#f7f6f3] hover:bg-[#eeece8] border border-[#e3e2de] text-[#37352f] rounded-lg text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
              >
                Delete Trade
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
