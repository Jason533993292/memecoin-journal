"use client";

import { useEffect, useRef, useState } from "react";
import { BarChart3, BookOpen, BrainCircuit, ChevronLeft, ChevronRight, ShieldCheck, Sparkles, X } from "lucide-react";
import { buildDemoTrades } from "../lib/demoTrades";
import { formatSol } from "../lib/utils";

type Choice = "guest" | "signup" | "signin";
const choiceDescriptions: Record<Choice, string> = {
  guest: "Try every main feature without an account. Guest work disappears when the page is refreshed or closed.",
  signup: "Create a private account so your trades, research, and reflections stay saved.",
  signin: "Continue with an account you already created.",
};
const slides = [
  { title: "See your trading patterns", description: "Turn recorded trades into an equity curve, calendar, win rate, and realized P&L.", icon: BarChart3, kind: "chart" as const },
  { title: "Journal the decision, not only the result", description: "Connect your thinking, emotions, rules, and thesis to the trades they influenced.", icon: BookOpen, kind: "journal" as const },
  { title: "Review with discipline", description: "Find repeated strengths and mistakes, then use the optional AI coach for a focused review.", icon: BrainCircuit, kind: "coach" as const },
];

export default function AccessChoiceModal({ onClose, onGuest, onSignUp, onSignIn }: { onClose: () => void; onGuest: () => void; onSignUp: () => void; onSignIn: () => void }) {
  const [activeChoice, setActiveChoice] = useState<Choice | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    dialogRef.current?.setAttribute("data-access-choice-hydrated", "true");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setSlideIndex((index) => (index + 1) % slides.length), 5200);
    return () => window.clearInterval(timer);
  }, []);
  const choiceEvents = (choice: Choice) => ({ onMouseEnter: () => setActiveChoice(choice), onMouseLeave: () => setActiveChoice(null), onFocus: () => setActiveChoice(choice), onBlur: () => setActiveChoice(null) });
  const moveSlide = (direction: number) => setSlideIndex((index) => (index + direction + slides.length) % slides.length);
  const slide = slides[slideIndex];
  const SlideIcon = slide.icon;

  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#05080d]/85 p-4 backdrop-blur-md" onClick={onClose}>
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="access-choice-title" onClick={(event) => event.stopPropagation()} className="relative grid w-full max-w-6xl overflow-hidden rounded-[30px] border border-white/10 bg-[#0d121b] text-white shadow-[0_35px_120px_rgba(0,0,0,.65)] lg:grid-cols-[0.9fr_1.1fr]">
      <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 z-20 rounded-xl bg-black/25 p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"><X size={19}/></button>
      <div className="flex min-h-[580px] flex-col justify-center p-7 sm:p-10 lg:p-12">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-400/10 text-sky-400"><Sparkles size={24}/></div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-sky-400">Memecoin Journal</p>
        <h2 id="access-choice-title" className="mt-3 max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">Trade less blindly. Review every decision.</h2>
        <p className="mt-4 max-w-lg text-sm leading-6 text-slate-300">Track trades, journal your reasoning, connect coin theses, and uncover the habits behind your realized P&amp;L—all in one private workspace.</p>
        <div className="mt-5 flex items-center gap-2 text-xs text-slate-400"><ShieldCheck size={16} className="text-emerald-400"/> Your account data stays private to you.</div>
        <div aria-live="polite" className="mt-8 flex min-h-[68px] items-center rounded-2xl border border-white/8 bg-white/[0.045] px-4 py-3 text-sm leading-5 text-slate-200">{activeChoice ? choiceDescriptions[activeChoice] : "Choose Guest mode to explore temporarily, or Sign up to keep your work."}</div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div><button type="button" onClick={onSignUp} {...choiceEvents("signup")} className="min-h-13 w-full rounded-xl bg-[#1a73ca] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/20 transition duration-200 hover:-translate-y-0.5 hover:bg-[#2386df] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400">Sign up</button><p className="mt-2 text-center text-[11px] leading-4 text-slate-400">Private account · saved workspace</p></div>
          <div><button type="button" onClick={onGuest} {...choiceEvents("guest")} className="min-h-13 w-full rounded-xl bg-[#9a4b14] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-orange-950/20 transition duration-200 hover:-translate-y-0.5 hover:bg-[#7f3d10] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f1ad68]">Guest mode</button><p className="mt-2 text-center text-[11px] leading-4 text-slate-400">No account · cleared on refresh</p></div>
        </div>
        <div className="mt-5 text-center"><button type="button" onClick={onSignIn} {...choiceEvents("signin")} className="text-sm font-semibold text-sky-400 underline decoration-2 underline-offset-4 transition hover:text-sky-300 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-400">Sign in</button><p className="mt-2 text-[11px] text-slate-400">Use an existing account</p></div>
      </div>
      <div className="relative hidden min-h-[580px] overflow-hidden border-l border-white/8 bg-[radial-gradient(circle_at_30%_25%,rgba(35,131,226,.22),transparent_40%),linear-gradient(145deg,#0a1522,#080b12_70%)] p-10 lg:flex lg:flex-col lg:justify-center">
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.04)_1px,transparent_1px)] [background-size:42px_42px]"/>
        <div key={slide.kind} className="relative animate-in fade-in slide-in-from-right-3 duration-500">
          <div className="overflow-hidden rounded-3xl border border-white/12 bg-[#111824]/90 p-5 shadow-2xl shadow-black/40">
            <div className="mb-5 flex items-center justify-between"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/15 text-sky-400"><SlideIcon size={20}/></div><div><p className="text-sm font-semibold">{slide.title}</p><p className="text-[11px] text-slate-400">Workspace preview</p></div></div><span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-300">Private</span></div>
            {slide.kind === "chart" && <ChartPreview/>}
            {slide.kind === "journal" && <JournalPreview/>}
            {slide.kind === "coach" && <CoachPreview/>}
          </div>
          <p className="mx-auto mt-6 max-w-lg text-center text-sm leading-6 text-slate-400">{slide.description}</p>
        </div>
        <div className="relative mt-7 flex items-center justify-center gap-3"><button type="button" onClick={() => moveSlide(-1)} aria-label="Previous preview" className="rounded-lg p-2 text-slate-400 hover:bg-white/8 hover:text-white"><ChevronLeft size={18}/></button><div className="flex gap-2">{slides.map((item,index)=><button key={item.kind} type="button" onClick={()=>setSlideIndex(index)} aria-label={`Show preview ${index+1}`} aria-current={index===slideIndex} className={`h-2 rounded-full transition-all ${index===slideIndex ? "w-7 bg-sky-400" : "w-2 bg-slate-600 hover:bg-slate-500"}`}/>)}</div><button type="button" onClick={() => moveSlide(1)} aria-label="Next preview" className="rounded-lg p-2 text-slate-400 hover:bg-white/8 hover:text-white"><ChevronRight size={18}/></button></div>
      </div>
    </section>
  </div>;
}

