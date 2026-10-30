export default function LoadingState({ label = "Loading section" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-label={label} className="min-h-[240px] animate-pulse space-y-4 rounded-2xl border border-[#e9e9e7] bg-[#fbfbfa] p-5">
      <span className="sr-only">{label}…</span>
      <div className="h-5 w-48 rounded-md bg-[#e9e9e7]" />
      <div className="h-3 w-80 max-w-full rounded bg-[#f1f1ef]" />
      <div className="grid gap-3 pt-3 sm:grid-cols-3">
        {[0, 1, 2].map((item) => <div key={item} className="h-28 rounded-xl border border-[#e9e9e7] bg-white" />)}
      </div>
      <div className="h-24 rounded-xl bg-[#f1f1ef]" />
    </div>
  );
}
