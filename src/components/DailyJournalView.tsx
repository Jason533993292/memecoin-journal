"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  Bold, BookHeart, CalendarDays, Check, ChevronLeft, ChevronRight, Cloud, CloudOff,
  Download, Expand, Italic, Link2, List, ListOrdered, Minimize2, Plus, Quote, Search,
  Strikethrough, Tags, Trash2, Underline, WandSparkles, X,
} from "lucide-react";
import type { DailyJournalEntry, DailyJournalEntryType, Trade } from "@/lib/types";
import {
  createDailyJournalEntry, DAILY_JOURNAL_EMOTIONS, journalPlainText,
  matchesDailyJournalSearch, sanitizeJournalHtml,
} from "@/lib/dailyJournal";
import {
  deleteAllSupabaseDailyJournalEntries, deleteSupabaseDailyJournalEntry, listSupabaseDailyJournalEntries, saveSupabaseDailyJournalEntry,
} from "@/lib/journalBackend";
import { useToast } from "./Toast";

type SaveState = "idle" | "draft" | "saving" | "saved" | "offline";
type JournalFont = "clean" | "classic" | "typewriter" | "handwritten";

interface DailyJournalViewProps {
  userId: string;
  trades: Trade[];
  tutorialMode?: boolean;
}

const TYPE_LABELS: Record<DailyJournalEntryType, string> = {
  free: "Free writing", pre_trade: "Pre-trade", post_trade: "Post-trade", end_of_day: "End-of-day",
};

const JOURNAL_FONTS: Array<{ id: JournalFont; label: string; family: string }> = [
  { id: "clean", label: "Clean", family: "Inter, ui-sans-serif, system-ui, sans-serif" },
  { id: "classic", label: "Classic", family: "Georgia, 'Times New Roman', serif" },
  { id: "typewriter", label: "Typewriter", family: "'Courier New', ui-monospace, monospace" },
  { id: "handwritten", label: "Handwritten", family: "'Segoe Print', 'Bradley Hand', cursive" },
];

const DEMO_ENTRY: DailyJournalEntry = {
  id: "tutorial-example",
  title: "Staying patient after a fast start",
  contentHtml: "<h2>What I noticed</h2><p>I felt <strong>confident</strong> after my first win, then caught myself looking for a trade that was not there.</p><h2>What I will repeat</h2><p>Pause for five minutes and reread the invalidation before every entry.</p>",
  plainText: "What I noticed I felt confident after my first win, then caught myself looking for a trade that was not there. What I will repeat Pause for five minutes and reread the invalidation before every entry.",
  entryType: "end_of_day", entryDate: new Date().toISOString().slice(0, 10), emotions: ["Confident", "FOMO"],
  emotionIntensity: 3, energyLevel: 4, confidenceLevel: 4, tags: ["patience", "discipline"], linkedTradeIds: [],
  createdAt: Date.now(), updatedAt: Date.now(),
};

function dateLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

