"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";

interface TradeDateTimePickerProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
}

const pad = (value: number) => String(value).padStart(2, "0");

function parseLocalValue(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return new Date();
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]));
}

function serializeLocalValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function TradeDateTimePicker({ id, value, onChange }: TradeDateTimePickerProps) {
  const selected = parseLocalValue(value);
  const [isOpen, setIsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => ({ year: selected.getFullYear(), month: selected.getMonth() }));

  const days = useMemo(() => {
    const first = new Date(visibleMonth.year, visibleMonth.month, 1);
    const count = new Date(visibleMonth.year, visibleMonth.month + 1, 0).getDate();
    return {
      leading: first.getDay(),
      values: Array.from({ length: count }, (_, index) => index + 1),
    };
  }, [visibleMonth]);

  const setDay = (day: number) => {
    const next = new Date(selected);
    next.setFullYear(visibleMonth.year, visibleMonth.month, day);
    onChange(serializeLocalValue(next));
  };

  const setTime = (time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return;
    const next = new Date(selected);
    next.setHours(hours, minutes, 0, 0);
    onChange(serializeLocalValue(next));
  };

  const changeMonth = (offset: number) => {
    const next = new Date(visibleMonth.year, visibleMonth.month + offset, 1);
    setVisibleMonth({ year: next.getFullYear(), month: next.getMonth() });
  };

  const chooseToday = () => {
    const now = new Date();
    setVisibleMonth({ year: now.getFullYear(), month: now.getMonth() });
    onChange(serializeLocalValue(now));
  };

  const monthLabel = new Date(visibleMonth.year, visibleMonth.month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const displayValue = selected.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="relative">
      <button
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-center justify-between rounded-lg border border-[#e3e2de] bg-[#fbfbfa] px-3 py-2 text-left text-xs text-[#37352f] transition-colors hover:border-[#c8c7c3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2383e2]"
      >
        <span className="flex items-center gap-2"><CalendarDays size={14} className="text-[#2383e2]" />{displayValue}</span>
        <span className="text-[10px] font-semibold text-[#787774]">Change</span>
      </button>

      {isOpen && (
        <div role="dialog" aria-label="Choose trade date and time" className="trade-date-picker absolute left-0 right-0 z-40 mt-2 rounded-xl border border-[#e3e2de] bg-white p-3 shadow-xl sm:max-w-sm">
          <div className="mb-3 flex items-center justify-between">
            <button type="button" aria-label="Previous month" onClick={() => changeMonth(-1)} className="rounded-lg p-1.5 text-[#787774] transition-colors hover:bg-[#f1f1ef] hover:text-[#37352f]"><ChevronLeft size={16} /></button>
            <span className="text-xs font-bold text-[#37352f]">{monthLabel}</span>
            <button type="button" aria-label="Next month" onClick={() => changeMonth(1)} className="rounded-lg p-1.5 text-[#787774] transition-colors hover:bg-[#f1f1ef] hover:text-[#37352f]"><ChevronRight size={16} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-[#9b9a97]">
            {(["S", "M", "T", "W", "T", "F", "S"] as const).map((label, index) => <span key={`${label}-${index}`} className="py-1 font-semibold">{label}</span>)}
            {Array.from({ length: days.leading }, (_, index) => <span key={`blank-${index}`} />)}
            {days.values.map((day) => {
              const active = day === selected.getDate() && visibleMonth.month === selected.getMonth() && visibleMonth.year === selected.getFullYear();
              return <button key={day} type="button" onClick={() => setDay(day)} aria-pressed={active} className={`h-8 rounded-lg text-xs font-medium transition-colors ${active ? "bg-[#2383e2] text-white" : "text-[#37352f] hover:bg-[#f1f1ef]"}`}>{day}</button>;
            })}
          </div>
          <div className="mt-3 flex items-center gap-2 border-t border-[#f1f1ef] pt-3">
            <Clock size={14} className="text-[#787774]" />
            <input aria-label="Trade time" type="time" value={`${pad(selected.getHours())}:${pad(selected.getMinutes())}`} onChange={(event) => setTime(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-[#e3e2de] bg-[#fbfbfa] px-2.5 py-1.5 text-xs text-[#37352f] focus:border-[#2383e2] focus:outline-none" />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <button type="button" onClick={chooseToday} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#2383e2] transition-colors hover:bg-blue-50">Today</button>
            <button type="button" onClick={() => setIsOpen(false)} className="rounded-lg bg-[#2383e2] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#1a73ca]">Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
