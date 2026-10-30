"use client";

import { useMemo, useState } from "react";
import { Trade } from "../lib/types";
import { formatRealizedPnl, formatSol, getTradeDate } from "../lib/utils";
import { DEFAULT_GOOD_TAGS } from "../lib/constants";
import { getUsdValueStatus } from "../lib/tradeCalculations";
import { BarChart3, Layers, Target, Clock, Tag, Lightbulb, CalendarDays, ShieldAlert, ShieldCheck, Gauge } from "lucide-react";
import TiltStreakHeatmap from "./TiltStreakHeatmap";
import { calculateRiskAnalytics } from "../lib/riskAnalytics";
import TradeComparisonCard from "./TradeComparisonCard";
import PerformanceReportCard from "./PerformanceReportCard";

interface StatisticsViewProps {
  trades: Trade[];
  solPrice?: number;
  onSelectTrade?: (trade: Trade) => void;
}

export default function StatisticsView({ trades, solPrice = 150, onSelectTrade }: StatisticsViewProps) {
  const [currencyMode, setCurrencyMode] = useState<"SOL" | "USD">("SOL");
  const formatPnl = (sol: number, usd = sol * solPrice) =>
    formatRealizedPnl(currencyMode === "SOL" ? sol : usd, currencyMode);

  // 1. Results Breakdown
  const results = useMemo(() => {
    const wins = trades.filter((t) => t.result === "Win");
    const be = trades.filter((t) => t.result === "BE");
    const losses = trades.filter((t) => t.result === "Loss");

    const winPnlUsd = wins.reduce((acc, trade) => acc + (getUsdValueStatus(trade, solPrice).value ?? 0), 0);
    const bePnlUsd = be.reduce((acc, trade) => acc + (getUsdValueStatus(trade, solPrice).value ?? 0), 0);
    const lossPnlUsd = losses.reduce((acc, trade) => acc + (getUsdValueStatus(trade, solPrice).value ?? 0), 0);

    return {
      win: { count: wins.length, pnlSol: wins.reduce((sum, trade) => sum + (trade.pnlSol || 0), 0), pnlUsd: winPnlUsd },
      be: { count: be.length, pnlSol: be.reduce((sum, trade) => sum + (trade.pnlSol || 0), 0), pnlUsd: bePnlUsd },
      loss: { count: losses.length, pnlSol: losses.reduce((sum, trade) => sum + (trade.pnlSol || 0), 0), pnlUsd: lossPnlUsd },
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
      map[setup].pnlUsd += getUsdValueStatus(t, solPrice).value ?? 0;
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
      hasDurationData: winners.length > 0 && losers.length > 0,
    };
  }, [trades]);

  // Yearly Breakdown
  const yearlyStats = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const discoveredYears = trades.map((t) => getTradeDate(t).getFullYear());
    const years = Array.from(new Set([...discoveredYears, currentYear])).sort((a, b) => a - b).map(String);
    const map: Record<string, { count: number; pnlSol: number; pnlUsd: number }> = Object.fromEntries(
      years.map((year) => [year, { count: 0, pnlSol: 0, pnlUsd: 0 }])
    );

    trades.forEach((t) => {
      const date = getTradeDate(t);
      const yearStr = String(date.getFullYear());
      if (map[yearStr]) {
        map[yearStr].count += 1;
        map[yearStr].pnlSol += t.pnlSol || 0;
        map[yearStr].pnlUsd += getUsdValueStatus(t, solPrice).value ?? 0;
      }
    });

    return years.map((name) => ({ name, ...map[name] }));
  }, [trades, solPrice]);

  // Tag performance
  const tagImpact = useMemo(() => {
    const map: Record<string, { count: number; pnlSol: number; isGood: boolean }> = {};
    trades.forEach((t) => {
      t.goodTags?.forEach((tag) => {
        if (!map[tag]) map[tag] = { count: 0, pnlSol: 0, isGood: true };
        map[tag].count += 1;
        map[tag].pnlSol += t.pnlSol || 0;
      });
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
      .filter((item) => item.count >= 2 && Math.abs(item.pnlSol) >= 0.005)
      .sort((a, b) => Math.abs(b.pnlSol) - Math.abs(a.pnlSol));
  }, [trades]);

  const disciplineStats = useMemo(() => {
    const grades = (["A", "B", "C", "D"] as const).map((grade) => {
      const group = trades.filter((trade) => trade.processGrade === grade);
      const wins = group.filter((trade) => trade.pnlSol > 0).length;
      const pnl = group.reduce((sum, trade) => sum + (trade.pnlSol || 0), 0);
      return { grade, count: group.length, winRate: group.length ? Math.round((wins / group.length) * 100) : null, pnl };
    });
    const confidenceBands = [
      { label: "0–49%", min: 0, max: 49 },
      { label: "50–69%", min: 50, max: 69 },
      { label: "70–84%", min: 70, max: 84 },
      { label: "85–100%", min: 85, max: 100 },
    ].map((band) => {
      const group = trades.filter((trade) => trade.confidenceAtEntry !== undefined && trade.confidenceAtEntry >= band.min && trade.confidenceAtEntry <= band.max);
      const wins = group.filter((trade) => trade.pnlSol > 0).length;
      const averageConfidence = group.length ? group.reduce((sum, trade) => sum + (trade.confidenceAtEntry || 0), 0) / group.length : null;
      const actualWinRate = group.length ? (wins / group.length) * 100 : null;
      return { ...band, count: group.length, averageConfidence, actualWinRate, pnl: group.reduce((sum, trade) => sum + (trade.pnlSol || 0), 0) };
    });
    return {
      grades,
      confidenceBands,
      gradedCount: grades.reduce((sum, grade) => sum + grade.count, 0),
      confidenceCount: confidenceBands.reduce((sum, band) => sum + band.count, 0),
    };
  }, [trades]);

  const monthComparison = useMemo(() => {
    const now = new Date();
    const currentStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const current = trades.filter((trade) => getTradeDate(trade).getTime() >= currentStart);
    const previous = trades.filter((trade) => {
      const timestamp = getTradeDate(trade).getTime();
      return timestamp >= previousStart && timestamp < currentStart;
    });
    const summarize = (group: Trade[]) => ({
      count: group.length,
      pnl: group.reduce((sum, trade) => sum + (trade.pnlSol || 0), 0),
      winRate: group.length ? Math.round((group.filter((trade) => trade.pnlSol > 0).length / group.length) * 100) : null,
    });
    return { current: summarize(current), previous: summarize(previous) };
  }, [trades]);
  const riskAnalytics = useMemo(() => calculateRiskAnalytics(trades), [trades]);

  if (trades.length === 0) {
    return (
      <div className="journal-page">
        <div className="flex items-center gap-2 text-xs text-[#787774] mb-2">
          <span>Journal</span>
          <span>/</span>
          <span className="text-[#37352f] font-medium">Statistics</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#2383e2]">
            <BarChart3 size={20} />
          </span>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#37352f]">
              Statistics & Strategy Analytics
            </h1>
            <p className="text-xs text-[#787774] mt-0.5">
              Deep dive into setup win-rates, holding duration patterns, streaks, and mistake costs.
            </p>
          </div>
          </div>
          <div aria-label="Statistics currency" className="flex rounded-lg border border-[#e3e2de] bg-white p-1 text-xs font-semibold">
            {(["SOL", "USD"] as const).map((unit) => <button key={unit} type="button" onClick={() => setCurrencyMode(unit)} aria-pressed={currencyMode === unit} className={`rounded-md px-3 py-1.5 ${currencyMode === unit ? "bg-[#f1f1ef] text-[#37352f]" : "text-[#787774]"}`}>{unit === "USD" ? "USD ($)" : unit}</button>)}
          </div>
        </div>

        <div className="bg-white border border-[#e9e9e7] rounded-2xl p-12 text-center max-w-lg mx-auto shadow-xs mt-6">
          <div className="w-14 h-14 bg-[#f7f6f3] border border-[#e3e2de] rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
            <BarChart3 size={24} />
          </div>
          <h3 className="text-base font-bold text-[#37352f] mb-1.5">No Historical Trades Yet</h3>
          <p className="text-xs text-[#787774] max-w-sm mx-auto leading-relaxed">
            Log your trades in the journal or dashboard to unlock win-rate analytics, setup performance, holding-time patterns, and tilt & streak heatmaps.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="journal-page">
      {/* Title */}
      <div className="pt-6">
        <div className="flex items-center gap-2 text-xs text-[#787774] mb-2">
          <span>Journal</span>
          <span>/</span>
          <span className="text-[#37352f] font-medium">Statistics</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#2383e2]">
            <BarChart3 size={20} />
          </span>
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

      <PerformanceReportCard trades={trades} currency={currencyMode} solPrice={solPrice} />

      {/* Tilt & Streak Heatmap */}
      <TiltStreakHeatmap trades={trades} solPrice={solPrice} onSelectTrade={onSelectTrade} />

      <section className="rounded-xl border border-[#e9e9e7] bg-white p-5 shadow-xs" aria-labelledby="risk-dashboard-title">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#f1f1ef] pb-3"><div className="flex items-center gap-2"><ShieldAlert size={16} className="text-amber-600"/><div><h2 id="risk-dashboard-title" className="text-sm font-semibold text-[#37352f]">Risk &amp; Capital Deployment</h2><p className="text-xs text-[#787774]">Historical completed trades only—not a live open-position or wallet-exposure feed.</p></div></div><span className="text-[10px] text-[#9b9a97]">{riskAnalytics.recordedRiskCount}/{trades.length} trades include initial risk</span></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <RiskMetric label="Average initial risk" value={riskAnalytics.recordedRiskCount ? `${formatSol(riskAnalytics.averageInitialRiskSol)} SOL` : "Not recorded"} detail={riskAnalytics.recordedRiskCount ? `Largest planned risk ${formatSol(riskAnalytics.maxInitialRiskSol)} SOL` : "Add initial risk when logging trades"}/>
          <RiskMetric label="Risk-limit breaches" value={String(riskAnalytics.riskBreachCount)} detail="Loss exceeded recorded initial risk by more than 5%" tone={riskAnalytics.riskBreachCount ? "warning" : "normal"}/>
          <RiskMetric label="Capital deployed" value={`${formatSol(riskAnalytics.totalCapitalDeployedSol)} SOL`} detail={`Largest single entry ${formatSol(riskAnalytics.largestTradeSol)} SOL`}/>
          <RiskMetric label="Recorded fees" value={`${formatSol(riskAnalytics.totalFeesSol)} SOL`} detail="Aggregated from saved trade fees and partial fills"/>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Concentration label="Largest wallet share of deployed capital" name={riskAnalytics.largestWallet?.name ?? "No wallet data"} share={riskAnalytics.largestWallet?.share ?? 0} amount={riskAnalytics.largestWallet?.amountSol ?? 0}/>
          <Concentration label="Largest token share of deployed capital" name={riskAnalytics.largestToken?.name ?? "No token data"} share={riskAnalytics.largestToken?.share ?? 0} amount={riskAnalytics.largestToken?.amountSol ?? 0}/>
        </div>
      </section>

      <TradeComparisonCard trades={trades} onSelectTrade={onSelectTrade}/>

      {/* Discipline, confidence calibration, and period comparison */}
      <div data-tour="analytics-discipline" className="analytics-card p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#f1f1ef] pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-[#2383e2]" />
            <div>
              <h2 className="text-sm font-semibold text-[#37352f]">Discipline &amp; Confidence Calibration</h2>
              <p className="text-xs text-[#787774]">Compare execution quality and confidence at entry with actual outcomes.</p>
            </div>
          </div>
          <span className="text-[10px] text-[#9b9a97]">Descriptive only · small samples can mislead</span>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <section>
            <div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-semibold text-[#37352f]">Process grade outcomes</h3><span className="text-[10px] text-[#9b9a97]">{disciplineStats.gradedCount} graded</span></div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {disciplineStats.grades.map((item) => <div key={item.grade} className="rounded-lg border border-[#e9e9e7] bg-[#fbfbfa] p-3"><p className="text-[10px] uppercase text-[#787774]">Grade {item.grade}</p><p className="mt-1 font-mono text-sm font-bold text-[#37352f]">{item.count ? `${item.winRate}% wins` : "—"}</p><p className={`mt-1 text-[10px] font-semibold ${item.pnl >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{item.count ? `${formatPnl(item.pnl)} · ${item.count}` : "No trades"}</p></div>)}
            </div>
          </section>
          <section>
            <div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-semibold text-[#37352f]">Confidence vs actual win rate</h3><span className="text-[10px] text-[#9b9a97]">{disciplineStats.confidenceCount} tracked</span></div>
            <div className="space-y-2">
              {disciplineStats.confidenceBands.map((band) => <div key={band.label} className="grid grid-cols-[62px_1fr_auto] items-center gap-2 text-[11px]"><span className="font-mono text-[#5a5957]">{band.label}</span><div className="h-2 overflow-hidden rounded-full bg-[#f1f1ef]"><div className="h-full rounded-full bg-[#2383e2]" style={{ width: `${band.actualWinRate ?? 0}%` }}/></div><span className="min-w-24 text-right font-mono text-[#37352f]">{band.count ? `${Math.round(band.actualWinRate!)}% actual · ${band.count}` : "No trades"}</span></div>)}
            </div>
          </section>
        </div>

        <section className="grid gap-3 border-t border-[#f1f1ef] pt-4 sm:grid-cols-3">
          <div className="flex items-center gap-2"><Gauge size={15} className="text-[#2383e2]"/><div><p className="text-[10px] uppercase text-[#787774]">This month realized P&amp;L</p><p className="font-mono text-sm font-bold text-[#37352f]">{formatPnl(monthComparison.current.pnl)}</p><p className="text-[10px] text-[#9b9a97]">{monthComparison.current.count} trades · {monthComparison.current.winRate ?? "—"}% wins</p></div></div>
          <div><p className="text-[10px] uppercase text-[#787774]">Previous month realized P&amp;L</p><p className="font-mono text-sm font-bold text-[#37352f]">{formatPnl(monthComparison.previous.pnl)}</p><p className="text-[10px] text-[#9b9a97]">{monthComparison.previous.count} trades · {monthComparison.previous.winRate ?? "—"}% wins</p></div>
          <div><p className="text-[10px] uppercase text-[#787774]">Realized P&amp;L change</p><p className={`font-mono text-sm font-bold ${monthComparison.current.pnl - monthComparison.previous.pnl >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{formatPnl(monthComparison.current.pnl - monthComparison.previous.pnl)}</p><p className="text-[10px] text-[#9b9a97]">Net result vs previous month</p></div>
        </section>
      </div>

      {/* Duration Tracking Analytics Card */}
      <div data-tour="analytics-duration" className="analytics-card p-5 space-y-4">
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
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl">
            <div>
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                Avg Winner Holding Time
              </span>
              <div className="text-xl font-mono font-bold text-emerald-900 mt-1">
                {durationStats.avgWinFormatted}
              </div>
              <span className="text-[10px] text-emerald-700">Time to hit profit targets</span>
            </div>
          </div>

          <div className="p-4 bg-rose-50/50 border border-rose-200 rounded-xl">
            <div>
              <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider block">
                Avg Loser Holding Time
              </span>
              <div className="text-xl font-mono font-bold text-rose-900 mt-1">
                {durationStats.avgLossFormatted}
              </div>
              <span className="text-[10px] text-rose-700">Time held before cutting loss</span>
            </div>
          </div>
        </div>

        {durationStats.hasDurationData && (
          <div className="p-3 bg-[#fbfbfa] border border-[#e9e9e7] rounded-lg text-xs text-[#5a5957] flex items-center gap-2">
            <Lightbulb size={16} className="shrink-0" />
            <span>
              {durationStats.avgLossDuration && durationStats.avgWinDuration && durationStats.avgLossDuration > durationStats.avgWinDuration ? (
                <span>
                  <strong>Insight:</strong> You are holding losing trades longer than winners ({durationStats.avgLossFormatted} vs {durationStats.avgWinFormatted}). Respect your stop loss faster!
                </span>
              ) : durationStats.avgLossDuration === durationStats.avgWinDuration ? (
                <span>
                  <strong>Insight:</strong> Winner and loser holding times are currently the same. More varied trade data is needed before drawing a conclusion.
                </span>
              ) : (
                <span>
                  <strong>Insight:</strong> Winners are being held longer than losing trades ({durationStats.avgWinFormatted} vs {durationStats.avgLossFormatted}).
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Strategy / Setup Type Performance Table */}
      <div data-tour="analytics-setups" className="analytics-card p-5 space-y-3">
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
                  <th className="py-2 px-3 font-medium">Realized P&amp;L ({currencyMode})</th>
                </tr>
              </thead>
              <tbody>
                {setupStats.map((item) => (
                  <tr key={item.setup} className="border-b border-[#f7f6f5] hover:bg-[#fcfbf9]">
                    <td className="py-2.5 px-3 font-semibold text-[#37352f] flex items-center gap-1.5">
                      <Target size={13} className="text-[#2383e2]" />
                      <span>{item.setup}</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-[#5a5957]">{item.count}</td>
                    <td className="py-2.5 px-3">
                      <span className="rounded border border-[#e3e2de] bg-[#f7f6f3] px-2 py-0.5 text-[11px] font-bold text-[#37352f]">
                        {item.winRate}% ({item.wins}W / {item.count - item.wins}L)
                      </span>
                    </td>
                    <td className={`py-2.5 px-3 font-mono font-bold ${item.pnlSol >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {formatPnl(item.pnlSol, item.pnlUsd)}
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
          <div className="pb-3 border-b border-[#e9e9e7]">
            <div className="flex items-center gap-1.5 font-semibold text-xs text-[#37352f]">
              <span className="p-1 rounded bg-neutral-100 text-neutral-600"><BarChart3 size={14} /></span>
              <span>Results Breakdown</span>
            </div>
          </div>

          <div className="mt-3 space-y-2 text-xs">
            <div className="flex items-center justify-between py-2 border-b border-[#f1f1ef]">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[#787774] w-4">{results.win.count}</span>
                <span className="font-medium text-[#37352f] flex items-center gap-1">
                  Win
                </span>
              </div>
              <span className="font-mono font-medium text-emerald-600">
                {formatPnl(results.win.pnlSol, results.win.pnlUsd)}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-[#f1f1ef]">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[#787774] w-4">{results.be.count}</span>
                <span className="font-medium text-[#37352f] flex items-center gap-1">
                  Break-even
                </span>
              </div>
              <span className="font-mono font-medium text-[#787774]">
                {formatPnl(results.be.pnlSol, results.be.pnlUsd)}
              </span>
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[#787774] w-4">{results.loss.count}</span>
                <span className="font-medium text-[#37352f] flex items-center gap-1">
                  Loss
                </span>
              </div>
              <span className="font-mono font-medium text-rose-600">
                {formatPnl(results.loss.pnlSol, results.loss.pnlUsd)}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Yearly Statistics Card */}
        <div data-tour="analytics-yearly" className="analytics-card p-5">
          <div className="pb-3 border-b border-[#e9e9e7]">
            <div className="flex items-center gap-1.5 font-semibold text-xs text-[#37352f]">
              <span className="p-1 rounded bg-neutral-100 text-neutral-600"><CalendarDays size={14} /></span>
              <span>Yearly Statistics</span>
            </div>
          </div>

          <div className="mt-3 space-y-2 text-xs">
            {yearlyStats.map((y) => (
              <div key={y.name} className="flex items-center justify-between py-2 border-b border-[#f1f1ef] last:border-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[#37352f]">{y.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-[#787774]">{y.count}</span>
                  <span className={`font-mono font-medium ${y.pnlSol >= 0 ? "text-[#37352f]" : "text-rose-600"}`}>
                    {formatPnl(y.pnlSol, y.pnlUsd)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tag performance card */}
      {tagImpact.length > 0 && (
        <div className="bg-white border border-[#e9e9e7] rounded-xl p-5 shadow-xs">
          <h2 className="text-sm font-semibold text-[#37352f] flex items-center gap-2 mb-1">
            <Tag size={15} className="text-[#2383e2]" />
            <span>P&amp;L by Trade Tag</span>
          </h2>
          <p className="text-xs text-[#787774] mb-4">
            Net P&amp;L for tags used on at least two trades. This shows correlation, not causation.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {tagImpact.map((item) => (
              <div
                key={item.tag}
                className="p-3 bg-[#fbfbfa] border border-[#e9e9e7] rounded-lg flex items-center justify-between"
              >
                <div>
                  <span className="text-xs font-semibold text-[#37352f] flex items-center gap-1">
                    <span>{item.tag}</span>
                  </span>
                  <span className="text-[11px] text-[#787774]">{item.count} trade{item.count > 1 ? "s" : ""}</span>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-mono font-semibold block ${item.pnlSol >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {formatPnl(item.pnlSol)}
                  </span>
                  <span className="text-[10px] text-[#9b9a97]">net P&amp;L on tagged trades</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RiskMetric({ label, value, detail, tone = "normal" }: { label: string; value: string; detail: string; tone?: "normal" | "warning" }) {
  return <div className="rounded-lg border border-[#e9e9e7] bg-[#fbfbfa] p-3"><p className="text-[10px] uppercase text-[#787774]">{label}</p><p className={`mt-1 font-mono text-base font-bold ${tone === "warning" ? "text-rose-700" : "text-[#37352f]"}`}>{value}</p><p className="mt-1 text-[10px] leading-4 text-[#9b9a97]">{detail}</p></div>;
}

function Concentration({ label, name, share, amount }: { label: string; name: string; share: number; amount: number }) {
  return <div className="rounded-lg border border-[#e9e9e7] p-3"><div className="flex items-center justify-between gap-3 text-xs"><div><p className="text-[#787774]">{label}</p><p className="mt-1 font-semibold text-[#37352f]">{name}</p></div><div className="text-right"><p className="font-mono font-bold text-[#37352f]">{share.toFixed(0)}%</p><p className="text-[10px] text-[#9b9a97]">{formatSol(amount)} SOL</p></div></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#f1f1ef]"><div className={`h-full rounded-full ${share >= 50 ? "bg-amber-500" : "bg-[#2383e2]"}`} style={{ width: `${Math.min(100, share)}%` }}/></div></div>;
}
