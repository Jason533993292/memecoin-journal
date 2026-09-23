"use client";

import { useState, useMemo } from "react";
import { Trade, JournalRules, AiCoachBrief, GoalSettings } from "../lib/types";
import { getTradeTimestamp } from "../lib/utils";
import {
  Banknote,
  Star,
  PieChart,
  CircleDot,
  PlusCircle,
  MinusCircle,
  ExternalLink,
  BookOpen,
  BarChart2,
  Wallet as WalletIcon,
  LineChart,
  Bot,
  RefreshCw,
  Sparkles,
  Lock,
  ChevronDown,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Flame,
  Target,
  Calendar,
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
  solPrice?: number;
}

export default function DashboardView({
  trades,
  rules,
  goals,
  onNavigateTab,
  onOpenNewTrade,
  onOpenRuleEditor,
  onOpenGoalEditor,
  onOpenDailyRecap,
  aiBrief,
  onRefreshAiBrief,
  loadingAi,
  solPrice = 150,
}: DashboardViewProps) {
  // Memoized Calculations
  const {
    totalTrades,
    wins,
    losses,
    winRate,
    solGained,
    solLost,
    netPnlSol,
    netPnlUsd,
    tradesToday,
    pnlTodaySol,
    todayLossSol,
    isDailyLossExceeded,
    expectancySol,
    profitFactor,
    totalFeesSol,
  } = useMemo(() => {
    const totalTrades = trades.length;
    const wins = trades.filter((t) => t.result === "Win");
    const losses = trades.filter((t) => t.result === "Loss");
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
    const wRate = totalTrades > 0 ? wins.length / totalTrades : 0;
    const lRate = totalTrades > 0 ? losses.length / totalTrades : 0;
    const avgWinSol = wins.length > 0 ? grossProfitSol / wins.length : 0;
    const avgLossSol = losses.length > 0 ? grossLossSol / losses.length : 0;
    const expectancySol = (wRate * avgWinSol) - (lRate * avgLossSol);
    const profitFactor = grossLossSol > 0 ? (grossProfitSol / grossLossSol).toFixed(2) : grossProfitSol > 0 ? "99.9" : "0.00";
    const totalFeesSol = trades.reduce((acc, t) => acc + (t.feesSol || 0), 0);

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
      wins,
      losses,
      winRate,
      solGained,
      solLost,
      netPnlSol,
      netPnlUsd,
      tradesToday,
      pnlTodaySol,
      todayLossSol,
      isDailyLossExceeded,
      expectancySol: expectancySol.toFixed(3),
      profitFactor,
      totalFeesSol: totalFeesSol.toFixed(3),
    };
  }, [trades, solPrice, goals.maxDailyLossSol]);

  return (
    <div className="space-y-6 sm:space-y-8 pb-16">
      {/* Title & Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between pt-6 gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-[#37352f]">
            MemeCoins Dashboard
          </h1>
          <p className="text-xs text-[#787774] mt-1">
            Solana trading discipline cockpit, risk checklists, equity curve & AI coach.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Daily Recap Button */}
          <button
            onClick={onOpenDailyRecap}
            className="bg-[#f7f6f3] hover:bg-[#eeece8] border border-[#e3e2de] text-[#37352f] px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <Sparkles size={13} className="text-amber-600" />
            <span>Today's Recap ({tradesToday.length})</span>
          </button>

          {/* Log Trade Button */}
          <button
            onClick={onOpenNewTrade}
            className="bg-[#2383e2] hover:bg-[#1a73ca] text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <span>+ Log Trade (N)</span>
          </button>
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

      {/* Row of 6 Notion Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-3.5">
        {/* Card 1: Net P&L (USD) */}
        <div className="notion-card p-3.5 sm:p-4 flex flex-col justify-between">
          <div className="flex items-center gap-1 text-[11px] text-[#787774] mb-2 sm:mb-3">
            <span className="p-1 rounded bg-[#f1f1ef] text-[#5a5957] flex items-center gap-0.5">
              <Banknote size={13} />
              <ChevronDown size={10} />
            </span>
          </div>
          <div>
            <span className="text-[11px] sm:text-xs text-[#787774] font-medium block">Net P&L (USD)</span>
            <div className={`text-sm sm:text-base font-semibold font-mono tabular-nums tracking-tight mt-1 ${netPnlUsd >= 0 ? "text-[#37352f]" : "text-rose-600"}`}>
              {netPnlUsd >= 0
                ? `$${netPnlUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : `-$${Math.abs(netPnlUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </div>
          </div>
        </div>

        {/* Card 2: Net P&L (SOL) */}
        <div className="notion-card p-3.5 sm:p-4 flex flex-col justify-between">
          <div className="flex items-center gap-1 text-[11px] text-[#787774] mb-2 sm:mb-3">
            <span className="p-1 rounded bg-[#f1f1ef] text-[#5a5957] flex items-center gap-0.5">
              <Star size={13} />
              <ChevronDown size={10} />
            </span>
          </div>
          <div>
            <span className="text-[11px] sm:text-xs text-[#787774] font-medium block">Net P&L (SOL)</span>
            <div className={`text-sm sm:text-base font-semibold font-mono tabular-nums tracking-tight mt-1 ${netPnlSol >= 0 ? "text-[#37352f]" : "text-rose-600"}`}>
              {netPnlSol >= 0 ? `+${netPnlSol.toFixed(2)}` : `${netPnlSol.toFixed(2)}`}
            </div>
          </div>
        </div>

        {/* Card 3: Win Rate */}
        <div className="notion-card p-3.5 sm:p-4 flex flex-col justify-between">
          <div className="flex items-center gap-1 text-[11px] text-[#787774] mb-2 sm:mb-3">
            <span className="p-1 rounded bg-[#f1f1ef] text-[#5a5957] flex items-center gap-0.5">
              <PieChart size={13} />
              <ChevronDown size={10} />
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
            <span className="p-1 rounded bg-[#f1f1ef] text-[#5a5957] flex items-center gap-0.5">
              <CircleDot size={13} />
              <ChevronDown size={10} />
            </span>
          </div>
          <div>
            <span className="text-[11px] sm:text-xs text-[#787774] font-medium block">Total Trades</span>
            <div className="text-sm sm:text-base font-semibold font-mono tabular-nums tracking-tight mt-1 text-[#37352f]">
              {totalTrades}
            </div>
            <div className="w-full bg-[#f1f1ef] h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-neutral-400 h-full rounded-full transition-all"
                style={{ width: `${Math.min(totalTrades * 10, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Card 5: SOL Gained */}
        <div className="notion-card p-3.5 sm:p-4 flex flex-col justify-between">
          <div className="flex items-center gap-1 text-[11px] text-[#787774] mb-2 sm:mb-3">
            <span className="p-1 rounded bg-[#f1f1ef] text-emerald-600 flex items-center gap-0.5">
              <PlusCircle size={13} />
              <ChevronDown size={10} />
            </span>
          </div>
          <div>
            <span className="text-[11px] sm:text-xs text-[#787774] font-medium block">SOL Gained</span>
            <div className="text-sm sm:text-base font-semibold font-mono tabular-nums tracking-tight mt-1 text-emerald-600 flex items-center gap-1">
              <span>+{solGained.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Card 6: SOL Lost */}
        <div className="notion-card p-3.5 sm:p-4 flex flex-col justify-between">
          <div className="flex items-center gap-1 text-[11px] text-[#787774] mb-2 sm:mb-3">
            <span className="p-1 rounded bg-[#f1f1ef] text-rose-600 flex items-center gap-0.5">
              <MinusCircle size={13} />
              <ChevronDown size={10} />
            </span>
          </div>
          <div>
            <span className="text-[11px] sm:text-xs text-[#787774] font-medium block">SOL Lost</span>
            <div className="text-sm sm:text-base font-semibold font-mono tabular-nums tracking-tight mt-1 text-rose-600 flex items-center gap-1">
              <span>-{solLost.toFixed(2)}</span>
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
          <div>
            Fees Drag: <span className="font-mono font-semibold text-amber-600 tabular-nums">{totalFeesSol} SOL</span>
          </div>
          <div>
            Today P&L: <span className={`font-mono font-semibold tabular-nums ${pnlTodaySol >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {pnlTodaySol >= 0 ? `+${pnlTodaySol.toFixed(2)}` : pnlTodaySol.toFixed(2)} SOL
            </span>
          </div>
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

      {/* Main Grid: Risk Management + Trade Plan + Right Navigation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Risk Management Card (Left) */}
        <div className="lg:col-span-4 bg-[#fbfbfa] border border-[#e9e9e7] rounded-xl p-5 flex flex-col justify-between min-h-[300px]">
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

          <div className="pt-6 mt-4 border-t border-[#f1f1ef]">
            <p className="text-[11px] text-[#9b9a97]">
              If you want to change this click{" "}
              <button
                onClick={onOpenRuleEditor}
                className="text-[#2383e2] hover:underline font-medium"
              >
                unlock page / edit rules
              </button>
              .
            </p>
          </div>
        </div>

        {/* Trade Plan Card (Middle) */}
        <div className="lg:col-span-4 bg-[#fbfbfa] border border-[#e9e9e7] rounded-xl p-5 flex flex-col justify-between min-h-[300px]">
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

          <div className="pt-6 mt-4 border-t border-[#f1f1ef]">
            <p className="text-[11px] text-[#9b9a97]">
              If you want to change this click{" "}
              <button
                onClick={onOpenRuleEditor}
                className="text-[#2383e2] hover:underline font-medium"
              >
                unlock page / edit rules
              </button>
              .
            </p>
          </div>
        </div>

        {/* Right Sidebar: Navigation & External Links */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white border border-[#e9e9e7] rounded-xl p-4 space-y-2 shadow-xs">
            <div className="space-y-1">
              <button
                onClick={() => onNavigateTab("journal")}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-[#37352f] hover:bg-[#f7f6f3] transition-colors text-left group"
              >
                <div className="flex items-center gap-2.5">
                  <BookOpen size={15} className="text-[#787774] group-hover:text-[#2383e2]" />
                  <span>Trade Journal</span>
                </div>
                <span className="text-[11px] text-[#9b9a97]">{totalTrades} logged</span>
              </button>

              <button
                onClick={() => onNavigateTab("ai-coach")}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-[#37352f] hover:bg-[#f7f6f3] transition-colors text-left group"
              >
                <div className="flex items-center gap-2.5">
                  <Bot size={15} className="text-emerald-600" />
                  <span>AI Trade Review</span>
                </div>
                <span className="text-[11px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  DeepSeek
                </span>
              </button>

              <button
                onClick={() => onNavigateTab("wallets")}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-[#37352f] hover:bg-[#f7f6f3] transition-colors text-left group"
              >
                <div className="flex items-center gap-2.5">
                  <WalletIcon size={15} className="text-[#787774] group-hover:text-[#2383e2]" />
                  <span>Wallets & Paychecks</span>
                </div>
                <ArrowRight size={13} className="text-[#c4c4c2] group-hover:text-[#37352f]" />
              </button>

              <button
                onClick={() => onNavigateTab("statistics")}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-[#37352f] hover:bg-[#f7f6f3] transition-colors text-left group"
              >
                <div className="flex items-center gap-2.5">
                  <LineChart size={15} className="text-[#787774] group-hover:text-[#2383e2]" />
                  <span>Statistics & Analytics</span>
                </div>
                <ArrowRight size={13} className="text-[#c4c4c2] group-hover:text-[#37352f]" />
              </button>
            </div>

            <div className="pt-3 border-t border-[#f1f1ef] space-y-1.5 text-xs text-[#5a5957]">
              <a
                href="https://dexscreener.com/solana"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-[#f7f6f3] hover:text-[#2383e2] transition-colors"
              >
                <ExternalLink size={13} className="text-[#9b9a97]" />
                <span>dexscreener.com</span>
              </a>

              <a
                href="https://axiom.trade"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-[#f7f6f3] hover:text-[#2383e2] transition-colors"
              >
                <span className="text-xs">👤</span>
                <span>Axiom <strong className="font-semibold text-[#37352f]">Axiom</strong></span>
              </a>

              <a
                href="https://bullx.io"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-[#f7f6f3] hover:text-[#2383e2] transition-colors"
              >
                <span className="text-xs">🐂</span>
                <span>BullX <strong className="font-semibold text-emerald-600">BullX</strong></span>
              </a>
            </div>
          </div>

          {/* AI Coach Card */}
          <div className="bg-gradient-to-br from-[#fafafa] to-[#f4f7f6] border border-[#e2e8e5] rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                <Bot size={15} className="text-emerald-600" />
                <span>DeepSeek AI Coach</span>
              </div>
              <button
                onClick={onRefreshAiBrief}
                disabled={loadingAi}
                className="p-1 rounded hover:bg-emerald-50 text-emerald-700 transition-colors disabled:opacity-50"
                title="Refresh AI feedback"
              >
                <RefreshCw size={13} className={loadingAi ? "animate-spin" : ""} />
              </button>
            </div>

            <p className="text-xs text-[#4a4946] leading-relaxed line-clamp-3">
              {aiBrief?.advice ||
                "Log your recent trades and click refresh to get ruthless, personalized feedback from your AI coach."}
            </p>

            <button
              onClick={() => onNavigateTab("ai-coach")}
              className="mt-3 text-[11px] font-medium text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              <span>Open Full AI Review</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
