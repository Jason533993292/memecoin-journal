"use client";

import { useMemo } from "react";
import { Trade, GoalSettings } from "../lib/types";
import { getTradeTimestamp } from "../lib/utils";
import { Target, Trophy, Flame, AlertCircle, Edit2, CheckCircle2, TrendingUp, AlertTriangle, ShieldCheck, Award, AlertOctagon } from "lucide-react";

interface GoalTrackerProps {
  trades: Trade[];
  goals: GoalSettings;
  onOpenGoalEditor: () => void;
  solPrice?: number;
}

export default function GoalTracker({
  trades,
  goals,
  onOpenGoalEditor,
  solPrice = 150,
}: GoalTrackerProps) {
  const stats = useMemo(() => {
    const nowObj = new Date();
    const now = nowObj.getTime();
    const currentMonth = nowObj.getMonth();
    const currentYear = nowObj.getFullYear();
    const currentDayOfMonth = nowObj.getDate();
    
    // Days left in month (inclusive of today)
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysLeftInMonth = Math.max(1, lastDayOfMonth - currentDayOfMonth + 1);

    // Days left in week (Sunday is end of week, inclusive of today)
    const dayOfWeek = nowObj.getDay();
    const daysLeftInWeek = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;

    // Start of week (Monday 00:00:00)
    const startOfWeek = new Date(nowObj);
    const diff = startOfWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfWeekTime = startOfWeek.getTime();

    // Start of month (1st of month 00:00:00)
    const startOfMonth = new Date(currentYear, currentMonth, 1).getTime();

    // Start of calendar today (00:00:00)
    const startOfToday = new Date(currentYear, currentMonth, currentDayOfMonth).getTime();

    let weeklyPnl = 0;
    let monthlyPnl = 0;
    let todayPnl = 0;
    let todayTradesCount = 0;

    trades.forEach((t) => {
      const time = getTradeTimestamp(t);
      const pnl = t.pnlSol || 0;

      if (time >= startOfWeekTime) {
        weeklyPnl += pnl;
      }
      if (time >= startOfMonth) {
        monthlyPnl += pnl;
      }
      if (time >= startOfToday) {
        todayPnl += pnl;
        todayTradesCount += 1;
      }
    });

    const totalTrades = trades.length;
    const winTrades = trades.filter((t) => t.result === "Win").length;
    const currentWinRate = totalTrades > 0 ? (winTrades / totalTrades) * 100 : 0;

    // Progress percentages
    const weeklyPct = Math.min(100, Math.max(0, (weeklyPnl / (goals.weeklyPnlSolTarget || 5)) * 100));
    const monthlyPct = Math.min(100, Math.max(0, (monthlyPnl / (goals.monthlyPnlSolTarget || 20)) * 100));
    const winRatePct = Math.min(100, (currentWinRate / (goals.targetWinRate || 60)) * 100);

    // Today loss guardrail status
    const todayLoss = todayPnl < 0 ? Math.abs(todayPnl) : 0;
    const lossGuardrailTriggered = todayLoss >= (goals.maxDailyLossSol || 2);
    const tradesGuardrailTriggered = todayTradesCount >= (goals.maxDailyTrades || 6);

    return {
      weeklyPnl: parseFloat(weeklyPnl.toFixed(2)),
      monthlyPnl: parseFloat(monthlyPnl.toFixed(2)),
      todayPnl: parseFloat(todayPnl.toFixed(2)),
      todayTradesCount,
      currentWinRate: parseFloat(currentWinRate.toFixed(1)),
      weeklyPct: Math.round(weeklyPct),
      monthlyPct: Math.round(monthlyPct),
      winRatePct: Math.round(winRatePct),
      lossGuardrailTriggered,
      tradesGuardrailTriggered,
      daysLeftInWeek,
      daysLeftInMonth,
    };
  }, [trades, goals]);

  return (
    <div className="bg-[#fbfbfa] border border-[#e9e9e7] rounded-xl p-5 shadow-xs flex flex-col space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#f1f1ef]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
            <Target size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#37352f] flex items-center gap-2">
              <span>Discipline & Profit Goals</span>
              {stats.weeklyPct >= 100 && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                  <Trophy size={11} /> Goal Crushed
                </span>
              )}
            </h3>
            <p className="text-[11px] text-[#787774]">Track milestones and stay accountable to risk thresholds.</p>
          </div>
        </div>

        <button
          onClick={onOpenGoalEditor}
          className="text-[11px] text-[#787774] hover:text-[#2383e2] flex items-center gap-1 font-medium transition-colors"
          title="Adjust goals"
        >
          <Edit2 size={12} />
          <span>Edit Goals</span>
        </button>
      </div>

      {/* Progress Bars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Goal 1: Weekly SOL Target */}
        <div className="p-3 bg-white border border-[#e9e9e7] rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#37352f]">Weekly Target</span>
            <span className="font-mono text-[11px] text-[#787774]">
              <strong className={stats.weeklyPnl >= 0 ? "text-emerald-600" : "text-rose-600"}>
                {stats.weeklyPnl >= 0 ? `+${stats.weeklyPnl}` : stats.weeklyPnl}
              </strong>{" "}
              / {goals.weeklyPnlSolTarget || 5} SOL
            </span>
          </div>

          <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                stats.weeklyPct >= 100
                  ? "bg-emerald-500"
                  : stats.weeklyPct >= 50
                  ? "bg-indigo-500"
                  : "bg-blue-400"
              }`}
              style={{ width: `${Math.min(stats.weeklyPct, 100)}%` }}
            ></div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-[#9b9a97]">
            <span>{stats.weeklyPct}% Achieved</span>
            <span>{stats.daysLeftInWeek} day{stats.daysLeftInWeek !== 1 ? 's' : ''} left</span>
          </div>
        </div>

        {/* Goal 2: Monthly SOL Target */}
        <div className="p-3 bg-white border border-[#e9e9e7] rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#37352f]">Monthly Target</span>
            <span className="font-mono text-[11px] text-[#787774]">
              <strong className={stats.monthlyPnl >= 0 ? "text-emerald-600" : "text-rose-600"}>
                {stats.monthlyPnl >= 0 ? `+${stats.monthlyPnl}` : stats.monthlyPnl}
              </strong>{" "}
              / {goals.monthlyPnlSolTarget || 20} SOL
            </span>
          </div>

          <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                stats.monthlyPct >= 100
                  ? "bg-emerald-500"
                  : stats.monthlyPct >= 50
                  ? "bg-indigo-500"
                  : "bg-purple-400"
              }`}
              style={{ width: `${Math.min(stats.monthlyPct, 100)}%` }}
            ></div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-[#9b9a97]">
            <span>{stats.monthlyPct}% Achieved</span>
            <span>{stats.daysLeftInMonth} day{stats.daysLeftInMonth !== 1 ? 's' : ''} left</span>
          </div>
        </div>

        {/* Goal 3: Win Rate Target */}
        <div className="p-3 bg-white border border-[#e9e9e7] rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#37352f]">Target Win Rate</span>
            <span className="font-mono text-[11px] text-[#787774]">
              <strong className={stats.currentWinRate >= (goals.targetWinRate || 60) ? "text-emerald-600" : "text-[#37352f]"}>
                {stats.currentWinRate}%
              </strong>{" "}
              / {goals.targetWinRate || 60}%
            </span>
          </div>

          <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                stats.currentWinRate >= (goals.targetWinRate || 60) ? "bg-emerald-500" : "bg-amber-400"
              }`}
              style={{ width: `${Math.min(stats.winRatePct, 100)}%` }}
            ></div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-[#9b9a97]">
            <span>
              {stats.currentWinRate >= (goals.targetWinRate || 60) ? "🎯 On Target" : "Improve setup selection"}
            </span>
            <span>All Trades</span>
          </div>
        </div>
      </div>

      {/* Daily Guardrails Status Indicator */}
      {(stats.lossGuardrailTriggered || stats.tradesGuardrailTriggered) && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <div>
              <strong className="font-semibold block">Risk Threshold Reached for Today!</strong>
              <p className="text-[11px] text-rose-800">
                {stats.lossGuardrailTriggered
                  ? `You have lost ${Math.abs(stats.todayPnl)} SOL today (Max limit: ${goals.maxDailyLossSol} SOL). Step away from the charts to protect your capital.`
                  : `You logged ${stats.todayTradesCount} trades today (Max limit: ${goals.maxDailyTrades}). Avoid overtrading on low-conviction setups.`}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
