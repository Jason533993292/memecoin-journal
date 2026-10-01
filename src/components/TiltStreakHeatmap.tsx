"use client";

import { useMemo } from "react";
import { Trade } from "../lib/types";
import { getTradeDate, getLocalDayKey } from "../lib/utils";
import { AlertTriangle, Calendar } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLocalStorageValue, writeLocalStorageValue } from "../lib/useLocalStorage";
import { getUsdValueStatus } from "../lib/tradeCalculations";

interface TiltStreakHeatmapProps {
  trades: Trade[];
  solPrice?: number;
}

export default function TiltStreakHeatmap({ trades, solPrice = 150 }: TiltStreakHeatmapProps) {
  const { user } = useAuth();
  const currencyStorageKey = user ? "memecoin_journal_" + user.uid + "_calendar_currency" : "calendar_currency";
  const storedCurrency = useLocalStorageValue(currencyStorageKey);
  const currency = storedCurrency === "USD" ? storedCurrency : "SOL";

  const handleCurrencyChange = (c: "SOL" | "USD") => {
    if (user) writeLocalStorageValue(currencyStorageKey, c);
  };

  // Pre-bucket all trades by local day key in O(N) single pass
  const dailyBuckets = useMemo(() => {
    const map = new Map<string, Trade[]>();
    trades.forEach((t) => {
      const dateObj = getTradeDate(t);
      const key = getLocalDayKey(dateObj);
      const list = map.get(key) || [];
      list.push(t);
      map.set(key, list);
    });
    return map;
  }, [trades]);

  // Calculate 28-Day Breakdown & Streaks using calendar arithmetic (DST-safe)
  const { heatmapData, monthlyProfitInfo, todayLosses, isTiltAlert } = useMemo(() => {
    const days = [];
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let monthPnlSol = 0;
    let monthPnlUsd = 0;

    for (let i = 27; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 12, 0, 0);
      const dayKey = getLocalDayKey(d);
      const dayTrades = dailyBuckets.get(dayKey) || [];

      const wins = dayTrades.filter((t) => t.result === "Win").length;
      const losses = dayTrades.filter((t) => t.result === "Loss").length;
      const pnlSol = dayTrades.reduce((acc, t) => acc + (t.pnlSol || 0), 0);
      const pnlUsd = dayTrades.reduce((acc, trade) => acc + (getUsdValueStatus(trade, solPrice).value ?? 0), 0);
      days.push({
        date: d,
        dayKey,
        dayLabel: d.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" }),
        tradeCount: dayTrades.length,
        wins,
        losses,
        pnlSol: parseFloat(pnlSol.toFixed(2)),
        pnlUsd: parseFloat(pnlUsd.toFixed(2)),
      });
    }

    // Monthly profit from all trades
    trades.forEach((t) => {
      const dateObj = getTradeDate(t);
      if (dateObj.getMonth() === currentMonth && dateObj.getFullYear() === currentYear) {
        monthPnlSol += t.pnlSol || 0;
        monthPnlUsd += getUsdValueStatus(t, solPrice).value ?? 0;
      }
    });

    // Compute actual streak logic (consecutive active trading days)
    let currentStreak = 0;
    let streakType: "win" | "loss" | "none" = "none";
    let maxWinStreak = 0;
    let maxLossStreak = 0;

    // Scan backwards from today to find current active day streak
    for (let i = days.length - 1; i >= 0; i--) {
      const d = days[i];
      if (d.tradeCount === 0) continue;
      if (d.pnlSol > 0) {
        if (streakType === "none" || streakType === "win") {
          streakType = "win";
          currentStreak++;
        } else {
          break;
        }
      } else if (d.pnlSol < 0) {
        if (streakType === "none" || streakType === "loss") {
          streakType = "loss";
          currentStreak++;
        } else {
          break;
        }
      } else {
        break;
      }
    }

    // Scan forward for best streaks
    let runningWin = 0;
    let runningLoss = 0;
    days.forEach((d) => {
      if (d.tradeCount > 0) {
        if (d.pnlSol > 0) {
          runningWin++;
          runningLoss = 0;
          if (runningWin > maxWinStreak) maxWinStreak = runningWin;
        } else if (d.pnlSol < 0) {
          runningLoss++;
          runningWin = 0;
          if (runningLoss > maxLossStreak) maxLossStreak = runningLoss;
        } else {
          runningWin = 0;
          runningLoss = 0;
        }
      }
    });

    const todayKey = getLocalDayKey(now);
    const todayTrades = dailyBuckets.get(todayKey) || [];
    const tLosses = todayTrades.filter((t) => t.result === "Loss").length;

    return {
      heatmapData: days,
      streakInfo: { currentStreak, streakType, maxWinStreak, maxLossStreak },
      monthlyProfitInfo: {
        pnlSol: monthPnlSol,
        pnlUsd: monthPnlUsd,
      },
      todayLosses: tLosses,
      isTiltAlert: tLosses >= 3,
    };
  }, [trades, dailyBuckets, solPrice]);

  // Format value based on currency
  const formatDayPnl = (day: { pnlSol: number; pnlUsd: number; tradeCount: number }) => {
    if (day.tradeCount === 0) return "—";

    if (currency === "SOL") {
      const val = day.pnlSol;
      return val > 0 ? `+${val.toFixed(2)}` : `${val.toFixed(2)}`;
    }
    if (currency === "USD") {
      const val = day.pnlUsd;
      return val > 0 ? `+$${val.toFixed(2)}` : val < 0 ? `-$${Math.abs(val).toFixed(2)}` : `$0.00`;
    }
    return "—";
  };

  return (
    <div className="bg-[#fbfbfa] border border-[#e9e9e7] rounded-xl p-5 shadow-xs space-y-4">
      {/* Header with Streak Counters & Currency Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#e9e9e7]">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-[#2383e2]" />
          <div>
            <h3 className="text-xs font-bold text-[#37352f]">28-Day Trading Calendar & Tilt Heatmap</h3>
            <p className="text-[11px] text-[#787774]">Daily profit/loss clusters and discipline monitoring.</p>
          </div>
        </div>

        {/* Currency Switcher & Monthly Profit */}
        <div className="flex items-center gap-3">
          {/* Currency Toggle */}
          <div className="flex items-center gap-0.5 bg-[#f1f1ef] p-0.5 rounded-lg border border-[#e3e2de] text-[11px]">
            <button
              type="button"
              onClick={() => handleCurrencyChange("SOL")}
              className={`px-2.5 py-0.5 rounded-md font-semibold transition-all ${
                currency === "SOL"
                  ? "bg-white text-[#37352f] shadow-xs"
                  : "text-[#787774] hover:text-[#37352f]"
              }`}
            >
              SOL
            </button>
            <button
              type="button"
              onClick={() => handleCurrencyChange("USD")}
              className={`px-2.5 py-0.5 rounded-md font-semibold transition-all ${
                currency === "USD"
                  ? "bg-white text-[#37352f] shadow-xs"
                  : "text-[#787774] hover:text-[#37352f]"
              }`}
            >
              USD ($)
            </button>
          </div>

          {/* Monthly Profit */}
          <div className="flex items-center gap-1.5 px-3 py-1 bg-white border border-[#e9e9e7] rounded-full font-bold shadow-xs">
            <span className="text-[10px] text-[#787774] font-medium mr-1 uppercase">Month P&L</span>
            <span
              className={
                currency === "SOL"
                  ? monthlyProfitInfo.pnlSol >= 0 ? "text-emerald-600" : "text-rose-600"
                  : monthlyProfitInfo.pnlUsd >= 0 ? "text-emerald-600" : "text-rose-600"
              }
            >
              {currency === "SOL"
                ? `${monthlyProfitInfo.pnlSol >= 0 ? "+" : ""}${monthlyProfitInfo.pnlSol.toFixed(2)} SOL`
                : `${monthlyProfitInfo.pnlUsd >= 0 ? "+$" : "-$"}${Math.abs(monthlyProfitInfo.pnlUsd).toFixed(2)}`}
            </span>
          </div>
        </div>
      </div>

      {/* Tilt Warning Banner if 3+ losses in session */}
      {isTiltAlert && (
        <div className="p-3.5 bg-rose-100/80 border border-rose-300 rounded-lg flex items-center gap-3 text-rose-900 animate-in fade-in duration-200">
          <AlertTriangle size={20} className="text-rose-600 shrink-0" />
          <div className="text-xs">
            <strong className="block font-bold">⚠️ TILT LIMIT REACHED TODAY ({todayLosses} Losses)</strong>
            <span>Rule: Max 3 losses per session. Step away from the charts, close BullX/Photon, and reset your mind.</span>
          </div>
        </div>
      )}

      {/* 28-Day Grid Squares using valid arbitrary Tailwind grid template */}
      <div>
        <div className="grid grid-cols-7 sm:grid-cols-[repeat(14,minmax(0,1fr))] gap-2">
          {heatmapData.map((day) => {
            const hasTrades = day.tradeCount > 0;
            const isGreen = day.pnlSol > 0;
            const isRed = day.pnlSol < 0;

            const tooltipText = `${day.dayLabel}: ${day.tradeCount} trade${day.tradeCount > 1 ? "s" : ""} | ${day.pnlSol >= 0 ? `+${day.pnlSol}` : day.pnlSol} SOL (${day.pnlUsd >= 0 ? "+$" : "-$"}${Math.abs(day.pnlUsd).toFixed(2)})`;

            return (
              <div
                key={day.dayKey}
                title={tooltipText}
                className={`group relative rounded-lg p-2 flex flex-col justify-between border transition-all text-center h-14 ${
                  !hasTrades
                    ? "bg-white border-[#e9e9e7] text-[#9b9a97] opacity-60"
                    : isGreen
                    ? "bg-emerald-50/80 border-emerald-300 text-emerald-900 shadow-xs hover:border-emerald-500"
                    : isRed
                    ? "bg-rose-50/80 border-rose-300 text-rose-900 shadow-xs hover:border-rose-500"
                    : "bg-neutral-100 border-neutral-300 text-neutral-800"
                }`}
              >
                <span className="text-[10px] font-mono block opacity-70">
                  {day.date.getDate()}
                </span>
                <span className="text-[11px] font-mono font-bold truncate">
                  {formatDayPnl(day)}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between text-[10px] text-[#9b9a97] pt-2">
          <span>28 days ago</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-emerald-200 border border-emerald-400"></span> Green Day
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-rose-200 border border-rose-400"></span> Red Day
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-white border border-neutral-300"></span> Inactive
            </span>
          </div>
          <span>Today</span>
        </div>
      </div>
    </div>
  );
}
