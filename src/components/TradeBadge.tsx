import { TRADE_BADGE_LABELS, TRADE_BADGE_STYLES, type TradeBadgeKind } from "@/lib/tradeBadges";

export default function TradeBadge({ kind, compact = false }: { kind: TradeBadgeKind; compact?: boolean }) {
  return (
    <span className={`inline-flex items-center rounded-full border font-bold uppercase tracking-[0.08em] ${compact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]"} ${TRADE_BADGE_STYLES[kind]}`}>
      {TRADE_BADGE_LABELS[kind]}
    </span>
  );
}
