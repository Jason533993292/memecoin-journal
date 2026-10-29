"use client";

import { ArrowRight, BookOpenCheck, CheckCircle2, Clock3, Rocket, ShieldCheck } from "lucide-react";
import FeedbackAdminPanel from "@/components/FeedbackAdminPanel";

type RoadmapItem = { text: string; status: "Available" | "In progress" | "Planned" };

const ROADMAP: Array<{ title: string; description: string; items: RoadmapItem[] }> = [
  {
    title: "Privacy & security",
    description: "Keeping private journal data isolated, recoverable, and resistant to abuse.",
    items: [
      { text: "Strict browser security policy and security headers", status: "Available" },
      { text: "Private per-user database rules and least-privilege access", status: "Available" },
      { text: "Account and network limits on costly requests", status: "Available" },
      { text: "Automated secret scanning before releases", status: "Available" },
      { text: "Scheduled dependency and code-security scans", status: "Available" },
      { text: "Encrypted storage option for persistent AI provider keys", status: "Available" },
      { text: "Security history for sensitive account actions", status: "Planned" },
      { text: "Regular credential-rotation checks", status: "Available" },
      { text: "Verified backup restoration exercises", status: "Planned" },
      { text: "Audited administration for feedback reports", status: "Available" },
    ],
  },
  {
    title: "Backend reliability",
    description: "Making saving, importing, notifications, and recovery predictable.",
    items: [
      { text: "Reconciled and repeatable database migration history", status: "Available" },
      { text: "Integration tests against a protected staging database", status: "In progress" },
      { text: "Resumable account deletion across every data store", status: "Available" },
      { text: "Duplicate-safe feedback and import operations", status: "Available" },
      { text: "Request IDs in server logs for faster diagnosis", status: "Available" },
      { text: "Health checks for important external services", status: "Available" },
      { text: "Queued feedback email delivery with retries", status: "In progress" },
      { text: "Automatic monitoring for market-price outages", status: "Available" },
      { text: "Verified database backup checks", status: "In progress" },
      { text: "Alerts for unusual authentication and database errors", status: "Planned" },
    ],
  },
  {
    title: "Frontend quality",
    description: "Keeping every interaction fast, predictable, accessible, and testable.",
    items: [
      { text: "Automated trade create, edit, refresh, and delete journeys", status: "In progress" },
      { text: "Automated accessibility checks", status: "Available" },
      { text: "Friendly recovery screen for unexpected errors", status: "Available" },
      { text: "Clear offline and reconnecting states", status: "Available" },
      { text: "Lazy-loaded charts and large dialogs", status: "Available" },
      { text: "Database-generated TypeScript definitions", status: "Available" },
      { text: "One shared currency and quantity formatter", status: "In progress" },
      { text: "Safer component-based AI response formatting", status: "Available" },
      { text: "Warning-free automated test configuration", status: "Available" },
      { text: "Consistent loading placeholders and request cancellation", status: "In progress" },
    ],
  },
  {
    title: "Interface design",
    description: "Improving readability and consistency across themes, screens, and devices.",
    items: [
      { text: "Automatic contrast checks for every theme", status: "Available" },
      { text: "A documented set of reusable theme colors", status: "In progress" },
      { text: "Consistent card borders and visual depth", status: "In progress" },
      { text: "Compact and comfortable calendar density", status: "Available" },
      { text: "Consistent typography across analytics cards", status: "In progress" },
      { text: "Mobile-friendly full-width forms and panels", status: "In progress" },
      { text: "Consistent chart legends, tooltips, and empty states", status: "Planned" },
      { text: "Unified PAPER, LIVE, WIN, and LOSS badges", status: "In progress" },
      { text: "Visible keyboard focus on every control", status: "In progress" },
      { text: "Clearer guidance when a page has no data", status: "In progress" },
    ],
  },
  {
    title: "User experience",
    description: "Helping traders get value faster and recover safely from mistakes.",
    items: [
      { text: "First-login guided welcome tour", status: "Available" },
      { text: "Automatic saving for unfinished trade drafts", status: "Available" },
      { text: "Undo after deleting a trade", status: "Available" },
      { text: "Import preview with duplicate and error explanations", status: "Available" },
      { text: "Discoverable keyboard-shortcut guide", status: "Available" },
      { text: "Calendar filters for wallet, currency, and strategy", status: "Available" },
      { text: "Direct links between coin theses and resulting trades", status: "Available" },
      { text: "Persistent saved, syncing, and offline status", status: "Available" },
      { text: "Backup and export reminders", status: "Available" },
      { text: "Feedback receipt and resolution tracking", status: "Available" },
    ],
  },
];

const STATUS_STYLES = {
  Available: "bg-emerald-50 text-emerald-700",
  "In progress": "bg-blue-50 text-blue-700",
  Planned: "bg-[#f1f1ef] text-[#5a5957]",
};

