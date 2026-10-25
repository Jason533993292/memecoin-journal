"use client";

import { CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BookOpen, ChevronLeft, X } from "lucide-react";

type SpotlightStep = {
  id: string;
  selector: string;
  title: string;
  description: string;
  instruction: string;
  requireTargetClick: boolean;
  viewTab?: string;
  chapter: string;
};

const SPOTLIGHT_STEPS: SpotlightStep[] = [
  { id: "dashboard", chapter: "Dashboard", selector: '[data-tour="nav-dashboard"]', title: "Dashboard", description: "Your daily overview brings results, recent activity, goals, the trading calendar, and the equity curve together.", instruction: "Click the highlighted Dashboard button.", requireTargetClick: true },
  { id: "dashboard-summary", chapter: "Dashboard", selector: '[data-tour="dashboard-summary"]', title: "Performance at a glance", description: "These cards summarize net P&L, win rate, trade count, and today's result. Customize lets you choose which cards appear on this device.", instruction: "This live example updates from the trades currently shown.", requireTargetClick: false, viewTab: "dashboard" },
  { id: "equity-curve", chapter: "Dashboard", selector: '[data-tour="equity-curve"]', title: "Cumulative Equity Curve", description: "See how realized results build over time. Switch between P&L, balance, drawdown, SOL, USD, and time ranges.", instruction: "The tutorial scrolled to the live chart automatically.", requireTargetClick: false, viewTab: "dashboard" },
  { id: "calendar", chapter: "Dashboard", selector: '[data-tour="monthly-calendar"]', title: "Monthly Trading Calendar", description: "Every day shows its realized profit or loss. Click a day containing trades to reveal the trades behind that result.", instruction: "The highlighted calendar is a live visual example.", requireTargetClick: false, viewTab: "dashboard" },
  { id: "journal", chapter: "Trades", selector: '[data-tour="nav-journal"]', title: "Trades", description: "Trades is the searchable record of every paper and live trade.", instruction: "Click the highlighted Trades button.", requireTargetClick: true },
  { id: "journal-filters", chapter: "Journal", selector: '[data-tour="journal-filters"]', title: "Search, filter, and change views", description: "Narrow trades by result, date, setup, wallet, or emotion tag, then switch between table and card layouts.", instruction: "Filters change only what is displayed; they do not modify a trade.", requireTargetClick: false, viewTab: "journal" },
  { id: "journal-results", chapter: "Journal", selector: '[data-tour="journal-example"]', title: "Example trade card", description: "This complete example shows the token, setup, holding time, position size, result, P&L, discipline tags, and date. Real trade cards also provide actions to inspect, edit, share, and safely delete.", instruction: "Tutorial examples are fictional, read-only, and never saved to your account.", requireTargetClick: false, viewTab: "journal" },
  { id: "daily-journal", chapter: "Daily Journal", selector: '[data-tour="nav-daily-journal"]', title: "Daily Journal", description: "This is your private space for thoughts, emotions, lessons, and the decisions surrounding your trades.", instruction: "Click the highlighted Daily Journal button.", requireTargetClick: true },
  { id: "daily-journal-new", chapter: "Daily Journal", selector: '[data-tour="daily-journal-new-entry"]', title: "Two clear ways to begin", description: "Free writing opens a blank page. Guided entry gives you a Pre-trade, Post-trade, or End-of-day structure.", instruction: "Tutorial examples are read-only, so neither button will save anything while the tour is active.", requireTargetClick: false, viewTab: "daily-journal" },
  { id: "daily-journal-library", chapter: "Daily Journal", selector: '[data-tour="daily-journal-library"]', title: "Find past reflections", description: "Search titles, writing, emotions, and tags. Switch to the calendar to return to entries from a particular day, or recover an unfinished browser draft.", instruction: "The example reflection is fictional and is never added to your account.", requireTargetClick: false, viewTab: "daily-journal" },
  { id: "daily-journal-editor", chapter: "Daily Journal", selector: '[data-tour="daily-journal-editor"]', title: "Write inside your journal book", description: "The left page holds your title, date, ruled writing area, formatting tools, and a choice of Clean, Classic, Typewriter, or Handwritten fonts. Previous and Next turn between saved entries.", instruction: "Focus mode opens the book over the rest of the app. Your font choice is remembered only as a display preference.", requireTargetClick: false, viewTab: "daily-journal" },
  { id: "daily-journal-context", chapter: "Daily Journal", selector: '[data-tour="daily-journal-reflection-tools"]', title: "Add emotional context", description: "Record emotions and intensity, add searchable tags, and link the reflection to the trade or trades that prompted it.", instruction: "Linked trades help you compare what you felt with what actually happened.", requireTargetClick: false, viewTab: "daily-journal" },
  { id: "daily-journal-save", chapter: "Daily Journal", selector: '[data-tour="daily-journal-save"]', title: "Automatic private saving", description: "After you pause typing, the journal automatically syncs the reflection to your private account. Save now lets you sync immediately; offline drafts remain in this browser for recovery.", instruction: "The tutorial will not save the fictional example.", requireTargetClick: false, viewTab: "daily-journal" },
  { id: "wallets", chapter: "Wallets", selector: '[data-tour="nav-wallets"]', title: "Wallets & Paychecks", description: "Track real Solana wallets separately from simulated paper-trading capital.", instruction: "Click the highlighted Wallets button.", requireTargetClick: true },
  { id: "wallet-scan", chapter: "Wallets", selector: '[data-tour="wallet-scan"]', title: "Check a public Solana address", description: "Paste a public Phantom or Solflare address to read its current on-chain SOL balance. Private keys and seed phrases should never be entered here.", instruction: "Scanning is optional; the tutorial will not submit an address.", requireTargetClick: false, viewTab: "wallets" },
  { id: "paper-capital", chapter: "Wallets", selector: '[data-tour="paper-capital"]', title: "Paper Trading Capital", description: "Set a fictional starting balance for practice trades. Current simulated equity combines that starting amount with paper-trade P&L.", instruction: "Paper capital is not real SOL and cannot be withdrawn.", requireTargetClick: false, viewTab: "wallets" },
  { id: "new-wallet", chapter: "Wallets", selector: '[data-tour="new-wallet"]', title: "Add a trading wallet", description: "Create a named wallet with a balance and optional public address so trades and performance can be grouped correctly.", instruction: "This explanation does not open or submit the form.", requireTargetClick: false, viewTab: "wallets" },
  { id: "wallet-records", chapter: "Wallets", selector: '[data-tour="wallet-records"]', title: "Wallet performance and actions", description: "Review each wallet's balance, win rate, trades, P&L, address, deposits, withdrawals, and management actions in one place.", instruction: "If you have no real wallets yet, this area explains what will appear after you add one.", requireTargetClick: false, viewTab: "wallets" },
  { id: "wallet-history", chapter: "Wallets", selector: '[data-tour="wallet-history"], [data-tour="wallet-records"]', title: "Deposit & Paycheck History", description: "Deposits record capital moved into a wallet. Paychecks record profit removed from it without changing your historical trades.", instruction: "The history keeps those balance changes separate from trading P&L. The tab appears after the first wallet transaction exists.", requireTargetClick: false, viewTab: "wallets" },
  { id: "analytics", chapter: "Analytics", selector: '[data-tour="nav-statistics"]', title: "Statistics & Analytics", description: "Compare win rate, setups, discipline, streaks, holding time, and performance across your saved history.", instruction: "Click the highlighted Analytics button.", requireTargetClick: true },
  { id: "analytics-calendar", chapter: "Analytics", selector: '[data-tour="monthly-calendar"]', title: "Review every trading day", description: "Move between months, switch SOL or USD, and select any profit or loss day to open the trade cards that produced that result.", instruction: "Use the calendar to connect a monthly total back to the individual decisions behind it.", requireTargetClick: false, viewTab: "statistics" },
  { id: "analytics-discipline", chapter: "Analytics", selector: '[data-tour="analytics-discipline"]', title: "Discipline & confidence", description: "Compare process grades and entry confidence with actual outcomes to find where execution matches—or conflicts with—your expectations.", instruction: "Small samples can mislead, so use these figures as descriptive evidence.", requireTargetClick: false, viewTab: "statistics" },
  { id: "analytics-duration", chapter: "Analytics", selector: '[data-tour="analytics-duration"]', title: "Holding-time patterns", description: "Compare how long winning and losing trades stay open. This can reveal whether you cut winners too early or let losing positions linger.", instruction: "Treat the insight as a pattern to investigate, not a rule based on only a few trades.", requireTargetClick: false, viewTab: "statistics" },
  { id: "analytics-setups", chapter: "Analytics", selector: '[data-tour="analytics-setups"]', title: "Strategy & setup performance", description: "Each setup is grouped by trade count, win rate, and realized P&L. Use the SOL/USD control to view the result in either currency.", instruction: "Compare both profitability and sample size before changing your strategy.", requireTargetClick: false, viewTab: "statistics" },
  { id: "analytics-yearly", chapter: "Analytics", selector: '[data-tour="analytics-yearly"]', title: "Yearly statistics", description: "This summary separates trade count and realized USD by year, making longer-term activity and results easier to compare.", instruction: "USD totals use the price information recorded or available for each trade.", requireTargetClick: false, viewTab: "statistics" },
  { id: "research", chapter: "Research", selector: '[data-tour="nav-research"]', title: "Coin Research & Thesis", description: "Build a structured thesis, save evidence, record invalidation rules, and copy the complete thesis for sharing.", instruction: "Click the highlighted Research button.", requireTargetClick: true },
  { id: "research-editor", chapter: "Research", selector: 'main[data-tour="research-editor"] > div:first-child', title: "Build a coin thesis", description: "Record the token, confidence, time horizon, bull and bear cases, catalysts, risks, invalidation, entry, stop, targets, sources, and position-size plan in one structured workspace.", instruction: "The example thesis is fictional and is not saved. Use Save research when you create a real thesis.", requireTargetClick: false, viewTab: "research" },
  { id: "research-copy", chapter: "Research", selector: '[title="Copy the complete shareable thesis in Discord-friendly Markdown"]', title: "Share the complete thesis", description: "Copy full thesis creates a Discord-friendly summary of the research fields, so you can review or share the plan without rewriting it.", instruction: "Review copied text before sharing and never include a private key or seed phrase.", requireTargetClick: false, viewTab: "research" },
  { id: "research-timeline", chapter: "Research", selector: '[aria-label="Add research timeline note"]', title: "Update the evidence over time", description: "Add dated research snapshots when a catalyst, price condition, liquidity signal, or assumption changes.", instruction: "A timeline helps you distinguish what you knew before a trade from what became clear afterward.", requireTargetClick: false, viewTab: "research" },
  { id: "research-decisions", chapter: "Research", selector: '[aria-label="Decision journal note"]', title: "Record the decision, not just the outcome", description: "The decision journal captures your mood and reasoning when a plan changes or an entry is considered. It is descriptive, not a personal score.", instruction: "Specific notes make later review more useful than labels such as good or bad trade.", requireTargetClick: false, viewTab: "research" },
  { id: "ai-coach", chapter: "AI Coach", selector: '[data-tour="nav-ai-coach"]', title: "AI Trader Coach", description: "Review execution patterns and discipline using the AI provider you choose. Your provider key remains under your control.", instruction: "Click the highlighted AI Coach button.", requireTargetClick: true },
  { id: "ai-provider-settings", chapter: "AI Coach", selector: '[data-tour="ai-provider-settings"]', title: "Your API key stays in your browser", description: "By default, the provider key is kept only for this browser-tab session. If you select ‘Keep this key’, it is stored in this browser's local storage and is not encrypted.", instruction: "Only when you request analysis is the key sent over HTTPS through the app server to your selected provider. The app server does not intentionally store it.", requireTargetClick: false, viewTab: "ai-coach" },
  { id: "ai-analysis", chapter: "AI Coach", selector: '[data-tour="ai-analysis"]', title: "Generate a trading review", description: "Refresh AI Review sends relevant recent trade information and discipline tags to the provider you configured, then displays the resulting coaching analysis here.", instruction: "AI output can be wrong. Use it as a review aid, not financial advice or an automatic trading decision.", requireTargetClick: false, viewTab: "ai-coach" },
  { id: "ai-question", chapter: "AI Coach", selector: '[data-tour="ai-question"]', title: "Ask a focused follow-up", description: "Ask a specific question about patterns in the journal, such as repeated mistakes, sizing discipline, entry timing, or exit behavior.", instruction: "A narrow question usually produces a more useful answer than asking for general trading advice.", requireTargetClick: false, viewTab: "ai-coach" },
  { id: "feedback", chapter: "Help", selector: '[data-tour="feedback"]', title: "Feedback", description: "Report a bug or suggest an improvement. Optional diagnostics help reproduce what happened without including your financial totals.", instruction: "Click Feedback to finish the tour and open the feedback form.", requireTargetClick: true },
];

