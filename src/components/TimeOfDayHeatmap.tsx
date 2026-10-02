"use client";

import { useState, useMemo, useCallback } from "react";
import { Trade } from "../lib/types";
import { Clock, X, TrendingUp, TrendingDown, Activity, Info } from "lucide-react";
import { getTradeDate, getTradeTimestamp } from "../lib/utils";
import { useCurrentTime } from "../lib/useLocalStorage";
import { getUsdValueStatus } from "../lib/tradeCalculations";

interface TimeOfDayHeatmapProps {
  trades: Trade[];
  solPrice?: number;
}

interface CellData {
  dayIndex: number;
  hour: number;
  totalPnlUsd: number;
  totalPnlSol: number;
  tradeCount: number;
  wins: number;
  losses: number;
  be: number;
  trades: Trade[];
}

type HeatmapMetric = "avgPnl" | "totalPnl" | "winRate" | "tradeCount";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const DAY_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const HOUR_LABELS = [
  "12am", "1am", "2am", "3am", "4am", "5am", "6am", "7am", "8am", "9am", "10am", "11am",
  "12pm", "1pm", "2pm", "3pm", "4pm", "5pm", "6pm", "7pm", "8pm", "9pm", "10pm", "11pm",
];

function formatUsdSigned(val: number): string {
  if (val === 0) return "$0.00";
  const abs = Math.abs(val);
  if (abs >= 1000) {
    return `${val > 0 ? "+" : "-"}$${(abs / 1000).toFixed(2)}K`;
  }
  return `${val > 0 ? "+" : "-"}$${abs.toFixed(2)}`;
}

