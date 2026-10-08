"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { db, type User } from "../lib/firebase";
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, setDoc } from "firebase/firestore";
import { Trade, JournalRules, AiCoachBrief, GoalSettings } from "../lib/types";
import TopBanner from "../components/TopBanner";
import DashboardView from "../components/DashboardView";
import TradeJournalView from "../components/TradeJournalView";
const WalletsView = dynamic(() => import("../components/WalletsView"), { loading: () => <SectionLoading /> });
const StatisticsView = dynamic(() => import("../components/StatisticsView"), { loading: () => <SectionLoading /> });
const AiCoachView = dynamic(() => import("../components/AiCoachView"), { loading: () => <SectionLoading /> });
import LogTradeModal from "../components/LogTradeModal";
import EditTradeModal from "../components/EditTradeModal";
import TradeDetailDrawer from "../components/TradeDetailDrawer";
import RuleEditorModal from "../components/RuleEditorModal";
import CommandPaletteModal from "../components/CommandPaletteModal";
import ShareablePnlCardModal from "../components/ShareablePnlCardModal";
import GoalEditorModal from "../components/GoalEditorModal";
import DailyRecapModal from "../components/DailyRecapModal";
import AccountDeletionModal from "../components/AccountDeletionModal";
import { ToastProvider, useToast } from "../components/Toast";
import { parseLocalStorageValue, useLocalStorageValue, writeLocalStorageValue } from "../lib/useLocalStorage";
import { Trash2 } from "lucide-react";
import {
  deleteSupabaseTrade,
  listSupabaseTrades,
  loadSupabasePreferences,
  patchSupabasePreferences,
  usesSupabaseJournal,
} from "@/lib/journalBackend";

import { useAuth } from "../context/AuthContext";
import AuthModal from "../components/AuthModal";

const DEFAULT_RULES: JournalRules = {
  riskManagement: [
    "Max risk 1 SOL per trade — never risk your rent money.",
    "Never size more than 10% of total portfolio into a newly launched coin.",
    "Cut loss immediately if narrative breaks or developer dumps.",
    "Never average down on a dumping coin. Losers average losers.",
    "Max 3 losses per session — step away from the keyboard if tilting.",
  ],
  tradePlan: [
    "Filter DexScreener & BullX for volume > $500k and liquidity > $50k.",
    "Inspect developer wallet, top 10 holders, and bundle percentage on Bubblemaps.",
    "Wait for 5m consolidation pullback before entering green pumps.",
    "Take initial investment (50%) out at 2x. Let house money ride.",
    "Leave a 10-20% moonbag with trailing stop on psychological levels.",
  ],
};

const DEFAULT_GOALS: GoalSettings = {
  weeklyPnlSolTarget: 5,
  monthlyPnlSolTarget: 20,
  targetWinRate: 60,
  maxDailyLossSol: 2,
  maxDailyTrades: 6,
};

function SectionLoading() {
  return <div className="min-h-[240px] flex items-center justify-center text-sm text-[#787774]">Loading section…</div>;
}

function MainApp() {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-sm text-[#787774]">
        Loading your private journal…
      </main>
    );
  }
  if (!user) return <AuthModal />;
  return <AuthenticatedApp key={user.uid} user={user} />;
}

