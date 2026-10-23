"use client";

import { CircleDot, Crosshair, MousePointer2, Target, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type CursorMode = "default" | "crosshair" | "x" | "dot" | "precision";

const OPTIONS: Array<{ id: CursorMode; label: string; icon: typeof MousePointer2 }> = [
  { id: "default", label: "Normal cursor", icon: MousePointer2 },
  { id: "crosshair", label: "Crosshair", icon: Crosshair },
  { id: "x", label: "X cursor", icon: X },
  { id: "dot", label: "Dot cursor", icon: CircleDot },
  { id: "precision", label: "Precision target", icon: Target },
];

const STORAGE_KEY = "memecoin_journal_cursor";

export default function CursorPicker() {
  const [mode, setMode] = useState<CursorMode>(() => {
    if (typeof window === "undefined") return "default";
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return OPTIONS.some((option) => option.id === saved) ? saved as CursorMode : "default";
  });
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.dataset.cursor = mode;
    window.localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", closeOnEscape);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("keydown", closeOnEscape); };
  }, [open]);

  const choose = (next: CursorMode) => {
    setMode(next);
    setOpen(false);
  };

  const CurrentIcon = OPTIONS.find((option) => option.id === mode)?.icon ?? MousePointer2;
  return (
    <div ref={rootRef} className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-label="Choose cursor style" aria-haspopup="menu" aria-expanded={open} title="Choose cursor style" className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e3e2de] bg-white text-[#5a5957] shadow-xs transition hover:bg-[#f1f1ef] hover:text-[#2383e2]">
        <CurrentIcon size={14}/>
      </button>
      {open && (
        <div role="menu" aria-label="Cursor styles" className="absolute right-0 top-9 z-[70] w-48 rounded-xl border border-[#e3e2de] bg-white p-1.5 text-[#37352f] shadow-2xl">
          {OPTIONS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" role="menuitemradio" aria-checked={mode === id} onClick={() => choose(id)} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs transition ${mode === id ? "bg-blue-50 font-semibold text-[#176bbd]" : "hover:bg-[#f7f6f3]"}`}>
              <Icon size={15}/><span className="flex-1">{label}</span>{mode === id && <span aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
