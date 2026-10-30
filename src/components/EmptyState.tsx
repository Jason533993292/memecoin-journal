import type { ReactNode } from "react";

export default function EmptyState({ icon, title, detail, actionLabel, onAction, compact = false }: {
  icon: ReactNode;
  title: string;
  detail: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}) {
  return (
    <div role="status" className={`mx-auto flex max-w-lg flex-col items-center justify-center rounded-2xl border border-dashed border-[#d8d7d3] bg-white/70 text-center ${compact ? "p-6" : "p-10"}`}>
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f1f1ef] text-[#5a5957]">{icon}</span>
      <h3 className="text-sm font-bold text-[#37352f]">{title}</h3>
      <p className="mt-1.5 max-w-sm text-xs leading-5 text-[#686762]">{detail}</p>
      {actionLabel && onAction && <button type="button" onClick={onAction} className="mt-4 rounded-lg bg-[#1a73ca] px-4 py-2 text-xs font-semibold text-white hover:bg-[#155fa8]">{actionLabel}</button>}
    </div>
  );
}
