"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Trade } from "../lib/types";
import { getUsdValueStatus } from "../lib/tradeCalculations";
import { useLocalStorageValue, writeLocalStorageValue } from "../lib/useLocalStorage";
import { getLocalDayKey, getTradeDate } from "../lib/utils";

interface TiltStreakHeatmapProps {
  trades: Trade[];
  solPrice?: number;
  onSelectTrade?: (trade: Trade) => void;
}

type CalendarDay = {
  date: Date;
  dayKey: string;
  dayLabel: string;
  tradeCount: number;
  pnlSol: number;
  pnlUsd: number;
};

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function TiltStreakHeatmap({ trades, solPrice = 150, onSelectTrade }: TiltStreakHeatmapProps) {
  const { user } = useAuth();
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const todayKey = getLocalDayKey(currentDate);
  const [visibleMonth, setVisibleMonth] = useState(() => ({ year: currentYear, month: currentMonth }));
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  const currencyStorageKey = user ? `memecoin_journal_${user.uid}_calendar_currency` : "calendar_currency";
  const storedCurrency = useLocalStorageValue(currencyStorageKey);
  const currency = storedCurrency === "USD" ? storedCurrency : "SOL";

  const handleCurrencyChange = (nextCurrency: "SOL" | "USD") => {
    if (user) writeLocalStorageValue(currencyStorageKey, nextCurrency);
  };

  const dailyBuckets = useMemo(() => {
    const buckets = new Map<string, Trade[]>();
    trades.forEach((trade) => {
      const key = getLocalDayKey(getTradeDate(trade));
      buckets.set(key, [...(buckets.get(key) ?? []), trade]);
    });
    return buckets;
  }, [trades]);

  const { calendarDays, leadingBlankDays, monthlyProfitInfo, todayLosses, isTiltAlert } = useMemo(() => {
    const firstDay = new Date(visibleMonth.year, visibleMonth.month, 1, 12);
    const numberOfDays = new Date(visibleMonth.year, visibleMonth.month + 1, 0, 12).getDate();
    const days: CalendarDay[] = [];
    let monthPnlSol = 0;
    let monthPnlUsd = 0;

    for (let dayNumber = 1; dayNumber <= numberOfDays; dayNumber += 1) {
      const date = new Date(visibleMonth.year, visibleMonth.month, dayNumber, 12);
      const dayKey = getLocalDayKey(date);
      const dayTrades = dailyBuckets.get(dayKey) ?? [];
      const pnlSol = dayTrades.reduce((total, trade) => total + (trade.pnlSol || 0), 0);
      const pnlUsd = dayTrades.reduce(
        (total, trade) => total + (getUsdValueStatus(trade, solPrice).value ?? 0),
        0,
      );

      monthPnlSol += pnlSol;
      monthPnlUsd += pnlUsd;
      days.push({
        date,
        dayKey,
        dayLabel: date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
        tradeCount: dayTrades.length,
        pnlSol,
        pnlUsd,
      });
    }

    const todayTrades = dailyBuckets.get(todayKey) ?? [];
    const lossesToday = todayTrades.filter((trade) => trade.result === "Loss").length;

    return {
      calendarDays: days,
      leadingBlankDays: firstDay.getDay(),
      monthlyProfitInfo: { pnlSol: monthPnlSol, pnlUsd: monthPnlUsd },
      todayLosses: lossesToday,
      isTiltAlert: lossesToday >= 3,
    };
  }, [dailyBuckets, solPrice, todayKey, visibleMonth]);

  const isCurrentMonth = visibleMonth.year === currentYear && visibleMonth.month === currentMonth;
  const monthLabel = new Date(visibleMonth.year, visibleMonth.month, 1, 12).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const changeMonth = (offset: number) => {
    setSelectedDayKey(null);
    setVisibleMonth((current) => {
      const next = new Date(current.year, current.month + offset, 1, 12);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  const formatDayPnl = (day: CalendarDay) => {
    if (day.tradeCount === 0) return "—";
    if (currency === "SOL") return `${day.pnlSol > 0 ? "+" : ""}${day.pnlSol.toFixed(2)}`;
    return day.pnlUsd > 0
      ? `+$${day.pnlUsd.toFixed(2)}`
      : day.pnlUsd < 0
        ? `−$${Math.abs(day.pnlUsd).toFixed(2)}`
        : "$0.00";
  };

  const monthlyPnl = currency === "SOL" ? monthlyProfitInfo.pnlSol : monthlyProfitInfo.pnlUsd;
  const selectedTrades = selectedDayKey ? (dailyBuckets.get(selectedDayKey) ?? []) : [];
  const selectedDayLabel = selectedDayKey
    ? new Date(`${selectedDayKey}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : null;

  return (
    <section aria-labelledby="monthly-calendar-title" className="bg-[#fbfbfa] border border-[#e9e9e7] rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#e9e9e7]">
        <div className="flex items-center gap-2">
          <Calendar size={17} className="text-[#2383e2]" aria-hidden="true" />
          <div>
            <h3 id="monthly-calendar-title" className="text-xs font-bold text-[#37352f]">Monthly Trading Calendar</h3>
            <p className="text-[11px] text-[#787774]">Review every trading day and its realized profit or loss.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-0.5 bg-[#f1f1ef] p-0.5 rounded-lg border border-[#e3e2de] text-[11px]">
            {(["SOL", "USD"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handleCurrencyChange(option)}
                aria-pressed={currency === option}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                  currency === option ? "bg-white text-[#37352f] shadow-xs" : "text-[#787774] hover:text-[#37352f]"
                }`}
              >
                {option === "USD" ? "USD ($)" : option}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#e9e9e7] rounded-full font-bold shadow-xs">
            <span className="text-[10px] text-[#787774] font-medium uppercase">Month P&amp;L</span>
            <span className={monthlyPnl >= 0 ? "text-emerald-600" : "text-rose-600"}>
              {currency === "SOL"
                ? `${monthlyPnl >= 0 ? "+" : ""}${monthlyPnl.toFixed(2)} SOL`
                : `${monthlyPnl >= 0 ? "+$" : "−$"}${Math.abs(monthlyPnl).toFixed(2)}`}
            </span>
          </div>
        </div>
      </div>

      {isTiltAlert && (
        <div className="p-3.5 bg-rose-100/80 border border-rose-300 rounded-lg flex items-center gap-3 text-rose-900">
          <AlertTriangle size={20} className="text-rose-600 shrink-0" aria-hidden="true" />
          <div className="text-xs">
            <strong className="block font-bold">Tilt limit reached today ({todayLosses} losses)</strong>
            <span>Rule: Max 3 losses per session. Step away from the charts and reset before trading again.</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          aria-label="View previous month"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#e3e2de] bg-white text-[#37352f] transition-colors hover:bg-[#f1f1ef]"
        >
          <ChevronLeft size={17} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setVisibleMonth({ year: currentYear, month: currentMonth })}
          className="rounded-lg px-3 py-1.5 text-sm font-bold text-[#37352f] transition-colors hover:bg-[#f1f1ef]"
          title={isCurrentMonth ? "Current month" : "Return to current month"}
        >
          {monthLabel}
        </button>
        <button
          type="button"
          onClick={() => changeMonth(1)}
          disabled={isCurrentMonth}
          aria-label="View next month"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#e3e2de] bg-white text-[#37352f] transition-colors hover:bg-[#f1f1ef] disabled:cursor-not-allowed disabled:opacity-35"
        >
          <ChevronRight size={17} aria-hidden="true" />
        </button>
      </div>

      <div>
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2" aria-label={`${monthLabel} trading results`}>
          {weekdayLabels.map((label) => (
            <div key={label} className="pb-1 text-center text-[9px] font-semibold uppercase tracking-wide text-[#9b9a97] sm:text-[10px]">
              {label}
            </div>
          ))}
          {Array.from({ length: leadingBlankDays }, (_, index) => (
            <div key={`blank-${index}`} aria-hidden="true" />
          ))}
          {calendarDays.map((day) => {
            const hasTrades = day.tradeCount > 0;
            const isGreen = day.pnlSol > 0;
            const isRed = day.pnlSol < 0;
            const isToday = day.dayKey === todayKey;
            const tooltipText = `${day.dayLabel}: ${day.tradeCount} trade${day.tradeCount === 1 ? "" : "s"}; ${day.pnlSol >= 0 ? "+" : ""}${day.pnlSol.toFixed(2)} SOL; ${day.pnlUsd >= 0 ? "+$" : "−$"}${Math.abs(day.pnlUsd).toFixed(2)}`;

            return (
              <button
                type="button"
                key={day.dayKey}
                title={tooltipText}
                onClick={() => hasTrades && setSelectedDayKey((current) => current === day.dayKey ? null : day.dayKey)}
                disabled={!hasTrades}
                aria-pressed={selectedDayKey === day.dayKey}
                className={`calendar-day relative flex h-12 flex-col justify-center gap-0.5 rounded-lg border px-1 py-0.5 text-center transition-colors sm:h-14 sm:px-1.5 ${
                  !hasTrades
                    ? "cursor-default bg-white border-[#e9e9e7] text-[#9b9a97]"
                    : isGreen
                      ? "bg-emerald-50/80 border-emerald-300/70 text-emerald-900 hover:bg-emerald-50"
                      : isRed
                        ? "bg-rose-50/80 border-rose-300/70 text-rose-900 hover:bg-rose-50"
                        : "bg-neutral-100 border-neutral-300 text-neutral-800"
                } ${selectedDayKey === day.dayKey ? "calendar-day-selected" : ""}`}
              >
                <span className="text-[10px] font-mono opacity-75 sm:text-[11px]">{day.date.getDate()}{isToday ? <span className="ml-1 text-[8px] font-sans">Today</span> : null}</span>
                <span className="truncate whitespace-nowrap text-[9px] font-mono font-bold tracking-tight sm:text-[11px]">
                  {formatDayPnl(day)}
                </span>
                <span className={`text-[8px] sm:text-[9px] ${hasTrades ? "opacity-70" : "invisible"}`}>
                  {day.tradeCount} {day.tradeCount === 1 ? "trade" : "trades"}
                </span>
              </button>
            );
          })}
        </div>

        {selectedDayKey && (
          <div className="mt-4 border-t border-[#e9e9e7] pt-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-[#37352f]">{selectedDayLabel}</h4>
                <p className="text-[10px] text-[#787774]">{selectedTrades.length} trade{selectedTrades.length === 1 ? "" : "s"} recorded</p>
              </div>
              <button type="button" onClick={() => setSelectedDayKey(null)} className="rounded-lg px-2 py-1 text-[10px] font-semibold text-[#787774] hover:bg-[#f1f1ef]">Close</button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {selectedTrades.map((trade) => {
                const pnl = trade.pnlSol || 0;
                return (
                  <button key={trade.id} type="button" onClick={() => onSelectTrade?.(trade)} className="calendar-trade-card flex items-center justify-between gap-3 rounded-lg border border-[#e9e9e7] bg-white p-3 text-left transition-colors hover:bg-[#f7f6f3]">
                    <span className="min-w-0"><span className="block truncate text-xs font-bold text-[#37352f]">{trade.name || trade.symbol}</span><span className="block text-[10px] text-[#787774]">${trade.symbol} · {getTradeDate(trade).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span></span>
                    <span className={`shrink-0 font-mono text-xs font-bold ${pnl > 0 ? "text-emerald-600" : pnl < 0 ? "text-rose-600" : "text-[#787774]"}`}>{pnl > 0 ? "+" : ""}{pnl.toFixed(2)} SOL</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3 pt-3 text-[10px] text-[#787774]">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded border border-emerald-400 bg-emerald-200" /> Profit day</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded border border-rose-400 bg-rose-200" /> Loss day</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded border border-neutral-300 bg-white" /> No trades</span>
        </div>
      </div>
    </section>
  );
}
