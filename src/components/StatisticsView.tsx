"use client";

import { useMemo } from "react";
import { Trade } from "../lib/types";
import { getTradeDate, getTradeTimestamp } from "../lib/utils";
import { DEFAULT_GOOD_TAGS } from "./LogTradeModal";
import { Lock, BarChart3, TrendingUp, Calendar, AlertTriangle, Layers, Target, ArrowUpRight, Clock, ShieldCheck, Zap, Tag } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Area,
  AreaChart,
} from "recharts";
import TiltStreakHeatmap from "./TiltStreakHeatmap";
import TimeOfDayHeatmap from "./TimeOfDayHeatmap";

interface StatisticsViewProps {
  trades: Trade[];
  solPrice?: number;
}

export default function StatisticsView({ trades, solPrice = 150 }: StatisticsViewProps) {
  // Quant & Strategy Expectancy Metrics
  const quantMetrics = useMemo(() => {
    const total = trades.length;
    const wins = trades.filter((t) => t.result === "Win");
    const losses = trades.filter((t) => t.result === "Loss");
    const winRate = total > 0 ? wins.length / total : 0;
    const lossRate = total > 0 ? losses.length / total : 0;

    const grossProfitSol = wins.reduce((sum, t) => sum + (t.pnlSol || 0), 0);
    const grossLossSol = losses.reduce((sum, t) => sum + Math.abs(t.pnlSol || 0), 0);

    const avgWinSol = wins.length > 0 ? grossProfitSol / wins.length : 0;
    const avgLossSol = losses.length > 0 ? grossLossSol / losses.length : 0;

    const profitFactor = grossLossSol > 0 ? grossProfitSol / grossLossSol : grossProfitSol > 0 ? 99.9 : 0;
    const payoffRatio = avgLossSol > 0 ? avgWinSol / avgLossSol : 0;
    const expectancySol = (winRate * avgWinSol) - (lossRate * avgLossSol);

    // R-multiples for trades with initialRiskSol > 0
    const rTrades = trades.filter((t) => t.initialRiskSol && t.initialRiskSol > 0);
    const avgR = rTrades.length > 0
      ? rTrades.reduce((sum, t) => sum + ((t.pnlSol || 0) / (t.initialRiskSol || 1)), 0) / rTrades.length
      : null;

    const totalFeesSol = trades.reduce((sum, t) => sum + (t.feesSol || 0), 0);

    return {
      total,
      winRate: (winRate * 100).toFixed(1),
      grossProfitSol: grossProfitSol.toFixed(2),
      grossLossSol: grossLossSol.toFixed(2),
      avgWinSol: avgWinSol.toFixed(3),
      avgLossSol: avgLossSol.toFixed(3),
      profitFactor: profitFactor.toFixed(2),
      payoffRatio: payoffRatio.toFixed(2),
      expectancySol: expectancySol.toFixed(3),
      expectancyUsd: (expectancySol * solPrice).toFixed(2),
      avgR: avgR !== null ? (avgR >= 0 ? `+${avgR.toFixed(2)}R` : `${avgR.toFixed(2)}R`) : null,
      totalFeesSol: totalFeesSol.toFixed(3),
      hasRData: rTrades.length > 0,
    };
  }, [trades, solPrice]);

  // 1. Results Breakdown
  const results = useMemo(() => {
    const wins = trades.filter((t) => t.result === "Win");
    const be = trades.filter((t) => t.result === "BE");
    const losses = trades.filter((t) => t.result === "Loss");

    const winPnlUsd = wins.reduce((acc, t) => acc + (t.pnlUsd !== undefined ? t.pnlUsd : (t.pnlSol || 0) * solPrice), 0);
    const bePnlUsd = be.reduce((acc, t) => acc + (t.pnlUsd !== undefined ? t.pnlUsd : (t.pnlSol || 0) * solPrice), 0);
    const lossPnlUsd = losses.reduce((acc, t) => acc + (t.pnlUsd !== undefined ? t.pnlUsd : (t.pnlSol || 0) * solPrice), 0);

    return {
      win: { count: wins.length, pnl: winPnlUsd },
      be: { count: be.length, pnl: bePnlUsd },
      loss: { count: losses.length, pnl: lossPnlUsd },
    };
  }, [trades, solPrice]);

  // 2. Setup Type Breakdown
  const setupStats = useMemo(() => {
    const map: Record<string, { count: number; wins: number; pnlSol: number; pnlUsd: number }> = {};

    trades.forEach((t) => {
      const setup = t.setupType || "General / Discretionary";
      if (!map[setup]) {
        map[setup] = { count: 0, wins: 0, pnlSol: 0, pnlUsd: 0 };
      }
      map[setup].count += 1;
      if (t.result === "Win") map[setup].wins += 1;
      map[setup].pnlSol += t.pnlSol || 0;
      map[setup].pnlUsd += t.pnlUsd !== undefined ? t.pnlUsd : (t.pnlSol || 0) * solPrice;
    });

    return Object.entries(map)
      .map(([setup, data]) => ({
        setup,
        count: data.count,
        wins: data.wins,
        winRate: data.count > 0 ? ((data.wins / data.count) * 100).toFixed(0) : "0",
        pnlSol: parseFloat(data.pnlSol.toFixed(2)),
        pnlUsd: parseFloat(data.pnlUsd.toFixed(2)),
      }))
      .sort((a, b) => b.pnlSol - a.pnlSol);
  }, [trades, solPrice]);

  // 3. Trade Duration Analytics (Winners vs Losers)
  const durationStats = useMemo(() => {
    const winners = trades.filter((t) => t.result === "Win" && t.durationMinutes && t.durationMinutes > 0);
    const losers = trades.filter((t) => t.result === "Loss" && t.durationMinutes && t.durationMinutes > 0);

    const avgWinDuration =
      winners.length > 0
        ? Math.round(winners.reduce((acc, t) => acc + (t.durationMinutes || 0), 0) / winners.length)
        : null;

    const avgLossDuration =
      losers.length > 0
        ? Math.round(losers.reduce((acc, t) => acc + (t.durationMinutes || 0), 0) / losers.length)
        : null;

    const formatMins = (mins: number | null) => {
      if (!mins) return "N/A";
      if (mins < 60) return `${mins} mins`;
      const hours = Math.floor(mins / 60);
      const rem = mins % 60;
      return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
    };

    return {
      avgWinDuration,
      avgLossDuration,
      avgWinFormatted: formatMins(avgWinDuration),
      avgLossFormatted: formatMins(avgLossDuration),
      hasDurationData: (winners.length + losers.length) > 0,
    };
  }, [trades]);

  // 4. Day of Week Breakdown
  const dailyStats = useMemo(() => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const ordered = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

    const map: Record<string, { count: number; pnl: number }> = {};
    ordered.forEach((d) => (map[d] = { count: 0, pnl: 0 }));

    trades.forEach((t) => {
      const date = getTradeDate(t);
      const dayName = days[date.getDay()];
      if (map[dayName]) {
        map[dayName].count += 1;
        map[dayName].pnl += t.pnlUsd !== undefined ? t.pnlUsd : (t.pnlSol || 0) * solPrice;
      }
    });

    return ordered.map((name) => ({ name, ...map[name] }));
  }, [trades, solPrice]);

  // 5. Monthly Breakdown
  const monthlyStats = useMemo(() => {
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    const map: Record<string, { count: number; pnl: number }> = {};
    months.forEach((m) => (map[m] = { count: 0, pnl: 0 }));

    trades.forEach((t) => {
      const date = getTradeDate(t);
      const monthName = months[date.getMonth()];
      if (map[monthName]) {
        map[monthName].count += 1;
        map[monthName].pnl += t.pnlUsd !== undefined ? t.pnlUsd : (t.pnlSol || 0) * solPrice;
      }
    });

    return months.map((name) => ({ name, ...map[name] }));
  }, [trades, solPrice]);

  // 6. Yearly Breakdown
  const yearlyStats = useMemo(() => {
    const years = ["2024", "2025", "2026"];
    const map: Record<string, { count: number; pnl: number }> = {
      "2024": { count: 0, pnl: 0 },
      "2025": { count: 0, pnl: 0 },
      "2026": { count: 0, pnl: 0 },
    };

    trades.forEach((t) => {
      const date = getTradeDate(t);
      const yearStr = String(date.getFullYear());
      if (map[yearStr]) {
        map[yearStr].count += 1;
        map[yearStr].pnl += t.pnlUsd !== undefined ? t.pnlUsd : (t.pnlSol || 0) * solPrice;
      }
    });

    return years.map((name) => ({ name, ...map[name] }));
  }, [trades, solPrice]);

  // 7. Equity Curve
  const equityCurve = useMemo(() => {
    const sorted = [...trades].sort((a, b) => {
      const timeA = getTradeTimestamp(a);
      const timeB = getTradeTimestamp(b);
      return timeA - timeB;
    });

    let runningPnl = 0;
    const curve = [{ index: 0, date: "Start", pnl: 0 }];

    sorted.forEach((t, i) => {
      runningPnl += t.pnlSol || 0;
      const label = getTradeDate(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      curve.push({
        index: i + 1,
        date: label,
        pnl: parseFloat(runningPnl.toFixed(2)),
      });
    });

    return curve;
  }, [trades]);

  // 8. Tag Impact
  const tagImpact = useMemo(() => {
    const map: Record<string, { count: number; pnlSol: number; isGood: boolean }> = {};
    trades.forEach((t) => {
      if (t.mistakes && t.mistakes.length > 0) {
        t.mistakes.forEach((m) => {
          const isGood = DEFAULT_GOOD_TAGS.includes(m) || m.toLowerCase().includes("good") || m.toLowerCase().includes("profit") || m.toLowerCase().includes("win");
          if (!map[m]) map[m] = { count: 0, pnlSol: 0, isGood };
          map[m].count += 1;
          map[m].pnlSol += (t.pnlSol || 0);
        });
      }
    });

    return Object.entries(map)
      .map(([tag, data]) => ({ tag, ...data }))
      .sort((a, b) => Math.abs(b.pnlSol) - Math.abs(a.pnlSol));
  }, [trades]);

  return (
    <div className="space-y-8 pb-16">
      {/* Title */}
      <div className="pt-6">
        <div className="flex items-center gap-2 text-xs text-[#787774] mb-2">
          <span>Journal</span>
          <span>/</span>
          <span className="text-[#37352f] font-medium flex items-center gap-1">
            <span>📈</span>
            <span>Statistics</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-3xl">📈</span>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#37352f]">
              Statistics & Strategy Analytics
            </h1>
            <p className="text-xs text-[#787774] mt-0.5">
              Deep dive into setup win-rates, holding duration patterns, streaks, and mistake costs.
            </p>
          </div>
        </div>
      </div>

      {/* Tilt & Streak Heatmap */}
      <TiltStreakHeatmap trades={trades} solPrice={solPrice} />

      {/* Time-of-Day Performance Heatmap (Axiom-style) */}
      <TimeOfDayHeatmap trades={trades} solPrice={solPrice} />

      {/* Quant Performance & Strategy Expectancy Card */}
      <div className="bg-white border border-[#e9e9e7] rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#f1f1ef]">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-[#2383e2]" />
            <div>
              <h2 className="text-sm font-semibold text-[#37352f]">Quant Expectancy & Performance Ratios</h2>
              <p className="text-xs text-[#787774]">
                Mathematical system expectancy, profit factor, win/loss payoffs, and execution drag.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-[#2383e2] bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
            Strategy Edge
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {/* Mathematical Expectancy */}
          <div className="p-3.5 bg-[#fbfbfa] border border-[#e9e9e7] rounded-xl">
            <div className="text-[11px] uppercase tracking-wider text-[#787774] font-semibold">
              Expectancy / Trade
            </div>
            <div className={`text-xl font-mono font-bold tabular-nums mt-1 ${
              parseFloat(quantMetrics.expectancySol) > 0 ? "text-emerald-600" : parseFloat(quantMetrics.expectancySol) < 0 ? "text-rose-600" : "text-[#37352f]"
            }`}>
              {parseFloat(quantMetrics.expectancySol) >= 0 ? `+${quantMetrics.expectancySol}` : quantMetrics.expectancySol} SOL
            </div>
            <div className="text-[10px] text-[#9b9a97] mt-0.5">
              ≈ ${quantMetrics.expectancyUsd} / execution
            </div>
          </div>

          {/* Profit Factor */}
          <div className="p-3.5 bg-[#fbfbfa] border border-[#e9e9e7] rounded-xl">
            <div className="text-[11px] uppercase tracking-wider text-[#787774] font-semibold">
              Profit Factor
            </div>
            <div className="text-xl font-mono font-bold tabular-nums mt-1 text-[#37352f]">
              {quantMetrics.profitFactor}
            </div>
            <div className="text-[10px] text-[#9b9a97] mt-0.5">
              Gross Win: {quantMetrics.grossProfitSol} / Loss: {quantMetrics.grossLossSol}
            </div>
          </div>

          {/* Payoff Ratio */}
          <div className="p-3.5 bg-[#fbfbfa] border border-[#e9e9e7] rounded-xl">
            <div className="text-[11px] uppercase tracking-wider text-[#787774] font-semibold">
              Payoff (Win / Loss)
            </div>
            <div className="text-xl font-mono font-bold tabular-nums mt-1 text-[#37352f]">
              {quantMetrics.payoffRatio} : 1
            </div>
            <div className="text-[10px] text-[#9b9a97] mt-0.5">
              Avg +{quantMetrics.avgWinSol} / -{quantMetrics.avgLossSol} SOL
            </div>
          </div>

          {/* Execution Fees / R-Multiple */}
          <div className="p-3.5 bg-[#fbfbfa] border border-[#e9e9e7] rounded-xl">
            <div className="text-[11px] uppercase tracking-wider text-[#787774] font-semibold">
              {quantMetrics.hasRData ? "Average R-Multiple" : "Solana Fees Drag"}
            </div>
            <div className="text-xl font-mono font-bold tabular-nums mt-1 text-amber-600">
              {quantMetrics.hasRData ? quantMetrics.avgR : `${quantMetrics.totalFeesSol} SOL`}
            </div>
            <div className="text-[10px] text-[#9b9a97] mt-0.5">
              {quantMetrics.hasRData ? `Fees: ${quantMetrics.totalFeesSol} SOL` : "Jito tips + priority fees"}
            </div>
          </div>
        </div>
      </div>

      {/* Duration Tracking Analytics Card */}
      <div className="bg-white border border-[#e9e9e7] rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#f1f1ef]">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-amber-600" />
            <div>
              <h2 className="text-sm font-semibold text-[#37352f]">Trade Duration & Holding Time Analysis</h2>
              <p className="text-xs text-[#787774]">
                Compare winner holding times vs loser holding times to identify greed vs bagholding.
              </p>
            </div>
          </div>
          <span className="text-[11px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
            Psychology Metric
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                Avg Winner Holding Time
              </span>
              <div className="text-xl font-mono font-bold text-emerald-900 mt-1">
                {durationStats.avgWinFormatted}
              </div>
              <span className="text-[10px] text-emerald-700">Time to hit profit targets</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-lg">
              🏆
            </div>
          </div>

          <div className="p-4 bg-rose-50/50 border border-rose-200 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider block">
                Avg Loser Holding Time
              </span>
              <div className="text-xl font-mono font-bold text-rose-900 mt-1">
                {durationStats.avgLossFormatted}
              </div>
              <span className="text-[10px] text-rose-700">Time held before cutting loss</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-lg">
              💥
            </div>
          </div>
        </div>

        {durationStats.hasDurationData && (
          <div className="p-3 bg-[#fbfbfa] border border-[#e9e9e7] rounded-lg text-xs text-[#5a5957] flex items-center gap-2">
            <span className="text-base">💡</span>
            <span>
              {durationStats.avgLossDuration && durationStats.avgWinDuration && durationStats.avgLossDuration > durationStats.avgWinDuration ? (
                <span>
                  <strong>Insight:</strong> You are holding losing trades longer than winners ({durationStats.avgLossFormatted} vs {durationStats.avgWinFormatted}). Respect your stop loss faster!
                </span>
              ) : (
                <span>
                  <strong>Insight:</strong> Great discipline! You cut losing trades quickly and let your winners run.
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Strategy / Setup Type Performance Table */}
      <div className="bg-white border border-[#e9e9e7] rounded-xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#f1f1ef]">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-[#2383e2]" />
            <div>
              <h2 className="text-sm font-semibold text-[#37352f]">Strategy & Setup Performance</h2>
              <p className="text-xs text-[#787774]">Discover which trading setups yield your highest win rates and edge.</p>
            </div>
          </div>
          <span className="text-[11px] text-[#9b9a97]">{setupStats.length} setups tracked</span>
        </div>

        {setupStats.length === 0 ? (
          <p className="text-xs text-[#9b9a97] py-4 text-center">No trades logged yet to calculate setup win rates.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#e9e9e7] text-[#787774]">
                  <th className="py-2 px-3 font-medium">Trading Setup / Playbook</th>
                  <th className="py-2 px-3 font-medium">Trades</th>
                  <th className="py-2 px-3 font-medium">Win Rate</th>
                  <th className="py-2 px-3 font-medium">Realized P&L (SOL)</th>
                  <th className="py-2 px-3 font-medium">Approx USD</th>
                </tr>
              </thead>
              <tbody>
                {setupStats.map((item) => (
                  <tr key={item.setup} className="border-b border-[#f7f6f5] hover:bg-[#fcfbf9]">
                    <td className="py-2.5 px-3 font-semibold text-[#37352f] flex items-center gap-1.5">
                      <Target size={13} className="text-[#2383e2]" />
                      <span>{item.setup}</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#787774]">{item.count}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        Number(item.winRate) >= 60 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-neutral-100 text-neutral-700"
                      }`}>
                        {item.winRate}% ({item.wins}W / {item.count - item.wins}L)
                      </span>
                    </td>
                    <td className={`py-2.5 px-3 font-mono font-bold ${item.pnlSol >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {item.pnlSol >= 0 ? `+${item.pnlSol}` : item.pnlSol} SOL
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#787774]">
                      ${item.pnlUsd.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 2 Notion-style Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Results Card */}
        <div className="bg-[#fbfbfa] border border-[#e9e9e7] rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#e9e9e7]">
            <div className="flex items-center gap-1.5 font-semibold text-xs text-[#37352f]">
              <span className="p-1 rounded bg-neutral-100 text-neutral-600">📊</span>
              <span>Results Breakdown</span>
            </div>
            <div className="flex items-center gap-1 text-[#9b9a97] text-xs">
              <Lock size={12} />
              <span>Locked</span>
            </div>
          </div>

          <div className="mt-3 space-y-2 text-xs">
            <div className="flex items-center justify-between py-2 border-b border-[#f1f1ef]">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[#787774] w-4">{results.win.count}</span>
                <span className="font-medium text-[#37352f] flex items-center gap-1">
                  <span>🏆</span> Win
                </span>
              </div>
              <span className="font-mono font-medium text-emerald-600">
                ${results.win.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-[#f1f1ef]">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[#787774] w-4">{results.be.count}</span>
                <span className="font-medium text-[#37352f] flex items-center gap-1">
                  <span>⚖️</span> BE
                </span>
              </div>
              <span className="font-mono font-medium text-[#787774]">
                ${results.be.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[#787774] w-4">{results.loss.count}</span>
                <span className="font-medium text-[#37352f] flex items-center gap-1">
                  <span>💥</span> Loss
                </span>
              </div>
              <span className="font-mono font-medium text-rose-600">
                -${Math.abs(results.loss.pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Yearly Statistics Card */}
        <div className="bg-[#fbfbfa] border border-[#e9e9e7] rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#e9e9e7]">
            <div className="flex items-center gap-1.5 font-semibold text-xs text-[#37352f]">
              <span className="p-1 rounded bg-neutral-100 text-neutral-600">📅</span>
              <span>Yearly Statistics</span>
            </div>
            <div className="flex items-center gap-1 text-[#9b9a97] text-xs">
              <Lock size={12} />
              <span>Locked</span>
            </div>
          </div>

          <div className="mt-3 space-y-2 text-xs">
            {yearlyStats.map((y) => (
              <div key={y.name} className="flex items-center justify-between py-2 border-b border-[#f1f1ef] last:border-0">
                <div className="flex items-center gap-2">
                  <span>📅</span>
                  <span className="font-medium text-[#37352f]">{y.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-[#787774]">{y.count}</span>
                  <span className={`font-mono font-medium ${y.pnl >= 0 ? "text-[#37352f]" : "text-rose-600"}`}>
                    ${y.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tag Frequency & Impact Card */}
      {tagImpact.length > 0 && (
        <div className="bg-white border border-[#e9e9e7] rounded-xl p-5 shadow-xs">
          <h2 className="text-sm font-semibold text-[#37352f] flex items-center gap-2 mb-1">
            <Tag size={15} className="text-[#2383e2]" />
            <span>Tag Frequency & Execution Impact</span>
          </h2>
          <p className="text-xs text-[#787774] mb-4">
            Total Solana won or lost per tag across your historical trades.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {tagImpact.map((item) => (
              <div
                key={item.tag}
                className="p-3 bg-[#fbfbfa] border border-[#e9e9e7] rounded-lg flex items-center justify-between"
              >
                <div>
                  <span className="text-xs font-semibold text-[#37352f] flex items-center gap-1">
                    <span>{item.isGood ? "✅" : "⚠️"}</span>
                    <span>{item.tag}</span>
                  </span>
                  <span className="text-[11px] text-[#787774]">{item.count} trade{item.count > 1 ? "s" : ""}</span>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-mono font-semibold block ${item.pnlSol >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {item.pnlSol >= 0 ? `+${item.pnlSol.toFixed(2)}` : item.pnlSol.toFixed(2)} SOL
                  </span>
                  <span className="text-[10px] text-[#9b9a97]">net impact</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
