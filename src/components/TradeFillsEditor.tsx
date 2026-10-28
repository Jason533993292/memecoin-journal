"use client";

import { MinusCircle, Plus } from "lucide-react";
import type { TradeFill } from "@/lib/types";
import { summarizeTradeFills } from "@/lib/tradeInput";

type Props = {
  fills: TradeFill[];
  quoteSymbol: string;
  onChange: (fills: TradeFill[]) => void;
};

function localInputValue(timestamp: number) {
  const date = new Date(timestamp);
  return new Date(timestamp - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export default function TradeFillsEditor({ fills, quoteSymbol, onChange }: Props) {
  const summary = summarizeTradeFills(fills);
  const add = (side: TradeFill["side"]) => onChange([
    ...fills,
    { id: crypto.randomUUID(), side, quoteAmount: 0, feeSol: 0, executedAt: Date.now() },
  ]);
  const update = (id: string, patch: Partial<TradeFill>) => onChange(fills.map((fill) => fill.id === id ? { ...fill, ...patch } : fill));
  const remove = (id: string) => onChange(fills.filter((fill) => fill.id !== id));

  return (
    <details className="rounded-xl border border-[#e3e2de] bg-white p-3">
      <summary className="cursor-pointer text-xs font-semibold text-[#37352f]">Partial entries & exits {fills.length ? `· ${fills.length} fills` : ""}</summary>
      <p className="mt-1 text-[10px] text-[#787774]">Record each amount spent or received. Totals and fees automatically replace the aggregate fields above.</p>
      <div className="mt-3 space-y-2">
        {fills.map((fill, index) => (
          <div key={fill.id} className="grid grid-cols-[72px_1fr_1fr_1.35fr_28px] gap-2 rounded-lg border border-[#eee] bg-[#fbfbfa] p-2">
            <select aria-label={`Fill ${index + 1} side`} value={fill.side} onChange={(event) => update(fill.id, { side: event.target.value as TradeFill["side"] })} className="rounded-md border border-[#e3e2de] bg-white px-1.5 py-1 text-[11px]"><option value="entry">Entry</option><option value="exit">Exit</option></select>
            <label className="text-[9px] text-[#787774]">Amount ({quoteSymbol})<input aria-label={`Fill ${index + 1} amount`} type="number" min="0" step="any" value={fill.quoteAmount || ""} onWheel={(event) => event.currentTarget.blur()} onChange={(event) => update(fill.id, { quoteAmount: Number(event.target.value) })} className="mt-0.5 w-full rounded-md border border-[#e3e2de] bg-white px-1.5 py-1 font-mono text-[11px]" /></label>
            <label className="text-[9px] text-[#787774]">Fee (SOL)<input aria-label={`Fill ${index + 1} fee`} type="number" min="0" step="any" value={fill.feeSol || ""} onWheel={(event) => event.currentTarget.blur()} onChange={(event) => update(fill.id, { feeSol: Number(event.target.value) })} className="mt-0.5 w-full rounded-md border border-[#e3e2de] bg-white px-1.5 py-1 font-mono text-[11px]" /></label>
            <label className="text-[9px] text-[#787774]">Executed<input aria-label={`Fill ${index + 1} time`} type="datetime-local" value={localInputValue(fill.executedAt)} onChange={(event) => update(fill.id, { executedAt: new Date(event.target.value).getTime() })} className="mt-0.5 w-full rounded-md border border-[#e3e2de] bg-white px-1.5 py-1 text-[10px]" /></label>
            <button type="button" onClick={() => remove(fill.id)} aria-label={`Remove fill ${index + 1}`} className="self-end rounded-md p-1 text-rose-600 hover:bg-rose-50"><MinusCircle size={14}/></button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => add("entry")} className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800"><Plus size={11} className="mr-1 inline"/>Entry</button>
        <button type="button" onClick={() => add("exit")} className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-800"><Plus size={11} className="mr-1 inline"/>Exit</button>
        {fills.length > 0 && <span className="ml-auto text-[10px] text-[#787774]">Spent {summary.boughtQuote.toFixed(2)} · Received {summary.soldQuote.toFixed(2)} · P&L {summary.pnlQuote >= 0 ? "+" : ""}{summary.pnlQuote.toFixed(2)} {quoteSymbol} · Fees {summary.feesSol.toFixed(4)} SOL</span>}
      </div>
    </details>
  );
}
