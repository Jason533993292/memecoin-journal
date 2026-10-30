import { BarChart3 } from "lucide-react";

export function ChartEmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div role="status" className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-[#d8d7d3] bg-white/70 p-6 text-center">
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#176bbd]"><BarChart3 size={19} /></span>
      <p className="text-xs font-semibold text-[#37352f]">{title}</p>
      <p className="mt-1 max-w-md text-[11px] leading-5 text-[#686762]">{detail}</p>
    </div>
  );
}

export function ChartLegend({ seriesLabel, seriesColor, markerLabel }: { seriesLabel: string; seriesColor: string; markerLabel?: string }) {
  return (
    <div aria-label="Chart legend" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-[#686762]">
      <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-5 rounded-full" style={{ backgroundColor: seriesColor }} />{seriesLabel}</span>
      {markerLabel && <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-white bg-[#2383e2] shadow-[0_0_0_1px_#9b9a97]" />{markerLabel}</span>}
    </div>
  );
}
