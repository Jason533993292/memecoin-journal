"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

type LegalKind = "privacy" | "terms";

export default function LegalModal({ kind, onClose, onChange }: { kind: LegalKind | null; onClose: () => void; onChange: (kind: LegalKind) => void }) {
  useEffect(() => {
    if (!kind) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", closeOnEscape); };
  }, [kind, onClose]);

  if (!kind) return null;
  const title = kind === "privacy" ? "Privacy Notice" : "Terms of Use";
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm" onMouseDown={onClose}>
      <section role="dialog" aria-modal="true" aria-label={title} className="flex h-[min(860px,94vh)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#e3e2de] bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex items-center justify-between gap-3 border-b border-[#e9e9e7] px-4 py-3 sm:px-5">
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#2383e2]">Legal</p><h2 className="text-lg font-bold text-[#37352f]">{title}</h2></div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onChange(kind === "privacy" ? "terms" : "privacy")} className="rounded-lg border border-[#e3e2de] px-3 py-2 text-xs font-medium text-[#5a5957] hover:bg-[#f7f6f3]">View {kind === "privacy" ? "Terms" : "Privacy"}</button>
            <button type="button" onClick={onClose} aria-label={`Close ${title}`} className="rounded-lg p-2 text-[#787774] hover:bg-[#f7f6f3] hover:text-[#37352f]"><X size={18}/></button>
          </div>
        </header>
        <iframe title={title} src={`/${kind}?embedded=1`} className="min-h-0 flex-1 bg-[#fbfbfa]" />
      </section>
    </div>
  );
}
