"use client";

import { Cloud, Clock3, X } from "lucide-react";

export default function AccessChoiceModal({
  onClose,
  onGuest,
  onAccount,
}: {
  onClose: () => void;
  onGuest: () => void;
  onAccount: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="access-choice-title" onClick={(event) => event.stopPropagation()} className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#10141c] p-6 text-white shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-400">Start recording</p><h2 id="access-choice-title" className="mt-2 text-2xl font-bold">How would you like to continue?</h2><p className="mt-2 text-sm leading-6 text-slate-300">Browse freely, then choose temporary guest mode or a private account only when you want to save something.</p></div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"><X size={19}/></button>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={onGuest} className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-5 text-left transition hover:bg-amber-300/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300">
            <Clock3 className="text-amber-300" size={22}/><strong className="mt-3 block">Try guest mode</strong><span className="mt-1 block text-xs leading-5 text-slate-300">Data stays only in this tab and is removed when the tab closes.</span>
          </button>
          <button type="button" onClick={onAccount} className="rounded-2xl border border-sky-400/30 bg-sky-400/10 p-5 text-left transition hover:bg-sky-400/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400">
            <Cloud className="text-sky-400" size={22}/><strong className="mt-3 block">Create or sign in</strong><span className="mt-1 block text-xs leading-5 text-slate-300">Keep entries privately synced and available on your other devices.</span>
          </button>
        </div>
      </section>
    </div>
  );
}
