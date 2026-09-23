"use client";

import { useState, useMemo } from "react";
import { Trade } from "../lib/types";
import { getTradeTimestamp, getTradeDate } from "../lib/utils";
import { DEFAULT_GOOD_TAGS } from "./LogTradeModal";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Sparkles,
  Layers,
  ArrowUpRight,
  ShieldAlert,
  Sliders,
  AlertTriangle,
  ZoomIn,
  Wallet,
  Zap,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Brush,
} from "recharts";

interface EquityCurveCardProps {
  trades: Trade[];
  solPrice?: number;
}

export default function EquityCurveCard({ trades, solPrice = 150 }: EquityCurveCardProps) {
  const [timeframe, setTimeframe] = useState<"all" | "30d" | "7d">("all");
  const [currency, setCurrency] = useState<"SOL" | "USD">("SOL");
  const [chartMode, setChartMode] = useState<"equity" | "underwater">("equity");
  const [curveType, setCurveType] = useState<"pnl" | "balance">("pnl");
  const [startingCapitalSol, setStartingCapitalSol] = useState<number>(10);
  const [showAthLine, setShowAthLine] = useState<boolean>(true);
  const [showMistakes, setShowMistakes] = useState<boolean>(true);
  const [showBrush, setShowBrush] = useState<boolean>(false);

  const { chartData, netPnl, peakPnl, maxDrawdown, winRate, currentBalance } = useMemo(() => {
    const now = Date.now();
    const sorted = [...trades].sort((a, b) => {
      return getTradeTimestamp(a) - getTradeTimestamp(b);
    });

    const filtered = sorted.filter((t) => {
      const time = getTradeTimestamp(t);
      if (timeframe === "7d") return now - time <= 7 * 86400000;
      if (timeframe === "30d") return now - time <= 30 * 86400000;
      return true;
    });

    const baseOffset = curveType === "balance"
      ? (currency === "SOL" ? startingCapitalSol : startingCapitalSol * solPrice)
      : 0;

    let runningPnl = 0;
    let peak = 0;
    let maxDrawdown = 0;

    const data: Array<{
      index: number;
      date: string;
      fullDate: string;
      symbol: string;
      name: string;
      tradePnl: number;
      equity: number;
      ath: number;
      drawdown: number;
      hasMistake: boolean;
      mistakes: string[];
    }> = [
      {
        index: 0,
        date: "Start",
        fullDate: "Baseline Origin",
        symbol: "",
        name: "",
        tradePnl: 0,
        equity: parseFloat(baseOffset.toFixed(2)),
        ath: parseFloat(baseOffset.toFixed(2)),
        drawdown: 0,
        hasMistake: false,
        mistakes: [],
      },
    ];

    const dailyDataMap = new Map<string, {
      date: string;
      fullDate: string;
      tradePnl: number;
      tags: string[];
      hasMistake: boolean;
    }>();

    filtered.forEach((t) => {
      const dateObj = getTradeDate(t);
      const dayKey = dateObj.toLocaleDateString("en-US");
      const label = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const fullDate = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      
      const pnl = currency === "SOL"
        ? (t.pnlSol || 0)
        : (t.pnlUsd !== undefined ? t.pnlUsd : (t.pnlSol || 0) * solPrice);
      
      const mistakesList = t.mistakes || [];
      const badTags = mistakesList.filter((m) => !DEFAULT_GOOD_TAGS.includes(m));
      
      if (dailyDataMap.has(dayKey)) {
        const existing = dailyDataMap.get(dayKey)!;
        existing.tradePnl += pnl;
        existing.tags.push(...mistakesList);
        if (badTags.length > 0) existing.hasMistake = true;
      } else {
        dailyDataMap.set(dayKey, {
          date: label,
          fullDate,
          tradePnl: pnl,
          tags: [...mistakesList],
          hasMistake: badTags.length > 0,
        });
      }
    });

    let index = 1;
    for (const dayData of dailyDataMap.values()) {
      runningPnl += dayData.tradePnl;
      if (runningPnl > peak) peak = runningPnl;
      const currentDd = peak - runningPnl;
      if (currentDd > maxDrawdown) maxDrawdown = currentDd;
      
      const uniqueTags = Array.from(new Set(dayData.tags));
      
      data.push({
        index: index++,
        date: dayData.date,
        fullDate: dayData.fullDate,
        symbol: "",
        name: "Daily Aggregation",
        tradePnl: parseFloat(dayData.tradePnl.toFixed(2)),
        equity: parseFloat((baseOffset + runningPnl).toFixed(2)),
        ath: parseFloat((baseOffset + peak).toFixed(2)),
        drawdown: parseFloat((-currentDd).toFixed(2)),
        hasMistake: dayData.hasMistake,
        mistakes: uniqueTags,
      });
    }

    const winsCount = filtered.filter((t) => (t.pnlSol || 0) > 0).length;
    const wr = filtered.length > 0 ? ((winsCount / filtered.length) * 100).toFixed(0) : "0";

    return {
      chartData: data,
      netPnl: parseFloat(runningPnl.toFixed(2)),
      peakPnl: parseFloat(peak.toFixed(2)),
      maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
      winRate: wr,
      currentBalance: parseFloat((baseOffset + runningPnl).toFixed(2)),
    };
  }, [trades, timeframe, currency, solPrice, curveType, startingCapitalSol]);

  const isPositive = netPnl >= 0;
  const isUnderwater = chartMode === "underwater";
  const strokeColor = isUnderwater ? "#f43f5e" : isPositive ? "#10b981" : "#f43f5e";
  const gradientId = isUnderwater ? "underwaterGradient" : isPositive ? "greenGradient" : "redGradient";

  return (
    <div className="bg-[#fbfbfa] border border-[#e9e9e7] rounded-xl p-4 sm:p-5 shadow-xs flex flex-col space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#f1f1ef]">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-lg border ${isUnderwater ? "bg-rose-50 text-rose-600 border-rose-200" : "bg-blue-50 text-[#2383e2] border-blue-100"}`}>
            {isUnderwater ? <ShieldAlert size={18} /> : <TrendingUp size={18} />}
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#37352f] flex items-center gap-2">
              <span>{isUnderwater ? "Underwater Drawdown Analysis" : curveType === "balance" ? "Total Portfolio Account Value" : "Cumulative Equity Curve"}</span>
              <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-neutral-100 text-[#787774] border border-[#e9e9e7] font-mono tabular-nums">
                {trades.length} trades
              </span>
            </h3>
            <p className="text-[11px] text-[#787774]">
              {isUnderwater
                ? "Depth and duration below All-Time High (ATH) watermark."
                : curveType === "balance"
                ? `Simulated balance starting from ${startingCapitalSol} SOL.`
                : "Realized cumulative profit & loss trajectory over time."}
            </p>
          </div>
        </div>

        {/* Primary Controls */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* Mode Toggle: Equity vs Underwater */}
          <div className="flex items-center gap-0.5 bg-[#f1f1ef] p-0.5 rounded-md text-[11px]">
            <button
              type="button"
              onClick={() => setChartMode("equity")}
              className={`px-2 py-0.5 rounded font-medium transition-all ${
                chartMode === "equity" ? "bg-white text-[#37352f] shadow-xs font-semibold" : "text-[#787774]"
              }`}
            >
              Curve
            </button>
            <button
              type="button"
              onClick={() => setChartMode("underwater")}
              className={`px-2 py-0.5 rounded font-medium transition-all ${
                chartMode === "underwater" ? "bg-white text-rose-600 shadow-xs font-semibold" : "text-[#787774]"
              }`}
            >
              Underwater
            </button>
          </div>

          {/* Curve Type: PnL from 0 vs Account Balance */}
          {!isUnderwater && (
            <div className="flex items-center gap-0.5 bg-[#f1f1ef] p-0.5 rounded-md text-[11px]">
              <button
                type="button"
                onClick={() => setCurveType("pnl")}
                className={`px-2 py-0.5 rounded font-medium transition-all ${
                  curveType === "pnl" ? "bg-white text-[#37352f] shadow-xs font-semibold" : "text-[#787774]"
                }`}
              >
                PnL (0)
              </button>
              <button
                type="button"
                onClick={() => setCurveType("balance")}
                className={`px-2 py-0.5 rounded font-medium transition-all ${
                  curveType === "balance" ? "bg-white text-[#2383e2] shadow-xs font-semibold" : "text-[#787774]"
                }`}
              >
                Balance
              </button>
            </div>
          )}

          {/* Currency Toggle */}
          <div className="flex items-center gap-0.5 bg-[#f1f1ef] p-0.5 rounded-md text-[11px]">
            <button
              type="button"
              onClick={() => setCurrency("SOL")}
              className={`px-2 py-0.5 rounded font-medium transition-all ${
                currency === "SOL" ? "bg-white text-[#37352f] shadow-xs font-semibold" : "text-[#787774]"
              }`}
            >
              SOL
            </button>
            <button
              type="button"
              onClick={() => setCurrency("USD")}
              className={`px-2 py-0.5 rounded font-medium transition-all ${
                currency === "USD" ? "bg-white text-[#37352f] shadow-xs font-semibold" : "text-[#787774]"
              }`}
            >
              USD ($)
            </button>
          </div>

          {/* Timeframe selector */}
          <div className="flex items-center gap-0.5 bg-[#f1f1ef] p-0.5 rounded-md text-[11px]">
            {(["all", "30d", "7d"] as const).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={`px-2 py-0.5 rounded font-medium transition-all ${
                  timeframe === tf ? "bg-white text-[#37352f] shadow-xs font-semibold" : "text-[#787774]"
                }`}
              >
                {tf === "all" ? "All" : tf.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Advanced Analytic Overlay Toggles */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-[#787774]">
        <div className="flex flex-wrap items-center gap-2">
          {/* ATH High-Water Mark Toggle */}
          {!isUnderwater && (
            <button
              type="button"
              onClick={() => setShowAthLine((prev) => !prev)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors flex items-center gap-1.5 ${
                showAthLine
                  ? "bg-amber-50 text-amber-800 border-amber-200"
                  : "bg-white text-[#787774] border-[#e9e9e7] hover:bg-[#f7f6f3]"
              }`}
            >
              <span className={`w-2 h-0.5 ${showAthLine ? "bg-amber-600" : "bg-[#9b9a97]"}`}></span>
              <span>High-Water Mark (ATH)</span>
            </button>
          )}

          {/* Tilt & Mistake Dots Toggle */}
          <button
            type="button"
            onClick={() => setShowMistakes((prev) => !prev)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors flex items-center gap-1.5 ${
              showMistakes
                ? "bg-rose-50 text-rose-800 border-rose-200"
                : "bg-white text-[#787774] border-[#e9e9e7] hover:bg-[#f7f6f3]"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${showMistakes ? "bg-rose-500" : "bg-[#9b9a97]"}`}></span>
            <span>Mistake Dots</span>
          </button>

          {/* Time Scrubber (Brush) Toggle */}
          <button
            type="button"
            onClick={() => setShowBrush((prev) => !prev)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors flex items-center gap-1.5 ${
              showBrush
                ? "bg-blue-50 text-[#2383e2] border-blue-200"
                : "bg-white text-[#787774] border-[#e9e9e7] hover:bg-[#f7f6f3]"
            }`}
          >
            <ZoomIn size={12} />
            <span>Time Scrubber</span>
          </button>
        </div>

        {/* Balance Input if in Balance Mode */}
        {curveType === "balance" && !isUnderwater && (
          <div className="flex items-center gap-1.5 text-[11px]">
            <span>Starting Capital:</span>
            <input
              type="number"
              step="1"
              value={startingCapitalSol}
              onChange={(e) => setStartingCapitalSol(parseFloat(e.target.value) || 0)}
              className="w-16 bg-white border border-[#e3e2de] rounded px-1.5 py-0.5 text-xs font-mono font-semibold text-[#37352f]"
            />
            <span>SOL</span>
          </div>
        )}
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-2.5 bg-white border border-[#e9e9e7] rounded-lg">
          <span className="text-[10px] text-[#787774] block">
            {curveType === "balance" && !isUnderwater ? "Account Balance" : "Net Realized"}
          </span>
          <div className={`text-sm font-mono font-bold tabular-nums mt-0.5 ${netPnl >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {curveType === "balance" && !isUnderwater
              ? `${currentBalance} ${currency}`
              : `${netPnl >= 0 ? `+${netPnl}` : netPnl} ${currency}`}
          </div>
        </div>

        <div className="p-2.5 bg-white border border-[#e9e9e7] rounded-lg">
          <span className="text-[10px] text-[#787774] block">All-Time Peak (ATH)</span>
          <div className="text-sm font-mono font-semibold tabular-nums text-[#37352f] mt-0.5">
            +{peakPnl} {currency}
          </div>
        </div>

        <div className="p-2.5 bg-white border border-[#e9e9e7] rounded-lg">
          <span className="text-[10px] text-[#787774] block">Max Drawdown</span>
          <div className="text-sm font-mono font-semibold tabular-nums text-rose-600 mt-0.5">
            -{maxDrawdown} {currency}
          </div>
        </div>

        <div className="p-2.5 bg-white border border-[#e9e9e7] rounded-lg">
          <span className="text-[10px] text-[#787774] block">Period Win Rate</span>
          <div className="text-sm font-mono font-semibold tabular-nums text-[#37352f] mt-0.5">
            {winRate}%
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-64 sm:h-80 w-full pt-2">
        {trades.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-[#e3e2de] rounded-xl bg-white/50">
            <span className="text-2xl mb-1">📈</span>
            <p className="text-xs font-semibold text-[#37352f]">No Trades to Graph Yet</p>
            <p className="text-[11px] text-[#787774] mt-0.5">Log your trades to see your cumulative equity line come alive.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={strokeColor} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={strokeColor} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0efe9" vertical={false} />
              <XAxis
                dataKey="index"
                stroke="#9b9a97"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: "#e9e9e7" }}
                minTickGap={25}
                tickFormatter={(val) => {
                  const item = chartData.find((d) => d.index === val);
                  return item ? item.date : "";
                }}
              />
              <YAxis
                stroke="#9b9a97"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: "#e9e9e7" }}
                tickFormatter={(val) => `${val}`}
                domain={isUnderwater ? ["dataMin", 0] : ["auto", "auto"]}
              />
              <Tooltip
                cursor={{ stroke: "#525252", strokeWidth: 1, strokeDasharray: "3 3" }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload;
                    return (
                      <div className="bg-neutral-900 text-white text-[11px] p-3 rounded-lg shadow-xl border border-neutral-800 space-y-1.5 min-w-[170px]">
                        <div className="text-neutral-400 text-[10px] font-mono">{item.fullDate}</div>
                        {item.symbol && (
                          <div className="font-semibold text-neutral-100 flex items-center justify-between gap-2">
                            <span>{item.name || item.symbol}</span>
                            <span className="text-neutral-400 font-normal">(${item.symbol})</span>
                          </div>
                        )}
                        {item.tradePnl !== undefined && item.index > 0 && (
                          <div className="text-neutral-300 text-[10px] flex items-center justify-between">
                            <span>Trade P&L:</span>
                            <span className={item.tradePnl >= 0 ? "text-emerald-400 font-mono font-bold" : "text-rose-400 font-mono font-bold"}>
                              {item.tradePnl >= 0 ? `+${item.tradePnl}` : item.tradePnl} {currency}
                            </span>
                          </div>
                        )}
                        {isUnderwater ? (
                          <div className="text-neutral-300 border-t border-neutral-800 pt-1 mt-1 flex items-center justify-between">
                            <span>Drawdown Depth:</span>
                            <span className="text-rose-400 font-mono font-bold">
                              {item.drawdown} {currency}
                            </span>
                          </div>
                        ) : (
                          <>
                            <div className="text-neutral-300 border-t border-neutral-800 pt-1 mt-1 flex items-center justify-between">
                              <span>{curveType === "balance" ? "Account Balance:" : "Total Equity:"}</span>
                              <span className={item.equity >= 0 ? "text-emerald-400 font-mono font-bold" : "text-rose-400 font-mono font-bold"}>
                                {item.equity >= 0 ? `+${item.equity}` : item.equity} {currency}
                              </span>
                            </div>
                            {showAthLine && (
                              <div className="text-neutral-400 text-[10px] flex items-center justify-between">
                                <span>High-Water (ATH):</span>
                                <span className="font-mono text-amber-400">{item.ath} {currency}</span>
                              </div>
                            )}
                          </>
                        )}

                        {/* Tags Alert in Tooltip */}
                        {item.mistakes && item.mistakes.length > 0 && (
                          <div className="border-t border-neutral-800 pt-1 mt-1 flex flex-col gap-1">
                            {[...item.mistakes].sort((a, b) => {
                              const aIsGood = DEFAULT_GOOD_TAGS.includes(a) || a.toLowerCase().includes("good") || a.toLowerCase().includes("profit") || a.toLowerCase().includes("win");
                              const bIsGood = DEFAULT_GOOD_TAGS.includes(b) || b.toLowerCase().includes("good") || b.toLowerCase().includes("profit") || b.toLowerCase().includes("win");
                              if (aIsGood && !bIsGood) return -1;
                              if (!aIsGood && bIsGood) return 1;
                              return 0;
                            }).map((tag: string, idx: number) => {
                              const isGood = DEFAULT_GOOD_TAGS.includes(tag) || tag.toLowerCase().includes("good") || tag.toLowerCase().includes("profit") || tag.toLowerCase().includes("win");
                              return (
                                <div key={idx} className={`${isGood ? "text-emerald-400" : "text-rose-400"} text-[10px] flex items-start gap-1`}>
                                  <span className="shrink-0">{isGood ? "✅" : "⚠️"}</span>
                                  <span>{tag}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <ReferenceLine y={0} stroke="#d3d1cb" strokeWidth={1} />

              {/* Area Curve */}
              <Area
                type="monotone"
                dataKey={isUnderwater ? "drawdown" : "equity"}
                stroke={strokeColor}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  if (!payload || payload.index === 0) return <g key={props.key || Math.random()} />;
                  if (showMistakes && payload.hasMistake) {
                    return (
                      <circle
                        key={`mistake-dot-${payload.index}`}
                        cx={cx}
                        cy={cy}
                        r={4.5}
                        fill="#f43f5e"
                        stroke="#ffffff"
                        strokeWidth={1.5}
                      />
                    );
                  }
                  return <g key={props.key || Math.random()} />;
                }}
                activeDot={{ r: 5, fill: strokeColor, stroke: "#ffffff", strokeWidth: 2 }}
              />

              {/* High-Water Mark (ATH) Step Line */}
              {showAthLine && !isUnderwater && (
                <Line
                  type="stepAfter"
                  dataKey="ath"
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                  isAnimationActive={false}
                />
              )}

              {/* Granular Time Scrubber (Brush) */}
              {showBrush && chartData.length > 3 && (
                <Brush
                  dataKey="index"
                  height={24}
                  stroke="#2383e2"
                  fill="#f7f6f3"
                  tickFormatter={(val) => {
                    const item = chartData.find((d) => d.index === val);
                    return item ? item.date : "";
                  }}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
