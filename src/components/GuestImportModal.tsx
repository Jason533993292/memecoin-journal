"use client";

import { useState } from "react";
import { CloudUpload, Trash2 } from "lucide-react";

export default function GuestImportModal({ count, onImport, onDiscard }: { count: number; onImport: () => Promise<void>; onDiscard: () => void }) {
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const runImport = async () => {
    setImporting(true); setError("");
    try { await onImport(); } catch (reason) { const detail = reason instanceof Error && reason.message ? ` ${reason.message}` : ""; setError(`The guest entries could not be imported. They are still available in this tab.${detail}`); setImporting(false); }
  };
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="guest-import-title" className="w-full max-w-md rounded-3xl border border-white/10 bg-[#10141c] p-6 text-white shadow-2xl">
        <CloudUpload size={26} className="text-sky-400"/><h2 id="guest-import-title" className="mt-4 text-xl font-bold">Keep your guest entries?</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">You created {count} temporary trade{count === 1 ? "" : "s"}. Choose whether to import them into your private account.</p>
        {error && <p role="alert" className="mt-3 rounded-xl bg-rose-400/10 p-3 text-xs text-rose-200">{error}</p>}
        <div className="mt-6 space-y-2">
          <button type="button" disabled={importing} onClick={() => void runImport()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a73ca] px-4 py-3 text-sm font-semibold hover:bg-[#2383e2] disabled:opacity-50"><CloudUpload size={16}/>{importing ? "Importing…" : "Import guest entries"}</button>
          <button type="button" disabled={importing} onClick={onDiscard} className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-rose-300 hover:bg-rose-400/10"><Trash2 size={16}/>Discard temporary entries</button>
        </div>
      </section>
    </div>
  );
}