function AuthenticatedApp({ user }: { user: User }) {
  const { showToast } = useToast();
  const [currentTab, setCurrentTab] = useState<string>("dashboard");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  // Live SOL Price State
  const [solPrice, setSolPrice] = useState<number>(0);
  const [solChange24h, setSolChange24h] = useState<number>(0);
  const [solPriceStatus, setSolPriceStatus] = useState<"live" | "cached" | "stale" | "unavailable">("unavailable");
  const [solPriceUpdatedAt, setSolPriceUpdatedAt] = useState<number | null>(null);

  // Modals & Drawers
  const [isNewTradeModalOpen, setIsNewTradeModalOpen] = useState(false);
  const [isRuleEditorOpen, setIsRuleEditorOpen] = useState(false);
  const [isGoalEditorOpen, setIsGoalEditorOpen] = useState(false);
  const [isDailyRecapOpen, setIsDailyRecapOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [inspectingTrade, setInspectingTrade] = useState<Trade | null>(null);
  const [sharingTrade, setSharingTrade] = useState<Trade | null>(null);
  const [clonedTrade, setClonedTrade] = useState<Partial<Trade> | null>(null);
  const [tradeToDeleteDirectly, setTradeToDeleteDirectly] = useState<string | null>(null);
  const [isAccountDeletionOpen, setIsAccountDeletionOpen] = useState(false);

  // Rules and goals are stored in Firestore per account, not in shared browser keys.
  const [rules, setRules] = useState<JournalRules>(DEFAULT_RULES);
  const [goals, setGoals] = useState<GoalSettings>(DEFAULT_GOALS);

  // AI Brief state
  const aiBriefStorageKey = "memecoin_journal_" + user.uid + "_ai_brief";
  const providerApiKey = useLocalStorageValue("ai_" + user.uid + "_provider_api_key");
  const storedProvider = useLocalStorageValue("ai_" + user.uid + "_provider");
  const selectedProvider = storedProvider === "gemini" || storedProvider === "openai"
    ? storedProvider
    : "deepseek";
  const cachedAiBrief = useLocalStorageValue(aiBriefStorageKey);
  const aiBrief = parseLocalStorageValue<AiCoachBrief | null>(cachedAiBrief, null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [permissionError, setPermissionError] = useState(false);

  useEffect(() => {
    let active = true;
    const updateSolPrice = async () => {
      try {
        const response = await fetch("/api/sol-price");
        if (!active || !response.ok) return;
        const data = await response.json();
        if (typeof data.price === "number" && Number.isFinite(data.price) && data.price > 0) setSolPrice(data.price);
        if (data.change24h !== undefined) setSolChange24h(data.change24h);
        setSolPriceStatus(data.status === "live" || data.status === "cached" || data.status === "stale" ? data.status : "unavailable");
        setSolPriceUpdatedAt(typeof data.timestamp === "number" ? data.timestamp : null);
      } catch (error) {
        if (active) console.warn("Live SOL price is unavailable", error);
      }
    };
    void updateSolPrice();
    const interval = setInterval(() => void updateSolPrice(), 60_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const activeTrades = trades;
  const activeRules = rules;
  const activeGoals = goals;
  const activeAiBrief = aiBrief;
  const activeLoading = loading;

  useEffect(() => {
    if (usesSupabaseJournal()) {
      let active = true;
      const loadJournal = async () => {
        try {
          const [nextTrades, preferences] = await Promise.all([
            listSupabaseTrades(user.uid),
            loadSupabasePreferences(user.uid),
          ]);
          if (!active) return;
          setTrades(nextTrades);
          setRules(preferences.rules || DEFAULT_RULES);
          setGoals(preferences.goals || DEFAULT_GOALS);
          setPermissionError(false);
        } catch (error) {
          console.error("Supabase journal load failed", error);
          if (active) setPermissionError(true);
        } finally {
          if (active) setLoading(false);
        }
      };
      void loadJournal();
      const interval = window.setInterval(() => void loadJournal(), 20_000);
      return () => {
        active = false;
        window.clearInterval(interval);
      };
    }
    const uid = user.uid;
    const tradeQuery = query(
      collection(db, "users", uid, "trades"),
      orderBy("date", "desc")
    );
    const unsubscribeTrades = onSnapshot(
      tradeQuery,
      (snapshot) => {
        setTrades(
          snapshot.docs.map((tradeDocument) => ({
            id: tradeDocument.id,
            ...tradeDocument.data(),
          })) as Trade[]
        );
        setPermissionError(false);
        setLoading(false);
      },
      (error: unknown) => {
        console.error("Firestore trade listener failed", error);
        setTrades([]);
        setPermissionError(true);
        setLoading(false);
      }
    );

    const unsubscribePreferences = onSnapshot(
      doc(db, "users", uid, "settings", "preferences"),
      (snapshot) => {
        const preferences = snapshot.data();
        setRules((preferences?.rules as JournalRules | undefined) || DEFAULT_RULES);
        setGoals((preferences?.goals as GoalSettings | undefined) || DEFAULT_GOALS);
      },
      (error: unknown) => {
        console.error("Firestore settings listener failed", error);
        setPermissionError(true);
      }
    );

    return () => {
      unsubscribeTrades();
      unsubscribePreferences();
    };
  }, [user.uid]);

  const handleSaveRules = async (updated: JournalRules) => {
    try {
      if (usesSupabaseJournal()) {
        await patchSupabasePreferences(user.uid, { rules: updated });
      } else {
        await setDoc(doc(db, "users", user.uid, "settings", "preferences"), { rules: updated }, { merge: true });
      }
      setRules(updated);
    } catch {
      showToast("Could not save rules", "error", "Check your connection and try again.");
      throw new Error("Rule settings could not be saved.");
    }
  };

  const handleSaveGoals = async (updated: GoalSettings) => {
    try {
      if (usesSupabaseJournal()) {
        await patchSupabasePreferences(user.uid, { goals: updated });
      } else {
        await setDoc(doc(db, "users", user.uid, "settings", "preferences"), { goals: updated }, { merge: true });
      }
      setGoals(updated);
    } catch {
      showToast("Could not save goals", "error", "Check your connection and try again.");
      throw new Error("Goal settings could not be saved.");
    }
  };

  // Backwards-compatible trigger for modals
  const fetchTrades = useCallback(() => {
    if (!usesSupabaseJournal()) return;
    void listSupabaseTrades(user.uid)
      .then((nextTrades) => setTrades(nextTrades))
      .catch((error) => console.error("Supabase trade refresh failed", error));
  }, [user.uid]);

  // Delete trade
  const handleDeleteTradeDirectly = (id: string) => {
    setTradeToDeleteDirectly(id);
  };

  const confirmDeleteTradeDirectly = async () => {
    if (!tradeToDeleteDirectly || !user) return;
    const id = tradeToDeleteDirectly;
    setTradeToDeleteDirectly(null);
    try {
      if (usesSupabaseJournal()) {
        await deleteSupabaseTrade(user.uid, id);
        fetchTrades();
      } else {
        await deleteDoc(doc(db, "users", user.uid, "trades", id));
      }
    } catch {
      showToast("Could not delete this trade", "error", "Check your connection and try again.");
    }
  };

  // Global Keyboard Shortcuts (Cmd+K, N, Esc, /)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K / Ctrl+K Palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      // Don't trigger letter shortcuts if user is inside an input or textarea
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        if (e.key === "Escape") {
          setIsNewTradeModalOpen(false);
          setIsRuleEditorOpen(false);
          setIsGoalEditorOpen(false);
          setIsDailyRecapOpen(false);
          setIsCommandPaletteOpen(false);
          setEditingTrade(null);
          setInspectingTrade(null);
          setSharingTrade(null);
        }
        return;
      }

      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setIsNewTradeModalOpen(true);
      } else if (e.key === "Escape") {
        setIsNewTradeModalOpen(false);
        setIsRuleEditorOpen(false);
        setIsGoalEditorOpen(false);
        setIsDailyRecapOpen(false);
        setIsCommandPaletteOpen(false);
        setEditingTrade(null);
        setInspectingTrade(null);
        setSharingTrade(null);
      } else if (e.key === "/") {
        e.preventDefault();
        setCurrentTab("journal");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const refreshAiBrief = useCallback(async (
    providerOverride?: "deepseek" | "gemini" | "openai",
    apiKeyOverride?: string
  ) => {
    if (!user || activeTrades.length === 0) return;
    const sessionKey = typeof window === "undefined"
      ? ""
      : window.sessionStorage.getItem("ai_" + user.uid + "_provider_api_key") || "";
    const requestApiKey = apiKeyOverride?.trim() || sessionKey || providerApiKey || "";
    const requestProvider = providerOverride || selectedProvider;
    if (!requestApiKey) {
      showToast("AI review could not run", "error", "Save an API key for the selected provider first.");
      return;
    }
    setLoadingAi(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({
          trades: activeTrades.slice(0, 100).map((trade) => ({
            symbol: trade.symbol,
            result: trade.result,
            pnlSol: trade.pnlSol,
            pnlUsd: trade.pnlUsd,
            mistakes: trade.mistakes,
            goodTags: trade.goodTags,
            setupType: trade.setupType,
            createdAt: trade.createdAt,
            date: trade.date,
          })),
          clientApiKey: requestApiKey,
          provider: requestProvider,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const newBrief: AiCoachBrief = {
          advice: data.advice,
          timestamp: Date.now(),
        };
        writeLocalStorageValue(aiBriefStorageKey, JSON.stringify(newBrief));
      } else {
        const data = await res.json().catch(() => ({}));
        showToast("AI review could not run", "error", data.error || "Check the provider key and try again.");
      }
    } catch {
      showToast("AI review could not run", "error", "Check your connection and try again.");
    } finally {
      setLoadingAi(false);
    }
  }, [activeTrades, aiBriefStorageKey, providerApiKey, selectedProvider, showToast, user]);

  return (
    <div className="min-h-screen bg-white text-[#37352f] flex flex-col font-sans">
      <TopBanner
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenNewTrade={() => setIsNewTradeModalOpen(true)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenDailyRecap={() => setIsDailyRecapOpen(true)}
        onDeleteAccount={() => setIsAccountDeletionOpen(true)}
        solPrice={solPrice}
        solChange24h={solChange24h}
        solPriceStatus={solPriceStatus}
        solPriceUpdatedAt={solPriceUpdatedAt}
      />

      {/* Main Content View Container */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 md:px-10 flex-1 pb-16 md:pb-0">
        {/* Firestore Permission Alert Banner */}
        {permissionError && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">⚠️</span>
              <div>
                <strong className="font-semibold block text-amber-950">
                  Journal sync is unavailable
                </strong>
                <p className="text-amber-800 text-[11px] mt-0.5">
                  We could not read your private journal data. Check the deployed Firebase rules and your connection. The app never needs public database rules.
                </p>
              </div>
            </div>
            <a
              href="https://console.firebase.google.com/project/memecoin-journal/firestore/rules"
              target="_blank"
              rel="noreferrer"
              className="shrink-0 bg-amber-800 hover:bg-amber-900 text-white px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
            >
              Open Firebase Rules →
            </a>
          </div>
        )}

        {currentTab === "dashboard" && (
          <DashboardView
            key={user.uid}
            trades={activeTrades}
            rules={activeRules}
            goals={activeGoals}
            onNavigateTab={setCurrentTab}
            onOpenNewTrade={() => setIsNewTradeModalOpen(true)}
            onOpenRuleEditor={() => setIsRuleEditorOpen(true)}
            onOpenGoalEditor={() => setIsGoalEditorOpen(true)}
            onOpenDailyRecap={() => setIsDailyRecapOpen(true)}
            aiBrief={activeAiBrief}
            onRefreshAiBrief={refreshAiBrief}
            loadingAi={loadingAi}
            loading={activeLoading}
            solPrice={solPrice}
          />
        )}

        {currentTab === "journal" && (
          <TradeJournalView
            key={user.uid}
            trades={activeTrades}
            solPrice={solPrice}
            onOpenNewTrade={() => setIsNewTradeModalOpen(true)}
            onTradeDeleted={fetchTrades}
            onOpenEditTrade={(trade) => setEditingTrade(trade)}
            onSelectTrade={(trade) => setInspectingTrade(trade)}
          />
        )}

        {currentTab === "wallets" && <WalletsView key={user.uid} trades={activeTrades} solPrice={solPrice} />}

        {currentTab === "statistics" && <StatisticsView key={user.uid} trades={activeTrades} solPrice={solPrice} />}

        {currentTab === "ai-coach" && (
          <AiCoachView
            key={user.uid}
            trades={activeTrades}
            aiBrief={activeAiBrief}
            onRefreshAiBrief={refreshAiBrief}
            loadingAi={loadingAi}
          />
        )}
      </div>

      {/* Log New Trade Modal */}
      <LogTradeModal
        key={`${user.uid}:${isNewTradeModalOpen ? clonedTrade?.id || "new" : "closed"}`}
        isOpen={isNewTradeModalOpen}
        onClose={() => {
          setIsNewTradeModalOpen(false);
          setClonedTrade(null);
        }}
        onTradeLogged={fetchTrades}
        initialData={clonedTrade}
        solPrice={solPrice}
      />

      {/* Edit Trade Modal */}
      <EditTradeModal
        key={`${user.uid}:${editingTrade?.id || "closed"}`}
        trade={editingTrade}
        isOpen={!!editingTrade}
        onClose={() => setEditingTrade(null)}
        onTradeUpdated={fetchTrades}
        solPrice={solPrice}
      />

      {/* Trade Detail Inspector Drawer */}
      <TradeDetailDrawer
        key={user.uid}
        trade={inspectingTrade}
        isOpen={!!inspectingTrade}
        onClose={() => setInspectingTrade(null)}
        onEdit={(trade) => setEditingTrade(trade)}
        onDelete={handleDeleteTradeDirectly}
        onDuplicate={(trade) => {
          setClonedTrade(trade);
          setIsNewTradeModalOpen(true);
        }}
        onShare={(trade) => setSharingTrade(trade)}
        solPrice={solPrice}
      />

      {/* Rule Editor Modal */}
      <RuleEditorModal
        key={`${user.uid}:${isRuleEditorOpen ? "open" : "closed"}`}
        isOpen={isRuleEditorOpen}
        onClose={() => setIsRuleEditorOpen(false)}
        rules={activeRules}
        onSaveRules={handleSaveRules}
      />

      {/* Goal Tracker Editor Modal */}
      <GoalEditorModal
        key={`${user.uid}:${isGoalEditorOpen ? "open" : "closed"}`}
        isOpen={isGoalEditorOpen}
        onClose={() => setIsGoalEditorOpen(false)}
        goals={activeGoals}
        onSaveGoals={handleSaveGoals}
      />

      {/* Daily P&L Recap Modal */}
      <DailyRecapModal
        isOpen={isDailyRecapOpen}
        onClose={() => setIsDailyRecapOpen(false)}
        trades={activeTrades}
        solPrice={solPrice}
      />

      {/* Cmd+K Quick Command Palette */}
      <CommandPaletteModal
        key={isCommandPaletteOpen ? "open" : "closed"}
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigateTab={setCurrentTab}
        onOpenNewTrade={() => setIsNewTradeModalOpen(true)}
        trades={activeTrades}
        onSelectTrade={(trade) => setInspectingTrade(trade)}
      />

      {/* 1-Click Shareable PnL Card Graphic Modal */}
      <ShareablePnlCardModal
        key={`${user.uid}:${sharingTrade?.id || "closed"}`}
        trade={sharingTrade}
        isOpen={!!sharingTrade}
        onClose={() => setSharingTrade(null)}
        solPrice={solPrice}
      />

      <AccountDeletionModal
        key={`${user.uid}:${isAccountDeletionOpen ? "open" : "closed"}`}
        isOpen={isAccountDeletionOpen}
        onClose={() => setIsAccountDeletionOpen(false)}
      />

      {/* Custom Delete Trade Confirmation Modal */}
      {tradeToDeleteDirectly && (
        <div
          onClick={() => setTradeToDeleteDirectly(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white rounded-xl border border-[#e9e9e7] shadow-xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-100"
          >
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-[#37352f] flex items-center gap-1.5">
                <Trash2 size={16} className="text-rose-600" />
                <span>Delete Trade</span>
              </h3>
              <p className="text-xs text-[#787774]">
                Are you sure you want to permanently delete this trade from Firestore? This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#f1f1ef]">
              <button
                onClick={() => setTradeToDeleteDirectly(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#787774] hover:bg-[#f7f6f3] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteTradeDirectly}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors shadow-xs"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
      <footer className="mt-auto border-t border-[#e9e9e7] px-4 py-4 text-center text-xs text-[#787774]">
        <a href="/privacy" className="hover:text-[#2383e2]">Privacy</a>
        <span className="mx-3" aria-hidden="true">·</span>
        <a href="/terms" className="hover:text-[#2383e2]">Terms</a>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <ToastProvider>
      <MainApp />
    </ToastProvider>
  );
}
