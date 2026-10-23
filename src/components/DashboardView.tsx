"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@heroui/react";
import { Trade, JournalRules, AiCoachBrief, GoalSettings } from "../lib/types";
import { getTradeTimestamp } from "../lib/utils";
import { getUsdValueStatus } from "../lib/tradeCalculations";
import {
  Banknote,
  PieChart,
  CircleDot,
  CalendarDays,
  ArrowUpRight,
  ArrowRight,
  AlertOctagon,
  SlidersHorizontal,
} from "lucide-react";
import TiltStreakHeatmap from "./TiltStreakHeatmap";
import EquityCurveCard from "./EquityCurveCard";
import GoalTracker from "./GoalTracker";
import { parseLocalStorageValue, useLocalStorageValue, writeLocalStorageValue } from "../lib/useLocalStorage";

interface DashboardViewProps {
  trades: Trade[];
  rules: JournalRules;
  goals: GoalSettings;
  onNavigateTab: (tab: string) => void;
  onOpenNewTrade: () => void;
  onOpenRuleEditor: () => void;
  onOpenGoalEditor: () => void;
  onOpenDailyRecap: () => void;
  aiBrief: AiCoachBrief | null;
  onRefreshAiBrief: () => void;
  loadingAi: boolean;
  loading?: boolean;
  solPrice?: number;
  preferencesStorageKey: string;
  onSelectTrade: (trade: Trade) => void;
  demoMode: boolean;
  onDemoModeChange: (enabled: boolean) => void;
}

type MetricKey = "pnl" | "winRate" | "totalTrades" | "today";
const METRIC_LABELS: Record<MetricKey, string> = {
  pnl: "Net P&L",
  winRate: "Win rate",
  totalTrades: "Total trades",
  today: "Today",
};

