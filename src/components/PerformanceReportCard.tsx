"use client";

import { useMemo, useState } from "react";
import { CalendarRange, Clipboard } from "lucide-react";
import type { Trade } from "../lib/types";
import { buildPerformanceReport, type PerformanceReportPeriod } from "../lib/performanceReport";
import { formatRealizedPnl } from "../lib/utils";
import { useToast } from "./Toast";

export default function PerformanceReportCard({ trades, currency, solPrice }: { trades: Trade[]; currency: "SOL" | "USD"; solPrice: number }) {
  const [period, setPeriod] = useState<PerformanceReportPeriod>("week");
  const { showToast } = useToast();
  const report = useMemo(() => buildPerformanceReport(trades, period, new Date(), solPrice), [trades, period, solPrice]);
  const pnl = currency === "SOL" ? report.pnlSol : report.pnlUsd;
  const previous = currency === "SOL" ? report.previousPnlSol : report.previousPnlUsd;
  const summary = `${report.label}: ${report.count} trades, ${report.winRate == null ? "no win-rate sample" : `${report.winRate.toFixed(0)}% win rate`}, ${formatRealizedPnl(pnl, currency)} realized P&L. Best setup: ${report.bestSetup?.name ?? "not enough data"}. Most repeated mistake: ${report.repeatedMistake?.name ?? "none recorded"}.`;
  return <section aria-labelledby="performance-report-title" className="rounded-xl border border-[#e3e2de] bg-[#fbfbfa] p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 id="performance-report-title" className="flex items-center gap-2 text-sm font-semibold text-[#37352f]"><CalendarRange size={16} className="text-[#2383e2]"/>Performance review</h2><p className="mt-1 text-[11px] text-[#787774]">A factual summary of the selected period. Small samples are shown, not hidden.</p></div>
      <div className="flex items-center gap-2"><div className="flex rounded-lg border border-[#e3e2de] bg-white p-1 text-xs font-semibold">{(["week", "month"] as const).map((value) => <button type="button" key={value} onClick={() => setPeriod(value)} aria-pressed={period === value} className={`rounded-md px-3 py-1.5 ${period === value ? "bg-[#f1f1ef] text-[#37352f]" : "text-[#787774]"}`}>{value === "week" ? "Weekly" : "Monthly"}</button>)}</div><button type="button" title="Copy review" aria-label="Copy performance review" className="rounded-lg border border-[#e3e2de] bg-white p-2 text-[#787774] hover:bg-[#f1f1ef]" onClick={() => void navigator.clipboard.writeText(summary).then(() => showToast("Review copied", "success")).catch(() => showToast("Could not copy review", "error"))}><Clipboard size={15}/></button></div>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <ReportMetric label="Realized P&L" value={formatRealizedPnl(pnl, currency)} detail={`Previous period ${formatRealizedPnl(previous, currency)}`} tone={pnl >= 0 ? "positive" : "negative"}/>
      <ReportMetric label="Win rate" value={report.winRate == null ? "—" : `${report.winRate.toFixed(0)}%`} detail={`${report.wins} wins · ${report.count} trades`}/>
      <ReportMetric label="Average / trade" value={formatRealizedPnl(currency === "SOL" ? report.averageSol : report.averageUsd, currency)} detail={`Recorded fees ${formatRealizedPnl(currency === "SOL" ? report.feesSol : report.feesUsd, currency)}`}/>
      <ReportMetric label="Best setup" value={report.bestSetup?.name ?? "—"} detail={report.bestSetup ? `${report.bestSetup.count} trades · ${formatRealizedPnl(currency === "SOL" ? report.bestSetup.pnlSol : report.bestSetup.pnlUsd, currency)}` : "No trades in this period"}/>
    </div>
    <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs text-[#5a5957]"><strong>Repeated mistake:</strong> {report.repeatedMistake ? `${report.repeatedMistake.name} (${report.repeatedMistake.count} trades)` : "No mistake tag repeated in this period."}</p>
  </section>;
}

function ReportMetric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone?: "positive" | "negative" }) {
  return <div className="rounded-lg border border-[#e9e9e7] bg-white p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-[#787774]">{label}</p><p className={`mt-1 truncate text-lg font-semibold ${tone === "positive" ? "text-emerald-600" : tone === "negative" ? "text-rose-600" : "text-[#37352f]"}`} title={value}>{value}</p><p className="mt-1 text-[10px] text-[#9b9a97]">{detail}</p></div>;
}

