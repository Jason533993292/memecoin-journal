"use client";

import { useEffect, useState, useCallback } from "react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, query, orderBy, doc, deleteDoc } from "firebase/firestore";
import { Trade, JournalRules, AiCoachBrief, GoalSettings } from "../lib/types";
import TopBanner from "../components/TopBanner";
import DashboardView from "../components/DashboardView";
import TradeJournalView from "../components/TradeJournalView";
import WalletsView from "../components/WalletsView";
import StatisticsView from "../components/StatisticsView";
import AiCoachView from "../components/AiCoachView";
import LogTradeModal from "../components/LogTradeModal";
import EditTradeModal from "../components/EditTradeModal";
import TradeDetailDrawer from "../components/TradeDetailDrawer";
import RuleEditorModal from "../components/RuleEditorModal";
import CommandPaletteModal from "../components/CommandPaletteModal";
import ShareablePnlCardModal from "../components/ShareablePnlCardModal";
import GoalEditorModal from "../components/GoalEditorModal";
import DailyRecapModal from "../components/DailyRecapModal";
import { ToastProvider, useToast } from "../components/Toast";

function MainApp() {
  const [currentTab, setCurrentTab] = useState<string>("dashboard");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  // Live SOL Price State
  const [solPrice, setSolPrice] = useState<number>(150);
  const [solChange24h, setSolChange24h] = useState<number>(0);

  // Modals & Drawers
  const [isNewTradeModalOpen, setIsNewTradeModalOpen] = useState(false);
  const [isRuleEditorOpen, setIsRuleEditorOpen] = useState(false);
  const [isGoalEditorOpen, setIsGoalEditorOpen] = useState(false);
  const [isDailyRecapOpen, setIsDailyRecapOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [inspectingTrade, setInspectingTrade] = useState<Trade | null>(null);
  const [sharingTrade, setSharingTrade] = useState<Trade | null>(null);

  // Rules state (stored in localStorage)
  const [rules, setRules] = useState<JournalRules>({
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
  });

  // Goals state (stored in localStorage)
  const [goals, setGoals] = useState<GoalSettings>({
    weeklyPnlSolTarget: 5,
    monthlyPnlSolTarget: 20,
    targetWinRate: 60,
    maxDailyLossSol: 2,
    maxDailyTrades: 6,
  });

  // AI Brief state
  const [aiBrief, setAiBrief] = useState<AiCoachBrief | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [permissionError, setPermissionError] = useState(false);

  // Fetch Live SOL Price
  const fetchSolPrice = async () => {
    try {
      const res = await fetch("/api/sol-price");
      if (res.ok) {
        const data = await res.json();
        if (data.price) setSolPrice(data.price);
        if (data.change24h !== undefined) setSolChange24h(data.change24h);
      }
    } catch (e) {
      console.error("Failed to fetch SOL price:", e);
    }
  };

  useEffect(() => {
    fetchSolPrice();
    const interval = setInterval(fetchSolPrice, 60000);
    return () => clearInterval(interval);
  }, []);

  // Load rules, goals & AI brief from localStorage
  useEffect(() => {
    try {
      const savedRules = localStorage.getItem("memecoin_journal_rules");
      if (savedRules) {
        setRules(JSON.parse(savedRules));
      }
      const savedGoals = localStorage.getItem("memecoin_journal_goals");
      if (savedGoals) {
        setGoals(JSON.parse(savedGoals));
      }
      const savedAi = localStorage.getItem("memecoin_journal_ai_brief");
      if (savedAi) {
        setAiBrief(JSON.parse(savedAi));
      }
    } catch (e) {}
  }, []);

  const handleSaveRules = (updated: JournalRules) => {
    setRules(updated);
    try {
      localStorage.setItem("memecoin_journal_rules", JSON.stringify(updated));
    } catch (e) {}
  };

  const handleSaveGoals = (updated: GoalSettings) => {
    setGoals(updated);
    try {
      localStorage.setItem("memecoin_journal_goals", JSON.stringify(updated));
    } catch (e) {}
  };

  // Real-time Firestore subscription (no limit(100) truncation)
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "trades"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedTrades = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Trade[];
        setTrades(fetchedTrades);
        setPermissionError(false);
        setLoading(false);
      },
      (error: any) => {
        console.error("Firestore real-time listener error:", error);
        if (error?.code === "permission-denied" || error?.message?.includes("permissions")) {
          setPermissionError(true);
        }
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Backwards-compatible trigger for modals
  const fetchTrades = useCallback(() => {
    // onSnapshot automatically updates state, this is a smooth no-op
  }, []);

  // Delete trade
  const handleDeleteTradeDirectly = async (id: string) => {
    if (!confirm("Are you sure you want to delete this trade?")) return;
    try {
      await deleteDoc(doc(db, "trades", id));
    } catch (e) {
      console.error("Error deleting trade:", e);
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

  // AI Brief generator (DeepSeek)
  const refreshAiBrief = async () => {
    if (trades.length === 0) return;
    setLoadingAi(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trades: trades.slice(0, 10) }),
      });
      if (res.ok) {
        const data = await res.json();
        const newBrief: AiCoachBrief = {
          advice: data.advice,
          timestamp: Date.now(),
        };
        setAiBrief(newBrief);
        localStorage.setItem("memecoin_journal_ai_brief", JSON.stringify(newBrief));
      }
    } catch (e) {
      console.error("Error refreshing AI brief:", e);
    }
    setLoadingAi(false);
  };

  return (
    <div className="min-h-screen bg-white text-[#37352f] flex flex-col font-sans">
      {/* Top Banner with "TRUST THE PROCESS", live SOL price, Cmd+K trigger and tabs */}
      <TopBanner
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenNewTrade={() => setIsNewTradeModalOpen(true)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenDailyRecap={() => setIsDailyRecapOpen(true)}
        solPrice={solPrice}
        solChange24h={solChange24h}
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
                  Cloud Firestore Rules Need Update
                </strong>
                <p className="text-amber-800 text-[11px] mt-0.5">
                  Your Firebase database is currently in locked mode. Update your Firestore Rules to allow read/write so your journal can sync.
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
            trades={trades}
            rules={rules}
            goals={goals}
            onNavigateTab={setCurrentTab}
            onOpenNewTrade={() => setIsNewTradeModalOpen(true)}
            onOpenRuleEditor={() => setIsRuleEditorOpen(true)}
            onOpenGoalEditor={() => setIsGoalEditorOpen(true)}
            onOpenDailyRecap={() => setIsDailyRecapOpen(true)}
            aiBrief={aiBrief}
            onRefreshAiBrief={refreshAiBrief}
            loadingAi={loadingAi}
            solPrice={solPrice}
          />
        )}

        {currentTab === "journal" && (
          <TradeJournalView
            trades={trades}
            solPrice={solPrice}
            onOpenNewTrade={() => setIsNewTradeModalOpen(true)}
            onTradeDeleted={fetchTrades}
            onOpenEditTrade={(trade) => setEditingTrade(trade)}
            onSelectTrade={(trade) => setInspectingTrade(trade)}
          />
        )}

        {currentTab === "wallets" && <WalletsView trades={trades} solPrice={solPrice} />}

        {currentTab === "statistics" && <StatisticsView trades={trades} solPrice={solPrice} />}

        {currentTab === "ai-coach" && (
          <AiCoachView
            trades={trades}
            aiBrief={aiBrief}
            onRefreshAiBrief={refreshAiBrief}
            loadingAi={loadingAi}
          />
        )}
      </div>

      {/* Log New Trade Modal */}
      <LogTradeModal
        isOpen={isNewTradeModalOpen}
        onClose={() => setIsNewTradeModalOpen(false)}
        onTradeLogged={fetchTrades}
        solPrice={solPrice}
      />

      {/* Edit Trade Modal */}
      <EditTradeModal
        trade={editingTrade}
        isOpen={!!editingTrade}
        onClose={() => setEditingTrade(null)}
        onTradeUpdated={fetchTrades}
        solPrice={solPrice}
      />

      {/* Trade Detail Inspector Drawer */}
      <TradeDetailDrawer
        trade={inspectingTrade}
        isOpen={!!inspectingTrade}
        onClose={() => setInspectingTrade(null)}
        onEdit={(trade) => setEditingTrade(trade)}
        onDelete={handleDeleteTradeDirectly}
        onShare={(trade) => setSharingTrade(trade)}
      />

      {/* Rule Editor Modal */}
      <RuleEditorModal
        isOpen={isRuleEditorOpen}
        onClose={() => setIsRuleEditorOpen(false)}
        rules={rules}
        onSaveRules={handleSaveRules}
      />

      {/* Goal Tracker Editor Modal */}
      <GoalEditorModal
        isOpen={isGoalEditorOpen}
        onClose={() => setIsGoalEditorOpen(false)}
        goals={goals}
        onSaveGoals={handleSaveGoals}
      />

      {/* Daily P&L Recap Modal */}
      <DailyRecapModal
        isOpen={isDailyRecapOpen}
        onClose={() => setIsDailyRecapOpen(false)}
        trades={trades}
        solPrice={solPrice}
      />

      {/* Cmd+K Quick Command Palette */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigateTab={setCurrentTab}
        onOpenNewTrade={() => setIsNewTradeModalOpen(true)}
        trades={trades}
        onSelectTrade={(trade) => setInspectingTrade(trade)}
      />

      {/* 1-Click Shareable PnL Card Graphic Modal */}
      <ShareablePnlCardModal
        trade={sharingTrade}
        isOpen={!!sharingTrade}
        onClose={() => setSharingTrade(null)}
        solPrice={solPrice}
      />
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