export default function DashboardView({
  trades,
  rules,
  goals,
  onNavigateTab,
  onOpenNewTrade,
  onOpenRuleEditor,
  onOpenGoalEditor,
  loading = false,
  solPrice = 150,
  preferencesStorageKey,
  onSelectTrade,
  demoMode,
  onDemoModeChange,
}: DashboardViewProps) {
  const storedVisibleMetrics = useLocalStorageValue(preferencesStorageKey);
  const visibleMetrics = useMemo(() => {
    const parsed = parseLocalStorageValue<unknown>(storedVisibleMetrics, null);
    if (!Array.isArray(parsed)) return ["pnl", "winRate", "totalTrades", "today"] as MetricKey[];
    const valid = parsed.filter((value): value is MetricKey => typeof value === "string" && value in METRIC_LABELS);
    return valid.length > 0 ? valid : ["pnl", "winRate", "totalTrades", "today"];
  }, [storedVisibleMetrics]);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const customizeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!customizeOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (!customizeRef.current?.contains(event.target as Node)) setCustomizeOpen(false);
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCustomizeOpen(false);
    };
    window.addEventListener("pointerdown", dismiss);
    window.addEventListener("keydown", dismissOnEscape);
    return () => {
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("keydown", dismissOnEscape);
    };
  }, [customizeOpen]);

  const toggleMetric = (metric: MetricKey) => {
    const next = visibleMetrics.includes(metric)
      ? visibleMetrics.length === 1 ? visibleMetrics : visibleMetrics.filter((item) => item !== metric)
      : [...visibleMetrics, metric];
    writeLocalStorageValue(preferencesStorageKey, JSON.stringify(next));
  };
  // Memoized Calculations
  const {
    totalTrades,
    winRate,
    netPnlSol,
    netPnlUsd,
    tradesToday,
    pnlTodaySol,
    todayLossSol,
    isDailyLossExceeded,
  } = useMemo(() => {
    const totalTrades = trades.length;
    const wins = trades.filter((t) => t.result === "Win");
    const winRate = totalTrades > 0 ? ((wins.length / totalTrades) * 100).toFixed(0) : "0";

    const netPnlSol = trades.reduce((acc, t) => acc + (t.pnlSol || 0), 0);
    const netPnlUsd = trades.reduce((acc, trade) => acc + (getUsdValueStatus(trade, solPrice).value ?? 0), 0);

    // Calculate Today's calendar bounds
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const tradesToday = trades.filter((t) => getTradeTimestamp(t) >= startOfToday);
    const pnlTodaySol = tradesToday.reduce((acc, t) => acc + (t.pnlSol || 0), 0);
    const todayLossSol = tradesToday
      .filter((t) => (t.pnlSol || 0) < 0)
      .reduce((acc, t) => acc + Math.abs(t.pnlSol || 0), 0);

    const isDailyLossExceeded = goals.maxDailyLossSol > 0 && todayLossSol >= goals.maxDailyLossSol;

    return {
      totalTrades,
      winRate,
      netPnlSol,
      netPnlUsd,
      tradesToday,
      pnlTodaySol,
      todayLossSol,
      isDailyLossExceeded,
    };
  }, [trades, solPrice, goals.maxDailyLossSol]);

  if (loading) {
    return (
      <div className="journal-page">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 bg-[#f1f1ef] rounded-md w-56 animate-pulse"></div>
            <div className="h-4 bg-[#f7f6f3] rounded-md w-80 animate-pulse"></div>
          </div>
          <div className="h-9 bg-[#f1f1ef] rounded-md w-32 animate-pulse"></div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 bg-[#fbfbfa] border border-[#e9e9e7] rounded-xl p-4 animate-pulse flex flex-col justify-between">
              <div className="h-3 bg-[#e9e9e7] rounded w-16"></div>
              <div className="h-6 bg-[#deddd9] rounded w-24 mt-2"></div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-80 bg-[#fbfbfa] border border-[#e9e9e7] rounded-xl animate-pulse"></div>
          <div className="h-80 bg-[#fbfbfa] border border-[#e9e9e7] rounded-xl animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="journal-page">
      {/* Title */}
      <div className="relative flex flex-col items-stretch justify-between gap-4 pt-6 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-[#37352f]">
              Trading overview
            </h1>
          </div>
          <p className="text-xs text-[#787774] mt-1">
            Performance, discipline, risk and journal activity in one workspace.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:mt-1 sm:justify-end">
          <Button type="button" size="sm" variant="ghost" onPress={() => onDemoModeChange(!demoMode)} className={`h-8 min-w-0 rounded-lg border px-3 text-xs ${demoMode ? "border-blue-300 bg-blue-50 text-blue-800" : "border-[#e3e2de] bg-white text-[#5a5957]"}`}>
            {demoMode ? "Hide demo data" : "Preview demo data"}
          </Button>
          <div ref={customizeRef} className="relative">
            <Button type="button" size="sm" variant="ghost" onPress={() => setCustomizeOpen((open) => !open)} className="h-8 min-w-0 rounded-lg border border-[#e3e2de] bg-white px-3 text-xs text-[#5a5957]">
              <SlidersHorizontal size={13} /> Customize
            </Button>
        {customizeOpen && (
          <div className="absolute right-0 top-10 z-20 w-56 rounded-xl border border-[#e3e2de] bg-white p-3 shadow-xl">
            <p className="text-xs font-semibold text-[#37352f]">Dashboard cards</p>
            <p className="mt-1 text-[10px] text-[#787774]">Choose the metrics shown on this device.</p>
            <div className="mt-3 space-y-1">
              {(Object.keys(METRIC_LABELS) as MetricKey[]).map((metric) => (
                <label key={metric} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-xs hover:bg-[#f7f6f3]">
                  <input type="checkbox" checked={visibleMetrics.includes(metric)} onChange={() => toggleMetric(metric)} className="accent-[#2383e2]" />
                  <span>{METRIC_LABELS[metric]}</span>
                </label>
              ))}
            </div>
          </div>
        )}
          </div>
        </div>
      </div>

      {/* Daily Loss Limit Enforcement Banner */}
      {isDailyLossExceeded && (
        <div className="p-4 bg-rose-50 border-2 border-rose-400 rounded-xl text-xs text-rose-900 flex items-start gap-3 shadow-md animate-pulse">
          <AlertOctagon size={20} className="text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <strong className="text-sm font-bold text-rose-950 block">
              Daily max loss cap exceeded (-{todayLossSol.toFixed(2)} SOL / max {goals.maxDailyLossSol} SOL)
            </strong>
            <p className="text-rose-800">
              Discipline Rule Triggered: You have reached your maximum daily loss threshold for today. Do not revenge trade. Step away from BullX / Photon to protect your capital.
            </p>
          </div>
        </div>
      )}

      {/* Core performance metrics */}
      <div data-tour="dashboard-summary" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-3.5">
        {/* Net P&L */}
        {visibleMetrics.includes("pnl") && <div className="notion-card p-3.5 sm:p-4 flex flex-col justify-between">
          <div className="flex items-center gap-1 text-[11px] text-[#787774] mb-2 sm:mb-3">
            <span className="p-1 rounded bg-[#f1f1ef] text-[#5a5957]">
              <Banknote size={13} />
            </span>
          </div>
          <div>
            <span className="text-[11px] sm:text-xs text-[#787774] font-medium block">Net P&L</span>
            <div className={`text-sm sm:text-base font-semibold font-mono tabular-nums tracking-tight mt-1 ${netPnlSol >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {netPnlSol >= 0 ? `+${netPnlSol.toFixed(2)}` : netPnlSol.toFixed(2)} SOL
            </div>
            <div className="mt-1 text-[11px] font-mono text-[#787774] tabular-nums">
              {netPnlUsd >= 0
                ? `$${netPnlUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : `-$${Math.abs(netPnlUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </div>
          </div>
        </div>}

        {/* Card 3: Win Rate */}
        {visibleMetrics.includes("winRate") && <div className="notion-card p-3.5 sm:p-4 flex flex-col justify-between">
          <div className="flex items-center gap-1 text-[11px] text-[#787774] mb-2 sm:mb-3">
            <span className="p-1 rounded bg-[#f1f1ef] text-[#5a5957]">
              <PieChart size={13} />
            </span>
          </div>
          <div>
            <span className="text-[11px] sm:text-xs text-[#787774] font-medium block">Win Rate</span>
            <div className="mt-1">
              <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono tabular-nums bg-[#f1f1ef] text-[#37352f]">
                {winRate}%
              </span>
            </div>
          </div>
        </div>}

        {/* Card 4: Total Trades */}
        {visibleMetrics.includes("totalTrades") && <div className="notion-card p-3.5 sm:p-4 flex flex-col justify-between">
          <div className="flex items-center gap-1 text-[11px] text-[#787774] mb-2 sm:mb-3">
            <span className="p-1 rounded bg-[#f1f1ef] text-[#5a5957]">
              <CircleDot size={13} />
            </span>
          </div>
          <div>
            <span className="text-[11px] sm:text-xs text-[#787774] font-medium block">Total Trades</span>
            <div className="text-sm sm:text-base font-semibold font-mono tabular-nums tracking-tight mt-1 text-[#37352f]">
              {totalTrades}
            </div>
          </div>
        </div>}

        {/* Today's activity */}
        {visibleMetrics.includes("today") && <div className="notion-card p-3.5 sm:p-4 flex flex-col justify-between">
          <div className="flex items-center gap-1 text-[11px] text-[#787774] mb-2 sm:mb-3">
            <span className="p-1 rounded bg-[#f1f1ef] text-[#5a5957]">
              <CalendarDays size={13} />
            </span>
          </div>
          <div>
            <span className="text-[11px] sm:text-xs text-[#787774] font-medium block">Today</span>
            <div className={`mt-1 text-sm font-semibold font-mono tabular-nums tracking-tight ${pnlTodaySol >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {pnlTodaySol >= 0 ? `+${pnlTodaySol.toFixed(2)}` : pnlTodaySol.toFixed(2)} SOL
            </div>
            <div className="mt-1 text-[11px] text-[#787774]">{tradesToday.length} {tradesToday.length === 1 ? "trade" : "trades"}</div>
          </div>
        </div>}
      </div>

      {/* Primary analysis and recent activity */}
      <div className="grid items-stretch gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,0.8fr)]">
        <EquityCurveCard trades={trades} solPrice={solPrice} />

        <aside className="notion-card flex min-h-[360px] flex-col p-5" aria-labelledby="recent-activity-title">
          <div className="flex items-start justify-between gap-3 border-b border-[#e9e9e7] pb-4">
            <div>
              <h2 id="recent-activity-title" className="text-sm font-semibold text-[#37352f]">Recent activity</h2>
              <p className="mt-1 text-[11px] text-[#787774]">Your latest journal outcomes.</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onPress={() => onNavigateTab("journal")}
              className="h-7 min-w-0 px-2 text-[11px]"
            >
              View all <ArrowUpRight size={12} />
            </Button>
          </div>

          {trades.length > 0 ? (
            <div className="divide-y divide-[#e9e9e7]">
              {[...trades]
                .sort((a, b) => getTradeTimestamp(b) - getTradeTimestamp(a))
                .slice(0, 5)
                .map((trade) => (
                  <button
                    key={trade.id}
                    type="button"
                    onClick={() => onSelectTrade(trade)}
                    className="group flex w-full items-center gap-3 py-3 text-left"
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      trade.result === "Win"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : trade.result === "Loss"
                          ? "bg-rose-500/10 text-rose-600"
                          : "bg-[#f1f1ef] text-[#787774]"
                    }`}>
                      {(trade.symbol || trade.name || "?").slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-[#37352f] group-hover:text-[#2383e2]">
                        {trade.symbol || trade.name || "Unnamed token"}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-[#787774]">
                        {getTradeTimestamp(trade) > 0
                          ? new Date(getTradeTimestamp(trade)).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                          : "Date unavailable"}
                      </span>
                    </span>
                    <span className={`shrink-0 font-mono text-[11px] font-semibold tabular-nums ${
                      trade.pnlSol >= 0 ? "text-emerald-600" : "text-rose-600"
                    }`}>
                      {trade.pnlSol >= 0 ? "+" : ""}{trade.pnlSol.toFixed(2)} SOL
                    </span>
                  </button>
                ))}
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f1f1ef] text-[#787774]">
                <CircleDot size={16} />
              </span>
              <h3 className="mt-3 text-xs font-semibold text-[#37352f]">No activity yet</h3>
              <p className="mt-1 max-w-[220px] text-[11px] leading-5 text-[#787774]">
                Your latest wins, losses and break-even trades will appear here.
              </p>
              <Button size="sm" onPress={onOpenNewTrade} className="mt-4 h-8 text-xs">
                Log a trade
              </Button>
            </div>
          )}
        </aside>
      </div>

      {/* Feature 7: Visual Goal Tracker */}
      <GoalTracker
        trades={trades}
        goals={goals}
        onOpenGoalEditor={onOpenGoalEditor}
      />

      {/* Tilt & Win/Loss Streak Heatmap Calendar */}
      <TiltStreakHeatmap trades={trades} solPrice={solPrice} />

      {/* Onboarding Banner if 0 trades logged */}
      {totalTrades === 0 && (
        <div className="bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-neutral-50 border border-blue-100 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <h3 className="font-bold text-sm text-[#37352f] flex items-center gap-1.5 justify-center sm:justify-start">
              Ready to log your first trade?
            </h3>
            <p className="text-xs text-[#787774] max-w-xl">
              Paste any Solana contract address, attach your setup chart, calculate P&L, and track your emotional mistakes.
            </p>
          </div>
          <button
            onClick={onOpenNewTrade}
            className="shrink-0 bg-[#1a73ca] hover:bg-[#155fa8] text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
          >
            <span>Log First Trade</span>
            <ArrowRight size={13} />
          </button>
        </div>
      )}

      {/* Risk Management + Trade Plan */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Risk Management Card (Left) */}
        <div className="bg-[#fbfbfa] border border-[#e9e9e7] rounded-xl p-5 min-h-[260px]">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#e9e9e7]">
              <div className="flex items-center gap-2 font-semibold text-sm text-[#37352f]">
                <span>Risk Management</span>
              </div>
              <button
                onClick={onOpenRuleEditor}
                className="text-[11px] text-[#9b9a97] hover:text-[#2383e2] transition-colors"
                title="Edit rules"
              >
                Edit
              </button>
            </div>

            <ol className="mt-4 space-y-2.5 text-xs text-[#37352f] list-decimal list-inside leading-relaxed">
              {rules.riskManagement.map((rule, idx) => (
                <li key={idx} className="pl-1">
                  <span className="font-normal text-[#4a4946]">{rule}</span>
                </li>
              ))}
            </ol>
          </div>

        </div>

        {/* Trade Plan Card (Middle) */}
        <div className="bg-[#fbfbfa] border border-[#e9e9e7] rounded-xl p-5 min-h-[260px]">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#e9e9e7]">
              <div className="flex items-center gap-2 font-semibold text-sm text-[#37352f]">
                <span>Trade Plan</span>
              </div>
              <button
                onClick={onOpenRuleEditor}
                className="text-[11px] text-[#9b9a97] hover:text-[#2383e2] transition-colors"
                title="Edit rules"
              >
                Edit
              </button>
            </div>

            <ol className="mt-4 space-y-2.5 text-xs text-[#37352f] list-decimal list-inside leading-relaxed">
              {rules.tradePlan.map((rule, idx) => (
                <li key={idx} className="pl-1">
                  <span className="font-normal text-[#4a4946]">{rule}</span>
                </li>
              ))}
            </ol>
          </div>

        </div>
      </div>
    </div>
  );
}
