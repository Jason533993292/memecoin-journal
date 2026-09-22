"use client";

import { useMemo, useState } from "react";
import { Trade } from "../lib/types";
import { DEFAULT_GOOD_TAGS } from "./LogTradeModal";
import { X, Calendar, Trophy, AlertTriangle, Sparkles, Copy, Check, TrendingUp, TrendingDown, Share2 } from "lucide-react";
import { useToast } from "./Toast";

interface DailyRecapModalProps {
  isOpen: boolean;
  onClose: () => void;
  trades: Trade[];
  solPrice?: number;
}

export default function DailyRecapModal({
  isOpen,
  onClose,
  trades,
  solPrice = 150,
}: DailyRecapModalProps) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);

  const todaySummary = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const todayTrades = trades.filter((t) => {
      const time = t.date?.seconds ? t.date.seconds * 1000 : t.createdAt || 0;
      return time >= startOfToday;
    });

    const total = todayTrades.length;
    const wins = todayTrades.filter((t) => t.result === "Win");
    const losses = todayTrades.filter((t) => t.result === "Loss");
    const be = todayTrades.filter((t) => t.result === "BE");

    const netPnlSol = todayTrades.reduce((acc, t) => acc + (t.pnlSol || 0), 0);
    const netPnlUsd = todayTrades.reduce(
      (acc, t) => acc + (t.pnlUsd || (t.pnlSol || 0) * solPrice),
      0
    );

    const winRate = total > 0 ? ((wins.length / total) * 100).toFixed(0) : "0";

    // Best & worst trades
    const sortedByPnl = [...todayTrades].sort((a, b) => (b.pnlSol || 0) - (a.pnlSol || 0));
    const bestTrade = sortedByPnl.length > 0 && (sortedByPnl[0].pnlSol || 0) > 0 ? sortedByPnl[0] : null;
    const worstTrade =
      sortedByPnl.length > 0 && (sortedByPnl[sortedByPnl.length - 1].pnlSol || 0) < 0
        ? sortedByPnl[sortedByPnl.length - 1]
        : null;

    // Collect today's mistakes
    const mistakeMap: Record<string, number> = {};
    const goodTagMap: Record<string, number> = {};

    todayTrades.forEach((t) => {
      t.mistakes?.forEach((m) => {
        if (DEFAULT_GOOD_TAGS.includes(m)) {
          goodTagMap[m] = (goodTagMap[m] || 0) + 1;
        } else {
          mistakeMap[m] = (mistakeMap[m] || 0) + 1;
        }
      });
    });

    return {
      todayTrades,
      total,
      winsCount: wins.length,
      lossesCount: losses.length,
      beCount: be.length,
      winRate,
      netPnlSol: parseFloat(netPnlSol.toFixed(2)),
      netPnlUsd: parseFloat(netPnlUsd.toFixed(2)),
      bestTrade,
      worstTrade,
      mistakes: Object.entries(mistakeMap).sort((a, b) => b[1] - a[1]),
      goodTags: Object.entries(goodTagMap).sort((a, b) => b[1] - a[1]),
      dateLabel: now.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    };
  }, [trades, solPrice]);

  if (!isOpen) return null;

  const copyRecapToClipboard = () => {
    const formatted = `📅 MemeCoin Trading Daily Recap — ${todaySummary.dateLabel}
📊 Trades: ${todaySummary.total} (${todaySummary.winsCount}W / ${todaySummary.lossesCount}L / ${todaySummary.beCount}BE)
🎯 Win Rate: ${todaySummary.winRate}%
💰 Net P&L: ${todaySummary.netPnlSol >= 0 ? "+" : ""}${todaySummary.netPnlSol} SOL ($${todaySummary.netPnlUsd.toFixed(2)})
${todaySummary.bestTrade ? `🏆 Best: $${todaySummary.bestTrade.symbol} (+${todaySummary.bestTrade.pnlSol} SOL)` : ""}
${todaySummary.worstTrade ? `💥 Worst: $${todaySummary.worstTrade.symbol} (${todaySummary.worstTrade.pnlSol} SOL)` : ""}
#Solana #Memecoins #TradingJournal`;

    navigator.clipboard.writeText(formatted.trim());
    setCopied(true);
    showToast("Daily summary copied to clipboard!", "success");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-[#e9e9e7] rounded-2xl p-6 w-full max-w-lg shadow-2xl relative text-[#37352f] my-6"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#9b9a97] hover:text-[#37352f] transition-colors p-1 rounded-md hover:bg-[#f1f1ef]"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2.5 mb-5 pb-3.5 border-b border-[#f1f1ef]">
          <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
            <Sparkles size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#37352f]">Daily Trading Recap</h2>
            <p className="text-xs text-[#787774] flex items-center gap-1">
              <Calendar size={11} />
              <span>{todaySummary.dateLabel}</span>
            </p>
          </div>
        </div>

        {todaySummary.total === 0 ? (
          <div className="text-center py-8 space-y-3">
            <span className="text-3xl">☕</span>
            <h3 className="text-sm font-semibold text-[#37352f]">No Trades Logged Today Yet</h3>
            <p className="text-xs text-[#787774] max-w-sm mx-auto">
              Execute your trading plan with discipline. When you close your trades for the day, check back here for your automated recap!
            </p>
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            {/* Net P&L Big Tile */}
            <div
              className={`p-4 rounded-xl border flex items-center justify-between ${
                todaySummary.netPnlSol >= 0
                  ? "bg-emerald-50/70 border-emerald-200 text-emerald-950"
                  : "bg-rose-50/70 border-rose-200 text-rose-950"
              }`}
            >
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider opacity-75">
                  Today's Net Realized
                </span>
                <div className="text-2xl font-mono font-extrabold mt-0.5">
                  {todaySummary.netPnlSol >= 0 ? `+${todaySummary.netPnlSol}` : todaySummary.netPnlSol} SOL
                </div>
                <div className="text-xs font-mono font-medium opacity-85">
                  {todaySummary.netPnlUsd >= 0 ? `+$${todaySummary.netPnlUsd.toFixed(2)}` : `-$${Math.abs(todaySummary.netPnlUsd).toFixed(2)}`} USD
                </div>
              </div>

              <div className="text-right space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider opacity-75 block">
                  Today's Win Rate
                </span>
                <div className="text-lg font-bold">
                  {todaySummary.winRate}%
                </div>
                <div className="text-[11px] opacity-80">
                  {todaySummary.winsCount}W · {todaySummary.lossesCount}L · {todaySummary.beCount}BE
                </div>
              </div>
            </div>

            {/* Highlights: Best vs Worst */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-[#fbfbfa] border border-[#e9e9e7] rounded-xl space-y-1">
                <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                  <Trophy size={11} />
                  <span>Top Winner</span>
                </div>
                {todaySummary.bestTrade ? (
                  <div>
                    <div className="font-bold text-xs text-[#37352f]">
                      ${todaySummary.bestTrade.symbol}
                    </div>
                    <div className="font-mono text-emerald-600 font-semibold text-xs mt-0.5">
                      +{todaySummary.bestTrade.pnlSol} SOL
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-[#9b9a97] italic">None today</p>
                )}
              </div>

              <div className="p-3 bg-[#fbfbfa] border border-[#e9e9e7] rounded-xl space-y-1">
                <div className="flex items-center gap-1 text-[10px] font-bold text-rose-700 uppercase tracking-wider">
                  <AlertTriangle size={11} />
                  <span>Biggest Loss</span>
                </div>
                {todaySummary.worstTrade ? (
                  <div>
                    <div className="font-bold text-xs text-[#37352f]">
                      ${todaySummary.worstTrade.symbol}
                    </div>
                    <div className="font-mono text-rose-600 font-semibold text-xs mt-0.5">
                      {todaySummary.worstTrade.pnlSol} SOL
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-[#9b9a97] italic">None today 🎉</p>
                )}
              </div>
            </div>

            {/* Psychology & Discipline Tags Today */}
            {(todaySummary.goodTags.length > 0 || todaySummary.mistakes.length > 0) && (
              <div className="p-3 bg-[#fbfbfa] border border-[#e9e9e7] rounded-xl space-y-2">
                <h4 className="text-[11px] font-bold text-[#787774] uppercase tracking-wider">
                  Today's Discipline Breakdown
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {todaySummary.goodTags.map(([tag, count]) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200"
                    >
                      ✓ {tag} ({count}x)
                    </span>
                  ))}
                  {todaySummary.mistakes.map(([tag, count]) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-50 text-rose-800 border border-rose-200"
                    >
                      ⚠️ {tag} ({count}x)
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-[#f1f1ef]">
          <button
            onClick={copyRecapToClipboard}
            disabled={todaySummary.total === 0}
            className="px-3.5 py-1.5 bg-[#f7f6f3] hover:bg-[#eeece8] border border-[#e3e2de] text-[#37352f] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40"
          >
            {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
            <span>{copied ? "Copied!" : "Copy Summary"}</span>
          </button>

          <button
            onClick={onClose}
            className="bg-[#2383e2] hover:bg-[#1a73ca] text-white px-4 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