function ChartPreview() {
  const trades = buildDemoTrades();
  const pnl = trades.reduce((sum, trade) => sum + trade.pnlSol, 0);
  const wins = trades.filter((trade) => trade.result === "Win").length;
  const values = [
    ["Realized P&L", `${pnl >= 0 ? "+" : ""}${formatSol(pnl)} SOL`],
    ["Win rate", `${Math.round((wins / Math.max(trades.length, 1)) * 100)}%`],
    ["Trades", String(trades.length)],
  ];
  return <div><div className="grid grid-cols-3 gap-3">{values.map(([label,value])=><div key={label} className="rounded-xl border border-white/8 bg-white/[0.035] p-3"><p className="text-[10px] text-slate-400">{label}</p><p className="mt-1 text-sm font-bold text-emerald-300">{value}</p></div>)}</div><svg viewBox="0 0 520 180" className="mt-5 h-52 w-full" aria-label="Example cumulative trading curve"><defs><linearGradient id="welcome-chart" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#22c55e" stopOpacity=".35"/><stop offset="1" stopColor="#22c55e" stopOpacity="0"/></linearGradient></defs><path d="M10 160 C70 155,90 135,135 125 S200 122,235 82 S300 65,340 72 S405 85,445 35 S485 24,510 20 L510 170 L10 170Z" fill="url(#welcome-chart)"/><path d="M10 160 C70 155,90 135,135 125 S200 122,235 82 S300 65,340 72 S405 85,445 35 S485 24,510 20" fill="none" stroke="#34d399" strokeWidth="4" strokeLinecap="round"/></svg></div>;
}
function JournalPreview() {
  return <div className="rounded-2xl border border-sky-300/15 bg-[#0b1728] p-6 shadow-inner"><div className="flex justify-between border-b border-sky-200/10 pb-3"><strong className="font-serif text-slate-50">Post-trade reflection</strong><span className="text-xs text-sky-100/55">Today</span></div><div className="mt-4 space-y-3 font-serif text-sm leading-7 text-slate-200/80"><p className="border-b border-sky-100/10">What did I see before entering?</p><p className="border-b border-sky-100/10">Did the trade still match my thesis?</p><p className="border-b border-sky-100/10">What will I repeat or avoid next time?</p><p className="border-b border-sky-100/10 text-sky-200/45">Start writing on any line…</p></div></div>;
}
function CoachPreview() {
  return <div className="space-y-3"><div className="rounded-2xl border border-blue-400/15 bg-blue-400/[0.06] p-4"><p className="text-xs font-semibold text-sky-300">Pattern found</p><p className="mt-2 text-sm leading-6 text-slate-300">Your strongest results came from planned pullbacks. Chased entries produced most avoidable losses.</p></div><div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-white/[0.04] p-4"><p className="text-[10px] text-slate-400">Primary strength</p><p className="mt-1 text-sm font-semibold text-emerald-300">Followed plan</p></div><div className="rounded-xl bg-white/[0.04] p-4"><p className="text-[10px] text-slate-400">Review next</p><p className="mt-1 text-sm font-semibold text-rose-300">Chased entry</p></div></div><div className="rounded-xl border border-white/8 p-3 text-xs text-slate-400">Ask: “Which setup should I stop forcing?”</div></div>;
}
