"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
} from "firebase/firestore";
import { Trade, Wallet, WalletTransaction } from "../lib/types";
import {
  Plus,
  Wallet as WalletIcon,
  Copy,
  Check,
  ArrowDownToLine,
  ArrowUpFromLine,
  Trash2,
  Edit2,
  Calendar,
  Loader2,
  Sparkles,
  Zap
} from "lucide-react";
import DepositPaycheckModal from "./DepositPaycheckModal";
import WalletSyncPanel from "./WalletSyncPanel";
import { useToast } from "./Toast";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";
import { parseLocalStorageValue } from "../lib/useLocalStorage";
import { formatSol, getTradeTimestamp } from "../lib/utils";
import { isValidSolAmount } from "../lib/tradeInput";
import {
  applySupabaseWalletTransaction,
  deleteSupabaseWallet,
  listSupabaseWallets,
  listSupabaseWalletTransactions,
  loadSupabaseWalletConfig,
  saveSupabaseWallet,
  saveSupabaseWalletConfig,
  saveSupabaseWalletTransaction,
  usesSupabaseJournal,
} from "../lib/journalBackend";

interface WalletsViewProps {
  trades: Trade[];
  solPrice?: number;
  onImportWalletTrade?: (draft: Partial<Trade>) => void;
}

type WalletActivity = { signature: string; blockTime: number; feeSol: number; solChange: number; tokenChanges: Array<{ mint: string; change: number }> };
type WalletHolding = { mint: string; amount: number; symbol: string; name: string; priceUsd: number | null; valueUsd: number | null };
type WalletTradeCandidate = { mint: string; boughtSol: number; soldSol: number; feesSol: number; entryAt: number; exitAt?: number; fills: NonNullable<Trade["fills"]>; signatures: string[] };

const DEFAULT_WALLETS: Wallet[] = [];

function createLocalId(prefix: string) {
  return `${prefix}-${globalThis.crypto.randomUUID()}`;
}

