"use client";

import { useMemo } from "react";
import { Trade, JournalRules, AiCoachBrief, GoalSettings } from "../lib/types";
import { getTradeTimestamp } from "../lib/utils";
import {
  Banknote,
  PieChart,
  CircleDot,
  ArrowRight,
  Zap,
  AlertOctagon,
} from "lucide-react";
import TiltStreakHeatmap from "./TiltStreakHeatmap";
import EquityCurveCard from "./EquityCurveCard";
import GoalTracker from "./GoalTracker";

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
}

export default function DashboardView({
  trades,
  rules,
  goals,
  onOpenNewTrade,
  onOpenRuleEditor,
  onOpenGoalEditor,
  loading = false,
  solPrice = 150,
}: DashboardViewProps) {
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
    expectancySol,
    profitFactor,
  } = useMemo(() => {
    const totalTrades = trades.length;
    const wins = trades.filter((t) => t.result === "Win");
    const winRate = totalTrades > 0 ? ((wins.length / totalTrades) * 100).toFixed(0) : "0";

    const solGained = trades
      .filter((t) => (t.pnlSol || 0) > 0)
      .reduce((acc, t) => acc + (t.pnlSol || 0), 0);

    const solLost = trades
      .filter((t) => (t.pnlSol || 0) < 0)
      .reduce((acc, t) => acc + Math.abs(t.pnlSol || 0), 0);

    const netPnlSol = trades.reduce((acc, t) => acc + (t.pnlSol || 0), 0);
    const netPnlUsd = trades.reduce(
      (acc, t) => acc + (t.pnlUsd !== undefined ? t.pnlUsd : (t.pnlSol || 0) * solPrice),
      0
    );

    // Quant Expectancy & Profit Factor
    const grossProfitSol = solGained;
    const grossLossSol = solLost;
    const profitableTrades = trades.filter((t) => (t.pnlSol || 0) > 0);
    const losingTrades = trades.filter((t) => (t.pnlSol || 0) < 0);
    const avgWinSol = profitableTrades.length > 0 ? grossProfitSol / profitableTrades.length : 0;
    const avgLossSol = losingTrades.length > 0 ? grossLossSol / losingTrades.length : 0;
    const expectancySol = ((profitableTrades.length / Math.max(totalTrades, 1)) * avgWinSol)
      - ((losingTrades.length / Math.max(totalTrades, 1)) * avgLossSol);
    const profitFactor = grossLossSol > 0 ? (grossProfitSol / grossLossSol).toFixed(2) : grossProfitSol > 0 ? "99.9" : "0.00";

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
      expectancySol: expectancySol.toFixed(3),
      profitFactor,
    };
  }, [trades, solPrice, goals.maxDailyLossSol]);

  if (loading) {
    return (
      <div className="space-y-6 sm:space-y-8 pb-16 pt-6">
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
    <div className="space-y-6 sm:space-y-8 pb-16">
      {/* Title */}
      <div className="pt-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-[#37352f]">
              MemeCoins Dashboard
            </h1>
          </div>
          <p className="text-xs text-[#787774] mt-1">
            Solana trading discipline cockpit, risk checklists, equity curve & AI coach.
          </p>
        </div>

      </div>

      {/* Daily Loss Limit Enforcement Banner */}
      {isDailyLossExceeded && (
        <div className="p-4 bg-rose-50 border-2 border-rose-400 rounded-xl text-xs text-rose-900 flex items-start gap-3 shadow-md animate-pulse">
          <AlertOctagon size={20} className="text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <strong className="text-sm font-bold text-rose-950 block">
              🛑 Daily Max Loss Cap Exceeded (-{todayLossSol.toFixed(2)} SOL / Max {goals.maxDailyLossSol} SOL)
            </strong>
            <p className="text-rose-800">
              Discipline Rule Triggered: You have reached your maximum daily loss threshold for today. Do not revenge trade. Step away from BullX / Photon to protect your capital.
            </p>
          </div>
        </div>
      )}

      {/* Core performance metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-3.5">
        {/* Net P&L */}
        <div className="notion-card p-3.5 sm:p-4 flex flex-col justify-between">
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
        </div>

        {/* Card 3: Win Rate */}
        <div className="notion-card p-3.5 sm:p-4 flex flex-col justify-between">
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
        </div>

        {/* Card 4: Total Trades */}
        <div className="notion-card p-3.5 sm:p-4 flex flex-col justify-between">
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
        </div>
      </div>

      {/* Quant Strategy Edge Bar */}
      <div className="bg-[#fcfbf9] border border-[#e9e9e7] rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-[#2383e2]" />
          <span className="font-semibold text-[#37352f]">Quant Expectancy:</span>
          <span className={`font-mono font-bold tabular-nums ${parseFloat(expectancySol) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {parseFloat(expectancySol) >= 0 ? `+${expectancySol}` : expectancySol} SOL / trade
          </span>
        </div>

        <div className="flex items-center gap-4 text-[#787774]">
          <div>
            Profit Factor: <span className="font-mono font-semibold text-[#37352f] tabular-nums">{profitFactor}</span>
          </div>
          {tradesToday.length > 0 && <div>
            Today P&L: <span className={`font-mono font-semibold tabular-nums ${pnlTodaySol >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {pnlTodaySol >= 0 ? `+${pnlTodaySol.toFixed(2)}` : pnlTodaySol.toFixed(2)} SOL
            </span>
          </div>}
        </div>
      </div>

      {/* Feature 2: Equity Curve Graph */}
      <EquityCurveCard trades={trades} solPrice={solPrice} />

      {/* Feature 7: Visual Goal Tracker */}
      <GoalTracker
        trades={trades}
        goals={goals}
        onOpenGoalEditor={onOpenGoalEditor}
        solPrice={solPrice}
      />

      {/* Tilt & Win/Loss Streak Heatmap Calendar */}
      <TiltStreakHeatmap trades={trades} solPrice={solPrice} />

      {/* Onboarding Banner if 0 trades logged */}
      {totalTrades === 0 && (
        <div className="bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-neutral-50 border border-blue-100 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <h3 className="font-bold text-sm text-[#37352f] flex items-center gap-1.5 justify-center sm:justify-start">
              <span>🚀</span> Ready to log your first trade?
            </h3>
            <p className="text-xs text-[#787774] max-w-xl">
              Paste any Solana contract address, attach your setup chart, calculate P&L, and track your emotional mistakes.
            </p>
          </div>
          <button
            onClick={onOpenNewTrade}
            className="shrink-0 bg-[#2383e2] hover:bg-[#1a73ca] text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
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
                <span>⚠️</span>
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
                <span>🔀</span>
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
