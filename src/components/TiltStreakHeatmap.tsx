"use client";

import { useState, useMemo, useEffect } from "react";
import { Trade } from "../lib/types";
import { Flame, Snowflake, AlertTriangle, ShieldCheck, Calendar, DollarSign, Euro } from "lucide-react";

interface TiltStreakHeatmapProps {
  trades: Trade[];
  solPrice?: number;
}

export default function TiltStreakHeatmap({ trades, solPrice = 150 }: TiltStreakHeatmapProps) {
  const [currency, setCurrency] = useState<"SOL" | "USD" | "EUR">("SOL");
  const USD_TO_EUR = 0.92; // Approx current EUR/USD rate

  const getLocalDayKey = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem("memecoin_journal_calendar_currency");
      if (saved === "SOL" || saved === "USD" || saved === "EUR") {
        setCurrency(saved);
      }
    } catch (e) {}
  }, []);

  const handleCurrencyChange = (c: "SOL" | "USD" | "EUR") => {
    setCurrency(c);
    try {
      localStorage.setItem("memecoin_journal_calendar_currency", c);
    } catch (e) {}
  };

  // 1. Calculate Daily Breakdown for the last 28 days (4 weeks)
  const heatmapData = useMemo(() => {
    const days = [];
    const now = new Date();
    now.setHours(23, 59, 59, 999);

    for (let i = 27; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayKey = getLocalDayKey(d);

      // Find trades on this day
      const dayTrades = trades.filter((t) => {
        const tradeDate = t.date?.seconds
          ? new Date(t.date.seconds * 1000)
          : new Date(t.createdAt || Date.now());
        return getLocalDayKey(tradeDate) === dayKey;
      });

      const wins = dayTrades.filter((t) => t.result === "Win").length;
      const losses = dayTrades.filter((t) => t.result === "Loss").length;
      const pnlSol = dayTrades.reduce((acc, t) => acc + (t.pnlSol || 0), 0);
      const pnlUsd = dayTrades.reduce((acc, t) => acc + (t.pnlUsd || (t.pnlSol || 0) * solPrice), 0);
      const pnlEur = pnlUsd * USD_TO_EUR;

      days.push({
        date: d,
        dayKey,
        dayLabel: d.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" }),
        tradeCount: dayTrades.length,
        wins,
        losses,
        pnlSol: parseFloat(pnlSol.toFixed(2)),
        pnlUsd: parseFloat(pnlUsd.toFixed(2)),
        pnlEur: parseFloat(pnlEur.toFixed(2)),
      });
    }

    return days;
  }, [trades, solPrice]);

  // 2. Calculate Monthly Profit
  const monthlyProfitInfo = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let pnlSol = 0;
    let pnlUsd = 0;
    let pnlEur = 0;

    trades.forEach((t) => {
      const tradeDate = t.date?.seconds
        ? new Date(t.date.seconds * 1000)
        : new Date(t.createdAt || Date.now());
      
      if (tradeDate.getMonth() === currentMonth && tradeDate.getFullYear() === currentYear) {
        pnlSol += t.pnlSol || 0;
        pnlUsd += t.pnlUsd || (t.pnlSol || 0) * solPrice;
      }
    });
    pnlEur = pnlUsd * USD_TO_EUR;

    return { pnlSol, pnlUsd, pnlEur };
  }, [trades, solPrice]);

  // 3. Check for Today's Tilt Warning (>= 3 losses today)
  const todayKey = getLocalDayKey(new Date());
  const todayTrades = trades.filter((t) => {
    const tradeDate = t.date?.seconds
      ? new Date(t.date.seconds * 1000)
      : new Date(t.createdAt || Date.now());
    return getLocalDayKey(tradeDate) === todayKey;
  });

  const todayLosses = todayTrades.filter((t) => t.result === "Loss").length;
  const isTiltAlert = todayLosses >= 3;

  // Format value based on currency
  const formatDayPnl = (day: { pnlSol: number; pnlUsd: number; pnlEur: number; tradeCount: number }) => {
    if (day.tradeCount === 0) return "—";

    if (currency === "SOL") {
      const val = day.pnlSol;
      return val > 0 ? `+${val.toFixed(2)}` : `${val.toFixed(2)}`;
    }
    if (currency === "USD") {
      const val = day.pnlUsd;
      return val > 0 ? `+$${val.toFixed(2)}` : val < 0 ? `-$${Math.abs(val).toFixed(2)}` : `$0.00`;
    }
    if (currency === "EUR") {
      const val = day.pnlEur;
      return val > 0 ? `+€${val.toFixed(2)}` : val < 0 ? `-€${Math.abs(val).toFixed(2)}` : `€0.00`;
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

        {/* Currency Switcher & Streak Pill */}
        <div className="flex items-center gap-3">
          {/* Currency Toggle (SOL - USD - EUR) */}
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
            <button
              type="button"
              onClick={() => handleCurrencyChange("EUR")}
              className={`px-2.5 py-0.5 rounded-md font-semibold transition-all ${
                currency === "EUR"
                  ? "bg-white text-[#37352f] shadow-xs"
                  : "text-[#787774] hover:text-[#37352f]"
              }`}
            >
              EUR (€)
            </button>
          </div>

          {/* Monthly Profit */}
          <div className="flex items-center gap-1.5 px-3 py-1 bg-white border border-[#e9e9e7] rounded-full font-bold shadow-xs">
            <span className="text-[10px] text-[#787774] font-medium mr-1 uppercase">Month P&L</span>
            <span
              className={
                currency === "SOL"
                  ? monthlyProfitInfo.pnlSol >= 0 ? "text-emerald-600" : "text-rose-600"
                  : currency === "USD"
                  ? monthlyProfitInfo.pnlUsd >= 0 ? "text-emerald-600" : "text-rose-600"
                  : monthlyProfitInfo.pnlEur >= 0 ? "text-emerald-600" : "text-rose-600"
              }
            >
              {currency === "SOL"
                ? `${monthlyProfitInfo.pnlSol >= 0 ? "+" : ""}${monthlyProfitInfo.pnlSol.toFixed(2)} SOL`
                : currency === "USD"
                ? `${monthlyProfitInfo.pnlUsd >= 0 ? "+$" : "-$"}${Math.abs(monthlyProfitInfo.pnlUsd).toFixed(2)}`
                : `${monthlyProfitInfo.pnlEur >= 0 ? "+€" : "-€"}${Math.abs(monthlyProfitInfo.pnlEur).toFixed(2)}`}
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

      {/* 28-Day Grid Squares */}
      <div>
        <div className="grid grid-cols-7 sm:grid-cols-14 gap-2">
          {heatmapData.map((day) => {
            const hasTrades = day.tradeCount > 0;
            const isGreen = day.pnlSol > 0;
            const isRed = day.pnlSol < 0;

            const tooltipText = `${day.dayLabel}: ${day.tradeCount} trade${day.tradeCount > 1 ? "s" : ""} | ${day.pnlSol >= 0 ? `+${day.pnlSol}` : day.pnlSol} SOL ($${day.pnlUsd >= 0 ? `+${day.pnlUsd}` : day.pnlUsd} / €${day.pnlEur >= 0 ? `+${day.pnlEur}` : day.pnlEur})`;

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
