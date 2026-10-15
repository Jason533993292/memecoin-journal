interface BetaBadgeProps {
  tone?: "light" | "dark";
}

export default function BetaBadge({ tone = "light" }: BetaBadgeProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase leading-none tracking-[0.08em] ${
        tone === "dark"
          ? "border-white/20 bg-white/10 text-white/70"
          : "border-[#d6d3cd] bg-[#f7f6f3] text-[#787774]"
      }`}
      title="This feature is new and may change based on beta feedback"
    >
      Beta
    </span>
  );
}
