"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "./Toast";

interface TradingDataDeletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

export default function TradingDataDeletionModal({
  isOpen,
  onClose,
  onDeleted,
}: TradingDataDeletionModalProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || !user) return null;
  const ready = confirmation === "DELETE ALL" && !loading;

  const deleteTradingData = async () => {
    if (!ready) return;
    setLoading(true);
    setError("");
    try {
      const token = await user.getIdToken(true);
      const response = await fetch("/api/account/trades/delete", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "Trading-data deletion failed. Please try again.");
        return;
      }

      try {
        localStorage.removeItem(`memecoin_journal_${user.uid}_ai_brief`);
        localStorage.removeItem(`memecoin_journal_${user.uid}_demo_mode`);
      } catch {
        // Cloud deletion succeeded even if browser storage is unavailable.
      }
      onDeleted();
      showToast("Trades and statistics deleted", "success", "Your account, wallets, research, rules, and goals were kept.");
      onClose();
    } catch {
      setError("We could not delete your trading data. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-trading-data-title"
        className="w-full max-w-md space-y-5 rounded-2xl border border-rose-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <span className="rounded-xl bg-rose-50 p-2 text-rose-600"><AlertTriangle size={20} /></span>
            <div>
              <h2 id="delete-trading-data-title" className="text-lg font-bold text-[#37352f]">Delete all trades and statistics?</h2>
              <p className="mt-1 text-sm leading-6 text-[#676662]">
                This permanently deletes every saved trade. Dashboard and analytics statistics will reset to zero because they are calculated from those trades.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={loading} aria-label="Close trading-data deletion" className="rounded-lg p-1.5 text-[#787774] hover:bg-[#f7f6f3] disabled:opacity-50">
            <X size={18} />
          </button>
        </div>

        <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-900">
          Kept: your account, wallets, wallet history, research, rules, goals, and feedback. Export your trades first if you may need a copy.
        </p>

        {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{error}</p>}

        <label className="block space-y-1.5 text-xs font-medium text-[#37352f]">
          Type <span className="font-bold">DELETE ALL</span> to confirm
          <input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            disabled={loading}
            className="w-full rounded-lg border border-[#deddd8] px-3 py-2.5 text-sm outline-none focus:border-rose-400 disabled:opacity-60"
          />
        </label>

        <div className="flex gap-3">
          <button type="button" onClick={onClose} disabled={loading} className="flex-1 rounded-lg border border-[#deddd8] px-4 py-2.5 text-sm font-semibold text-[#676662] hover:bg-[#f7f6f3] disabled:opacity-50">Cancel</button>
          <button type="button" onClick={() => void deleteTradingData()} disabled={!ready} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            {loading ? "Deleting…" : "Delete all"}
          </button>
        </div>
      </section>
    </div>
  );
}
