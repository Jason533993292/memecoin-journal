"use client";

import { useState, useMemo } from "react";
import { Trade } from "../lib/types";
import { TrendingUp, TrendingDown, DollarSign, Sparkles, Layers, ArrowUpRight } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

interface EquityCurveCardProps {
  trades: Trade[];
  solPrice?: number;
}

export default function EquityCurveCard({ trades, solPrice = 150 }: EquityCurveCardProps) {
  const [timeframe, setTimeframe] = useState<"all" | "30d" | "7d">("all");
  const [currency, setCurrency] = useState<"SOL" | "USD">("SOL");

  const { chartData, netPnl, peakPnl, troughPnl, winRate } = useMemo(() => {
    const now = Date.now();
    const sorted = [...trades].sort((a, b) => {
      const timeA = a.date?.seconds ? a.date.seconds * 1000 : a.createdAt || 0;
      const timeB = b.date?.seconds ? b.date.seconds * 1000 : b.createdAt || 0;
      return timeA - timeB;
    });

    const filtered = sorted.filter((t) => {
      const time = t.date?.seconds ? t.date.seconds * 1000 : t.createdAt || 0;
      if (timeframe === "7d") return now - time <= 7 * 86400000;
      if (timeframe === "30d") return now - time <= 30 * 86400000;
      return true;
    });

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
    }> = [
      {
        index: 0,
        date: "Start",
        fullDate: "Initial",
        symbol: "",
        name: "",
        tradePnl: 0,
        equity: 0,
      },
    ];

    filtered.forEach((t, i) => {
      const pnl = currency === "SOL" ? (t.pnlSol || 0) : (t.pnlUsd || (t.pnlSol || 0) * solPrice);
      runningPnl += pnl;
      
      if (runningPnl > peak) peak = runningPnl;
      const drawdown = peak - runningPnl;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;

      const dateObj = t.date?.seconds ? new Date(t.date.seconds * 1000) : new Date(t.createdAt || now);
      const label = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const fullDate = dateObj.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

      data.push({
        index: i + 1,
        date: label,
        fullDate,
        symbol: t.symbol || "MEME",
        name: t.name || "",
        tradePnl: parseFloat(pnl.toFixed(2)),
        equity: parseFloat(runningPnl.toFixed(2)),
      });
    });

    const winsCount = filtered.filter((t) => (t.pnlSol || 0) > 0).length;
    const wr = filtered.length > 0 ? ((winsCount / filtered.length) * 100).toFixed(0) : "0";

    return {
      chartData: data,
      netPnl: parseFloat(runningPnl.toFixed(2)),
      peakPnl: parseFloat(peak.toFixed(2)),
      maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
      winRate: wr,
    };
  }, [trades, timeframe, currency, solPrice]);

  const isPositive = netPnl >= 0;
  const strokeColor = isPositive ? "#10b981" : "#f43f5e";
  const gradientId = `equityGradient-${currency}-${timeframe}`;

  return (
    <div className="bg-[#fbfbfa] border border-[#e9e9e7] rounded-xl p-5 shadow-xs flex flex-col space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#f1f1ef]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-50 text-[#2383e2] border border-blue-100">
            <TrendingUp size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#37352f] flex items-center gap-2">
              <span>Cumulative Equity Curve</span>
              <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-neutral-100 text-[#787774] border border-[#e9e9e7]">
                {trades.length} trades recorded
              </span>
            </h3>
            <p className="text-[11px] text-[#787774]">Track total portfolio trajectory and drawdown velocity.</p>
          </div>
        </div>

        {/* Filters: Timeframe & Currency */}
        <div className="flex items-center gap-2">
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
                {tf === "all" ? "All Time" : tf.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-2.5 bg-white border border-[#e9e9e7] rounded-lg">
          <span className="text-[10px] text-[#787774] block">Net Realized</span>
          <div className={`text-sm font-mono font-bold mt-0.5 ${netPnl >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {netPnl >= 0 ? `+${netPnl}` : netPnl} {currency}
          </div>
        </div>

        <div className="p-2.5 bg-white border border-[#e9e9e7] rounded-lg">
          <span className="text-[10px] text-[#787774] block">All-Time Peak (ATH)</span>
          <div className="text-sm font-mono font-semibold text-[#37352f] mt-0.5">
            +{peakPnl} {currency}
          </div>
        </div>

        <div className="p-2.5 bg-white border border-[#e9e9e7] rounded-lg">
          <span className="text-[10px] text-[#787774] block">Max Drawdown</span>
          <div className="text-sm font-mono font-semibold text-rose-600 mt-0.5">
            -{maxDrawdown} {currency}
          </div>
        </div>

        <div className="p-2.5 bg-white border border-[#e9e9e7] rounded-lg">
          <span className="text-[10px] text-[#787774] block">Period Win Rate</span>
          <div className="text-sm font-mono font-semibold text-[#37352f] mt-0.5">
            {winRate}%
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-60 sm:h-72 w-full pt-2">
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
                dataKey="date"
                stroke="#9b9a97"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: "#e9e9e7" }}
                minTickGap={30}
              />
              <YAxis
                stroke="#9b9a97"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: "#e9e9e7" }}
                tickFormatter={(val) => `${val}`}
                domain={["auto", "auto"]}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload;
                    return (
                      <div className="bg-neutral-900 text-white text-[11px] p-2.5 rounded-lg shadow-xl border border-neutral-800 space-y-1">
                        <div className="text-neutral-400 text-[10px] font-mono">{item.fullDate}</div>
                        {item.symbol && (
                          <div className="font-semibold text-neutral-100 flex items-center gap-1">
                            <span>{item.name || item.symbol}</span>
                            <span className="text-neutral-400 font-normal">(${item.symbol})</span>
                          </div>
                        )}
                        {item.tradePnl !== undefined && item.index > 0 && (
                          <div className="text-neutral-300 text-[10px]">
                            Trade P&L:{" "}
                            <span className={item.tradePnl >= 0 ? "text-emerald-400 font-mono font-bold" : "text-rose-400 font-mono font-bold"}>
                              {item.tradePnl >= 0 ? `+${item.tradePnl}` : item.tradePnl} {currency}
                            </span>
                          </div>
                        )}
                        <div className="text-neutral-300 border-t border-neutral-800 pt-1 mt-1">
                          Total Equity:{" "}
                          <span className={item.equity >= 0 ? "text-emerald-400 font-mono font-bold" : "text-rose-400 font-mono font-bold"}>
                            {item.equity >= 0 ? `+${item.equity}` : item.equity} {currency}
                          </span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <ReferenceLine y={0} stroke="#9b9a97" strokeDasharray="3 3" opacity={0.5} />
              <Area
                type="monotone"
                dataKey="equity"
                stroke={strokeColor}
                strokeWidth={2.5}
                fillOpacity={1}
                fill={`url(#${gradientId})`}
                dot={{ r: 3.5, fill: strokeColor, strokeWidth: 2, stroke: "#fff" }}
                activeDot={{ r: 6, fill: strokeColor, stroke: "#fff", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
