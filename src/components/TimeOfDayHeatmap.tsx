"use client";

import { useState, useMemo, useCallback } from "react";
import { Trade } from "../lib/types";
import { Clock, X, TrendingUp, TrendingDown, Activity } from "lucide-react";

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

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const DAY_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const HOUR_LABELS = [
  "12a", "1a", "2a", "3a", "4a", "5a", "6a", "7a", "8a", "9a", "10a", "11a",
  "12p", "1p", "2p", "3p", "4p", "5p", "6p", "7p", "8p", "9p", "10p", "11p",
];

function formatUsd(val: number): string {
  const abs = Math.abs(val);
  if (abs >= 1000) {
    return `${val >= 0 ? "+" : "-"}$${(abs / 1000).toFixed(2)}K`;
  }
  return `${val >= 0 ? "+" : "-"}$${abs.toFixed(2)}`;
}

function formatUsdSigned(val: number): string {
  if (val === 0) return "$0.00";
  const abs = Math.abs(val);
  if (abs >= 1000) {
    return `${val > 0 ? "+" : "-"}$${(abs / 1000).toFixed(2)}K`;
  }
  return `${val > 0 ? "+" : "-"}$${abs.toFixed(2)}`;
}

export default function TimeOfDayHeatmap({ trades, solPrice = 150 }: TimeOfDayHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<{ day: number; hour: number } | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [expandedHour, setExpandedHour] = useState<number | null>(null);

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
      const tradeDate = t.date?.seconds
        ? new Date(t.date.seconds * 1000)
        : new Date(t.createdAt || Date.now());

      // Convert JS getDay (0=Sun) to our grid (0=Mon)
      const jsDay = tradeDate.getDay();
      const dayIdx = jsDay === 0 ? 6 : jsDay - 1; // Mon=0, Tue=1, ... Sun=6
      const hour = tradeDate.getHours();

      const pnlUsd = t.pnlUsd || (t.pnlSol || 0) * solPrice;

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

  // Find global min/max for color scaling
  const { globalMin, globalMax } = useMemo(() => {
    let min = 0;
    let max = 0;
    gridData.forEach((row) =>
      row.forEach((cell) => {
        if (cell.tradeCount > 0) {
          if (cell.totalPnlUsd < min) min = cell.totalPnlUsd;
          if (cell.totalPnlUsd > max) max = cell.totalPnlUsd;
        }
      })
    );
    return { globalMin: min, globalMax: max };
  }, [gridData]);

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

          if (!bestCell || cell.totalPnlUsd > bestCell.totalPnlUsd) bestCell = { ...cell };
          if (!worstCell || cell.totalPnlUsd < worstCell.totalPnlUsd) worstCell = { ...cell };
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
  }, [gridData]);

  // Color for a cell
  const getCellColor = useCallback(
    (cell: CellData) => {
      if (cell.tradeCount === 0) return "rgba(255,255,255,0.03)";

      const pnl = cell.totalPnlUsd;
      if (pnl > 0) {
        const intensity = globalMax > 0 ? Math.min(pnl / globalMax, 1) : 0;
        const alpha = 0.15 + intensity * 0.7;
        return `rgba(34, 197, 94, ${alpha})`;
      } else if (pnl < 0) {
        const intensity = globalMin < 0 ? Math.min(Math.abs(pnl) / Math.abs(globalMin), 1) : 0;
        const alpha = 0.15 + intensity * 0.7;
        return `rgba(239, 68, 68, ${alpha})`;
      }
      return "rgba(255,255,255,0.08)";
    },
    [globalMin, globalMax]
  );

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
      const timeA = a.date?.seconds ? a.date.seconds * 1000 : a.createdAt || 0;
      const timeB = b.date?.seconds ? b.date.seconds * 1000 : b.createdAt || 0;
      return timeA - timeB;
    });
  }, [expandedDay, expandedHour, gridData]);

  // Currently hovered cell data
  const hoveredData = hoveredCell ? gridData[hoveredCell.day][hoveredCell.hour] : null;

  return (
    <div className="bg-[#1a1a2e] border border-[#2a2a4a] rounded-xl overflow-hidden shadow-lg">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b border-[#2a2a4a]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Performance by Hour & Day</h3>
              <p className="text-[11px] text-gray-400">
                Each square is an average P&L per trade in that hourly slot.
              </p>
            </div>
          </div>
          <span className="text-[10px] text-gray-500 font-mono">
            {trades.length} total trades
          </span>
        </div>
      </div>

      {/* Grid */}
      <div className="px-4 py-3 overflow-x-auto">
        <div className="min-w-[700px]">
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
                onClick={() => handleDayClick(dayIdx)}
                className={`w-6 shrink-0 text-[10px] font-bold text-center cursor-pointer transition-colors ${
                  expandedDay === dayIdx && expandedHour === null
                    ? "text-emerald-400"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {DAY_LABELS[dayIdx]}
              </button>

              {/* Hour cells */}
              {row.map((cell, hour) => (
                <div
                  key={hour}
                  className={`flex-1 h-7 mx-[1px] rounded-[3px] flex items-center justify-center cursor-pointer transition-all relative ${
                    expandedDay === dayIdx && (expandedHour === null || expandedHour === hour)
                      ? "ring-1 ring-emerald-400/50"
                      : ""
                  }`}
                  style={{ backgroundColor: getCellColor(cell) }}
                  onMouseEnter={(e) => handleMouseEnter(dayIdx, hour, e)}
                  onMouseLeave={() => setHoveredCell(null)}
                  onClick={() => handleCellClick(dayIdx, hour)}
                >
                  {cell.tradeCount > 0 && (
                    <span
                      className={`text-[8px] font-mono font-bold leading-none ${
                        cell.totalPnlUsd >= 0 ? "text-emerald-100" : "text-rose-100"
                      }`}
                    >
                      {formatUsdSigned(cell.totalPnlUsd)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}

          {/* Current time indicator */}
          <div className="flex items-center mt-1">
            <div className="w-6 shrink-0" />
            {HOUR_LABELS.map((_, i) => {
              const now = new Date();
              const isCurrentHour = now.getHours() === i;
              return (
                <div key={i} className="flex-1 flex justify-center">
                  {isCurrentHour && (
                    <div className="flex flex-col items-center">
                      <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-b-[4px] border-l-transparent border-r-transparent border-b-purple-400" />
                      <span className="text-[8px] text-purple-400 font-mono font-bold">
                        {now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
          <div className="bg-[#0f0f1e] border border-[#3a3a5a] rounded-lg px-3 py-2 shadow-xl min-w-[180px]">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock size={11} className="text-gray-400" />
              <span
                className={`text-sm font-bold font-mono ${
                  hoveredData.totalPnlUsd >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {formatUsdSigned(hoveredData.totalPnlUsd)}
              </span>
              <span className="text-[10px] text-gray-400">
                over {hoveredData.tradeCount} trade{hoveredData.tradeCount !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="text-[10px] text-gray-400">
              {DAY_FULL[hoveredCell.day]} {formatHourRange(hoveredCell.hour)} ·{" "}
              {hoveredData.tradeCount > 0
                ? `${Math.round((hoveredData.wins / hoveredData.tradeCount) * 100)}% win rate`
                : "—"}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Stats Bar */}
      {summaryStats.totalTrades > 0 && (
        <div className="px-4 py-2.5 border-t border-[#2a2a4a] flex flex-wrap items-center gap-3 text-[11px]">
          {summaryStats.worstCell && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-500/10 border border-rose-500/20 rounded-md">
              <TrendingDown size={12} className="text-rose-400" />
              <span className="text-rose-300 font-medium">
                Worst hour · {DAY_FULL[summaryStats.worstCell.dayIndex].slice(0, 3)}{" "}
                {summaryStats.worstCell.hour === 0
                  ? "12 AM"
                  : summaryStats.worstCell.hour < 12
                  ? `${summaryStats.worstCell.hour} AM`
                  : summaryStats.worstCell.hour === 12
                  ? "12 PM"
                  : `${summaryStats.worstCell.hour - 12} PM`}{" "}
                · {formatUsd(summaryStats.worstCell.totalPnlUsd)}
              </span>
            </div>
          )}
          {summaryStats.bestCell && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-md">
              <TrendingUp size={12} className="text-emerald-400" />
              <span className="text-emerald-300 font-medium">
                Best hour · {DAY_FULL[summaryStats.bestCell.dayIndex].slice(0, 3)}{" "}
                {summaryStats.bestCell.hour === 0
                  ? "12 AM"
                  : summaryStats.bestCell.hour < 12
                  ? `${summaryStats.bestCell.hour} AM`
                  : summaryStats.bestCell.hour === 12
                  ? "12 PM"
                  : `${summaryStats.bestCell.hour - 12} PM`}{" "}
                · {formatUsd(summaryStats.bestCell.totalPnlUsd)}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 border border-white/10 rounded-md">
            <Activity size={12} className="text-gray-400" />
            <span className="text-gray-300 font-medium">
              Avg · {formatUsdSigned(summaryStats.avgPerTrade)} / trade
            </span>
          </div>
        </div>
      )}

      {/* Expanded Trade Logs Panel */}
      {expandedDay !== null && expandedTrades.length > 0 && (
        <div className="border-t border-[#2a2a4a] bg-[#12122a]">
          <div className="px-4 py-3">
            {/* Panel Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">
                  {DAY_FULL[expandedDay]}
                  {expandedHour !== null && (
                    <span className="text-gray-400 font-normal">
                      {" "}· {formatHourRange(expandedHour)}
                    </span>
                  )}
                </span>
                <span className="text-[10px] px-2 py-0.5 bg-white/10 text-gray-300 rounded-full">
                  {expandedTrades.length} trade{expandedTrades.length !== 1 ? "s" : ""}
                </span>
              </div>
              <button
                onClick={() => {
                  setExpandedDay(null);
                  setExpandedHour(null);
                }}
                className="text-gray-500 hover:text-white transition-colors p-1"
              >
                <X size={14} />
              </button>
            </div>

            {/* Trade Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[300px] overflow-y-auto pr-1">
              {expandedTrades.map((trade) => {
                const tradeDate = trade.date?.seconds
                  ? new Date(trade.date.seconds * 1000)
                  : new Date(trade.createdAt || Date.now());
                const timeStr = tradeDate.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                });
                const pnlUsd = trade.pnlUsd || (trade.pnlSol || 0) * solPrice;

                return (
                  <div
                    key={trade.id}
                    className={`p-3 rounded-lg border transition-all ${
                      trade.result === "Win"
                        ? "bg-emerald-500/5 border-emerald-500/20"
                        : trade.result === "Loss"
                        ? "bg-rose-500/5 border-rose-500/20"
                        : "bg-white/5 border-white/10"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">
                          {trade.symbol || trade.name || "Unknown"}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                            trade.result === "Win"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : trade.result === "Loss"
                              ? "bg-rose-500/20 text-rose-400"
                              : "bg-white/10 text-gray-400"
                          }`}
                        >
                          {trade.result}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-500 font-mono">{timeStr}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-[10px] text-gray-400">
                        {trade.setupType || "—"}
                      </div>
                      <span
                        className={`text-xs font-mono font-bold ${
                          pnlUsd >= 0 ? "text-emerald-400" : "text-rose-400"
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