export default function WalletsView({ trades, solPrice = 150, onImportWalletTrade }: WalletsViewProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const storagePrefix = `memecoin_journal_${user?.uid || "guest"}_`;
  const [wallets, setWallets] = useState<Wallet[]>(DEFAULT_WALLETS);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [paperCapitalSol, setPaperCapitalSol] = useState(25);
  const [walletDataLoading, setWalletDataLoading] = useState(true);
  const migrationAttempted = useRef(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  // Live On-Chain Address Checker
  const [lookupAddress, setLookupAddress] = useState("");
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [lookupResult, setLookupResult] = useState<{ address: string; balanceSol: number } | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [walletActivities, setWalletActivities] = useState<WalletActivity[]>([]);
  const [walletHoldings, setWalletHoldings] = useState<WalletHolding[]>([]);
  const [scannedWallet, setScannedWallet] = useState<{ address: string; name: string } | null>(null);

  const walletTradeCandidates = useMemo(() => {
    const candidates = new Map<string, WalletTradeCandidate>();
    for (const activity of [...walletActivities].sort((a, b) => a.blockTime - b.blockTime)) {
      for (const change of activity.tokenChanges) {
        if (Math.abs(activity.solChange) < 0.000000001) continue;
        const current = candidates.get(change.mint) || { mint: change.mint, boughtSol: 0, soldSol: 0, feesSol: 0, entryAt: activity.blockTime, fills: [], signatures: [] };
        if (change.change > 0 && activity.solChange < 0) {
          const spent = Math.max(0, -activity.solChange - activity.feeSol);
          current.boughtSol += spent;
          current.entryAt = Math.min(current.entryAt, activity.blockTime);
          current.fills.push({ id: `${activity.signature}-entry`, side: "entry", quoteAmount: spent, feeSol: activity.feeSol, executedAt: activity.blockTime });
        } else if (change.change < 0 && activity.solChange > 0) {
          const received = Math.max(0, activity.solChange + activity.feeSol);
          current.soldSol += received;
          current.exitAt = Math.max(current.exitAt || 0, activity.blockTime);
          current.fills.push({ id: `${activity.signature}-exit`, side: "exit", quoteAmount: received, feeSol: activity.feeSol, executedAt: activity.blockTime });
        } else continue;
        current.feesSol += activity.feeSol;
        if (!current.signatures.includes(activity.signature)) current.signatures.push(activity.signature);
        candidates.set(change.mint, current);
      }
    }
    return [...candidates.values()].filter((candidate) => candidate.boughtSol > 0 || candidate.soldSol > 0).sort((a, b) => (b.exitAt || b.entryAt) - (a.exitAt || a.entryAt));
  }, [walletActivities]);

  // Paper Trading Balance
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
  const [walletToDelete, setWalletToDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    if (usesSupabaseJournal()) {
      let cancelled = false;
      let requestInFlight = false;
      const load = async () => {
        if (requestInFlight) return;
        requestInFlight = true;
        try {
          const [nextWallets, nextTransactions, config] = await Promise.all([
            listSupabaseWallets(user.uid),
            listSupabaseWalletTransactions(user.uid),
            loadSupabaseWalletConfig(user.uid),
          ]);
          if (cancelled) return;
          setWallets(nextWallets);
          setTransactions(nextTransactions);
          setPaperCapitalSol(typeof config.paperCapitalSol === "number" && config.paperCapitalSol >= 0 ? config.paperCapitalSol : 25);
        } catch {
          if (!cancelled) showToast("Could not load wallets", "error", "Check your connection and try again.");
        } finally {
          if (!cancelled) setWalletDataLoading(false);
          requestInFlight = false;
        }
      };
      void load();
      const poll = window.setInterval(() => void load(), 20_000);
      return () => {
        cancelled = true;
        window.clearInterval(poll);
      };
    }

    let loadedWallets = false;
    let loadedTransactions = false;
    let loadedConfig = false;
    const updateLoading = () => setWalletDataLoading(!(loadedWallets && loadedTransactions && loadedConfig));

    const stopWallets = onSnapshot(
      collection(db, "users", user.uid, "wallets"),
      (snapshot) => {
        setWallets(snapshot.docs.map((walletDoc) => walletDoc.data() as Wallet));
        loadedWallets = true;
        updateLoading();
      },
      () => {
        loadedWallets = true;
        updateLoading();
        showToast("Could not load wallets", "error", "Check your connection and Firestore permissions.");
      }
    );
    const stopTransactions = onSnapshot(
      query(collection(db, "users", user.uid, "walletTransactions"), orderBy("date", "desc")),
      (snapshot) => {
        setTransactions(snapshot.docs.map((transactionDoc) => transactionDoc.data() as WalletTransaction));
        loadedTransactions = true;
        updateLoading();
      },
      () => {
        loadedTransactions = true;
        updateLoading();
        showToast("Could not load wallet history", "error", "Check your connection and Firestore permissions.");
      }
    );
    const stopConfig = onSnapshot(
      doc(db, "users", user.uid, "settings", "walletConfig"),
      (snapshot) => {
        const value = snapshot.data()?.paperCapitalSol;
        setPaperCapitalSol(typeof value === "number" && value >= 0 ? value : 25);
        loadedConfig = true;
        updateLoading();
      },
      () => {
        loadedConfig = true;
        updateLoading();
        showToast("Could not load paper balance", "error", "Check your connection and Firestore permissions.");
      }
    );

    return () => {
      stopWallets();
      stopTransactions();
      stopConfig();
    };
  }, [showToast, user]);

  // One-time migration for accounts that used the earlier browser-only wallet storage.
  useEffect(() => {
    if (!user || walletDataLoading || migrationAttempted.current) return;
    migrationAttempted.current = true;

    try {
      const storedWallets = localStorage.getItem(`${storagePrefix}wallets`);
      const storedTransactions = localStorage.getItem(`${storagePrefix}wallet_txs`);
      const storedPaperCapital = localStorage.getItem(`${storagePrefix}paper_capital`);
      const walletValue = parseLocalStorageValue<unknown>(storedWallets, []);
      const transactionValue = parseLocalStorageValue<unknown>(storedTransactions, []);
      const legacyWallets = Array.isArray(walletValue) ? walletValue.slice(0, 100) as Wallet[] : [];
      const legacyTransactions = Array.isArray(transactionValue) ? transactionValue.slice(0, 1000) as WalletTransaction[] : [];
      const legacyPaperCapital = Number.parseFloat(storedPaperCapital || "");
      if (legacyWallets.length === 0 && legacyTransactions.length === 0 && !Number.isFinite(legacyPaperCapital)) return;

      const saveWallets = usesSupabaseJournal()
        ? legacyWallets.map((wallet) => saveSupabaseWallet(user.uid, wallet))
        : legacyWallets.map((wallet) => setDoc(doc(db, "users", user.uid, "wallets", wallet.id), {
            ...wallet,
            updatedAt: typeof wallet.updatedAt === "number" ? wallet.updatedAt : Date.now(),
          }));
      const saveTransactions = usesSupabaseJournal()
        ? legacyTransactions.map((transaction) => saveSupabaseWalletTransaction(user.uid, transaction))
        : legacyTransactions.map((transaction) => setDoc(doc(db, "users", user.uid, "walletTransactions", transaction.id), {
            ...transaction,
            date: transaction.date || Timestamp.now(),
            createdAt: typeof transaction.createdAt === "number" ? transaction.createdAt : Date.now(),
          }));
      const saveConfig = Number.isFinite(legacyPaperCapital) && legacyPaperCapital >= 0
        ? usesSupabaseJournal()
          ? [saveSupabaseWalletConfig(user.uid, legacyPaperCapital)]
          : [setDoc(doc(db, "users", user.uid, "settings", "walletConfig"), {
              paperCapitalSol: legacyPaperCapital,
              updatedAt: Date.now(),
            })]
        : [];
      void Promise.all([
        ...saveWallets,
        ...saveTransactions,
        ...saveConfig,
      ]).then(() => {
        localStorage.removeItem(`${storagePrefix}wallets`);
        localStorage.removeItem(`${storagePrefix}wallet_txs`);
        localStorage.removeItem(`${storagePrefix}paper_capital`);
        showToast("Wallet data secured in your account", "success", "Your earlier browser-only data was migrated to your account.");
      }).catch(() => {
        migrationAttempted.current = false;
        showToast("Wallet migration paused", "error", "Your browser copy is intact. We will retry after you reload.");
      });
    } catch {
      // Browser storage may be unavailable; cloud wallet data remains usable.
    }
  }, [showToast, storagePrefix, user, walletDataLoading]);

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
      const token = await user?.getIdToken();
      const res = await fetch("/api/sol-balance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: "Bearer " + token } : {}),
        },
        body: JSON.stringify({ address: clean }),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setLookupResult(data);
        showToast("On-Chain Balance Verified", "success", `${data.balanceSol} SOL`);
      } else {
        showToast("Address lookup failed. Check address format.", "error");
      }
    } catch {
      showToast("Network error checking Solana balance", "error");
    }
    setLoadingLookup(false);
  };

  const handleAddVerifiedWallet = async () => {
    if (!lookupResult) return;
    const newW: Wallet = {
      id: createLocalId("w"),
      name: "Solana Wallet",
      balanceSol: lookupResult.balanceSol,
      address: lookupResult.address,
    };
    try {
      if (usesSupabaseJournal()) await saveSupabaseWallet(user!.uid, newW);
      else await setDoc(doc(db, "users", user!.uid, "wallets", newW.id), newW);
      showToast(`Added ${newW.name} with ${newW.balanceSol} SOL`, "success");
      setLookupResult(null);
      await handleImportWalletActivity(newW.address, newW.name);
    } catch {
      showToast("Could not add wallet", "error", "Check your connection and try again.");
    }
  };

  const handleImportWalletActivity = async (address = lookupAddress.trim(), walletName?: string) => {
    const clean = address.trim();
    if (!clean || !user) return;
    setActivityLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/wallet-activity", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ address: clean }), cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "Wallet activity could not be imported.");
      setWalletActivities(Array.isArray(data.activities) ? data.activities : []);
      setWalletHoldings(Array.isArray(data.holdings) ? data.holdings : []);
      setScannedWallet({ address: clean, name: walletName || wallets.find((wallet) => wallet.address === clean)?.name || "Solana Wallet" });
      showToast("Read-only wallet activity imported", "success", "Review a transaction before adding it to your journal.");
    } catch (error) {
      showToast("Wallet import failed", "error", error instanceof Error ? error.message : "Try again shortly.");
    } finally { setActivityLoading(false); }
  };

  const reviewCandidateAsTrade = (candidate: WalletTradeCandidate) => {
    if (!onImportWalletTrade) return;
    const pnlSol = candidate.soldSol - candidate.boughtSol - candidate.feesSol;
    onImportWalletTrade({
      ca: candidate.mint,
      wallet: scannedWallet?.name || "Imported wallet",
      boughtSol: candidate.boughtSol,
      soldSol: candidate.soldSol || undefined,
      pnlSol,
      result: candidate.soldSol > 0 ? (Math.abs(pnlSol) < 0.000000001 ? "BE" : pnlSol > 0 ? "Win" : "Loss") : undefined,
      feesSol: candidate.feesSol,
      tradedAt: candidate.exitAt || candidate.entryAt,
      durationMinutes: candidate.exitAt ? Math.max(1, Math.round((candidate.exitAt - candidate.entryAt) / 60_000)) : undefined,
      fills: candidate.fills,
      notes: `Detected from read-only wallet activity. Review every value before saving. Transactions: ${candidate.signatures.join(", ")}`,
      venue: "On-chain import",
    });
  };

  // Handle Paper Trading Capital Update
  const handleSavePaperCapital = async () => {
    const num = parseFloat(tempPaperCapital);
    if (isValidSolAmount(num)) {
      try {
        if (usesSupabaseJournal()) await saveSupabaseWalletConfig(user!.uid, num);
        else await setDoc(doc(db, "users", user!.uid, "settings", "walletConfig"), {
            paperCapitalSol: num,
            updatedAt: Date.now(),
          });
        showToast("Paper trading capital updated", "success", `${num} SOL`);
      } catch {
        showToast("Could not save paper balance", "error", "Check your connection and try again.");
        return;
      }
    } else {
      showToast("Enter a valid paper balance", "error", "Use 0–100,000,000 SOL with up to 9 decimal places.");
      return;
    }
    setIsEditingPaperCapital(false);
  };

  const handleAddOrUpdateWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWalletName.trim()) return;
    const balanceSol = editingWallet?.balanceSol ?? Number(newWalletBalance || 0);
    if (!isValidSolAmount(balanceSol)) {
      showToast("Enter a valid wallet balance", "error", "Use 0–100,000,000 SOL with up to 9 decimal places.");
      return;
    }

    const savedWallet: Wallet = editingWallet
      ? {
          ...editingWallet,
          name: newWalletName.trim(),
          balanceSol,
          address: newWalletAddress.trim() || editingWallet.address,
        }
      : {
          id: createLocalId("w"),
          name: newWalletName.trim(),
          balanceSol,
          address: newWalletAddress.trim() || "Address not set",
        };

    try {
      if (usesSupabaseJournal()) await saveSupabaseWallet(user!.uid, savedWallet);
      else await setDoc(doc(db, "users", user!.uid, "wallets", savedWallet.id), { ...savedWallet, updatedAt: Date.now() });
      showToast(editingWallet ? "Wallet updated" : "Wallet added", "success", savedWallet.name);
      setEditingWallet(null);
      if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(savedWallet.address)) await handleImportWalletActivity(savedWallet.address, savedWallet.name);
    } catch {
      showToast("Could not save wallet", "error", "Check your connection and try again.");
      return;
    }

    setNewWalletName("");
    setNewWalletBalance("");
    setNewWalletAddress("");
    setIsAddingWallet(false);
  };

  const handleDeleteWallet = (id: string, name: string) => {
    setWalletToDelete({ id, name });
  };

  const confirmDeleteWallet = async () => {
    if (!walletToDelete) return;
    const { id, name } = walletToDelete;
    try {
      if (usesSupabaseJournal()) await deleteSupabaseWallet(user!.uid, id);
      else await deleteDoc(doc(db, "users", user!.uid, "wallets", id));
      showToast("Wallet deleted", "info", name);
      setWalletToDelete(null);
    } catch {
      showToast("Could not delete wallet", "error", "Check your connection and try again.");
    }
  };

  const handleOpenTxModal = (wallet: Wallet, type: "deposit" | "paycheck") => {
    setModalWallet(wallet);
    setModalType(type);
    setIsTxModalOpen(true);
  };

  const handleConfirmTransaction = async (walletId: string, deltaSol: number, notes: string) => {
    const targetWallet = wallets.find((w) => w.id === walletId);
    if (!targetWallet) return;

    const newTx: WalletTransaction = {
      id: createLocalId("tx"),
      walletId,
      walletName: targetWallet.name,
      type: deltaSol >= 0 ? "deposit" : "paycheck",
      amountSol: Math.abs(deltaSol),
      ...(solPrice > 0 ? { amountUsd: Math.abs(deltaSol) * solPrice } : {}),
      notes,
      date: new Date(),
      createdAt: Date.now(),
    };
    if (usesSupabaseJournal()) {
      await applySupabaseWalletTransaction(user!.uid, newTx, deltaSol);
      return;
    }
    const walletRef = doc(db, "users", user!.uid, "wallets", walletId);
    const transactionRef = doc(db, "users", user!.uid, "walletTransactions", newTx.id);
    await runTransaction(db, async (transaction) => {
      const walletSnapshot = await transaction.get(walletRef);
      if (!walletSnapshot.exists()) throw new Error("Wallet no longer exists.");
      const currentBalance = Number(walletSnapshot.data().balanceSol) || 0;
      if (deltaSol < 0 && Math.abs(deltaSol) > currentBalance) {
        throw new Error("Withdrawal exceeds the wallet balance.");
      }
      const newBalance = currentBalance + deltaSol;
      if (!Number.isFinite(newBalance) || newBalance < 0 || newBalance > 100_000_000) {
        throw new Error("Wallet balance is outside the supported range.");
      }
      transaction.update(walletRef, {
        balanceSol: newBalance,
        updatedAt: Date.now(),
      });
      transaction.set(transactionRef, newTx);
    });
  };

  const totalPortfolioSol = wallets.reduce((acc, w) => acc + w.balanceSol, 0);

  // Paper trading calculations
  const paperTrades = trades.filter((t) => (t.wallet || "").toLowerCase() === "paper");
  const paperPnlSol = paperTrades.reduce((acc, t) => acc + (t.pnlSol || 0), 0);
  const currentPaperBalance = Math.max(0, paperCapitalSol + paperPnlSol);

  return (
    <div className="journal-page">
      {/* Breadcrumb & Title */}
      <div className="pt-6">
        <div className="flex items-center gap-2 text-xs text-[#787774] mb-2">
          <span>Journal</span>
          <span>/</span>
          <span className="text-[#37352f] font-medium">Wallets</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#37352f]">
                Wallets
              </h1>
              <p className="text-xs text-[#787774] mt-0.5">
                Check live on-chain Solana balances, manage trading wallets, and track paper trading capital.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              data-tour="new-wallet"
              onClick={() => {
                setEditingWallet(null);
                setNewWalletName("");
                setNewWalletBalance("");
                setNewWalletAddress("");
                setIsAddingWallet(true);
              }}
              className="bg-[#1a73ca] hover:bg-[#155fa8] text-white px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Plus size={14} />
              <span>New Wallet</span>
            </button>
          </div>
        </div>
      </div>

      {walletDataLoading && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800">
          <Loader2 size={14} className="animate-spin" />
          Loading your private wallet data…
        </div>
      )}

      <WalletSyncPanel onImportWalletTrade={onImportWalletTrade} />

      {/* Top 2 Action Banners: 1. Live On-Chain Address Scanner, 2. Paper Trading Sizer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* On-Chain Solana Wallet Balance Scanner */}
        <div data-tour="wallet-scan" className="bg-white border border-[#e9e9e7] rounded-xl p-4 shadow-xs space-y-3">
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
              aria-label="Solana wallet address"
              placeholder="Paste your Phantom/Solflare address..."
              className="flex-1 bg-[#fbfbfa] border border-[#e3e2de] rounded-lg px-3 py-1.5 text-xs text-[#37352f] font-mono focus:outline-none focus:border-[#2383e2]"
            />
            <button
              onClick={handleCheckOnChainBalance}
              disabled={loadingLookup || !lookupAddress}
              className="px-3 py-1.5 bg-[#1a73ca] hover:bg-[#155fa8] text-white rounded-lg text-xs font-medium flex items-center gap-1 disabled:opacity-50 transition-colors shrink-0"
            >
              {loadingLookup ? <Loader2 size={13} className="animate-spin" /> : <span>Scan RPC</span>}
            </button>
          </div>

          {lookupResult && (
            <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-lg flex items-center justify-between animate-in fade-in duration-200">
              <div>
                <span className="text-[11px] text-emerald-800 font-medium block">Verified On-Chain Balance:</span>
                <span className="text-sm font-bold font-mono text-emerald-950">
                  {formatSol(lookupResult.balanceSol)} SOL <span className="text-xs font-normal text-emerald-700">(≈ ${(lookupResult.balanceSol * solPrice).toFixed(2)})</span>
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
        <div data-tour="paper-capital" className="bg-white border border-[#e9e9e7] rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-50 text-[#2383e2]">
                <Sparkles size={15} />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-[#37352f]">Paper Trading Capital</h3>
                  <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-amber-700">
                    SIMULATION ONLY
                  </span>
                </div>
                <p className="text-[11px] text-[#787774]">Practice balance only. This is not real SOL and cannot be withdrawn.</p>
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
                className="px-3 py-1.5 bg-[#1a73ca] hover:bg-[#155fa8] text-white rounded-lg text-xs font-semibold"
              >
                Save
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="p-2.5 bg-[#fbfbfa] border border-[#e9e9e7] rounded-lg">
                <span className="text-[10px] text-[#787774] block">Initial Simulated Balance</span>
                <span className="font-mono font-bold text-xs text-[#37352f]">{formatSol(paperCapitalSol)} SOL</span>
              </div>
              <div className="p-2.5 bg-[#fbfbfa] border border-[#e9e9e7] rounded-lg">
                <span className="text-[10px] text-[#787774] block">Current Simulated Equity</span>
                <span className={`font-mono font-bold text-xs ${paperPnlSol >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {formatSol(currentPaperBalance)} SOL ({paperPnlSol >= 0 ? `+${formatSol(paperPnlSol)}` : formatSol(paperPnlSol)})
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {user && (lookupAddress.trim() || scannedWallet) && (
        <section className="rounded-xl border border-[#e9e9e7] bg-white p-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-sm font-semibold text-[#37352f]">Read-only wallet scanner{scannedWallet ? ` · ${scannedWallet.name}` : ""}</h2><p className="mt-1 text-[11px] text-[#787774]">Detects likely swaps, entries, exits, transfers, fees, and current token balances from a public address. It never requests a signature, private key, or seed phrase.</p></div>
            <button type="button" onClick={() => void handleImportWalletActivity(scannedWallet?.address || lookupAddress.trim(), scannedWallet?.name)} disabled={activityLoading} className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 disabled:opacity-50">{activityLoading ? <Loader2 size={13} className="animate-spin"/> : <ArrowDownToLine size={13}/>}Scan recent activity</button>
          </div>
          {walletHoldings.length > 0 && <div className="mt-4"><h3 className="text-xs font-semibold">Open token balances</h3><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{walletHoldings.slice(0, 9).map((holding) => { const related = trades.filter((trade) => trade.ca === holding.mint); const costSol = related.reduce((sum, trade) => sum + (trade.boughtSol || 0) - (trade.soldSol || 0), 0); const valueSol = holding.valueUsd !== null && solPrice > 0 ? holding.valueUsd / solPrice : null; const unrealized = valueSol !== null && costSol > 0 ? valueSol - costSol : null; return <article key={holding.mint} className="rounded-lg bg-[#fbfbfa] p-3 text-xs"><div className="flex justify-between gap-2"><strong className="truncate">{holding.name} · ${holding.symbol}</strong><span className="font-mono">{holding.amount.toLocaleString(undefined,{maximumFractionDigits:4})}</span></div><p className="mt-1 text-[10px] text-[#787774]">{holding.valueUsd === null ? "Market value unavailable" : `$${holding.valueUsd.toFixed(2)} current value`}</p>{unrealized !== null && <p className={`mt-1 font-mono text-[11px] font-semibold ${unrealized < 0 ? "text-rose-700" : "text-emerald-700"}`}>{unrealized >= 0 ? "+" : ""}{formatSol(unrealized)} SOL estimated unrealized P&amp;L</p>}</article>; })}</div><p className="mt-2 text-[10px] text-[#9b9a97]">Unrealized P&amp;L is an estimate from current public market prices and journaled net cost. Verify thin-liquidity tokens before acting.</p></div>}
          {walletTradeCandidates.length > 0 && <div className="mt-4 border-t border-[#f1f1ef] pt-4"><h3 className="text-xs font-semibold">Detected trades to review</h3><p className="mt-1 text-[10px] text-[#787774]">The scanner groups matching on-chain entries and exits. Nothing is added to your journal until you review and save it.</p><div className="mt-2 space-y-2">{walletTradeCandidates.slice(0, 12).map((candidate) => { const pnl = candidate.soldSol - candidate.boughtSol - candidate.feesSol; return <article key={candidate.mint} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#e9e9e7] p-3 text-xs"><div className="min-w-0"><strong className="block truncate font-mono">{candidate.mint}</strong><p className="mt-1 text-[10px] text-[#787774]">Bought {formatSol(candidate.boughtSol)} SOL · Sold {formatSol(candidate.soldSol)} SOL · Fees {formatSol(candidate.feesSol)} SOL{candidate.soldSol > 0 ? ` · Estimated P&L ${pnl >= 0 ? "+" : ""}${formatSol(pnl)} SOL` : " · Open position"}</p></div>{onImportWalletTrade && <button type="button" onClick={() => reviewCandidateAsTrade(candidate)} className="rounded-lg bg-[#1a73ca] px-3 py-2 text-[11px] font-semibold text-white">Review as trade</button>}</article>; })}</div></div>}
          {walletActivities.length > 0 && <details className="mt-4 border-t border-[#f1f1ef] pt-4"><summary className="cursor-pointer text-xs font-semibold text-[#5a5957]">Raw transfers and transactions · {walletActivities.length}</summary><div className="mt-2 space-y-2">{walletActivities.slice(0, 12).map((activity) => <article key={activity.signature} className="rounded-lg bg-[#fbfbfa] p-3 text-xs"><strong>{new Date(activity.blockTime).toLocaleString()}</strong><p className="mt-1 text-[10px] text-[#787774]">SOL {activity.solChange >= 0 ? "+" : ""}{formatSol(activity.solChange)} · {activity.tokenChanges.length} token change{activity.tokenChanges.length === 1 ? "" : "s"} · network fee {formatSol(activity.feeSol)} SOL</p></article>)}</div></details>}
        </section>
      )}

      {/* Real-wallet summary */}
      {(wallets.length > 0 || transactions.length > 0) && <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[#fbfbfa] border border-[#e9e9e7] rounded-xl p-4">
          <span className="text-xs text-[#787774] block">Total Wallet Balance</span>
          <div className="text-xl font-bold text-[#37352f] mt-1 font-mono">
            {formatSol(totalPortfolioSol)} SOL
          </div>
          <span className="text-[11px] text-[#9b9a97]">≈ ${(totalPortfolioSol * solPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>

        <div className="bg-[#fbfbfa] border border-[#e9e9e7] rounded-xl p-4">
          <span className="text-xs text-[#787774] block">Tracked Wallets</span>
          <div className="text-xl font-bold text-[#37352f] mt-1">
            {wallets.length} Wallets
          </div>
          <span className="text-[11px] text-[#9b9a97]">Wallets with live or manually tracked balances</span>
        </div>

        <div className="bg-[#fbfbfa] border border-[#e9e9e7] rounded-xl p-4">
          <span className="text-xs text-[#787774] block">Profit Withdrawn</span>
          <div className="text-xl font-bold text-emerald-600 mt-1 font-mono">
            {formatSol(transactions.filter((t) => t.type === "paycheck").reduce((acc, t) => acc + t.amountSol, 0))} SOL
          </div>
          <span className="text-[11px] text-[#9b9a97]">Withdrawn profit</span>
        </div>
      </div>}

      {/* Wallet data toolbar */}
      {(wallets.length > 0 || transactions.length > 0) && <div data-tour="wallet-history" className="flex items-center justify-between border-b border-[#e9e9e7] pb-3 text-xs text-[#787774]">
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
      </div>}

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
              min="0"
              max="100000000"
              step="0.000000001"
              placeholder="Balance (SOL)"
              value={newWalletBalance}
              onChange={(e) => setNewWalletBalance(e.target.value)}
              disabled={Boolean(editingWallet)}
              title={editingWallet ? "Use a deposit or paycheck entry to change this recorded balance." : "Opening wallet balance"}
              className="bg-white border border-[#e3e2de] rounded-md px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:bg-[#f1f1ef] disabled:text-[#787774]"
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
              className="px-3 py-1 bg-[#1a73ca] hover:bg-[#155fa8] text-white rounded text-xs font-medium"
            >
              {editingWallet ? "Save Changes" : "Create Wallet"}
            </button>
          </div>
        </form>
      )}

      {wallets.length === 0 && transactions.length === 0 ? (
        <div data-tour="wallet-records" className="rounded-xl border border-dashed border-[#d8d7d3] bg-[#fbfbfa] px-6 py-10 text-center">
          <WalletIcon size={24} className="mx-auto text-[#9b9a97]" />
          <h3 className="mt-3 text-sm font-semibold text-[#37352f]">No real wallets tracked yet</h3>
          <p className="mx-auto mt-1 max-w-md text-xs text-[#787774]">
            Paper trading remains available above. Add a wallet only when you want to track a real Solana address, deposits, and profit withdrawals.
          </p>
          <button
            type="button"
            onClick={() => setIsAddingWallet(true)}
            className="mt-4 rounded-lg bg-[#1a73ca] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#155fa8]"
          >
            Add a real wallet
          </button>
        </div>
      ) : activeTab === "wallets" ? (
        /* Notion Database Table */
        <div data-tour="wallet-records" className="border border-[#e9e9e7] rounded-lg overflow-hidden bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="notion-table-th">Name</th>
                  <th className="notion-table-th">Balance</th>
                  <th className="notion-table-th">Win Rate</th>
                  <th className="notion-table-th">Trades</th>
                  <th className="notion-table-th">Wins</th>
                  <th className="notion-table-th">Losses</th>
                  <th className="notion-table-th">Total P&amp;L (SOL)</th>
                  <th className="notion-table-th">Address</th>
                  <th className="notion-table-th">Deposit</th>
                  <th className="notion-table-th">Withdraw</th>
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
                          Click &quot;+ New Wallet&quot; above to track balances, deposits, and paycheck profit sweeps across Phantom, BullX, or Photon.
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
                        {formatSol(wallet.balanceSol)} SOL
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
                        {walletPnl >= 0 ? `+${formatSol(walletPnl)} SOL` : `${formatSol(walletPnl)} SOL`}
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
                        <div className="flex items-center justify-center gap-1">
                          {wallet.address && wallet.address !== "Address not set" && <button
                            onClick={() => void handleImportWalletActivity(wallet.address, wallet.name)}
                            disabled={activityLoading}
                            className="flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                            title="Scan public wallet activity"
                          >
                            {activityLoading && scannedWallet?.address === wallet.address ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />} Scan
                          </button>}
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
        <div data-tour="wallet-records" className="border border-[#e9e9e7] rounded-lg overflow-hidden bg-white shadow-xs">
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#9b9a97]">
              No deposit or paycheck history logged yet. Click &quot;Deposit&quot; or &quot;Paycheck&quot; on any wallet above.
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
                      {getTradeTimestamp(tx) > 0 ? new Date(getTradeTimestamp(tx)).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }) : "—"}
                    </td>
                    <td className="notion-table-td font-semibold">
                      {tx.type === "deposit" ? (
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-[#2383e2] border border-blue-200 text-[11px]">
                          Deposit
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px]">
                          Paycheck
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

      {/* Delete Wallet Confirmation Modal */}
      {walletToDelete && (
        <div
          onClick={() => setWalletToDelete(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white rounded-xl border border-[#e9e9e7] shadow-xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-100"
          >
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-[#37352f] flex items-center gap-1.5">
                <Trash2 size={16} className="text-rose-600" />
                <span>Remove Wallet</span>
              </h3>
              <p className="text-xs text-[#787774]">
                Are you sure you want to remove <strong className="text-[#37352f]">{walletToDelete.name}</strong> from your tracked wallets?
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#f1f1ef]">
              <button
                onClick={() => setWalletToDelete(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#787774] hover:bg-[#f7f6f3] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteWallet}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors shadow-xs"
              >
                Delete Wallet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
