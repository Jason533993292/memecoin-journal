"use client";

import { useState } from "react";
import { Wallet } from "../lib/types";
import { X, ArrowDownToLine, ArrowUpFromLine, Loader2, AlertTriangle } from "lucide-react";
import { useToast } from "./Toast";
import { formatSol } from "../lib/utils";
import { isValidSolAmount } from "../lib/tradeInput";

interface DepositPaycheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallet: Wallet | null;
  type: "deposit" | "paycheck";
  onConfirm: (walletId: string, deltaSol: number, notes: string) => Promise<void>;
  solPrice?: number;
}

export default function DepositPaycheckModal({
  isOpen,
  onClose,
  wallet,
  type,
  onConfirm,
  solPrice = 150,
}: DepositPaycheckModalProps) {
  const { showToast } = useToast();
  const [amountSol, setAmountSol] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  if (!isOpen || !wallet) return null;

  const isDeposit = type === "deposit";
  const numAmount = Number(amountSol) || 0;
  const numUsd = numAmount * solPrice;
  const isInvalidAmount = !isValidSolAmount(numAmount, false);
  const isOverdraft = !isDeposit && numAmount > wallet.balanceSol;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isInvalidAmount) {
      showToast("Please enter a valid amount greater than 0.", "error");
      return;
    }

    if (isOverdraft) {
      showToast(
        "Withdrawal exceeds this wallet’s balance",
        "error",
        `Enter ${formatSol(wallet.balanceSol)} SOL or less.`
      );
      return;
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
      const message = err instanceof Error ? err.message : "";
      showToast(
        "Transaction failed",
        "error",
        message.toLowerCase().includes("withdrawal exceeds")
          ? "The wallet balance changed. Refresh and enter an amount within the current balance."
          : "Check your connection and try again."
      );
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-transaction-title"
        className="bg-white border border-[#e9e9e7] rounded-xl p-6 w-full max-w-md shadow-xl relative text-[#37352f]"
      >
        <button
          onClick={() => {
            onClose();
          }}
          className="absolute top-4 right-4 text-[#9b9a97] hover:text-[#37352f] transition-colors p-1 rounded-md hover:bg-[#f1f1ef]"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#f1f1ef]">
          <span className="p-2 rounded-lg bg-[#f7f6f3]">
            {isDeposit ? <ArrowDownToLine size={18} className="text-[#2383e2]" /> : <ArrowUpFromLine size={18} className="text-emerald-600" />}
          </span>
          <div>
            <h2 id="wallet-transaction-title" className="text-base font-bold text-[#37352f]">
              {isDeposit ? "Deposit Funds to Wallet" : "Take Profit / Paycheck Withdrawal"}
            </h2>
            <p className="text-xs text-[#787774]">
              Wallet: <span className="font-semibold text-[#37352f]">{wallet.name}</span> (Current: {formatSol(wallet.balanceSol)} SOL)
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label htmlFor="wallet-transaction-amount" className="block font-medium text-[#787774] mb-1">
              {isDeposit ? "Deposit Amount (SOL)" : "Paycheck / Withdrawal Amount (SOL)"}
            </label>
            <div className="relative">
              <input
                id="wallet-transaction-amount"
                type="number"
                step="0.000000001"
                min="0"
                max="100000000"
                aria-invalid={amountSol !== "" && isInvalidAmount}
                required
                value={amountSol}
                onChange={(e) => {
                  setAmountSol(e.target.value);
                }}
                placeholder="e.g. 5.0"
                className="w-full bg-[#fbfbfa] border border-[#e3e2de] rounded-lg px-3 py-2 text-sm font-semibold text-[#37352f] focus:outline-none focus:border-[#2383e2] tabular-nums"
              />
              <span aria-live="polite" className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-[#787774] tabular-nums">
                ~${numUsd.toFixed(2)}
              </span>
            </div>
          </div>

          <div>
            <label htmlFor="wallet-transaction-notes" className="block font-medium text-[#787774] mb-1">Transaction Notes / Source</label>
            <input
              id="wallet-transaction-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isDeposit ? "e.g. Added 5 SOL from Coinbase" : "e.g. Cashed out 10 SOL profit to bank"}
              className="w-full bg-[#fbfbfa] border border-[#e3e2de] rounded-lg px-3 py-2 text-xs text-[#37352f] focus:outline-none focus:border-[#2383e2]"
            />
          </div>

          {/* Overdraft Warning Banner */}
          {isOverdraft && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 flex items-start gap-2">
              <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-semibold">Overdraft Warning</strong>
                <span>
                  Withdrawing {formatSol(numAmount)} SOL exceeds the recorded balance of {formatSol(wallet.balanceSol)} SOL.
                  Enter an amount no greater than the available balance.
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#f1f1ef]">
            <button
              type="button"
              onClick={() => {
                onClose();
              }}
              className="px-4 py-2 rounded-lg text-xs font-medium text-[#787774] hover:bg-[#f1f1ef] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || isOverdraft}
              className={`px-5 py-2 text-white font-medium rounded-lg text-xs shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 ${
                isDeposit
                  ? "bg-[#2383e2] hover:bg-[#1a73ca]"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {saving ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <span>
                  {`Confirm ${isDeposit ? "Deposit" : "Paycheck"}`}
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