type TargetRect = { top: number; left: number; right: number; bottom: number; width: number; height: number };

interface WelcomeTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  onNavigateTab: (tab: string) => void;
}

function findVisibleTarget(selector: string) {
  return Array.from(document.querySelectorAll<HTMLElement>(selector)).find((element) => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  }) ?? null;
}

export default function WelcomeTourModal({ isOpen, onClose, onComplete, onNavigateTab }: WelcomeTourModalProps) {
  const [started, setStarted] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const introButtonRef = useRef<HTMLButtonElement>(null);
  const step = SPOTLIGHT_STEPS[stepIndex];

  const advance = useCallback(() => {
    if (stepIndex === SPOTLIGHT_STEPS.length - 1) {
      onComplete();
      return;
    }
    setStepIndex((index) => index + 1);
  }, [onComplete, stepIndex]);

  const goBack = useCallback(() => setStepIndex((index) => Math.max(0, index - 1)), []);

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => introButtonRef.current?.focus(), 0);
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKeyDown);
    return () => { window.clearTimeout(timer); window.removeEventListener("keydown", handleKeyDown); };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !started) return;
    const root = document.documentElement;
    const body = document.body;
    const previousRootOverflow = root.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    const previousOverscroll = root.style.overscrollBehavior;
    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    root.style.overscrollBehavior = "none";

    const isInsideTutorial = (target: EventTarget | null) =>
      target instanceof Element && Boolean(target.closest("[data-tour-dialog]"));
    const preventBackgroundScroll = (event: Event) => {
      if (!isInsideTutorial(event.target)) event.preventDefault();
    };
    const lockTutorialKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
        return;
      }
      if (isInsideTutorial(event.target)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    window.addEventListener("wheel", preventBackgroundScroll, { passive: false, capture: true });
    window.addEventListener("touchmove", preventBackgroundScroll, { passive: false, capture: true });
    window.addEventListener("keydown", lockTutorialKeyboard, true);
    return () => {
      root.style.overflow = previousRootOverflow;
      body.style.overflow = previousBodyOverflow;
      root.style.overscrollBehavior = previousOverscroll;
      window.removeEventListener("wheel", preventBackgroundScroll, true);
      window.removeEventListener("touchmove", preventBackgroundScroll, true);
      window.removeEventListener("keydown", lockTutorialKeyboard, true);
    };
  }, [isOpen, onClose, started]);

  useEffect(() => {
    if (!isOpen || !started || !step) return;
    if (step.viewTab) onNavigateTab(step.viewTab);

    let target: HTMLElement | null = null;
    let clickTarget: HTMLElement | null = null;
    let clickHandler: (() => void) | null = null;
    let hasAdvanced = false;
    let hasRequestedScroll = false;
    const timers: number[] = [];
    const updateTarget = () => {
      target = findVisibleTarget(step.selector);
      if (!target) { setTargetRect(null); return; }
      const initialRect = target.getBoundingClientRect();
      if (!hasRequestedScroll && (initialRect.top < 76 || initialRect.bottom > window.innerHeight - 28)) {
        hasRequestedScroll = true;
        target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      }
      const measure = () => {
        if (!target) return;
        const rect = target.getBoundingClientRect();
        const padding = 7;
        const height = Math.min(rect.height + padding * 2, window.innerHeight * 0.68);
        const top = Math.max(0, Math.min(rect.top - padding, window.innerHeight - height));
        setTargetRect({ top, left: Math.max(0, rect.left - padding), right: Math.min(window.innerWidth, rect.right + padding), bottom: top + height, width: Math.min(rect.width + padding * 2, window.innerWidth), height });
      };
      measure();
      timers.push(window.setTimeout(measure, 420));
      if (step.requireTargetClick && clickTarget !== target) {
        if (clickTarget && clickHandler) clickTarget.removeEventListener("click", clickHandler);
        clickTarget = target;
        clickHandler = () => {
          if (hasAdvanced) return;
          hasAdvanced = true;
          window.setTimeout(advance, 40);
        };
        clickTarget.addEventListener("click", clickHandler, { once: true });
      }
    };
    timers.push(window.setTimeout(updateTarget, 80));
    window.addEventListener("resize", updateTarget);
    window.addEventListener("scroll", updateTarget, true);
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      if (clickTarget && clickHandler) clickTarget.removeEventListener("click", clickHandler);
      window.removeEventListener("resize", updateTarget);
      window.removeEventListener("scroll", updateTarget, true);
    };
  }, [advance, isOpen, onNavigateTab, started, step]);

  if (!isOpen) return null;
  if (!started) {
    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
        <section role="dialog" aria-modal="true" aria-labelledby="welcome-tour-title" className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-[#111318] p-6 text-white shadow-2xl sm:p-8">
          <button type="button" onClick={onClose} aria-label="Close welcome tour" className="absolute right-4 top-4 rounded-lg p-2 text-neutral-400 transition hover:bg-white/8 hover:text-white"><X size={18} /></button>
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/15 text-[#55a7f1]"><BookOpen size={24} /></div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#55a7f1]">Welcome</p>
          <h2 id="welcome-tour-title" className="pr-8 text-2xl font-bold tracking-tight">Welcome to Memecoin Journal</h2>
          <p className="mt-3 text-sm leading-6 text-neutral-300">Thanks for using this journal. Every user is welcome. The guided tutorial will darken the page, point to each real feature, and wait for you to click the highlighted controls.</p>
          <div className="mt-5 rounded-2xl bg-white/[0.055] p-4 text-xs leading-5 text-neutral-300">When the tutorial explains a feature lower on the page, it will automatically scroll to it and use the live interface as the visual example.</div>
          <div className="mt-7 flex flex-wrap items-center justify-end gap-3">
            <button type="button" onClick={onComplete} className="h-11 rounded-xl px-4 text-xs font-semibold text-neutral-400 transition hover:bg-white/8 hover:text-white">Skip tutorial</button>
            <button ref={introButtonRef} type="button" onClick={() => setStarted(true)} className="group flex h-11 items-center gap-3 rounded-xl bg-[#1a73ca] px-5 text-sm font-semibold text-white transition hover:bg-[#2383e2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#55a7f1]">Continue tutorial <ArrowRight size={18} className="tour-arrow" /></button>
          </div>
        </section>
      </div>
    );
  }

  const viewportWidth = typeof window === "undefined" ? 1200 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 800 : window.innerHeight;
  const tooltipWidth = Math.min(340, viewportWidth - 24);
  const sidePlacement = targetRect && targetRect.left < 110 && viewportWidth > 700;
  const tooltipClearance = 320;
  const showBelow = targetRect ? targetRect.bottom + tooltipClearance < viewportHeight : true;
  const showAbove = targetRect ? targetRect.top > tooltipClearance : false;
  const tooltipStyle: CSSProperties = targetRect
    ? sidePlacement
      ? { top: Math.max(12, Math.min(targetRect.top, viewportHeight - 260)), left: Math.min(targetRect.right + 22, viewportWidth - tooltipWidth - 12), width: tooltipWidth }
      : showBelow
        ? { top: targetRect.bottom + 18, left: Math.max(12, Math.min(targetRect.left, viewportWidth - tooltipWidth - 12)), width: tooltipWidth }
        : showAbove
          ? { bottom: viewportHeight - targetRect.top + 18, left: Math.max(12, Math.min(targetRect.left, viewportWidth - tooltipWidth - 12)), width: tooltipWidth }
          : { top: 12, left: Math.max(12, Math.min(targetRect.left, viewportWidth - tooltipWidth - 12)), width: tooltipWidth }
    : { top: "50%", left: "50%", width: tooltipWidth, transform: "translate(-50%, -50%)" };

  return (
    <div className="pointer-events-none fixed inset-0 z-[80]" aria-live="polite">
      {!targetRect && <div className="pointer-events-auto fixed inset-0 bg-black/80" aria-hidden="true" />}
      {targetRect && <>
        <div className="pointer-events-auto fixed left-0 right-0 top-0 bg-black/80" style={{ height: targetRect.top }} />
        <div className="pointer-events-auto fixed bottom-0 left-0 right-0 bg-black/80" style={{ top: targetRect.bottom }} />
        <div className="pointer-events-auto fixed left-0 bg-black/80" style={{ top: targetRect.top, width: targetRect.left, height: targetRect.height }} />
        <div className="pointer-events-auto fixed right-0 bg-black/80" style={{ top: targetRect.top, left: targetRect.right, height: targetRect.height }} />
        {!step.requireTargetClick && <div className="pointer-events-auto fixed bg-transparent" aria-hidden="true" style={{ top: targetRect.top, left: targetRect.left, width: targetRect.width, height: targetRect.height }} />}
        <div className="pointer-events-none fixed rounded-xl border-2 border-[#55a7f1] shadow-[0_0_0_4px_rgba(35,131,226,0.25),0_0_28px_rgba(35,131,226,0.7)]" style={{ top: targetRect.top, left: targetRect.left, width: targetRect.width, height: targetRect.height }} />
      </>}
      <section data-tour-dialog role="dialog" aria-modal="true" aria-label={`Tutorial step ${stepIndex + 1}: ${step.title}`} className="tour-tooltip-scrollbar pointer-events-auto fixed z-[91] max-h-[calc(100vh-24px)] overflow-y-auto rounded-2xl border border-white/10 bg-[#111318] p-4 text-white shadow-2xl" style={tooltipStyle}>
        {targetRect && (sidePlacement ? <ArrowLeft className="tour-arrow-horizontal absolute -left-8 top-5 text-[#55a7f1]" size={24} /> : showBelow ? <ArrowUp className="tour-arrow-vertical absolute -top-8 left-6 text-[#55a7f1]" size={24} /> : <ArrowDown className="tour-arrow-vertical absolute -bottom-8 left-6 text-[#55a7f1]" size={24} />)}
        <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#55a7f1]">{step.chapter} · Step {stepIndex + 1} of {SPOTLIGHT_STEPS.length}</p><h2 className="mt-1 text-base font-bold">{step.title}</h2></div><button type="button" onClick={onClose} aria-label="Close tutorial" className="rounded-md p-1 text-neutral-500 hover:bg-white/8 hover:text-white"><X size={16} /></button></div>
        <p className="mt-2 text-xs leading-5 text-neutral-300">{step.description}</p>
        <p className="mt-3 rounded-xl bg-white/[0.055] p-3 text-[11px] font-medium leading-4 text-neutral-200">{step.instruction}</p>
        <div className="mt-3 flex items-center justify-between gap-3"><div className="flex items-center gap-2">{stepIndex > 0 && <button type="button" onClick={goBack} className="flex items-center gap-1 text-[10px] font-semibold text-neutral-400 hover:text-white"><ChevronLeft size={12} /> Back</button>}<button type="button" onClick={onComplete} className="text-[10px] font-semibold text-neutral-500 hover:text-white">Skip tutorial</button></div>{!step.requireTargetClick && <button type="button" onClick={advance} className="flex items-center gap-2 rounded-lg bg-[#1a73ca] px-3 py-2 text-xs font-semibold text-white hover:bg-[#2383e2]">Continue <ArrowRight size={14} className="tour-arrow" /></button>}</div>
      </section>
    </div>
  );
}
