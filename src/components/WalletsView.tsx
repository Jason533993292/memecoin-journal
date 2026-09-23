"use client";

import { useState, useEffect } from "react";
import { Trade, Wallet, WalletTransaction } from "../lib/types";
import {
  Lock,
  Plus,
  Wallet as WalletIcon,
  Copy,
  Check,
  ArrowDownToLine,
  ArrowUpFromLine,
  Trash2,
  Edit2,
  Calendar,
  DollarSign,
  Search,
  Loader2,
  RefreshCw,
  Sparkles,
  Zap
} from "lucide-react";
import DepositPaycheckModal from "./DepositPaycheckModal";
import { useToast } from "./Toast";

interface WalletsViewProps {
  trades: Trade[];
  solPrice?: number;
}

const DEFAULT_WALLETS: Wallet[] = [];

export default function WalletsView({ trades, solPrice = 150 }: WalletsViewProps) {
  const { showToast } = useToast();
  const [wallets, setWallets] = useState<Wallet[]>(DEFAULT_WALLETS);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  // Live On-Chain Address Checker
  const [lookupAddress, setLookupAddress] = useState("");
  const [lookupName, setLookupName] = useState("Phantom Live");
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [lookupResult, setLookupResult] = useState<{ address: string; balanceSol: number } | null>(null);

  // Paper Trading Balance
  const [paperCapitalSol, setPaperCapitalSol] = useState<number>(25.0);
  const [isEditingPaperCapital, setIsEditingPaperCapital] = useState(false);
  const [tempPaperCapital, setTempPaperCapital] = useState("25.0");

  // Modals & form state
  const [isAddingWallet, setIsAddingWallet] = useState(false);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);
  const [newWalletName, setNewWalletName] = useState("");
  const [newWalletBalance, setNewWalletBalance] = useState("");
  const [newWalletAddress, setNewWalletAddress] = useState("");

  // Deposit/Paycheck modal
  const [modalWallet, setModalWallet] = useState<Wallet | null>(null);
  const [modalType, setModalType] = useState<"deposit" | "paycheck">("deposit");
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"wallets" | "txLog">("wallets");

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("memecoin_journal_wallets");
      if (saved) setWallets(JSON.parse(saved));
      
      const savedTx = localStorage.getItem("memecoin_journal_wallet_txs");
      if (savedTx) setTransactions(JSON.parse(savedTx));

      const savedPaper = localStorage.getItem("memecoin_journal_paper_capital");
      if (savedPaper) setPaperCapitalSol(parseFloat(savedPaper));
    } catch (e) {}
  }, []);

  const saveWalletsToStorage = (updated: Wallet[]) => {
    setWallets(updated);
    try {
      localStorage.setItem("memecoin_journal_wallets", JSON.stringify(updated));
    } catch (e) {}
  };

  const saveTxToStorage = (updated: WalletTransaction[]) => {
    setTransactions(updated);
    try {
      localStorage.setItem("memecoin_journal_wallet_txs", JSON.stringify(updated));
    } catch (e) {}
  };

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedAddress(addr);
    showToast("Wallet address copied", "success");
    setTimeout(() => setCopiedAddress(null), 1500);
  };

  // Fetch On-Chain Live Balance
  const handleCheckOnChainBalance = async () => {
    const clean = lookupAddress.trim();
    if (!clean) return;
    setLoadingLookup(true);
    setLookupResult(null);

    try {
      const res = await fetch(`/api/sol-balance?address=${clean}`);
      if (res.ok) {
        const data = await res.json();
        setLookupResult(data);
        showToast("On-Chain Balance Verified", "success", `${data.balanceSol} SOL`);
      } else {
        showToast("Address lookup failed. Check address format.", "error");
      }
    } catch (e) {
      showToast("Network error checking Solana balance", "error");
    }
    setLoadingLookup(false);
  };

  const handleAddVerifiedWallet = () => {
    if (!lookupResult) return;
    const newW: Wallet = {
      id: `w-${Date.now()}`,
      name: lookupName.trim() || "Solana Wallet",
      balanceSol: lookupResult.balanceSol,
      address: lookupResult.address,
    };
    saveWalletsToStorage([...wallets, newW]);
    showToast(`Added ${newW.name} with ${newW.balanceSol} SOL`, "success");
    setLookupAddress("");
    setLookupResult(null);
  };

  // Handle Paper Trading Capital Update
  const handleSavePaperCapital = () => {
    const num = parseFloat(tempPaperCapital);
    if (!isNaN(num) && num >= 0) {
      setPaperCapitalSol(num);
      localStorage.setItem("memecoin_journal_paper_capital", String(num));
      showToast("Paper trading capital updated", "success", `${num} SOL`);
    }
    setIsEditingPaperCapital(false);
  };

  const handleAddOrUpdateWallet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWalletName.trim()) return;

    if (editingWallet) {
      const updated = wallets.map((w) =>
        w.id === editingWallet.id
          ? {
              ...w,
              name: newWalletName.trim(),
              balanceSol: parseFloat(newWalletBalance) || 0,
              address: newWalletAddress.trim() || w.address,
            }
          : w
      );
      saveWalletsToStorage(updated);
      showToast("Wallet updated", "success", newWalletName);
      setEditingWallet(null);
    } else {
      const newW: Wallet = {
        id: `w-${Date.now()}`,
        name: newWalletName.trim(),
        balanceSol: parseFloat(newWalletBalance) || 0,
        address: newWalletAddress.trim() || "Address not set",
      };
      saveWalletsToStorage([...wallets, newW]);
      showToast("Wallet added", "success", newW.name);
    }

    setNewWalletName("");
    setNewWalletBalance("");
    setNewWalletAddress("");
    setIsAddingWallet(false);
  };

  const handleDeleteWallet = (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name}?`)) return;
    const updated = wallets.filter((w) => w.id !== id);
    saveWalletsToStorage(updated);
    showToast("Wallet deleted", "info", name);
  };

  const handleOpenTxModal = (wallet: Wallet, type: "deposit" | "paycheck") => {
    setModalWallet(wallet);
    setModalType(type);
    setIsTxModalOpen(true);
  };

  const handleConfirmTransaction = async (walletId: string, deltaSol: number, notes: string) => {
    const targetWallet = wallets.find((w) => w.id === walletId);
    if (!targetWallet) return;

    const newBalance = Math.max(0, targetWallet.balanceSol + deltaSol);
    const updatedWallets = wallets.map((w) =>
      w.id === walletId ? { ...w, balanceSol: parseFloat(newBalance.toFixed(3)) } : w
    );
    saveWalletsToStorage(updatedWallets);

    const newTx: WalletTransaction = {
      id: `tx-${Date.now()}`,
      walletId,
      walletName: targetWallet.name,
      type: deltaSol >= 0 ? "deposit" : "paycheck",
      amountSol: Math.abs(deltaSol),
      amountUsd: Math.abs(deltaSol) * solPrice,
      notes,
      date: new Date().toISOString(),
      createdAt: Date.now(),
    };

    saveTxToStorage([newTx, ...transactions]);
  };

  const totalPortfolioSol = wallets.reduce((acc, w) => acc + w.balanceSol, 0);

  // Paper trading calculations
  const paperTrades = trades.filter((t) => (t.wallet || "").toLowerCase() === "paper");
  const paperPnlSol = paperTrades.reduce((acc, t) => acc + (t.pnlSol || 0), 0);
  const currentPaperBalance = Math.max(0, paperCapitalSol + paperPnlSol);

  return (
    <div className="space-y-6 pb-16">
      {/* Breadcrumb & Title */}
      <div className="pt-6">
        <div className="flex items-center gap-2 text-xs text-[#787774] mb-2">
          <span>Journal</span>
          <span>/</span>
          <span className="text-[#37352f] font-medium flex items-center gap-1">
            <span>💼</span>
            <span>Wallets</span>
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">💼</span>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#37352f]">
                Wallets & Live Solana Balances
              </h1>
              <p className="text-xs text-[#787774] mt-0.5">
                Check live on-chain Solana balances, manage trading wallets, and track paper trading capital.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setEditingWallet(null);
                setNewWalletName("");
                setNewWalletBalance("");
                setNewWalletAddress("");
                setIsAddingWallet(true);
              }}
              className="bg-[#2383e2] hover:bg-[#1a73ca] text-white px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Plus size={14} />
              <span>New Wallet</span>
            </button>
          </div>
        </div>
      </div>

      {/* Top 2 Action Banners: 1. Live On-Chain Address Scanner, 2. Paper Trading Sizer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* On-Chain Solana Wallet Balance Scanner */}
        <div className="bg-white border border-[#e9e9e7] rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                <Zap size={15} />
              </span>
              <div>
                <h3 className="text-xs font-bold text-[#37352f]">Check Live On-Chain Solana Balance</h3>
                <p className="text-[11px] text-[#787774]">Queries Solana blockchain RPC directly.</p>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={lookupAddress}
              onChange={(e) => setLookupAddress(e.target.value)}
              placeholder="Paste your Phantom/Solflare address..."
              className="flex-1 bg-[#fbfbfa] border border-[#e3e2de] rounded-lg px-3 py-1.5 text-xs text-[#37352f] font-mono focus:outline-none focus:border-[#2383e2]"
            />
            <button
              onClick={handleCheckOnChainBalance}
              disabled={loadingLookup || !lookupAddress}
              className="px-3 py-1.5 bg-[#2383e2] hover:bg-[#1a73ca] text-white rounded-lg text-xs font-medium flex items-center gap-1 disabled:opacity-50 transition-colors shrink-0"
            >
              {loadingLookup ? <Loader2 size={13} className="animate-spin" /> : <span>Scan RPC</span>}
            </button>
          </div>

          {lookupResult && (
            <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-lg flex items-center justify-between animate-in fade-in duration-200">
              <div>
                <span className="text-[11px] text-emerald-800 font-medium block">Verified On-Chain Balance:</span>
                <span className="text-sm font-bold font-mono text-emerald-950">
                  {lookupResult.balanceSol} SOL <span className="text-xs font-normal text-emerald-700">(≈ ${(lookupResult.balanceSol * solPrice).toFixed(2)})</span>
                </span>
              </div>
              <button
                onClick={handleAddVerifiedWallet}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-md text-xs font-semibold shadow-xs transition-colors"
              >
                + Add to Wallets
              </button>
            </div>
          )}
        </div>

        {/* Paper Trading Capital Settings */}
        <div className="bg-white border border-[#e9e9e7] rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-50 text-[#2383e2]">
                <Sparkles size={15} />
              </span>
              <div>
                <h3 className="text-xs font-bold text-[#37352f]">Paper Trading Capital (Simulated Bag)</h3>
                <p className="text-[11px] text-[#787774]">Test memecoin strategies without risking real SOL.</p>
              </div>
            </div>
            <button
              onClick={() => {
                setTempPaperCapital(String(paperCapitalSol));
                setIsEditingPaperCapital(!isEditingPaperCapital);
              }}
              className="text-[11px] text-[#2383e2] hover:underline font-medium"
            >
              {isEditingPaperCapital ? "Cancel" : "Set Capital"}
            </button>
          </div>

          {isEditingPaperCapital ? (
            <div className="flex gap-2">
              <input
                type="number"
                step="0.1"
                value={tempPaperCapital}
                onChange={(e) => setTempPaperCapital(e.target.value)}
                placeholder="Starting SOL (e.g. 25.0)"
                className="flex-1 bg-[#fbfbfa] border border-[#e3e2de] rounded-lg px-3 py-1.5 text-xs text-[#37352f] font-mono focus:outline-none focus:border-[#2383e2]"
              />
              <button
                onClick={handleSavePaperCapital}
                className="px-3 py-1.5 bg-[#2383e2] hover:bg-[#1a73ca] text-white rounded-lg text-xs font-semibold"
              >
                Save
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="p-2.5 bg-[#fbfbfa] border border-[#e9e9e7] rounded-lg">
                <span className="text-[10px] text-[#787774] block">Initial Paper Capital</span>
                <span className="font-mono font-bold text-xs text-[#37352f]">{paperCapitalSol.toFixed(1)} SOL</span>
              </div>
              <div className="p-2.5 bg-[#fbfbfa] border border-[#e9e9e7] rounded-lg">
                <span className="text-[10px] text-[#787774] block">Current Paper Equity</span>
                <span className={`font-mono font-bold text-xs ${paperPnlSol >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {currentPaperBalance.toFixed(2)} SOL ({paperPnlSol >= 0 ? `+${paperPnlSol.toFixed(2)}` : paperPnlSol.toFixed(2)})
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[#fbfbfa] border border-[#e9e9e7] rounded-xl p-4">
          <span className="text-xs text-[#787774] block">Total Combined Real Balance</span>
          <div className="text-xl font-bold text-[#37352f] mt-1 font-mono">
            {totalPortfolioSol.toFixed(2)} SOL
          </div>
          <span className="text-[11px] text-[#9b9a97]">≈ ${(totalPortfolioSol * solPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>

        <div className="bg-[#fbfbfa] border border-[#e9e9e7] rounded-xl p-4">
          <span className="text-xs text-[#787774] block">Active Trading Wallets</span>
          <div className="text-xl font-bold text-[#37352f] mt-1">
            {wallets.length} Wallets
          </div>
          <span className="text-[11px] text-[#9b9a97]">Phantom, BullX, Photon, Trojan</span>
        </div>

        <div className="bg-[#fbfbfa] border border-[#e9e9e7] rounded-xl p-4">
          <span className="text-xs text-[#787774] block">Total Realized Paychecks Cashed</span>
          <div className="text-xl font-bold text-emerald-600 mt-1 font-mono">
            {transactions.filter((t) => t.type === "paycheck").reduce((acc, t) => acc + t.amountSol, 0).toFixed(2)} SOL
          </div>
          <span className="text-[11px] text-[#9b9a97]">Withdrawn profit</span>
        </div>
      </div>

      {/* Notion Toolbar */}
      <div className="flex items-center justify-between border-b border-[#e9e9e7] pb-3 text-xs text-[#787774]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("wallets")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded border transition-all ${
              activeTab === "wallets"
                ? "bg-[#f7f6f3] text-[#37352f] font-semibold border-[#e9e9e7]"
                : "text-[#787774] hover:text-[#37352f] border-transparent"
            }`}
          >
            <WalletIcon size={13} />
            <span>Wallets Table</span>
          </button>
          <button
            onClick={() => setActiveTab("txLog")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded border transition-all ${
              activeTab === "txLog"
                ? "bg-[#f7f6f3] text-[#37352f] font-semibold border-[#e9e9e7]"
                : "text-[#787774] hover:text-[#37352f] border-transparent"
            }`}
          >
            <Calendar size={13} />
            <span>Deposit & Paycheck History ({transactions.length})</span>
          </button>
        </div>
      </div>

      {/* Add / Edit Wallet Inline Form */}
      {isAddingWallet && (
        <form onSubmit={handleAddOrUpdateWallet} className="p-4 bg-[#fbfbfa] border border-[#e3e2de] rounded-lg space-y-3 text-xs">
          <h3 className="font-semibold text-[#37352f]">
            {editingWallet ? `Edit Wallet: ${editingWallet.name}` : "Add New Trading Wallet"}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Wallet Name (e.g. BullX Sniper)"
              value={newWalletName}
              onChange={(e) => setNewWalletName(e.target.value)}
              required
              className="bg-white border border-[#e3e2de] rounded-md px-3 py-1.5 text-xs"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Balance (SOL)"
              value={newWalletBalance}
              onChange={(e) => setNewWalletBalance(e.target.value)}
              className="bg-white border border-[#e3e2de] rounded-md px-3 py-1.5 text-xs"
            />
            <input
              type="text"
              placeholder="Solana Address (Base58)"
              value={newWalletAddress}
              onChange={(e) => setNewWalletAddress(e.target.value)}
              className="bg-white border border-[#e3e2de] rounded-md px-3 py-1.5 text-xs font-mono"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsAddingWallet(false);
                setEditingWallet(null);
              }}
              className="px-3 py-1 rounded text-xs text-[#787774] hover:bg-[#f1f1ef]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1 bg-[#2383e2] hover:bg-[#1a73ca] text-white rounded text-xs font-medium"
            >
              {editingWallet ? "Save Changes" : "Create Wallet"}
            </button>
          </div>
        </form>
      )}

      {activeTab === "wallets" ? (
        /* Notion Database Table */
        <div className="border border-[#e9e9e7] rounded-lg overflow-hidden bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="notion-table-th">Aa Name</th>
                  <th className="notion-table-th">⭐ Balance</th>
                  <th className="notion-table-th">✔️ WinRate</th>
                  <th className="notion-table-th">⚫ Trades</th>
                  <th className="notion-table-th">🏆 Wins</th>
                  <th className="notion-table-th">💥 Losses</th>
                  <th className="notion-table-th">💵 Total P&L (SOL)</th>
                  <th className="notion-table-th">≡ Address</th>
                  <th className="notion-table-th">📥 Deposit</th>
                  <th className="notion-table-th">📤 Paycheck</th>
                  <th className="notion-table-th text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {wallets.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-xs text-[#787774]">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <WalletIcon size={24} className="text-[#9b9a97]" />
                        <span className="font-semibold text-[#37352f]">No Trading Wallets Added Yet</span>
                        <p className="text-[11px] max-w-sm text-[#787774]">
                          Click "+ New Wallet" above to track balances, deposits, and paycheck profit sweeps across Phantom, BullX, or Photon.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  wallets.map((wallet) => {
                  const walletPrefix = wallet.name.toLowerCase().split(" ")[0];
                  const walletTrades = trades.filter((t) => (t.wallet || "Main").toLowerCase().includes(walletPrefix));
                  const walletTradesCount = walletTrades.length;
                  const walletWins = walletTrades.filter((t) => t.result === "Win").length;
                  const walletLosses = walletTrades.filter((t) => t.result === "Loss").length;
                  const walletWinRate = walletTradesCount > 0 ? ((walletWins / walletTradesCount) * 100).toFixed(0) : "0";
                  const walletPnl = walletTrades.reduce((acc, t) => acc + (t.pnlSol || 0), 0);

                  return (
                    <tr key={wallet.id} className="hover:bg-[#fcfbf9] transition-colors group">
                      <td className="notion-table-td font-semibold text-[#37352f]">
                        <div className="flex items-center gap-2">
                          <WalletIcon size={14} className="text-[#787774]" />
                          <span>{wallet.name}</span>
                        </div>
                      </td>
                      <td className="notion-table-td font-mono font-medium">
                        {wallet.balanceSol.toFixed(2)} SOL
                      </td>
                      <td className="notion-table-td">
                        <span className="px-2 py-0.5 rounded text-[11px] bg-[#f1f1ef] font-medium">
                          {walletWinRate}%
                        </span>
                      </td>
                      <td className="notion-table-td text-[#5a5957] font-mono">
                        {walletTradesCount}
                      </td>
                      <td className="notion-table-td text-emerald-600 font-mono">
                        {walletWins}
                      </td>
                      <td className="notion-table-td text-rose-600 font-mono">
                        {walletLosses}
                      </td>
                      <td
                        className={`notion-table-td font-mono font-semibold ${
                          walletPnl > 0 ? "text-emerald-600" : walletPnl < 0 ? "text-rose-600" : "text-[#787774]"
                        }`}
                      >
                        {walletPnl >= 0 ? `+${walletPnl.toFixed(2)} SOL` : `${walletPnl.toFixed(2)} SOL`}
                      </td>
                      <td className="notion-table-td font-mono text-[11px] text-[#787774]">
                        <div className="flex items-center gap-1.5">
                          <span>{wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}</span>
                          <button
                            onClick={() => copyAddress(wallet.address)}
                            className="text-[#9b9a97] hover:text-[#37352f] p-0.5"
                            title="Copy address"
                          >
                            {copiedAddress === wallet.address ? (
                              <Check size={11} className="text-emerald-600" />
                            ) : (
                              <Copy size={11} />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="notion-table-td text-[#787774]">
                        <button
                          onClick={() => handleOpenTxModal(wallet, "deposit")}
                          className="text-[#2383e2] hover:underline flex items-center gap-1 text-[11px]"
                        >
                          <ArrowDownToLine size={12} />
                          <span>Deposit</span>
                        </button>
                      </td>
                      <td className="notion-table-td text-[#787774]">
                        <button
                          onClick={() => handleOpenTxModal(wallet, "paycheck")}
                          className="text-emerald-600 hover:underline flex items-center gap-1 text-[11px]"
                        >
                          <ArrowUpFromLine size={12} />
                          <span>Paycheck</span>
                        </button>
                      </td>
                      <td className="notion-table-td text-center">
                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setEditingWallet(wallet);
                              setNewWalletName(wallet.name);
                              setNewWalletBalance(String(wallet.balanceSol));
                              setNewWalletAddress(wallet.address);
                              setIsAddingWallet(true);
                            }}
                            className="p-1 text-[#9b9a97] hover:text-[#2383e2] rounded"
                            title="Edit wallet"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteWallet(wallet.id, wallet.name)}
                            className="p-1 text-[#9b9a97] hover:text-rose-600 rounded"
                            title="Delete wallet"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Transaction History Log */
        <div className="border border-[#e9e9e7] rounded-lg overflow-hidden bg-white shadow-xs">
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#9b9a97]">
              No deposit or paycheck history logged yet. Click "Deposit" or "Paycheck" on any wallet above.
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr>
                  <th className="notion-table-th">Date</th>
                  <th className="notion-table-th">Type</th>
                  <th className="notion-table-th">Wallet</th>
                  <th className="notion-table-th">Amount (SOL)</th>
                  <th className="notion-table-th">Approx USD</th>
                  <th className="notion-table-th">Notes</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[#fcfbf9]">
                    <td className="notion-table-td text-[#787774] font-mono text-[11px]">
                      {new Date(tx.createdAt || Date.now()).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="notion-table-td font-semibold">
                      {tx.type === "deposit" ? (
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-[#2383e2] border border-blue-200 text-[11px]">
                          📥 Deposit
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px]">
                          📤 Paycheck
                        </span>
                      )}
                    </td>
                    <td className="notion-table-td font-medium">{tx.walletName}</td>
                    <td className={`notion-table-td font-mono font-bold ${tx.type === "deposit" ? "text-blue-600" : "text-emerald-600"}`}>
                      {tx.type === "deposit" ? `+${tx.amountSol}` : `-${tx.amountSol}`} SOL
                    </td>
                    <td className="notion-table-td font-mono text-[#787774]">
                      ${(tx.amountUsd || tx.amountSol * solPrice).toFixed(2)}
                    </td>
                    <td className="notion-table-td text-[#787774]">{tx.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Deposit & Paycheck Modal */}
      <DepositPaycheckModal
        wallet={modalWallet}
        type={modalType}
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
        onConfirm={handleConfirmTransaction}
        solPrice={solPrice}
      />
    </div>
  );
}
