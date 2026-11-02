"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

const parseDate = (value: string) => {
  const parsed = value ? new Date(`${value}T12:00:00`) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export default function CalendarDatePicker({ value, onChange, ariaLabel = "Choose date", min }: { value: string; onChange: (value: string) => void; ariaLabel?: string; min?: string }) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => parseDate(value));
  const rootRef = useRef<HTMLDivElement>(null);
  const days = useMemo(() => {
    const leading = new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay();
    const count = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    return [...Array(leading).fill(null), ...Array.from({ length: count }, (_, index) => index + 1)];
  }, [cursor]);

  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", dismiss);
    return () => window.removeEventListener("pointerdown", dismiss);
  }, []);

  const selected = parseDate(value);
  const display = value ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(selected) : "Choose a date";
  const choose = (day: number) => {
    const next = new Date(cursor.getFullYear(), cursor.getMonth(), day);
    const key = dateKey(next);
    if (!min || key >= min) onChange(key);
    setOpen(false);
  };

  return <div ref={rootRef} className="calendar-date-picker">
    <button type="button" aria-label={ariaLabel} aria-expanded={open} className="calendar-date-trigger" onClick={() => { setCursor(parseDate(value)); setOpen((current) => !current); }}>
      <CalendarDays size={15} /><span>{display}</span>
    </button>
    {open && <div role="dialog" aria-label={ariaLabel} className="calendar-date-popover">
      <div className="calendar-date-header"><button type="button" aria-label="Previous month" onClick={() => setCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}><ChevronLeft size={16}/></button><strong>{new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(cursor)}</strong><button type="button" aria-label="Next month" onClick={() => setCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}><ChevronRight size={16}/></button></div>
      <div className="calendar-date-weekdays">{["S","M","T","W","T","F","S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
      <div className="calendar-date-days">{days.map((day, index) => {
        if (!day) return <span key={`blank-${index}`} />;
        const key = dateKey(new Date(cursor.getFullYear(), cursor.getMonth(), day));
        return <button key={key} type="button" disabled={Boolean(min && key < min)} aria-pressed={key === value} className={key === dateKey(new Date()) ? "is-today" : ""} onClick={() => choose(day)}>{day}</button>;
      })}</div>
      <button type="button" className="calendar-date-today" onClick={() => { const today = new Date(); setCursor(today); const key = dateKey(today); if (!min || key >= min) onChange(key); setOpen(false); }}>Use today</button>
    </div>}
  </div>;
}