export default function DailyJournalView({ userId, trades, tutorialMode = false }: DailyJournalViewProps) {
  const { showToast } = useToast();
  const editorRef = useRef<HTMLDivElement>(null);
  const [editorInitialHtml, setEditorInitialHtml] = useState(tutorialMode ? DEMO_ENTRY.contentHtml : "");
  const guidedMenuRef = useRef<HTMLDivElement>(null);
  const latestDraftRef = useRef<DailyJournalEntry | null>(tutorialMode ? DEMO_ENTRY : null);
  const [entries, setEntries] = useState<DailyJournalEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(() => tutorialMode ? DEMO_ENTRY.id : null);
  const [draft, setDraft] = useState<DailyJournalEntry | null>(() => tutorialMode ? DEMO_ENTRY : null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"entries" | "calendar">("entries");
  const [guidedOpen, setGuidedOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deleteAllConfirmation, setDeleteAllConfirmation] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [tagInput, setTagInput] = useState("");
  const [focusMode, setFocusMode] = useState(false);
  const [calendarCursor, setCalendarCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [journalFont, setJournalFont] = useState<JournalFont>(() => {
    if (typeof window === "undefined") return "classic";
    const stored = localStorage.getItem(`memecoin_journal_${userId}_journal_font`);
    return JOURNAL_FONTS.some((font) => font.id === stored) ? stored as JournalFont : "classic";
  });
  const draftStorageKey = `memecoin_journal_${userId}_daily_draft`;
  const fontStorageKey = `memecoin_journal_${userId}_journal_font`;

  const loadEntries = useCallback(async () => {
    try {
      const result = await listSupabaseDailyJournalEntries(userId);
      setEntries(result);
    } catch (error) {
      console.error("Daily journal load failed", error);
      showToast("Daily journal could not load", "error", "Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [showToast, userId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadEntries(), 0);
    return () => window.clearTimeout(timer);
  }, [loadEntries]);
  useEffect(() => {
    const update = () => setSaveState((state) => navigator.onLine ? (state === "offline" ? "draft" : state) : "offline");
    window.addEventListener("online", update); window.addEventListener("offline", update); update();
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  useEffect(() => {
    if (!guidedOpen) return;
    const close = (event: PointerEvent) => {
      if (!guidedMenuRef.current?.contains(event.target as Node)) setGuidedOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [guidedOpen]);
  useEffect(() => {
    if (!draft || tutorialMode) return;
    const timer = window.setTimeout(() => {
      localStorage.setItem(draftStorageKey, JSON.stringify(draft));
      if (!navigator.onLine) setSaveState("offline");
    }, 500);
    return () => window.clearTimeout(timer);
  }, [draft, draftStorageKey, tutorialMode]);
  useEffect(() => {
    if (!focusMode) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFocusMode(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [focusMode]);

  const visibleEntries = useMemo(() => {
    const source = tutorialMode && entries.length === 0 ? [DEMO_ENTRY] : entries;
    return source.filter((entry) => matchesDailyJournalSearch(entry, search));
  }, [entries, search, tutorialMode]);

  const openEntry = (entry: DailyJournalEntry) => {
    const opened = { ...entry, contentHtml: sanitizeJournalHtml(entry.contentHtml) };
    setEditorInitialHtml(opened.contentHtml);
    latestDraftRef.current = opened;
    setDraft(opened); setSelectedId(entry.id); setDeleteOpen(false); setSaveState("idle");
  };

  const startEntry = (type: DailyJournalEntryType) => {
    if (tutorialMode) return;
    const entry = createDailyJournalEntry(type);
    setEditorInitialHtml(entry.contentHtml);
    latestDraftRef.current = entry;
    setDraft(entry); setSelectedId(entry.id); setGuidedOpen(false); setSaveState("draft");
  };

  const updateDraft = (patch: Partial<DailyJournalEntry>) => {
    setDraft((current) => {
      if (!current) return current;
      const next = { ...current, ...patch, updatedAt: Date.now() };
      latestDraftRef.current = next;
      return next;
    });
    if (!tutorialMode) setSaveState(navigator.onLine ? "draft" : "offline");
  };

  const captureEditor = () => {
    if (!editorRef.current) return;
    const contentHtml = sanitizeJournalHtml(editorRef.current.innerHTML);
    updateDraft({ contentHtml, plainText: journalPlainText(contentHtml) });
  };

  const format = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    captureEditor();
  };

  const save = async (silent = false) => {
    if (!draft || tutorialMode) return;
    const contentHtml = sanitizeJournalHtml(editorRef.current?.innerHTML ?? draft.contentHtml);
    const ready = { ...draft, contentHtml, plainText: journalPlainText(contentHtml) };
    if (!ready.plainText && !ready.title.trim()) {
      showToast("Write something first", "info", "Add a title or a reflection before saving."); return;
    }
    if (!navigator.onLine) { setDraft(ready); setSaveState("offline"); return; }
    setSaveState("saving");
    try {
      await saveSupabaseDailyJournalEntry(userId, ready);
      setEntries((current) => [ready, ...current.filter((entry) => entry.id !== ready.id)]);
      const changedWhileSaving = latestDraftRef.current?.updatedAt !== ready.updatedAt;
      if (changedWhileSaving) {
        setSaveState("draft");
      } else {
        localStorage.removeItem(draftStorageKey);
        latestDraftRef.current = ready;
        setDraft(ready);
        setSaveState("saved");
      }
      if (!silent && !changedWhileSaving) showToast("Journal entry saved", "success", "Your private entry is synced.");
    } catch (error) {
      console.error("Daily journal save failed", error); setSaveState("draft");
      showToast("Entry was not synced", "error", "Your browser draft is safe. Try saving again.");
    }
  };

  useEffect(() => {
    if (!draft || tutorialMode || saveState !== "draft" || !navigator.onLine) return;
    if (!draft.title.trim() && !draft.plainText.trim()) return;
    const timer = window.setTimeout(() => void save(true), 1800);
    return () => window.clearTimeout(timer);
  // `save` intentionally uses the latest draft captured by this render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, saveState, tutorialMode]);

  const remove = async () => {
    if (!draft || tutorialMode) return;
    try {
      await deleteSupabaseDailyJournalEntry(userId, draft.id);
      setEntries((current) => current.filter((entry) => entry.id !== draft.id));
      latestDraftRef.current = null;
      setDraft(null); setSelectedId(null); setDeleteOpen(false); localStorage.removeItem(draftStorageKey);
      showToast("Journal entry deleted", "success");
    } catch { showToast("Entry could not be deleted", "error", "Try again in a moment."); }
  };

  const removeAll = async () => {
    if (deleteAllConfirmation !== "DELETE JOURNAL" || tutorialMode) return;
    try {
      await deleteAllSupabaseDailyJournalEntries(userId);
      latestDraftRef.current = null;
      setEntries([]); setDraft(null); setSelectedId(null); setDeleteAllOpen(false); setDeleteAllConfirmation("");
      localStorage.removeItem(draftStorageKey);
      showToast("Daily journal cleared", "success", "All reflections and the unfinished draft were removed.");
    } catch { showToast("Daily journal could not be cleared", "error", "Nothing was removed. Try again in a moment."); }
  };

  const recoverDraft = () => {
    try {
      const stored = localStorage.getItem(draftStorageKey);
      if (!stored) return showToast("No unfinished draft found", "info");
      const restored = JSON.parse(stored) as DailyJournalEntry;
      restored.contentHtml = sanitizeJournalHtml(restored.contentHtml || "");
      restored.plainText = journalPlainText(restored.contentHtml);
      setEditorInitialHtml(restored.contentHtml);
      latestDraftRef.current = restored;
      setDraft(restored); setSelectedId(restored.id); setSaveState("draft");
    } catch { localStorage.removeItem(draftStorageKey); }
  };

  const exportEntries = () => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `daily-journal-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); URL.revokeObjectURL(url);
  };

  const calendarDays = useMemo(() => {
    const first = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1);
    const count = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 0).getDate();
    return [...Array(first.getDay()).fill(null), ...Array.from({ length: count }, (_, index) => index + 1)];
  }, [calendarCursor]);

  const calendarDateKey = (day: number) => `${calendarCursor.getFullYear()}-${String(calendarCursor.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const selectedDayEntries = selectedCalendarDate
    ? visibleEntries.filter((entry) => entry.entryDate === selectedCalendarDate)
    : [];
  const linkedTrades = draft
    ? draft.linkedTradeIds.map((id) => trades.find((trade) => trade.id === id)).filter((trade): trade is Trade => Boolean(trade))
    : [];
  const selectedEntryIndex = selectedId ? visibleEntries.findIndex((entry) => entry.id === selectedId) : -1;
  const activeFont = JOURNAL_FONTS.find((font) => font.id === journalFont) ?? JOURNAL_FONTS[1];
  const chooseFont = (font: JournalFont) => {
    setJournalFont(font);
    localStorage.setItem(fontStorageKey, font);
  };
  const turnPage = (direction: -1 | 1) => {
    const next = visibleEntries[selectedEntryIndex + direction];
    if (next) openEntry(next);
  };

  return (
    <section data-tour="daily-journal-workspace" className={`daily-journal-workspace journal-page py-7 ${focusMode ? "fixed inset-0 z-[70] overflow-y-auto px-6 lg:px-12" : ""}`}>
      <header className={`mb-6 flex flex-wrap items-start justify-between gap-4 ${focusMode ? "mx-auto max-w-6xl" : ""}`}>
        <div className="flex items-start gap-3"><span className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-[#2383e2]"><BookHeart size={21} /></span><div><h1 className="text-2xl font-bold">Daily Journal</h1><p className="mt-1 text-sm text-[#787774]">Write what happened, how you felt, and what you want to remember.</p></div></div>
        <div ref={guidedMenuRef} data-tour="daily-journal-new-entry" className="relative flex flex-wrap gap-2">
          {draft && <button type="button" onClick={() => setFocusMode((current) => !current)} className="daily-journal-secondary flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold" aria-label={focusMode ? "Exit focus mode" : "Enter focus mode"}>{focusMode ? <Minimize2 size={16} /> : <Expand size={16} />} {focusMode ? "Exit focus" : "Focus"}</button>}
          {!focusMode && <>
          <button type="button" onClick={() => startEntry("free")} disabled={tutorialMode} className="flex h-10 items-center gap-2 rounded-xl bg-[#2383e2] px-4 text-sm font-semibold text-white hover:bg-[#1a73ca] disabled:opacity-60"><Plus size={16} /> Free writing</button>
          <button type="button" onClick={() => setGuidedOpen((open) => !open)} disabled={tutorialMode} className="flex h-10 items-center gap-2 rounded-xl border border-[#d8d7d3] bg-white px-4 text-sm font-semibold hover:bg-[#f7f6f3] disabled:opacity-60"><WandSparkles size={16} /> Guided entry</button>
          {guidedOpen && <div className="absolute right-0 top-12 z-30 w-56 rounded-xl border border-[#d8d7d3] bg-white p-2 shadow-xl">{(["pre_trade", "post_trade", "end_of_day"] as const).map((type) => <button key={type} type="button" onClick={() => startEntry(type)} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[#f1f1ef]">{TYPE_LABELS[type]}</button>)}</div>}
          </>}
        </div>
      </header>

      <div className={`grid min-h-[650px] gap-4 ${focusMode ? "mx-auto max-w-5xl" : "xl:grid-cols-[330px_minmax(0,1fr)]"}`}>
        {!focusMode && <aside data-tour="daily-journal-library" className="daily-journal-surface rounded-2xl border border-[#e3e2de] bg-white p-3">
          <div className="flex gap-2"><label className="flex h-10 flex-1 items-center gap-2 rounded-xl border border-[#e3e2de] px-3"><Search size={15} className="text-[#787774]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reflections" className="w-full bg-transparent text-sm outline-none" /></label><button type="button" onClick={() => setView((current) => current === "entries" ? "calendar" : "entries")} aria-label="Toggle journal calendar" className="h-10 w-10 rounded-xl border border-[#e3e2de] text-[#787774] hover:bg-[#f7f6f3]"><CalendarDays size={17} className="mx-auto" /></button></div>
          <div className="mt-3 flex items-center justify-between px-1 text-[11px] text-[#787774]"><span>{visibleEntries.length} entries</span><button type="button" onClick={recoverDraft} className="font-semibold text-[#2383e2] hover:underline">Recover draft</button></div>
          {view === "entries" ? <div className="mt-2 space-y-2">{loading ? <p className="p-4 text-sm text-[#787774]">Loading reflections…</p> : visibleEntries.map((entry) => <button key={entry.id} type="button" onClick={() => openEntry(entry)} className={`w-full rounded-xl border p-3 text-left transition ${selectedId === entry.id ? "border-blue-300 bg-blue-50" : "border-transparent hover:border-[#e3e2de] hover:bg-[#f7f6f3]"}`}><div className="flex items-center justify-between gap-2"><strong className="truncate text-sm">{entry.title}</strong><span className="shrink-0 text-[10px] text-[#787774]">{dateLabel(entry.entryDate)}</span></div><p className="mt-1 line-clamp-2 text-xs leading-5 text-[#787774]">{entry.plainText || "Empty reflection"}</p><div className="mt-2 flex flex-wrap gap-1">{entry.emotions.slice(0, 2).map((emotion) => <span key={emotion} className="rounded-md bg-[#f1f1ef] px-1.5 py-0.5 text-[9px]">{emotion}</span>)}<span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[9px] text-blue-700">{TYPE_LABELS[entry.entryType]}</span></div></button>)}</div> : <div className="mt-4"><div className="mb-3 flex items-center justify-between"><button type="button" aria-label="Previous month" onClick={() => { setCalendarCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1)); setSelectedCalendarDate(null); }} className="rounded-lg p-1 hover:bg-[#f7f6f3]"><ChevronLeft size={16} /></button><strong className="text-xs">{new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(calendarCursor)}</strong><button type="button" aria-label="Next month" onClick={() => { setCalendarCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1)); setSelectedCalendarDate(null); }} className="rounded-lg p-1 hover:bg-[#f7f6f3]"><ChevronRight size={16} /></button></div><div className="grid grid-cols-7 gap-1 text-center text-[9px] text-[#787774]">{"SMTWTFS".split("").map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}{calendarDays.map((day, index) => { const date = day ? calendarDateKey(day) : ""; const count = day ? visibleEntries.filter((entry) => entry.entryDate === date).length : 0; return <button key={index} type="button" disabled={!day} onClick={() => setSelectedCalendarDate(date)} className={`relative aspect-square rounded-lg text-[10px] ${selectedCalendarDate === date ? "ring-2 ring-blue-400" : ""} ${count ? "bg-blue-50 font-bold text-blue-700 hover:bg-blue-100" : "text-[#787774] hover:bg-[#f7f6f3]"}`}>{day}{count > 0 && <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-blue-500" />}</button>; })}</div>{selectedCalendarDate && <div className="mt-3 border-t border-[#e9e9e7] pt-3"><p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#787774]">{dateLabel(selectedCalendarDate)} · {selectedDayEntries.length} {selectedDayEntries.length === 1 ? "entry" : "entries"}</p>{selectedDayEntries.length ? <div className="space-y-1">{selectedDayEntries.map((entry) => <button key={entry.id} type="button" onClick={() => openEntry(entry)} className="w-full rounded-lg border border-[#e3e2de] p-2 text-left text-xs hover:bg-[#f7f6f3]"><strong className="block truncate">{entry.title}</strong><span className="text-[10px] text-[#787774]">{TYPE_LABELS[entry.entryType]}</span></button>)}</div> : <p className="text-xs text-[#787774]">No reflections on this day.</p>}</div>}</div>}
          <button type="button" onClick={exportEntries} disabled={!entries.length} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[#e3e2de] py-2 text-xs font-semibold text-[#5a5957] hover:bg-[#f7f6f3] disabled:opacity-40"><Download size={14} /> Export private journal</button>
          <button type="button" onClick={() => setDeleteAllOpen(true)} disabled={!entries.length || tutorialMode} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-40"><Trash2 size={14} /> Delete all journal entries</button>
        </aside>}

        <main data-tour="daily-journal-editor" className="daily-journal-book-shell">
          {!draft ? <div className="flex min-h-[580px] flex-col items-center justify-center text-center"><BookHeart size={42} className="text-[#b4b3af]" /><h2 className="mt-4 text-lg font-bold">A private space between the trades</h2><p className="mt-2 max-w-md text-sm leading-6 text-[#787774]">Choose Free writing for a blank page, or Guided entry for a pre-trade, post-trade, or end-of-day reflection.</p></div> : <>
            <div className={`daily-journal-book ${focusMode ? "is-focus" : ""}`} style={{ "--journal-font": activeFont.family } as CSSProperties}>
            <section className="daily-journal-paper daily-journal-left-page">
            <div className="daily-journal-book-heading"><input data-tour="daily-journal-title" value={draft.title} onChange={(event) => updateDraft({ title: event.target.value.slice(0, 160) })} disabled={tutorialMode} placeholder="Reflection title" className="min-w-0 flex-1 bg-transparent text-2xl font-bold outline-none placeholder:text-[#9b8f7b]" /><input aria-label="Journal entry date" type="date" value={draft.entryDate} onChange={(event) => updateDraft({ entryDate: event.target.value })} disabled={tutorialMode} className="daily-journal-date rounded-md border-0 bg-transparent text-xs" /></div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-b border-[#d8cdb9] pb-3"><span className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-700">{TYPE_LABELS[draft.entryType]}</span><div className="flex items-center gap-2 text-[11px] text-[#746955]">{saveState === "offline" ? <CloudOff size={14} /> : saveState === "saved" ? <Check size={14} className="text-emerald-600" /> : <Cloud size={14} />}<span>{saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "offline" ? "Offline — draft kept here" : saveState === "draft" ? "Browser draft" : "Synced entry"}</span></div></div>
            <div data-tour="daily-journal-toolbar" role="toolbar" aria-label="Journal formatting" className="mt-5 flex flex-wrap gap-1 rounded-xl border border-[#e3e2de] bg-[#f7f6f3] p-1.5">{[
              [Bold, "bold", "Bold"], [Italic, "italic", "Italic"], [Underline, "underline", "Underline"], [Strikethrough, "strikeThrough", "Strikethrough"], [List, "insertUnorderedList", "Bullet list"], [ListOrdered, "insertOrderedList", "Numbered list"], [Quote, "formatBlock", "Quote", "blockquote"],
            ].map(([Icon, command, label, value]) => <button key={String(command)} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => format(String(command), value ? String(value) : undefined)} disabled={tutorialMode} aria-label={String(label)} title={String(label)} className="rounded-lg p-2 text-[#5a5957] hover:bg-white hover:text-[#2383e2] disabled:opacity-50"><Icon size={15} /></button>)}<label className="ml-auto flex items-center gap-2 px-2 text-[10px] font-bold text-[#746955]">Font<select aria-label="Journal font" value={journalFont} onChange={(event) => chooseFont(event.target.value as JournalFont)} className="h-8 rounded-lg border border-[#d8cdb9] bg-white px-2 text-[11px]">{JOURNAL_FONTS.map((font) => <option key={font.id} value={font.id}>{font.label}</option>)}</select></label></div>
            <div key={draft.id} ref={editorRef} data-tour="daily-journal-writing" contentEditable={!tutorialMode} suppressContentEditableWarning onInput={captureEditor} dangerouslySetInnerHTML={{ __html: editorInitialHtml }} className="daily-journal-editor daily-journal-lined-paper mt-4 min-h-[440px] p-4 text-[15px] leading-8 outline-none" />
            <span className="daily-journal-page-number">{selectedEntryIndex >= 0 ? selectedEntryIndex * 2 + 1 : 1}</span>
            </section>
            {!focusMode && <section data-tour="daily-journal-reflection-tools" className="daily-journal-paper daily-journal-right-page"><div><h3 className="flex items-center gap-2 text-xs font-bold"><BookHeart size={14} /> Emotions</h3><div className="mt-2 flex flex-wrap gap-2">{DAILY_JOURNAL_EMOTIONS.map((emotion) => <button key={emotion} type="button" disabled={tutorialMode} onClick={() => updateDraft({ emotions: draft.emotions.includes(emotion) ? draft.emotions.filter((item) => item !== emotion) : [...draft.emotions, emotion].slice(0, 12) })} className={`rounded-lg border px-2.5 py-1.5 text-[11px] ${draft.emotions.includes(emotion) ? "border-blue-300 bg-blue-50 text-blue-700" : "border-[#d8cdb9] hover:bg-[#f7f0e3]"}`}>{emotion}</button>)}</div>{(["emotionIntensity", "energyLevel", "confidenceLevel"] as const).map((field) => <label key={field} className="mt-3 block text-[11px] text-[#746955]">{field === "emotionIntensity" ? "Emotion intensity" : field === "energyLevel" ? "Energy" : "Confidence"} · {draft[field] ?? "not set"}<input type="range" min="1" max="5" value={draft[field] ?? 3} onChange={(event) => updateDraft({ [field]: Number(event.target.value) })} disabled={tutorialMode} className="mt-1 w-full" /></label>)}</div><div className="mt-7 border-t border-[#d8cdb9] pt-6"><h3 className="flex items-center gap-2 text-xs font-bold"><Tags size={14} /> Tags & linked trades</h3><div className="mt-2 flex gap-2"><input value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); const tag = tagInput.trim().slice(0, 30); if (tag && !draft.tags.includes(tag)) updateDraft({ tags: [...draft.tags, tag].slice(0, 20) }); setTagInput(""); } }} disabled={tutorialMode} placeholder="Type a tag and press Enter" className="h-9 flex-1 rounded-lg border border-[#d8cdb9] px-3 text-xs outline-none" /></div><div className="mt-2 flex flex-wrap gap-1">{draft.tags.map((tag) => <button key={tag} type="button" onClick={() => updateDraft({ tags: draft.tags.filter((item) => item !== tag) })} className="rounded-md bg-[#eee4d2] px-2 py-1 text-[10px]">#{tag} ×</button>)}</div><label className="mt-4 flex items-center gap-2 text-[11px] font-semibold"><Link2 size={13} /> Link a trade<select value="" disabled={tutorialMode} onChange={(event) => { if (event.target.value && !draft.linkedTradeIds.includes(event.target.value)) updateDraft({ linkedTradeIds: [...draft.linkedTradeIds, event.target.value].slice(0, 50) }); }} className="h-9 min-w-0 flex-1 rounded-lg border border-[#d8cdb9] bg-white px-2"><option value="">Choose a trade…</option>{trades.filter((trade) => !draft.linkedTradeIds.includes(trade.id)).map((trade) => <option key={trade.id} value={trade.id}>{trade.name} · {trade.result}</option>)}</select></label>{linkedTrades.length ? <div className="mt-3 space-y-2">{linkedTrades.map((trade) => <div key={trade.id} className="daily-journal-linked-trade flex items-center justify-between gap-3 rounded-xl border border-[#d8cdb9] p-3"><div className="min-w-0"><strong className="block truncate text-xs">{trade.name} <span className="font-normal text-[#746955]">${trade.symbol}</span></strong><span className={`text-[10px] font-semibold ${trade.pnlSol < 0 ? "text-rose-600" : "text-emerald-600"}`}>{trade.result} · {trade.pnlSol >= 0 ? "+" : ""}{trade.pnlSol.toFixed(2)} SOL</span></div><button type="button" onClick={() => updateDraft({ linkedTradeIds: draft.linkedTradeIds.filter((id) => id !== trade.id) })} disabled={tutorialMode} aria-label={`Remove ${trade.name} from this entry`} className="rounded-lg p-1.5 text-[#746955] hover:bg-[#f7f0e3] hover:text-rose-600"><X size={14} /></button></div>)}</div> : <div className="mt-2 text-[10px] text-[#746955]">No trades linked yet</div>}<p className="mt-4 rounded-lg bg-[#f4ead8] p-2 text-[10px] leading-4 text-[#746955]">Daily Journal entries are not sent to the AI coach. Any future AI use will require a separate, explicit choice.</p></div><span className="daily-journal-page-number">{selectedEntryIndex >= 0 ? selectedEntryIndex * 2 + 2 : 2}</span></section>}
            </div>
            <footer className="daily-journal-book-footer mt-4 flex flex-wrap items-center justify-between gap-3"><div>{!focusMode && (deleteOpen ? <div className="flex items-center gap-2 text-xs"><span>Delete permanently?</span><button type="button" onClick={() => void remove()} className="rounded-lg bg-rose-600 px-3 py-2 font-semibold text-white">Yes, delete</button><button type="button" onClick={() => setDeleteOpen(false)} className="rounded-lg px-3 py-2">Cancel</button></div> : <button type="button" disabled={tutorialMode || draft.id === "tutorial-example"} onClick={() => setDeleteOpen(true)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-40"><Trash2 size={14} /> Delete</button>)}</div><div className="flex items-center gap-2"><button type="button" onClick={() => turnPage(-1)} disabled={selectedEntryIndex <= 0} className="daily-journal-secondary flex h-10 items-center gap-1 rounded-xl border px-3 text-xs font-semibold disabled:opacity-35"><ChevronLeft size={15} /> Previous</button><button type="button" onClick={() => turnPage(1)} disabled={selectedEntryIndex < 0 || selectedEntryIndex >= visibleEntries.length - 1} className="daily-journal-secondary flex h-10 items-center gap-1 rounded-xl border px-3 text-xs font-semibold disabled:opacity-35">Next <ChevronRight size={15} /></button></div><button type="button" data-tour="daily-journal-save" onClick={() => void save()} disabled={tutorialMode || saveState === "saving" || saveState === "saved"} className="rounded-xl bg-[#2383e2] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1a73ca] disabled:opacity-50">{saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : "Save now"}</button></footer>
          </>}
        </main>
      </div>
      {deleteAllOpen && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"><section role="dialog" aria-modal="true" aria-labelledby="delete-daily-journal-title" className="w-full max-w-md rounded-2xl border border-[#e3e2de] bg-white p-6 shadow-2xl"><h2 id="delete-daily-journal-title" className="text-lg font-bold">Delete every Daily Journal entry?</h2><p className="mt-2 text-sm leading-6 text-[#787774]">This permanently removes all reflections, emotions, tags, trade links, and the unfinished browser draft. Your trades are not affected.</p><label className="mt-4 block text-xs font-semibold">Type DELETE JOURNAL to confirm<input autoFocus value={deleteAllConfirmation} onChange={(event) => setDeleteAllConfirmation(event.target.value)} className="mt-2 h-10 w-full rounded-xl border border-[#d8d7d3] px-3 text-sm outline-none focus:border-rose-400" /></label><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => { setDeleteAllOpen(false); setDeleteAllConfirmation(""); }} className="rounded-xl px-4 py-2 text-sm font-semibold">Cancel</button><button type="button" onClick={() => void removeAll()} disabled={deleteAllConfirmation !== "DELETE JOURNAL"} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Delete all entries</button></div></section></div>}
    </section>
  );
}
