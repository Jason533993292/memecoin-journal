"use client";

import { useState } from "react";
import { X, ArrowDownToLine, ArrowUpFromLine, Loader2, DollarSign } from "lucide-react";
import { Wallet } from "../lib/types";
import { useToast } from "./Toast";

interface DepositPaycheckModalProps {
  wallet: Wallet | null;
  type: "deposit" | "paycheck";
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (walletId: string, deltaSol: number, notes: string) => Promise<void>;
  solPrice?: number;
}

export default function DepositPaycheckModal({
  wallet,
  type,
  isOpen,
  onClose,
  onConfirm,
  solPrice = 150,
}: DepositPaycheckModalProps) {
  const { showToast } = useToast();
  const [amountSol, setAmountSol] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  if (!isOpen || !wallet) return null;

  const isDeposit = type === "deposit";
  const numAmount = parseFloat(amountSol) || 0;
  const numUsd = numAmount * solPrice;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numAmount <= 0) {
      alert("Please enter a valid amount greater than 0.");
      return;
    }

    if (!isDeposit && numAmount > wallet.balanceSol) {
      if (!confirm(`Warning: Withdrawing ${numAmount} SOL is higher than the recorded balance of ${wallet.balanceSol} SOL. Proceed anyway?`)) {
        return;
      }
    }

    setSaving(true);
    try {
      const delta = isDeposit ? numAmount : -numAmount;
      await onConfirm(wallet.id, delta, notes.trim());
      showToast(
        isDeposit ? "Deposit recorded" : "Paycheck profit withdrawn",
        "success",
        `${isDeposit ? "+" : "-"}${numAmount} SOL on ${wallet.name}`
      );
      onClose();
      setAmountSol("");
      setNotes("");
    } catch (err) {
      console.error(err);
      showToast("Transaction failed", "error");
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white border border-[#e9e9e7] rounded-xl p-6 w-full max-w-md shadow-xl relative text-[#37352f]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#9b9a97] hover:text-[#37352f] transition-colors p-1 rounded-md hover:bg-[#f1f1ef]"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#f1f1ef]">
          <span className="p-2 rounded-lg bg-[#f7f6f3]">
            {isDeposit ? <ArrowDownToLine size={18} className="text-[#2383e2]" /> : <ArrowUpFromLine size={18} className="text-emerald-600" />}
          </span>
          <div>
            <h2 className="text-base font-bold text-[#37352f]">
              {isDeposit ? "Deposit Funds to Wallet" : "Take Profit / Paycheck Withdrawal"}
            </h2>
            <p className="text-xs text-[#787774]">
              Wallet: <span className="font-semibold text-[#37352f]">{wallet.name}</span> (Current: {wallet.balanceSol.toFixed(2)} SOL)
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-[#787774] mb-1">
              {isDeposit ? "Deposit Amount (SOL)" : "Paycheck / Withdrawal Amount (SOL)"}
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0.001"
                required
                value={amountSol}
                onChange={(e) => setAmountSol(e.target.value)}
                placeholder="e.g. 5.0"
                className="w-full bg-[#fbfbfa] border border-[#e3e2de] rounded-lg px-3 py-2 text-sm font-semibold text-[#37352f] focus:outline-none focus:border-[#2383e2]"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-[#787774]">
                ~${numUsd.toFixed(2)}
              </span>
            </div>
          </div>

          <div>
            <label className="block font-medium text-[#787774] mb-1">Transaction Notes / Source</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isDeposit ? "e.g. Added 5 SOL from Coinbase" : "e.g. Cashed out 10 SOL profit to bank"}
              className="w-full bg-[#fbfbfa] border border-[#e3e2de] rounded-lg px-3 py-2 text-xs text-[#37352f] focus:outline-none focus:border-[#2383e2]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#f1f1ef]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-[#787774] hover:bg-[#f1f1ef] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`px-5 py-2 text-white font-medium rounded-lg text-xs shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 ${
                isDeposit ? "bg-[#2383e2] hover:bg-[#1a73ca]" : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <span>Confirm {isDeposit ? "Deposit" : "Paycheck"}</span>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
