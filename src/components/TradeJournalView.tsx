"use client";

import { useState, useMemo, useRef } from "react";
import { Trade } from "../lib/types";
import { db } from "../lib/firebase";
import { doc, deleteDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import {
  Lock,
  ArrowUpDown,
  Filter,
  Search,
  Maximize2,
  Trash2,
  Edit2,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Copy,
  Check,
  Download,
  Upload,
  LayoutGrid,
  Table as TableIcon,
  Calendar,
  Wallet as WalletIcon,
  BookOpen,
  TrendingUp,
  TrendingDown,
  FileSpreadsheet,
  Image as ImageIcon,
  Clock,
  Layers,
} from "lucide-react";
import { exportTradesToCSV, exportTradesToJSON, parseCSV } from "../lib/exportImport";
import { getTradeTimestamp, getTradeDate } from "../lib/utils";
import { useToast } from "./Toast";
import ImageLightboxModal from "./ImageLightboxModal";

interface TradeJournalViewProps {
  trades: Trade[];
  solPrice?: number;
  onOpenNewTrade: () => void;
  onTradeDeleted: () => void;
  onOpenEditTrade: (trade: Trade) => void;
  onSelectTrade: (trade: Trade) => void;
}

export default function TradeJournalView({
  trades,
  solPrice = 150,
  onOpenNewTrade,
  onTradeDeleted,
  onOpenEditTrade,
  onSelectTrade,
}: TradeJournalViewProps) {
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
  const [deletedIds, setDeletedIds] = useState<string[]>([]);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  // Copy CA helper
  const copyToClipboard = (e: React.MouseEvent, text: string, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast("CA copied to clipboard", "success");
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Delete trade
  const requestDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setTradeToDelete(id);
  };

  const confirmDelete = async () => {
    if (!tradeToDelete) return;
    const id = tradeToDelete;
    setTradeToDelete(null);
    setDeletingId(id);
    setDeletedIds((prev) => [...prev, id]);
    
    try {
      await deleteDoc(doc(db, "trades", id));
      showToast("Trade deleted from Firestore", "info");
      onTradeDeleted();
    } catch (err) {
      console.error("Error deleting trade:", err);
      showToast("Failed to delete trade", "error");
      setDeletedIds((prev) => prev.filter((pid) => pid !== id));
    }
    setDeletingId(null);
  };

  // Handle JSON/CSV Import
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      let imported: any[] = [];
      if (file.name.endsWith(".json")) {
        imported = JSON.parse(text);
      } else if (file.name.endsWith(".csv")) {
        const rows = parseCSV(text);
        if (rows.length <= 1) throw new Error("Empty CSV file");
        for (let i = 1; i < rows.length; i++) {
          const cols = rows[i];
          if (cols.length >= 6) {
            imported.push({
              name: cols[1] || "Imported Token",
              symbol: cols[2] || "MEME",
              ca: cols[3] || "",
              wallet: cols[4] || "Main",
              result: cols[5] || "Win",
              boughtSol: parseFloat(cols[6]) || 0,
              soldSol: parseFloat(cols[7]) || 0,
              pnlSol: parseFloat(cols[8]) || 0,
              pnlUsd: parseFloat(cols[9]) || 0,
              setupType: cols[10] || "General",
              durationMinutes: parseFloat(cols[11]) || null,
              mcap: parseFloat(cols[12]) || 0,
              liquidity: parseFloat(cols[13]) || 0,
              price: parseFloat(cols[14]) || 0,
              mistakes: cols[15] ? cols[15].split(";").map((s) => s.trim()) : [],
              notes: cols[16] || "Imported from CSV",
              initialRiskSol: parseFloat(cols[17]) || null,
              feesSol: parseFloat(cols[18]) || null,
              createdAt: Date.now(),
            });
          }
        }
      }

      if (Array.isArray(imported) && imported.length > 0) {
        let count = 0;
        for (const item of imported) {
          await addDoc(collection(db, "trades"), {
            name: item.name || "Token",
            symbol: item.symbol || "MEME",
            ca: item.ca || "",
            wallet: item.wallet || "Main",
            result: item.result || "Win",
            setupType: item.setupType || "General",
            durationMinutes: item.durationMinutes || null,
            screenshotUrl: item.screenshotUrl || null,
            mcap: item.mcap || 0,
            liquidity: item.liquidity || 0,
            price: item.price || 0,
            boughtSol: item.boughtSol || 0,
            boughtUsd: item.boughtUsd || 0,
            soldSol: item.soldSol || 0,
            soldUsd: item.soldUsd || 0,
            pnlSol: item.pnlSol || 0,
            pnlUsd: item.pnlUsd || 0,
            initialRiskSol: item.initialRiskSol || null,
            feesSol: item.feesSol || null,
            mistakes: item.mistakes || [],
            notes: item.notes || "",
            date: serverTimestamp(),
            createdAt: Date.now(),
          });
          count++;
        }
        showToast(`Imported ${count} trades successfully!`, "success");
        onTradeDeleted();
      } else {
        showToast("No valid trades found in file", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to parse and import file", "error");
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Filter & Sort Trades
  const filteredTrades = useMemo(() => {
    const now = Date.now();
    const todayStart = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();

    return trades
      .filter((trade) => !deletedIds.includes(trade.id))
      .filter((trade) => {
        const matchesSearch =
          trade.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          trade.symbol?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          trade.ca?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (trade.setupType && trade.setupType.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (trade.notes && trade.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (trade.mistakes && trade.mistakes.some((m) => m.toLowerCase().includes(searchQuery.toLowerCase())));

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
  }, [trades, searchQuery, filterResult, filterWallet, filterSetup, filterMistake, dateRange, sortBy]);

  const totalFilteredPnl = filteredTrades.reduce((acc, t) => acc + (t.pnlSol || 0), 0);

  const formatDuration = (mins?: number) => {
    if (!mins) return null;
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remainder = mins % 60;
    return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
  };

  return (
    <div className="space-y-6 pb-16">
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
          <span className="text-[#37352f] font-medium flex items-center gap-1">
            <span>📓</span>
            <span>Trade Journal</span>
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📓</span>
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
              onClick={() => exportTradesToCSV(trades)}
              title="Export trades as CSV spreadsheet"
              className="bg-[#f7f6f3] hover:bg-[#eeece8] border border-[#e3e2de] text-[#37352f] px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <FileSpreadsheet size={13} />
              <span className="hidden sm:inline">Export CSV</span>
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
              className="bg-[#2383e2] hover:bg-[#1a73ca] text-white px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <span>+ Log Trade</span>
            </button>
          </div>
        </div>
      </div>

      {/* Database Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e9e9e7] pb-3 text-xs text-[#787774]">
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
                onClick={() => setFilterResult(tab)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                  filterResult === tab
                    ? "bg-white text-[#37352f] shadow-xs font-semibold"
                    : "text-[#787774] hover:text-[#37352f]"
                }`}
              >
                {tab === "All" ? `All (${trades.length})` : tab}
              </button>
            ))}
          </div>

          {/* Setup Strategy Filter Dropdown */}
          <select
            value={filterSetup}
            onChange={(e) => setFilterSetup(e.target.value)}
            className="bg-[#f7f6f3] border border-[#e9e9e7] rounded-md px-2 py-1 text-[11px] text-[#37352f] focus:outline-none"
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
            value={filterWallet}
            onChange={(e) => setFilterWallet(e.target.value)}
            className="bg-[#f7f6f3] border border-[#e9e9e7] rounded-md px-2 py-1 text-[11px] text-[#37352f] focus:outline-none"
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
              value={filterMistake}
              onChange={(e) => setFilterMistake(e.target.value)}
              className="bg-[#f7f6f3] border border-[#e9e9e7] rounded-md px-2 py-1 text-[11px] text-[#37352f] focus:outline-none"
            >
              <option value="All">All Emotion Tags</option>
              {uniqueMistakes.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}

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
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="bg-[#f7f6f3] border border-[#e9e9e7] rounded-md px-2 py-1 text-[11px] text-[#37352f] focus:outline-none"
          >
            <option value="all">All Time</option>
            <option value="today">Today (24h)</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>

        {/* Search and Sort */}
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e: any) => setSortBy(e.target.value)}
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
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search / or filter..."
              className="bg-[#fbfbfa] border border-[#e3e2de] rounded-md pl-7 pr-3 py-1 text-xs text-[#37352f] focus:outline-none focus:border-[#2383e2] w-40 sm:w-48"
            />
          </div>
        </div>
      </div>

      {/* Main Content: Table or Cards View or Empty State */}
      {trades.length === 0 ? (
        <div className="bg-[#fbfbfa] border border-[#e9e9e7] rounded-2xl p-8 sm:p-10 text-center max-w-2xl mx-auto my-6 space-y-5">
          <div className="w-16 h-16 bg-blue-50 text-[#2383e2] rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-xs">
            📓
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
              <p className="text-[#787774] text-[11px]">DeepSeek coaches you on your tilt patterns.</p>
            </div>
          </div>

          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={onOpenNewTrade}
              className="bg-[#2383e2] hover:bg-[#1a73ca] text-white px-5 py-2.5 rounded-lg text-xs font-semibold shadow-sm transition-all"
            >
              + Log Your First Trade (Hotkey: N)
            </button>
          </div>
        </div>
      ) : filteredTrades.length === 0 ? (
        <div className="p-12 text-center text-xs text-[#9b9a97] bg-white border border-[#e9e9e7] rounded-xl">
          No trades matched your search & filter criteria.
        </div>
      ) : viewMode === "cards" ? (
        /* Cards Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTrades.map((trade) => {
            const dateStr = trade.date?.seconds
              ? new Date(trade.date.seconds * 1000).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Just now";

            return (
              <div
                key={trade.id}
                onClick={() => onSelectTrade(trade)}
                className="bg-white border border-[#e9e9e7] hover:border-[#2383e2] rounded-xl p-4 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-3 group"
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
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
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
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          trade.result === "Win"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : trade.result === "Loss"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : "bg-neutral-100 text-neutral-700 border border-neutral-200"
                        }`}
                      >
                        {trade.result}
                      </span>
                    </div>
                  </div>

                  {/* Setup & Duration info */}
                  {(trade.setupType || trade.durationMinutes) && (
                    <div className="flex flex-wrap items-center gap-1 mb-2 text-[10px]">
                      {trade.setupType && (
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-[#2383e2] border border-blue-100 font-medium">
                          {trade.setupType}
                        </span>
                      )}
                      {trade.durationMinutes && (
                        <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-100 font-medium flex items-center gap-0.5">
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
                      <span className="font-mono font-medium">{currencyMode === "SOL" ? (trade.boughtSol || 0) : ((trade.boughtUsd) || ((trade.boughtSol || 0) * solPrice).toFixed(2))} {currencyMode}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#9b9a97] block">Net P&L</span>
                      <span
                        className={`font-mono font-bold ${
                          (trade.pnlSol || 0) > 0
                            ? "text-emerald-600"
                            : (trade.pnlSol || 0) < 0
                            ? "text-rose-600"
                            : "text-[#787774]"
                        }`}
                      >
                        {currencyMode === "SOL" ? ((trade.pnlSol || 0) > 0 ? `+${trade.pnlSol} SOL` : `${trade.pnlSol || 0} SOL`) : ((trade.pnlUsd || (trade.pnlSol || 0) * solPrice) > 0 ? `+$${(trade.pnlUsd || (trade.pnlSol || 0) * solPrice).toFixed(2)}` : `-$${Math.abs(trade.pnlUsd || (trade.pnlSol || 0) * solPrice).toFixed(2)}`)}
                      </span>
                    </div>
                  </div>

                  {trade.mistakes && trade.mistakes.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2.5">
                      {trade.mistakes.slice(0, 2).map((m, idx) => (
                        <span
                          key={idx}
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-neutral-100 text-neutral-700"
                        >
                          {m}
                        </span>
                      ))}
                      {trade.mistakes.length > 2 && (
                        <span className="text-[10px] text-[#9b9a97]">+{trade.mistakes.length - 2}</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#787774] pt-2 border-t border-[#f7f6f5]">
                  <span>{dateStr}</span>
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenEditTrade(trade);
                      }}
                      className="p-1 hover:text-[#2383e2] rounded"
                      title="Edit"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={(e) => requestDelete(e, trade.id)}
                      className="p-1 hover:text-rose-600 rounded"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Notion Database Table View */
        <div className="border border-[#e9e9e7] rounded-lg overflow-hidden bg-white shadow-xs">
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
                {filteredTrades.map((trade) => {
                  const dateStr = trade.date?.seconds
                    ? new Date(trade.date.seconds * 1000).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Just now";

                  return (
                    <tr
                      key={trade.id}
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
                      </td>

                      {/* Setup Strategy */}
                      <td className="notion-table-td">
                        {trade.setupType ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-[#2383e2] border border-blue-100 whitespace-nowrap">
                            {trade.setupType}
                          </span>
                        ) : (
                          <span className="text-[#9b9a97] text-[11px]">—</span>
                        )}
                      </td>

                      {/* Trade Duration */}
                      <td className="notion-table-td font-mono text-[11px] text-[#787774] whitespace-nowrap">
                        {trade.durationMinutes ? (
                          <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-100 font-medium">
                            ⏱️ {formatDuration(trade.durationMinutes)}
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
                        <span className="px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700 text-[10px]">
                          {trade.wallet || "Main"}
                        </span>
                      </td>

                      {/* Result */}
                      <td className="notion-table-td">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            trade.result === "Win"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : trade.result === "Loss"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-neutral-100 text-neutral-700 border border-neutral-200"
                          }`}
                        >
                          {trade.result}
                        </span>
                      </td>

                      {/* Bought SOL */}
                      <td className="notion-table-td font-mono text-[#37352f]">
                        {currencyMode === "SOL" ? trade.boughtSol || 0 : "$" + (trade.boughtUsd || ((trade.boughtSol || 0) * solPrice)).toFixed(2)}
                      </td>

                      {/* Sold SOL */}
                      <td className="notion-table-td font-mono text-[#37352f]">
                        {currencyMode === "SOL" ? trade.soldSol || 0 : "$" + (trade.soldUsd || ((trade.soldSol || 0) * solPrice)).toFixed(2)}
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
                        {currencyMode === "SOL" ? ((trade.pnlSol || 0) > 0 ? `+${trade.pnlSol}` : trade.pnlSol || 0) : ((trade.pnlUsd || (trade.pnlSol || 0) * solPrice) > 0 ? `+$${(trade.pnlUsd || (trade.pnlSol || 0) * solPrice).toFixed(2)}` : `-$${Math.abs((trade.pnlUsd || (trade.pnlSol || 0) * solPrice)).toFixed(2)}`)}
                      </td>

                      {/* Tags */}
                      <td className="notion-table-td max-w-xs">
                        <div className="flex flex-wrap gap-1">
                          {trade.mistakes?.map((m, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-neutral-100 text-neutral-700"
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
                          <button
                            onClick={() => onOpenEditTrade(trade)}
                            className="p-1 hover:text-[#2383e2] rounded"
                            title="Edit"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={(e) => requestDelete(e, trade.id)}
                            className="p-1 hover:text-rose-600 rounded"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
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

      {/* Lightbox for Chart Screenshots */}
      {lightboxImage && (
        <ImageLightboxModal
          isOpen={!!lightboxImage}
          onClose={() => setLightboxImage(null)}
          imageUrl={lightboxImage.url}
          title={lightboxImage.title}
        />
      )}
      {/* Delete Confirmation Modal */}
      {tradeToDelete && (
        <div 
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
            <h3 className="text-base font-bold text-[#37352f] mb-1">Delete Trade?</h3>
            <p className="text-xs text-[#787774] mb-6">
              This action cannot be undone. This trade will be permanently removed from your journal and analytics.
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
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
