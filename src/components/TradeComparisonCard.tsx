"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import type { Trade } from "@/lib/types";
import { formatSol, getTradeDate } from "@/lib/utils";

export default function TradeComparisonCard({ trades, onSelectTrade }: { trades: Trade[]; onSelectTrade?: (trade: Trade) => void }) {
  const newest = useMemo(() => [...trades].sort((a, b) => getTradeDate(b).getTime() - getTradeDate(a).getTime()), [trades]);
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");
  const left = newest.find((trade) => trade.id === leftId) ?? newest[0];
  const right = newest.find((trade) => trade.id === rightId) ?? newest.find((trade) => trade.id !== left?.id);
  if (!left || !right) return null;

  return <section className="rounded-xl border border-[#e9e9e7] bg-white p-5 shadow-xs" aria-labelledby="trade-comparison-title">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#f1f1ef] pb-3"><div className="flex items-center gap-2"><ArrowLeftRight size={16} className="text-[#2383e2]"/><div><h2 id="trade-comparison-title" className="text-sm font-semibold text-[#37352f]">Compare two trades</h2><p className="text-xs text-[#787774]">Inspect process, risk, size, fees, and outcome without switching between cards.</p></div></div></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2"><TradeSelect label="First trade" value={left.id} trades={newest} excludedId={right.id} onChange={setLeftId}/><TradeSelect label="Second trade" value={right.id} trades={newest} excludedId={left.id} onChange={setRightId}/></div>
    <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] border-collapse text-xs"><thead><tr className="border-b border-[#e9e9e7]"><th className="px-3 py-2 text-left font-medium text-[#787774]">Metric</th><th className="px-3 py-2 text-left font-semibold text-[#37352f]">{left.name}</th><th className="px-3 py-2 text-left font-semibold text-[#37352f]">{right.name}</th></tr></thead><tbody>
      <CompareRow label="Realized P&L" left={`${left.pnlSol >= 0 ? "+" : ""}${formatSol(left.pnlSol)} SOL`} right={`${right.pnlSol >= 0 ? "+" : ""}${formatSol(right.pnlSol)} SOL`} leftTone={left.pnlSol >= 0 ? "positive" : "negative"} rightTone={right.pnlSol >= 0 ? "positive" : "negative"}/>
      <CompareRow label="Capital deployed" left={`${formatSol(left.boughtSol)} SOL`} right={`${formatSol(right.boughtSol)} SOL`}/>
      <CompareRow label="Initial risk" left={left.initialRiskSol !== undefined ? `${formatSol(left.initialRiskSol)} SOL` : "Not recorded"} right={right.initialRiskSol !== undefined ? `${formatSol(right.initialRiskSol)} SOL` : "Not recorded"}/>
      <CompareRow label="Fees" left={left.feesSol !== undefined ? `${formatSol(left.feesSol)} SOL` : "Not recorded"} right={right.feesSol !== undefined ? `${formatSol(right.feesSol)} SOL` : "Not recorded"}/>
      <CompareRow label="Setup / playbook" left={left.playbookName || left.setupType || "Not recorded"} right={right.playbookName || right.setupType || "Not recorded"}/>
      <CompareRow label="Process grade" left={left.processGrade ?? "Not graded"} right={right.processGrade ?? "Not graded"}/>
      <CompareRow label="Entry confidence" left={left.confidenceAtEntry !== undefined ? `${left.confidenceAtEntry}%` : "Not recorded"} right={right.confidenceAtEntry !== undefined ? `${right.confidenceAtEntry}%` : "Not recorded"}/>
      <CompareRow label="Holding time" left={formatDuration(left.durationMinutes)} right={formatDuration(right.durationMinutes)}/>
    </tbody></table></div>
    {onSelectTrade && <div className="mt-4 flex justify-end gap-2"><button onClick={() => onSelectTrade(left)} className="rounded-md border border-[#e3e2de] px-3 py-2 text-xs hover:bg-[#f7f6f3]">Open {left.name}</button><button onClick={() => onSelectTrade(right)} className="rounded-md border border-[#e3e2de] px-3 py-2 text-xs hover:bg-[#f7f6f3]">Open {right.name}</button></div>}
  </section>;
}

function TradeSelect({ label, value, trades, excludedId, onChange }: { label: string; value: string; trades: Trade[]; excludedId: string; onChange: (id: string) => void }) {
  return <label className="text-xs font-medium text-[#5a5957]"><span className="mb-1.5 block">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-[#e3e2de] bg-white px-3 py-2 text-[#37352f] outline-none focus:border-[#2383e2]"><option value="">Most recent available</option>{trades.filter((trade) => trade.id !== excludedId).map((trade) => <option key={trade.id} value={trade.id}>{getTradeDate(trade).toLocaleDateString()} · {trade.name} · {trade.pnlSol >= 0 ? "+" : ""}{formatSol(trade.pnlSol)} SOL</option>)}</select></label>;
}

function CompareRow({ label, left, right, leftTone, rightTone }: { label: string; left: string; right: string; leftTone?: "positive" | "negative"; rightTone?: "positive" | "negative" }) {
  const tone = (value?: "positive" | "negative") => value === "positive" ? "text-emerald-700" : value === "negative" ? "text-rose-700" : "text-[#37352f]";
  return <tr className="border-b border-[#f1f1ef] last:border-0"><th className="px-3 py-2.5 text-left font-medium text-[#787774]">{label}</th><td className={`px-3 py-2.5 font-mono font-semibold ${tone(leftTone)}`}>{left}</td><td className={`px-3 py-2.5 font-mono font-semibold ${tone(rightTone)}`}>{right}</td></tr>;
}

function formatDuration(minutes?: number) {
  if (!minutes || minutes <= 0) return "Not recorded";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = Math.round(minutes % 60);
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}
