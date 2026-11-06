"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Clock3, Layers3, Play, Square, Target, TriangleAlert } from "lucide-react";
import type { Trade } from "../lib/types";
import { formatSol, getTradeTimestamp } from "../lib/utils";

type SessionPlan = { startedAt: number; maxTrades: number; maxLossSol: number; intention: string };

export default function DashboardReviewHub({ trades, storageKey, onSelectTrade, onOpenJournal }: {
  trades: Trade[];
  storageKey: string;
  onSelectTrade: (trade: Trade) => void;
  onOpenJournal: () => void;
}) {
  const [session, setSession] = useState<SessionPlan | null>(() => {
    if (typeof window === "undefined") return null;
    try { return JSON.parse(localStorage.getItem(storageKey) || "null") as SessionPlan | null; } catch { return null; }
  });
  const [maxTrades, setMaxTrades] = useState(5);
  const [maxLossSol, setMaxLossSol] = useState(1);
  const [intention, setIntention] = useState("");

  const reviewQueue = useMemo(() => [...trades]
    .filter((trade) => !trade.notes?.trim() || !trade.processGrade || (!trade.screenshotUrl && !trade.goodTags?.length && !trade.mistakes?.length))
    .sort((a, b) => getTradeTimestamp(b) - getTradeTimestamp(a))
    .slice(0, 5), [trades]);

  const groups = useMemo(() => {
    const grouped = new Map<string, Trade[]>();
    for (const trade of trades) {
      const key = trade.ca?.trim().toLowerCase() || `${trade.symbol}:${trade.name}`.toLowerCase();
      grouped.set(key, [...(grouped.get(key) || []), trade]);
    }
    return [...grouped.values()].filter((items) => items.length > 1).sort((a, b) => b.length - a.length).slice(0, 4);
  }, [trades]);

  const sessionTrades = useMemo(() => session ? trades.filter((trade) => getTradeTimestamp(trade) >= session.startedAt) : [], [session, trades]);
  const sessionPnl = sessionTrades.reduce((sum, trade) => sum + trade.pnlSol, 0);
  const lossUsed = Math.abs(Math.min(0, sessionPnl));
  const limitReached = Boolean(session && (sessionTrades.length >= session.maxTrades || lossUsed >= session.maxLossSol));

  const start = () => {
    const next = { startedAt: Date.now(), maxTrades: Math.max(1, maxTrades), maxLossSol: Math.max(0.01, maxLossSol), intention: intention.trim().slice(0, 160) };
    localStorage.setItem(storageKey, JSON.stringify(next)); setSession(next);
  };
  const end = () => { localStorage.removeItem(storageKey); setSession(null); };

  return <section aria-labelledby="review-hub-title" className="grid gap-5 xl:grid-cols-3">
    <div className="notion-card p-5 xl:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 id="review-hub-title" className="flex items-center gap-2 text-sm font-semibold text-[#37352f]"><CheckCircle2 size={16} className="text-[#2383e2]"/>Post-trade review queue</h2><p className="mt-1 text-[11px] text-[#787774]">Finish the context that turns a result into a useful lesson.</p></div>
        <button type="button" onClick={onOpenJournal} className="rounded-lg px-3 py-2 text-xs font-semibold text-[#176bbd] hover:bg-blue-50">Open all trades</button>
      </div>
      {reviewQueue.length ? <div className="mt-4 grid gap-2 sm:grid-cols-2">{reviewQueue.map((trade) => {
        const missing = [!trade.notes?.trim() && "notes", !trade.processGrade && "process grade", !trade.screenshotUrl && "chart"].filter(Boolean).join(" · ");
        return <button key={trade.id} type="button" onClick={() => onSelectTrade(trade)} className="rounded-xl border border-[#e9e9e7] bg-[#fbfbfa] p-3 text-left hover:border-blue-200 hover:bg-blue-50/30"><span className="flex items-center justify-between gap-3"><strong className="truncate text-xs text-[#37352f]">{trade.name}</strong><span className={`font-mono text-[11px] font-semibold ${trade.pnlSol < 0 ? "text-rose-600" : "text-emerald-600"}`}>{trade.pnlSol >= 0 ? "+" : ""}{formatSol(trade.pnlSol)} SOL</span></span><span className="mt-1 block text-[10px] text-[#787774]">Missing: {missing || "execution tags"}</span></button>;
      })}</div> : <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-xs text-emerald-800">All logged trades have enough review context.</div>}
      {groups.length > 0 && <div className="mt-5 border-t border-[#e9e9e7] pt-4"><h3 className="flex items-center gap-2 text-xs font-semibold text-[#37352f]"><Layers3 size={14}/>Related trade groups</h3><p className="mt-1 text-[10px] text-[#787774]">Entries sharing the same contract are grouped as one trading idea.</p><div className="mt-2 flex flex-wrap gap-2">{groups.map((group) => <button key={group[0].id} type="button" onClick={() => onSelectTrade(group[0])} className="rounded-full bg-[#f1f1ef] px-3 py-1.5 text-[10px] font-semibold text-[#5a5957] hover:bg-[#e8e7e3]">{group[0].symbol || group[0].name} · {group.length} entries</button>)}</div></div>}
    </div>

    <div className={`notion-card p-5 ${limitReached ? "border-rose-300 bg-rose-50/40" : ""}`}>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[#37352f]"><Target size={16} className="text-[#2383e2]"/>Trading session</h2>
      {!session ? <div className="mt-4 space-y-3"><div className="grid grid-cols-2 gap-2"><label className="text-[10px] text-[#787774]">Max trades<input type="number" min="1" max="50" value={maxTrades} onChange={(event) => setMaxTrades(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-[#e3e2de] bg-white px-2.5 py-2 text-xs text-[#37352f]"/></label><label className="text-[10px] text-[#787774]">Max loss (SOL)<input type="number" min="0.01" step="0.01" value={maxLossSol} onChange={(event) => setMaxLossSol(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-[#e3e2de] bg-white px-2.5 py-2 text-xs text-[#37352f]"/></label></div><label className="text-[10px] text-[#787774]">Session intention<input value={intention} maxLength={160} onChange={(event) => setIntention(event.target.value)} placeholder="e.g. Wait for confirmation" className="mt-1 w-full rounded-lg border border-[#e3e2de] bg-white px-2.5 py-2 text-xs text-[#37352f]"/></label><button type="button" onClick={start} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1a73ca] px-3 py-2.5 text-xs font-semibold text-white hover:bg-[#155fa8]"><Play size={13}/>Start session</button></div> : <div className="mt-4"><div className="flex items-center gap-2 text-[10px] text-[#787774]"><Clock3 size={13}/>Started {new Date(session.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>{session.intention && <p className="mt-3 rounded-lg bg-[#f7f6f3] p-3 text-xs text-[#5a5957]">{session.intention}</p>}<div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-lg border border-[#e9e9e7] p-3"><p className="text-[10px] text-[#787774]">Trades</p><strong className="text-sm">{sessionTrades.length} / {session.maxTrades}</strong></div><div className="rounded-lg border border-[#e9e9e7] p-3"><p className="text-[10px] text-[#787774]">Session P&L</p><strong className={`text-sm ${sessionPnl < 0 ? "text-rose-600" : "text-emerald-600"}`}>{sessionPnl >= 0 ? "+" : ""}{formatSol(sessionPnl)} SOL</strong></div></div>{limitReached && <p role="alert" className="mt-3 flex gap-2 rounded-lg bg-rose-100 p-3 text-xs font-semibold text-rose-800"><TriangleAlert size={14} className="shrink-0"/>Your session limit has been reached. End the session and review before logging another trade.</p>}<button type="button" onClick={end} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-[#e3e2de] px-3 py-2.5 text-xs font-semibold hover:bg-[#f7f6f3]"><Square size={12}/>End and review session</button></div>}
    </div>
  </section>;
}