export default function TimeOfDayHeatmap({ trades, solPrice = 150 }: TimeOfDayHeatmapProps) {
  const now = useCurrentTime();
  const [hoveredCell, setHoveredCell] = useState<{ day: number; hour: number } | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [expandedHour, setExpandedHour] = useState<number | null>(null);
  const [metric, setMetric] = useState<HeatmapMetric>("avgPnl");
  const [minimumSample, setMinimumSample] = useState(3);

  // Build the 7x24 grid
  const gridData = useMemo(() => {
    const grid: CellData[][] = Array.from({ length: 7 }, (_, dayIdx) =>
      Array.from({ length: 24 }, (_, hour) => ({
        dayIndex: dayIdx,
        hour,
        totalPnlUsd: 0,
        totalPnlSol: 0,
        tradeCount: 0,
        wins: 0,
        losses: 0,
        be: 0,
        trades: [] as Trade[],
      }))
    );

    trades.forEach((t) => {
      const tradeDate = getTradeDate(t);

      // Convert JS getDay (0=Sun) to our grid (0=Mon)
      const jsDay = tradeDate.getDay();
      const dayIdx = jsDay === 0 ? 6 : jsDay - 1; // Mon=0, Tue=1, ... Sun=6
      const hour = tradeDate.getHours();

      const pnlUsd = getUsdValueStatus(t, solPrice).value ?? 0;

      grid[dayIdx][hour].totalPnlUsd += pnlUsd;
      grid[dayIdx][hour].totalPnlSol += t.pnlSol || 0;
      grid[dayIdx][hour].tradeCount += 1;
      grid[dayIdx][hour].trades.push(t);

      if (t.result === "Win") grid[dayIdx][hour].wins += 1;
      else if (t.result === "Loss") grid[dayIdx][hour].losses += 1;
      else grid[dayIdx][hour].be += 1;
    });

    return grid;
  }, [trades, solPrice]);

  const metricValue = useCallback((cell: CellData) => {
    if (metric === "avgPnl") return cell.tradeCount ? cell.totalPnlUsd / cell.tradeCount : 0;
    if (metric === "winRate") return cell.tradeCount ? (cell.wins / cell.tradeCount) * 100 : 0;
    if (metric === "tradeCount") return cell.tradeCount;
    return cell.totalPnlUsd;
  }, [metric]);

  // Find global min/max for color scaling, excluding cells below the sample threshold.
  const { globalMin, globalMax } = useMemo(() => {
    let min = 0;
    let max = 0;
    gridData.forEach((row) =>
      row.forEach((cell) => {
        if (cell.tradeCount >= minimumSample) {
          const value = metricValue(cell);
          if (value < min) min = value;
          if (value > max) max = value;
        }
      })
    );
    return { globalMin: min, globalMax: max };
  }, [gridData, metricValue, minimumSample]);

  // Compute best/worst hour and average
  const summaryStats = useMemo(() => {
    let bestCell: CellData | null = null;
    let worstCell: CellData | null = null;
    let totalPnlUsd = 0;
    let totalTrades = 0;

    gridData.forEach((row) =>
      row.forEach((cell) => {
        if (cell.tradeCount > 0) {
          totalPnlUsd += cell.totalPnlUsd;
          totalTrades += cell.tradeCount;

          if (cell.tradeCount < minimumSample) return;
          if (!bestCell || metricValue(cell) > metricValue(bestCell)) bestCell = { ...cell };
          if (!worstCell || metricValue(cell) < metricValue(worstCell)) worstCell = { ...cell };
        }
      })
    );

    const avgPerTrade = totalTrades > 0 ? totalPnlUsd / totalTrades : 0;

    return { bestCell, worstCell, avgPerTrade, totalTrades } as {
      bestCell: CellData | null;
      worstCell: CellData | null;
      avgPerTrade: number;
      totalTrades: number;
    };
  }, [gridData, metricValue, minimumSample]);

  // Color for a cell
  const getCellColor = useCallback(
    (cell: CellData) => {
      if (cell.tradeCount < minimumSample) return "rgba(0,0,0,0.03)";

      const value = metricValue(cell);
      if (value > 0) {
        const intensity = globalMax > 0 ? Math.min(value / globalMax, 1) : 0;
        const alpha = 0.15 + intensity * 0.7;
        return `rgba(34, 197, 94, ${alpha})`;
      } else if (value < 0 && metric !== "winRate" && metric !== "tradeCount") {
        const intensity = globalMin < 0 ? Math.min(Math.abs(value) / Math.abs(globalMin), 1) : 0;
        const alpha = 0.15 + intensity * 0.7;
        return `rgba(239, 68, 68, ${alpha})`;
      }
      return "rgba(0,0,0,0.08)";
    },
    [globalMin, globalMax, metric, metricValue, minimumSample]
  );

  const formatMetric = (cell: CellData) => {
    if (cell.tradeCount === 0) return metric === "tradeCount" ? "0" : "No trades";
    if (metric === "avgPnl") return formatUsdSigned(cell.totalPnlUsd / cell.tradeCount);
    if (metric === "totalPnl") return formatUsdSigned(cell.totalPnlUsd);
    if (metric === "winRate") return `${Math.round((cell.wins / cell.tradeCount) * 100)}%`;
    return `${cell.tradeCount}`;
  };

  const metricLabel = metric === "avgPnl" ? "Avg P&L" : metric === "totalPnl" ? "Total P&L" : metric === "winRate" ? "Win rate" : "Trades";

  // Format hour range for tooltip
  const formatHourRange = (hour: number) => {
    const start = hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`;
    const endHour = (hour + 1) % 24;
    const end = endHour === 0 ? "12 AM" : endHour < 12 ? `${endHour} AM` : endHour === 12 ? "12 PM" : `${endHour - 12} PM`;
    return `${start} – ${end}`;
  };

  // Handle mouse enter on cell
  const handleMouseEnter = (dayIdx: number, hour: number, e: React.MouseEvent) => {
    setHoveredCell({ day: dayIdx, hour });
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
  };

  // Handle cell click
  const handleCellClick = (dayIdx: number, hour: number) => {
    const cell = gridData[dayIdx][hour];
    if (cell.tradeCount === 0) return;

    if (expandedDay === dayIdx && expandedHour === hour) {
      setExpandedDay(null);
      setExpandedHour(null);
    } else {
      setExpandedDay(dayIdx);
      setExpandedHour(hour);
    }
  };

  // Handle day label click (expand entire day)
  const handleDayClick = (dayIdx: number) => {
    if (expandedDay === dayIdx && expandedHour === null) {
      setExpandedDay(null);
    } else {
      setExpandedDay(dayIdx);
      setExpandedHour(null);
    }
  };

  // Get expanded trades
  const expandedTrades = useMemo(() => {
    if (expandedDay === null) return [];

    if (expandedHour !== null) {
      return gridData[expandedDay][expandedHour].trades;
    }

    // All trades for the entire day
    return gridData[expandedDay].flatMap((cell) => cell.trades).sort((a, b) => {
      return getTradeTimestamp(a) - getTradeTimestamp(b);
    });
  }, [expandedDay, expandedHour, gridData]);

  // Currently hovered cell data
  const hoveredData = hoveredCell ? gridData[hoveredCell.day][hoveredCell.hour] : null;

  const currentDate = new Date(now);
  const currentDayIdx = now ? (currentDate.getDay() === 0 ? 6 : currentDate.getDay() - 1) : -1;
  const currentHour = now ? currentDate.getHours() : -1;

  const worstValue = summaryStats.worstCell ? metricValue(summaryStats.worstCell) : 0;
  const worstIsActualLoss = (metric === "avgPnl" || metric === "totalPnl") && worstValue < 0;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-emerald-500" />
            <div>
              <h3 className="text-sm font-bold text-gray-900">Performance by Hour & Day</h3>
              <p className="text-[11px] text-gray-500">
                Compare time slots by average P&L, total P&L, win rate, or sample size.
              </p>
            </div>
          </div>
          <span className="text-[10px] text-gray-500 font-mono">
            {trades.length} total trades
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5" role="group" aria-label="Heatmap metric">
            {([['avgPnl', 'Avg P&L'], ['totalPnl', 'Total P&L'], ['winRate', 'Win rate'], ['tradeCount', 'Trades']] as const).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setMetric(value)} className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-colors ${metric === value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`} aria-pressed={metric === value}>{label}</button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-[10px] text-gray-500">
            Minimum sample
            <select value={minimumSample} onChange={(e) => setMinimumSample(Number(e.target.value))} className="rounded-md border border-gray-200 bg-white px-1.5 py-1 text-[10px] text-gray-700" aria-label="Minimum sample size">
              <option value={1}>1 trade</option><option value={2}>2 trades</option><option value={3}>3 trades</option><option value={5}>5 trades</option>
            </select>
          </label>
          <span className="inline-flex items-center gap-1 text-[10px] text-gray-400"><Info size={11} /> Cells below the threshold are muted.</span>
        </div>
      </div>

      {/* Grid */}
      <div className="px-4 py-3 overflow-x-auto">
        <div className="min-w-[700px] relative overflow-hidden pb-1">
          {/* Hour labels row */}
          <div className="flex items-center mb-1">
            <div className="w-6 shrink-0" />
            {HOUR_LABELS.map((label, i) => (
              <div
                key={i}
                className="flex-1 text-center text-[9px] text-gray-500 font-mono"
              >
                {i % 3 === 0 ? label : ""}
              </div>
            ))}
          </div>

          {/* Data rows */}
          {gridData.map((row, dayIdx) => (
            <div key={dayIdx} className="flex items-center mb-[2px]">
              {/* Day label */}
              <button
                type="button"
                onClick={() => handleDayClick(dayIdx)}
                aria-label={`Show all ${DAY_FULL[dayIdx]} trades`}
                aria-pressed={expandedDay === dayIdx && expandedHour === null}
                className={`w-6 shrink-0 text-[10px] font-bold text-center cursor-pointer transition-colors ${
                  expandedDay === dayIdx && expandedHour === null
                    ? "text-emerald-600"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                {DAY_LABELS[dayIdx]}
              </button>

              {/* Hour cells */}
              {row.map((cell, hour) => (
                <button
                  type="button"
                  key={hour}
                  className={`flex-1 h-7 mx-[1px] rounded-[3px] flex items-center justify-center cursor-pointer transition-all relative ${
                    expandedDay === dayIdx && (expandedHour === null || expandedHour === hour)
                      ? "ring-1 ring-emerald-400/50"
                      : dayIdx === currentDayIdx && hour === currentHour
                      ? "ring-1 ring-purple-400 z-10 before:absolute before:left-1/2 before:-top-[1000px] before:-bottom-[1000px] before:w-[1px] before:bg-purple-400/40 before:-z-10 after:absolute after:top-1/2 after:-left-[1000px] after:-right-[1000px] after:h-[1px] after:bg-purple-400/40 after:-z-10"
                      : ""
                  }`}
                  style={{ backgroundColor: getCellColor(cell) }}
                  onMouseEnter={(e) => handleMouseEnter(dayIdx, hour, e)}
                  onMouseLeave={() => setHoveredCell(null)}
                  onClick={() => handleCellClick(dayIdx, hour)}
                  aria-label={`${DAY_FULL[dayIdx]} ${formatHourRange(hour)}: ${cell.tradeCount} trade${cell.tradeCount === 1 ? "" : "s"}, ${formatMetric(cell)}`}
                  aria-pressed={expandedDay === dayIdx && expandedHour === hour}
                  disabled={cell.tradeCount === 0}
                >
                  {cell.tradeCount >= minimumSample && (
                    <span
                      className={`text-[8px] font-mono font-bold leading-none ${
                        cell.totalPnlUsd >= 0 ? "text-emerald-900" : "text-rose-900"
                      }`}
                    >
                      {formatMetric(cell)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}

        </div>
      </div>

      {/* Tooltip */}
      {hoveredData && hoveredData.tradeCount > 0 && hoveredCell && (
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y - 8,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-xl min-w-[180px]">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock size={11} className="text-gray-500" />
              <span
                className={`text-sm font-bold font-mono ${
                  hoveredData.totalPnlUsd >= 0 ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {formatUsdSigned(hoveredData.totalPnlUsd)}
              </span>
              <span className="text-[10px] text-gray-500">
                over {hoveredData.tradeCount} trade{hoveredData.tradeCount !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="text-[10px] text-gray-500">
              {DAY_FULL[hoveredCell.day]} {formatHourRange(hoveredCell.hour)} ·{" "}
                {hoveredData.tradeCount >= minimumSample
                  ? `${Math.round((hoveredData.wins / hoveredData.tradeCount) * 100)}% win rate`
                  : `Needs ${minimumSample} trades (has ${hoveredData.tradeCount})`}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Stats Bar */}
      {summaryStats.totalTrades > 0 && (
        <div className="px-4 py-2.5 border-t border-gray-100 flex flex-wrap items-center gap-3 text-[11px]">
          {summaryStats.worstCell && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 border rounded-md ${worstIsActualLoss ? "bg-rose-50 border-rose-100" : "bg-gray-50 border-gray-200"}`}>
              {worstIsActualLoss
                ? <TrendingDown size={12} className="text-rose-500" />
                : <Activity size={12} className="text-gray-500" />}
              <span className={`font-medium ${worstIsActualLoss ? "text-rose-700" : "text-gray-700"}`}>
                {worstIsActualLoss ? "Worst slot" : "Lowest slot"} · {DAY_FULL[summaryStats.worstCell.dayIndex].slice(0, 3)}{" "}
                {summaryStats.worstCell.hour === 0
                  ? "12 AM"
                  : summaryStats.worstCell.hour < 12
                  ? `${summaryStats.worstCell.hour} AM`
                  : summaryStats.worstCell.hour === 12
                  ? "12 PM"
                  : `${summaryStats.worstCell.hour - 12} PM`}{" "}
                · {metricLabel}: {formatMetric(summaryStats.worstCell)}
              </span>
            </div>
          )}
          {summaryStats.bestCell && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-100 rounded-md">
              <TrendingUp size={12} className="text-emerald-500" />
              <span className="text-emerald-700 font-medium">
                Best slot · {DAY_FULL[summaryStats.bestCell.dayIndex].slice(0, 3)}{" "}
                {summaryStats.bestCell.hour === 0
                  ? "12 AM"
                  : summaryStats.bestCell.hour < 12
                  ? `${summaryStats.bestCell.hour} AM`
                  : summaryStats.bestCell.hour === 12
                  ? "12 PM"
                  : `${summaryStats.bestCell.hour - 12} PM`}{" "}
                · {metricLabel}: {formatMetric(summaryStats.bestCell)}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-md">
            <Activity size={12} className="text-gray-500" />
            <span className="text-gray-700 font-medium">
              Avg · {formatUsdSigned(summaryStats.avgPerTrade)} / trade
            </span>
          </div>
        </div>
      )}

      {/* Expanded Trade Logs Panel */}
      {expandedDay !== null && expandedTrades.length > 0 && (
        <div className="border-t border-gray-100 bg-gray-50">
          <div className="px-4 py-3">
            {/* Panel Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-900">
                  {DAY_FULL[expandedDay]}
                  {expandedHour !== null && (
                    <span className="text-gray-500 font-normal">
                      {" "}· {formatHourRange(expandedHour)}
                    </span>
                  )}
                </span>
                <span className="text-[10px] px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full">
                  {expandedTrades.length} trade{expandedTrades.length !== 1 ? "s" : ""}
                </span>
              </div>
              <button
                onClick={() => {
                  setExpandedDay(null);
                  setExpandedHour(null);
                }}
                className="text-gray-400 hover:text-gray-900 transition-colors p-1"
              >
                <X size={14} />
              </button>
            </div>

            {/* Trade Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[300px] overflow-y-auto pr-1">
              {expandedTrades.map((trade) => {
                const tradeDate = getTradeDate(trade);
                const timeStr = tradeDate.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                });
                const pnlUsd = getUsdValueStatus(trade, solPrice).value ?? 0;

                return (
                  <div
                    key={trade.id}
                    className={`p-3 rounded-lg border transition-all ${
                      trade.result === "Win"
                        ? "bg-emerald-50 border-emerald-200"
                        : trade.result === "Loss"
                        ? "bg-rose-50 border-rose-200"
                        : "bg-white border-gray-200"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-900">
                          {trade.symbol || trade.name || "Unknown"}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                            trade.result === "Win"
                              ? "bg-emerald-100 text-emerald-700"
                              : trade.result === "Loss"
                              ? "bg-rose-100 text-rose-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {trade.result}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-500 font-mono">{timeStr}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-[10px] text-gray-500">
                        {trade.setupType || "—"}
                      </div>
                      <span
                        className={`text-xs font-mono font-bold ${
                          pnlUsd >= 0 ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {formatUsdSigned(pnlUsd)}
                      </span>
                    </div>

                    {trade.ca && (
                      <div className="mt-1.5 text-[9px] text-gray-600 font-mono truncate">
                        {trade.ca}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
