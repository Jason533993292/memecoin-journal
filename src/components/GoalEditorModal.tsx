"use client";

import { useState, useEffect } from "react";
import { X, Target, Check, ShieldAlert } from "lucide-react";
import { GoalSettings } from "../lib/types";
import { useToast } from "./Toast";

interface GoalEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  goals: GoalSettings;
  onSaveGoals: (goals: GoalSettings) => void;
}

export default function GoalEditorModal({
  isOpen,
  onClose,
  goals,
  onSaveGoals,
}: GoalEditorModalProps) {
  const { showToast } = useToast();
  const [weeklyTarget, setWeeklyTarget] = useState(String(goals.weeklyPnlSolTarget || 5));
  const [monthlyTarget, setMonthlyTarget] = useState(String(goals.monthlyPnlSolTarget || 20));
  const [targetWinRate, setTargetWinRate] = useState(String(goals.targetWinRate || 60));
  const [maxDailyLoss, setMaxDailyLoss] = useState(String(goals.maxDailyLossSol || 2));
  const [maxDailyTrades, setMaxDailyTrades] = useState(String(goals.maxDailyTrades || 6));

  useEffect(() => {
    if (goals) {
      setWeeklyTarget(String(goals.weeklyPnlSolTarget || 5));
      setMonthlyTarget(String(goals.monthlyPnlSolTarget || 20));
      setTargetWinRate(String(goals.targetWinRate || 60));
      setMaxDailyLoss(String(goals.maxDailyLossSol || 2));
      setMaxDailyTrades(String(goals.maxDailyTrades || 6));
    }
  }, [goals]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: GoalSettings = {
      weeklyPnlSolTarget: Math.max(0.1, parseFloat(weeklyTarget) || 5),
      monthlyPnlSolTarget: Math.max(0.1, parseFloat(monthlyTarget) || 20),
      targetWinRate: Math.min(100, Math.max(1, parseFloat(targetWinRate) || 60)),
      maxDailyLossSol: Math.max(0.1, parseFloat(maxDailyLoss) || 2),
      maxDailyTrades: Math.max(1, parseInt(maxDailyTrades, 10) || 6),
    };
    onSaveGoals(updated);
    showToast("Trading goals updated", "success");
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-[#e9e9e7] rounded-2xl p-6 w-full max-w-md shadow-xl relative text-[#37352f]"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#9b9a97] hover:text-[#37352f] transition-colors p-1 rounded-md hover:bg-[#f1f1ef]"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#f1f1ef]">
          <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
            <Target size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#37352f]">Configure Trading Goals</h2>
            <p className="text-xs text-[#787774]">Set clear targets to build discipline and prevent tilt.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-[#37352f] mb-1">Weekly SOL Profit Target</label>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={weeklyTarget}
                onChange={(e) => setWeeklyTarget(e.target.value)}
                className="w-full bg-[#fbfbfa] border border-[#e3e2de] rounded-lg px-3 py-2 text-xs font-mono font-medium focus:outline-none focus:border-[#2383e2]"
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 font-mono text-xs">SOL</span>
            </div>
            <span className="text-[10px] text-[#9b9a97] mt-0.5 block">Your 7-day net gain goal</span>
          </div>

          <div>
            <label className="block font-medium text-[#37352f] mb-1">Monthly SOL Profit Target</label>
            <div className="relative">
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={monthlyTarget}
                onChange={(e) => setMonthlyTarget(e.target.value)}
                className="w-full bg-[#fbfbfa] border border-[#e3e2de] rounded-lg px-3 py-2 text-xs font-mono font-medium focus:outline-none focus:border-[#2383e2]"
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 font-mono text-xs">SOL</span>
            </div>
            <span className="text-[10px] text-[#9b9a97] mt-0.5 block">Your 30-day net gain goal</span>
          </div>

          <div>
            <label className="block font-medium text-[#37352f] mb-1">Target Win Rate (%)</label>
            <div className="relative">
              <input
                type="number"
                step="1"
                min="10"
                max="100"
                value={targetWinRate}
                onChange={(e) => setTargetWinRate(e.target.value)}
                className="w-full bg-[#fbfbfa] border border-[#e3e2de] rounded-lg px-3 py-2 text-xs font-mono font-medium focus:outline-none focus:border-[#2383e2]"
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 font-mono text-xs">%</span>
            </div>
            <span className="text-[10px] text-[#9b9a97] mt-0.5 block">Target percentage of winning trades (e.g. 60%)</span>
          </div>

          <div className="pt-2 border-t border-[#f1f1ef]">
            <h4 className="text-[11px] font-bold text-rose-700 uppercase tracking-wider mb-2 flex items-center gap-1">
              <ShieldAlert size={12} />
              <span>Risk & Tilt Guardrails</span>
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-[#37352f] mb-1">Max Daily Loss</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={maxDailyLoss}
                    onChange={(e) => setMaxDailyLoss(e.target.value)}
                    className="w-full bg-[#fbfbfa] border border-[#e3e2de] rounded-lg px-2.5 py-2 text-xs font-mono font-medium focus:outline-none focus:border-[#2383e2]"
                    required
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 font-mono text-[11px]">SOL</span>
                </div>
                <span className="text-[10px] text-[#9b9a97] mt-0.5 block">Stop trading if hit</span>
              </div>

              <div>
                <label className="block font-medium text-[#37352f] mb-1">Max Trades / Day</label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={maxDailyTrades}
                  onChange={(e) => setMaxDailyTrades(e.target.value)}
                  className="w-full bg-[#fbfbfa] border border-[#e3e2de] rounded-lg px-2.5 py-2 text-xs font-mono font-medium focus:outline-none focus:border-[#2383e2]"
                  required
                />
                <span className="text-[10px] text-[#9b9a97] mt-0.5 block">Prevents overtrading</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#f1f1ef]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[#787774] hover:bg-[#f1f1ef]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-[#2383e2] hover:bg-[#1a73ca] text-white px-4 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              Save Goals
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
