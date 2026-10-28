"use client";

import { useState } from "react";
import { X, Plus, Trash2, Check } from "lucide-react";
import { JournalRules, TradingPlaybook } from "../lib/types";
import { useToast } from "./Toast";

interface RuleEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  rules: JournalRules;
  onSaveRules: (updated: JournalRules) => Promise<void>;
}

export default function RuleEditorModal({
  isOpen,
  onClose,
  rules,
  onSaveRules,
}: RuleEditorModalProps) {
  const { showToast } = useToast();
  const [riskList, setRiskList] = useState<string[]>([...rules.riskManagement]);
  const [planList, setPlanList] = useState<string[]>([...rules.tradePlan]);
  const [newRisk, setNewRisk] = useState("");
  const [newPlan, setNewPlan] = useState("");
  const [playbooks, setPlaybooks] = useState<TradingPlaybook[]>(rules.playbooks || []);

  if (!isOpen) return null;

  const handleSave = async () => {
    const riskManagement = riskList.filter((rule) => rule.trim().length > 0);
    const tradePlan = planList.filter((rule) => rule.trim().length > 0);
    if (
      riskManagement.length > 20 || tradePlan.length > 20 ||
      [...riskManagement, ...tradePlan, ...playbooks.flatMap((playbook) => playbook.checklist)].some((rule) => rule.length > 300) ||
      playbooks.length > 20 || playbooks.some((playbook) => !playbook.name.trim() || playbook.name.length > 120 || playbook.checklist.length > 20)
    ) {
      showToast("Rules exceed the limit", "error", "Use no more than 20 rules per list and keep each under 300 characters.");
      return;
    }
    try {
      await onSaveRules({ riskManagement, tradePlan, playbooks: playbooks.map((playbook) => ({ ...playbook, name: playbook.name.trim(), checklist: playbook.checklist.map((item) => item.trim()).filter(Boolean) })) });
      onClose();
    } catch {
      // The dashboard displays the cloud-save error and leaves this editor open.
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-[#e9e9e7] rounded-xl p-6 w-full max-w-lg shadow-xl relative my-8 text-[#37352f]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#9b9a97] hover:text-[#37352f] transition-colors p-1 rounded-md hover:bg-[#f1f1ef]"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#f1f1ef]">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-[#37352f]">Edit Trading Rules</h2>
            <p className="text-xs text-[#787774]">Customize your daily Risk Management and Trade Plan guidelines.</p>
          </div>
        </div>

        <div className="space-y-5 text-xs max-h-[65vh] overflow-y-auto pr-1">
          {/* Risk Management Section */}
          <div>
            <div className="flex items-center gap-1.5 font-semibold text-[#37352f] mb-2">
              <span>Risk Management Rules</span>
            </div>
            <div className="space-y-1.5">
              {riskList.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="w-5 text-center text-[#9b9a97] font-mono">{index + 1}</span>
                  <input
                    type="text"
                    maxLength={300}
                    value={item}
                    onChange={(e) => {
                      const updated = [...riskList];
                      updated[index] = e.target.value;
                      setRiskList(updated);
                    }}
                    className="flex-1 bg-[#fbfbfa] border border-[#e3e2de] rounded-md px-2.5 py-1.5 text-xs text-[#37352f] focus:outline-none focus:border-[#2383e2]"
                  />
                  <button
                    type="button"
                    onClick={() => setRiskList(riskList.filter((_, i) => i !== index))}
                    className="text-[#9b9a97] hover:text-rose-600 p-1.5 rounded transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                maxLength={300}
                value={newRisk}
                onChange={(e) => setNewRisk(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newRisk.trim()) {
                    e.preventDefault();
                    if (riskList.length >= 20) {
                      showToast("Rule limit reached", "error", "Keep up to 20 rules per section.");
                      return;
                    }
                    setRiskList([...riskList, newRisk.trim()]);
                    setNewRisk("");
                  }
                }}
                placeholder="Add new risk rule..."
                className="flex-1 bg-[#fbfbfa] border border-[#e3e2de] rounded-md px-2.5 py-1 text-xs text-[#37352f]"
              />
              <button
                type="button"
                onClick={() => {
                  if (newRisk.trim()) {
                    if (riskList.length >= 20) {
                      showToast("Rule limit reached", "error", "Keep up to 20 rules per section.");
                      return;
                    }
                    setRiskList([...riskList, newRisk.trim()]);
                    setNewRisk("");
                  }
                }}
                className="px-2.5 py-1 bg-[#f1f1ef] hover:bg-[#e3e2de] rounded-md text-xs font-medium flex items-center gap-1 text-[#37352f]"
              >
                <Plus size={12} /> Add
              </button>
            </div>
          </div>

          {/* Trade Plan Section */}
          <div className="pt-3 border-t border-[#f1f1ef]">
            <div className="flex items-center gap-1.5 font-semibold text-[#37352f] mb-2">
              <span>Trade Plan Rules</span>
            </div>
            <div className="space-y-1.5">
              {planList.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="w-5 text-center text-[#9b9a97] font-mono">{index + 1}</span>
                  <input
                  type="text"
                  maxLength={300}
                    value={item}
                    onChange={(e) => {
                      const updated = [...planList];
                      updated[index] = e.target.value;
                      setPlanList(updated);
                    }}
                    className="flex-1 bg-[#fbfbfa] border border-[#e3e2de] rounded-md px-2.5 py-1.5 text-xs text-[#37352f] focus:outline-none focus:border-[#2383e2]"
                  />
                  <button
                    type="button"
                    onClick={() => setPlanList(planList.filter((_, i) => i !== index))}
                    className="text-[#9b9a97] hover:text-rose-600 p-1.5 rounded transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                maxLength={300}
                value={newPlan}
                onChange={(e) => setNewPlan(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newPlan.trim()) {
                    e.preventDefault();
                    if (planList.length >= 20) {
                      showToast("Rule limit reached", "error", "Keep up to 20 rules per section.");
                      return;
                    }
                    setPlanList([...planList, newPlan.trim()]);
                    setNewPlan("");
                  }
                }}
                placeholder="Add new plan rule..."
                className="flex-1 bg-[#fbfbfa] border border-[#e3e2de] rounded-md px-2.5 py-1 text-xs text-[#37352f]"
              />
              <button
                type="button"
                onClick={() => {
                  if (newPlan.trim()) {
                    if (planList.length >= 20) {
                      showToast("Rule limit reached", "error", "Keep up to 20 rules per section.");
                      return;
                    }
                    setPlanList([...planList, newPlan.trim()]);
                    setNewPlan("");
                  }
                }}
                className="px-2.5 py-1 bg-[#f1f1ef] hover:bg-[#e3e2de] rounded-md text-xs font-medium flex items-center gap-1 text-[#37352f]"
              >
                <Plus size={12} /> Add
              </button>
            </div>
          </div>

          <div className="border-t border-[#f1f1ef] pt-3">
            <div className="mb-2 flex items-center justify-between">
              <div><div className="font-semibold text-[#37352f]">Strategy playbooks</div><p className="mt-0.5 text-[10px] text-[#787774]">Reusable setup checklists shown while logging a trade.</p></div>
              <button type="button" disabled={playbooks.length >= 20} onClick={() => setPlaybooks([...playbooks, { id: crypto.randomUUID(), name: "New playbook", checklist: ["Setup conditions confirmed"] }])} className="flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 disabled:opacity-50"><Plus size={11}/> Add playbook</button>
            </div>
            <div className="space-y-2">
              {playbooks.map((playbook) => (
                <div key={playbook.id} className="rounded-lg border border-[#e9e9e7] bg-[#fbfbfa] p-2.5">
                  <div className="flex gap-2">
                    <input aria-label="Playbook name" maxLength={120} value={playbook.name} onChange={(event) => setPlaybooks(playbooks.map((item) => item.id === playbook.id ? { ...item, name: event.target.value } : item))} className="flex-1 rounded-md border border-[#e3e2de] bg-white px-2 py-1.5 text-xs font-semibold" />
                    <button type="button" onClick={() => setPlaybooks(playbooks.filter((item) => item.id !== playbook.id))} className="rounded p-1.5 text-rose-600 hover:bg-rose-50" aria-label={`Delete ${playbook.name}`}><Trash2 size={13}/></button>
                  </div>
                  <label className="mt-2 block text-[10px] text-[#787774]">Required checks · one per line
                    <textarea rows={3} value={playbook.checklist.join("\n")} onChange={(event) => setPlaybooks(playbooks.map((item) => item.id === playbook.id ? { ...item, checklist: event.target.value.split("\n").slice(0, 20) } : item))} className="mt-1 w-full resize-y rounded-md border border-[#e3e2de] bg-white px-2 py-1.5 text-xs" />
                  </label>
                </div>
              ))}
              {!playbooks.length && <p className="rounded-lg border border-dashed border-[#e3e2de] p-3 text-center text-[11px] text-[#787774]">No playbooks yet. Add one for setups you repeat.</p>}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-[#f1f1ef]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-[#787774] hover:bg-[#f1f1ef]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 bg-[#1a73ca] hover:bg-[#155fa8] text-white font-medium rounded-lg text-xs shadow-xs flex items-center gap-1.5"
          >
            <Check size={13} /> Save Rules
          </button>
        </div>
      </div>
    </div>
  );
}