const RECOMMENDED_NEXT: Array<{ title: string; detail: string; status: "Ready" | "In progress" | "Needs setup" }> = [
  { title: "Activate protected staging checks", detail: "Connect the two-account privacy journey to protected GitHub staging secrets.", status: "Needs setup" },
  { title: "Activate service alerts", detail: "Add health tokens so database, backup, and feedback-email failures open an incident.", status: "Needs setup" },
  { title: "Complete a database restore drill", detail: "Restore a recent backup into an isolated project and verify it without touching production.", status: "Needs setup" },
  { title: "Enable Firebase App Check", detail: "Observe valid traffic first, then enforce requests from the real web app.", status: "Needs setup" },
  { title: "Feedback administration", detail: "A private allowlisted inbox can assign, resolve, and audit feedback reports.", status: "Ready" },
  { title: "Shared financial formatting", detail: "The shared formatter is live in statistics and the calendar; remaining displays are being migrated.", status: "In progress" },
  { title: "Generated database types", detail: "Hosted definitions are committed and a workflow now rejects stale generated types.", status: "Ready" },
  { title: "Safer AI response rendering", detail: "AI output now uses bounded React sections without HTML injection.", status: "Ready" },
  { title: "Reconciled migration history", detail: "Local filenames now match hosted versions and staging performs a dry-run migration check.", status: "Ready" },
  { title: "Calendar filters", detail: "Filter monthly results by wallet, currency, strategy, and paper or live trading.", status: "Ready" },
];

export default function GuideView({ onStartTour }: { onStartTour: () => void }) {
  return (
    <div className="journal-page space-y-8 pb-12 pt-6">
      <section className="overflow-hidden rounded-3xl border border-[#e3e2de] bg-[#0f1115] p-6 text-white shadow-sm sm:p-8">
        <div className="max-w-3xl">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/15 text-[#55a7f1]"><BookOpenCheck size={24} /></div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#55a7f1]">Guide & improvements</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Learn the journal, then help shape what comes next.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-300">Take the guided tour whenever you need a refresher. The roadmap below shows available improvements separately from work that is still planned.</p>
          <button type="button" onClick={onStartTour} className="group mt-6 flex items-center gap-3 rounded-xl bg-[#1a73ca] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2383e2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#55a7f1]">
            Start guided tour <ArrowRight size={17} className="tour-arrow" />
          </button>
        </div>
      </section>

      <section aria-labelledby="recommended-next-title" className="recommended-next-section rounded-2xl border border-blue-200 bg-blue-50/60 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2383e2] text-white"><Rocket size={19}/></span>
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#176bbd]">Recommended next</p><h2 id="recommended-next-title" className="mt-1 text-lg font-bold text-[#173f73]">The next ten improvements to prioritize</h2><p className="mt-1 text-xs leading-5 text-[#4f6f93]">Ordered by user-data safety, reliability, and the amount of day-to-day friction they remove.</p></div>
        </div>
        <ol className="mt-5 grid gap-3 lg:grid-cols-2">
          {RECOMMENDED_NEXT.map((item, index) => (
            <li key={item.title} className="recommended-next-card flex gap-3 rounded-xl border border-blue-100 bg-white/85 p-4">
              <span className="recommended-next-number flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-[#176bbd]">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-xs font-bold text-[#263d57]">{item.title}</h3><span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${item.status === "Ready" ? "bg-emerald-100 text-emerald-700" : item.status === "In progress" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-800"}`}>{item.status}</span></div>
                <p className="mt-1 text-[11px] leading-4 text-[#607892]">{item.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <FeedbackAdminPanel />

      <section aria-labelledby="roadmap-title">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="roadmap-title" className="text-xl font-bold text-[#37352f]">Product improvement roadmap</h2>
            <p className="mt-1 text-xs text-[#787774]">Fifty improvements across five areas. Statuses describe the current local build.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-[10px] font-semibold">
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">Available</span>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">In progress</span>
            <span className="rounded-full bg-[#f1f1ef] px-2.5 py-1 text-[#5a5957]">Planned</span>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          {ROADMAP.map((section) => (
            <article key={section.title} className="rounded-2xl border border-[#e3e2de] bg-white p-5 shadow-xs">
              <div className="mb-4 flex items-start gap-3 border-b border-[#f1f1ef] pb-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#2383e2]">{section.title === "Privacy & security" ? <ShieldCheck size={18} /> : section.title === "User experience" ? <Rocket size={18} /> : <Clock3 size={18} />}</span>
                <div><h3 className="text-sm font-bold text-[#37352f]">{section.title}</h3><p className="mt-1 text-[11px] leading-4 text-[#787774]">{section.description}</p></div>
              </div>
              <ol className="space-y-2.5">
                {section.items.map((item, index) => (
                  <li key={item.text} className="flex items-start gap-2.5 text-xs">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#f7f6f3] text-[9px] font-bold text-[#787774]">{index + 1}</span>
                    <span className="min-w-0 flex-1 leading-5 text-[#4a4946]">{item.text}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${STATUS_STYLES[item.status]}`}>{item.status === "Available" && <CheckCircle2 size={10} className="mr-1 inline" />}{item.status}</span>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
