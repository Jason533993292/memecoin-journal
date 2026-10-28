"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import {
  Bold, BookHeart, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Cloud, CloudOff,
  Download, Ellipsis, Expand, Italic, Library, Link2, List, ListOrdered, Minimize2, Plus, Quote, Search,
  SlidersHorizontal, Strikethrough, Tags, Trash2, Underline, WandSparkles, X,
} from "lucide-react";
import type { DailyJournalEntry, DailyJournalEntryType, Trade } from "@/lib/types";
import {
  createDailyJournalEntry, DAILY_JOURNAL_EMOTIONS, journalLocalDate, journalPlainText,
  matchesDailyJournalSearch, sanitizeJournalHtml,
} from "@/lib/dailyJournal";
import {
  deleteAllSupabaseDailyJournalEntries, deleteSupabaseDailyJournalEntry, listSupabaseDailyJournalEntries, saveSupabaseDailyJournalEntry,
} from "@/lib/journalBackend";
import { useToast } from "./Toast";
import JournalWorkbench, { DEFAULT_JOURNAL_PREFERENCES, readJournalPreferences } from "./JournalWorkbench";
import type { JournalPreferences, WorkbenchPanel } from "./JournalWorkbench";
import { cleanJournalDetails, escapeJournalText, hasJournalDetails, withJournalVersion } from "@/lib/journalWorkbench";
import type { JournalDetails } from "@/lib/journalWorkbench";
import type { ResearchItem } from "@/lib/types";
import { listSupabaseResearch } from "@/lib/journalBackend";
import { formatRealizedPnl, formatUsd } from "@/lib/utils";

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

const REFLECTION_PROMPTS = [
  "What did I notice?",
  "What was I feeling?",
  "Did I follow my plan?",
  "What will I do differently?",
] as const;

const DEMO_ENTRY: DailyJournalEntry = {
  id: "tutorial-example",
  title: "Staying patient after a fast start",
  contentHtml: "<h2>What I noticed</h2><p>I felt <strong>confident</strong> after my first win, then caught myself looking for a trade that was not there.</p><h2>What I will repeat</h2><p>Pause for five minutes and reread the invalidation before every entry.</p>",
  plainText: "What I noticed I felt confident after my first win, then caught myself looking for a trade that was not there. What I will repeat Pause for five minutes and reread the invalidation before every entry.",
  entryType: "end_of_day", entryDate: journalLocalDate(new Date()), emotions: ["Confident", "FOMO"],
  emotionIntensity: 3, energyLevel: 4, confidenceLevel: 4, tags: ["patience", "discipline"], linkedTradeIds: [],
  createdAt: Date.now(), updatedAt: Date.now(),
};

function dateLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function isDailyJournalDraft(value: unknown): value is DailyJournalEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<DailyJournalEntry>;
  return typeof entry.id === "string" && entry.id.length > 0 && entry.id.length <= 150
    && typeof entry.title === "string" && typeof entry.contentHtml === "string" && typeof entry.plainText === "string"
    && entry.contentHtml.length <= 100000
    && typeof entry.entryDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(entry.entryDate)
    && ["free", "pre_trade", "post_trade", "end_of_day"].includes(entry.entryType ?? "")
    && Array.isArray(entry.emotions) && entry.emotions.every((item) => typeof item === "string")
    && Array.isArray(entry.tags) && entry.tags.every((item) => typeof item === "string")
    && Array.isArray(entry.linkedTradeIds) && entry.linkedTradeIds.every((item) => typeof item === "string")
    && typeof entry.createdAt === "number" && Number.isFinite(entry.createdAt)
    && typeof entry.updatedAt === "number" && Number.isFinite(entry.updatedAt);
}

function browserDrafts(key: string): DailyJournalEntry[] {
  try {
    const stored = JSON.parse(localStorage.getItem(`${key}_archive`) || "[]");
    return Array.isArray(stored) ? stored.filter(isDailyJournalDraft) : [];
  } catch { return []; }
}

function preserveBrowserDraft(key: string, entry: DailyJournalEntry) {
  // Versions are already retained in cloud saves; avoid duplicating them in every browser draft.
  const localEntry = {...entry, details:{...entry.details, versions:[]}};
  const drafts = [localEntry, ...browserDrafts(key).filter((stored) => stored.id !== entry.id)]
    .sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 20);
  try {
    localStorage.setItem(`${key}_archive`, JSON.stringify(drafts));
    localStorage.setItem(key, JSON.stringify(localEntry));
  } catch { window.dispatchEvent(new Event("journal-draft-storage-full")); }
}

function clearBrowserDraft(key: string, id: string) {
  localStorage.setItem(`${key}_archive`, JSON.stringify(browserDrafts(key).filter((entry) => entry.id !== id)));
  try {
    if (JSON.parse(localStorage.getItem(key) || "null")?.id === id) localStorage.removeItem(key);
  } catch { localStorage.removeItem(key); }
}

export default function DailyJournalView({ userId, trades, tutorialMode = false }: DailyJournalViewProps) {
  const { showToast } = useToast();
  const editorRef = useRef<HTMLDivElement>(null);
  const promptMenuRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const revisionRef = useRef(0);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const savedEntriesRef = useRef(new Map<string, DailyJournalEntry>());
  const conflictRef = useRef(false);
  const mutationBusyRef = useRef(false);
  const [mutationBusy, setMutationBusy] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [locked, setLocked] = useState(false);
  const [workbench, setWorkbench] = useState<WorkbenchPanel | null>(null);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [datePickerCursor, setDatePickerCursor] = useState(() => new Date());
  const [research, setResearch] = useState<ResearchItem[]>([]);
  const [filterType, setFilterType] = useState("");
  const [filterEmotion, setFilterEmotion] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [slashOpen, setSlashOpen] = useState(false);
  const [selectionToolbar, setSelectionToolbar] = useState<{ top: number; left: number } | null>(null);
  const selectionRangeRef = useRef<Range | null>(null);
  const [formatState, setFormatState] = useState<Record<string, boolean>>({});
  const [reminderDismissed, setReminderDismissed] = useState(false);
  const [preferences, setPreferences] = useState<JournalPreferences>(DEFAULT_JOURNAL_PREFERENCES);
  const untouchedEntryIdRef = useRef<string | null>(null);
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
  const [promptOpen, setPromptOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
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
  const [journalFont, setJournalFont] = useState<JournalFont>("classic");
  const draftStorageKey = `memecoin_journal_${userId}_daily_draft`;
  const fontStorageKey = `memecoin_journal_${userId}_journal_font`;
  const preferencesKey = `memecoin_journal_${userId}_writing_preferences`;
  const mutationBlocked = locked || conflict || tutorialMode || mutationBusy;

  useEffect(() => {
    const failed = () => setStorageError(true);
    window.addEventListener("journal-draft-storage-full", failed);
    return () => window.removeEventListener("journal-draft-storage-full", failed);
  }, []);
  useEffect(() => {
    if (!tutorialMode) return;
    const syncTourPanels = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id || "";
      setLibraryOpen(id === "daily-journal-library");
      setDetailsOpen(id === "daily-journal-context");
      setToolsMenuOpen(["daily-journal-writing-tools", "daily-journal-review-tools", "daily-journal-recovery-tools"].includes(id));
    };
    window.addEventListener("memecoin-journal-tour-step", syncTourPanels);
    return () => window.removeEventListener("memecoin-journal-tour-step", syncTourPanels);
  }, [tutorialMode]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPreferences(readJournalPreferences(preferencesKey));
      try {
        const stored = localStorage.getItem(fontStorageKey);
        if (JOURNAL_FONTS.some(font => font.id === stored)) setJournalFont(stored as JournalFont);
      } catch { /* Keep the default font when browser storage is unavailable. */ }
    }, 0);
    return () => clearTimeout(timer);
  }, [preferencesKey, fontStorageKey]);

  useEffect(() => {
    if (workbench !== "context" || tutorialMode) return;
    let cancelled = false;
    listSupabaseResearch(userId).then(items => { if (!cancelled) setResearch(items); }).catch(() => { if (!cancelled) showToast("Research could not load", "error", "Try opening Reflection & trade context again."); });
    return () => { cancelled = true; };
  }, [workbench, userId, tutorialMode, showToast]);

  // One editor per entry in this browser; conditional cloud writes also protect
  // against another device changing a row since it was opened.
  useEffect(() => {
    if (!selectedId || tutorialMode || !navigator.locks) return;
    let release: (() => void) | undefined;
    let cancelled = false;
    void navigator.locks.request(`journal-edit:${userId}:${selectedId}`, { ifAvailable: true }, async lock => {
      if (cancelled) return;
      setLocked(!lock);
      if (lock) await new Promise<void>(resolve => { release = resolve; });
    });
    return () => { cancelled = true; release?.(); };
  }, [selectedId, tutorialMode, userId]);

  useEffect(() => {
    const selectionChanged = () => {
      const selection = window.getSelection();
      if (!selection?.rangeCount || !editorRef.current?.contains(selection.anchorNode) || !editorRef.current?.contains(selection.focusNode)) { setSelectionToolbar(null); return; }
      selectionRangeRef.current = selection.getRangeAt(0).cloneRange();
      setFormatState(Object.fromEntries(["bold", "italic", "underline", "strikeThrough", "insertUnorderedList", "insertOrderedList"].map(command => [command, document.queryCommandState(command)])));
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      setSelectionToolbar(selection.isCollapsed ? null : { top: Math.max(8, rect.top - 48), left: Math.max(8, Math.min(window.innerWidth-210, rect.left)) });
    };
    document.addEventListener("selectionchange", selectionChanged);
    window.addEventListener("scroll", selectionChanged, true);
    return () => { document.removeEventListener("selectionchange", selectionChanged); window.removeEventListener("scroll", selectionChanged, true); };
  }, []);

  const loadEntries = useCallback(async () => {
    try {
      const result = await listSupabaseDailyJournalEntries(userId);
      savedEntriesRef.current = new Map(result.map(entry => [entry.id, entry]));
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
    if (!guidedOpen && !moreOpen) return;
    const close = (event: PointerEvent) => {
      if (!guidedMenuRef.current?.contains(event.target as Node)) { setGuidedOpen(false); setMoreOpen(false); }
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [guidedOpen, moreOpen]);
  useEffect(() => {
    if (!toolsMenuOpen) return;
    const close = (event: PointerEvent) => {
      if (!(event.target as Element).closest(".journal-tools-menu")) setToolsMenuOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [toolsMenuOpen]);
  useEffect(() => {
    if (!promptOpen) return;
    const close = (event: PointerEvent) => {
      if (!promptMenuRef.current?.contains(event.target as Node)) setPromptOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [promptOpen]);
  useEffect(() => {
    if (!datePickerOpen) return;
    const close = (event: PointerEvent) => {
      if (!datePickerRef.current?.contains(event.target as Node)) setDatePickerOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [datePickerOpen]);
  useEffect(() => {
    if (!draft || tutorialMode || saveState === "saved" || saveState === "idle") return;
    const timer = window.setTimeout(() => {
      preserveBrowserDraft(draftStorageKey, draft);
      if (!navigator.onLine) setSaveState("offline");
    }, 500);
    return () => window.clearTimeout(timer);
  }, [draft, draftStorageKey, tutorialMode, saveState]);
  useEffect(() => {
    if (tutorialMode) return;
    const preserveDraft = () => {
      if (!latestDraftRef.current || !["draft", "saving", "offline"].includes(saveState)) return;
      preserveBrowserDraft(draftStorageKey, latestDraftRef.current);
    };
    window.addEventListener("pagehide", preserveDraft);
    return () => window.removeEventListener("pagehide", preserveDraft);
  }, [draftStorageKey, saveState, tutorialMode]);
  useEffect(() => {
    if (!focusMode) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFocusMode(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [focusMode]);
  useEffect(() => {
    if (tutorialMode || (!detailsOpen && !libraryOpen && !promptOpen)) return;
    const close = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setDetailsOpen(false);
      setLibraryOpen(false);
      setPromptOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [detailsOpen, libraryOpen, promptOpen, tutorialMode]);

  const visibleEntries = useMemo(() => {
    const source = tutorialMode && entries.length === 0 ? [DEMO_ENTRY] : entries;
    return source.filter(entry => !entry.details?.deletedAt && matchesDailyJournalSearch(entry, search)
      && (!filterType || entry.entryType === filterType) && (!filterEmotion || entry.emotions.includes(filterEmotion))
      && (!filterFrom || entry.entryDate >= filterFrom) && (!filterTo || entry.entryDate <= filterTo)
      && (!pinnedOnly || entry.details?.pinned))
      .sort((a,b) => Number(!!b.details?.pinned)-Number(!!a.details?.pinned) || b.entryDate.localeCompare(a.entryDate) || b.updatedAt-a.updatedAt);
  }, [entries, search, tutorialMode, filterType, filterEmotion, filterFrom, filterTo, pinnedOnly]);

  const openEntry = (entry: DailyJournalEntry) => {
    conflictRef.current = false; setConflict(false); setLocked(false); selectionRangeRef.current = null;
    if (latestDraftRef.current && ["draft", "saving", "offline"].includes(saveState)) preserveBrowserDraft(draftStorageKey, latestDraftRef.current);
    revisionRef.current += 1;
    untouchedEntryIdRef.current = null;
    const pending = browserDrafts(draftStorageKey).find((stored) => stored.id === entry.id);
    const source = pending ? {...pending,details:{...pending.details,versions:entry.details?.versions}} : entry;
    const opened = { ...source, contentHtml: sanitizeJournalHtml(source.contentHtml), details: cleanJournalDetails(source.details) };
    setEditorInitialHtml(opened.contentHtml);
    latestDraftRef.current = opened;
    setDraft(opened); setSelectedId(entry.id); setDeleteOpen(false); setLibraryOpen(false); setSaveState(pending ? "draft" : "idle");
  };

  const startEntry = (type: DailyJournalEntryType) => {
    if (tutorialMode) return;
    if (latestDraftRef.current && ["draft", "saving", "offline"].includes(saveState)) preserveBrowserDraft(draftStorageKey, latestDraftRef.current);
    revisionRef.current += 1;
    const entry = createDailyJournalEntry(type);
    conflictRef.current = false; setConflict(false); setLocked(false); selectionRangeRef.current = null;
    untouchedEntryIdRef.current = entry.id;
    setEditorInitialHtml(entry.contentHtml);
    latestDraftRef.current = entry;
    setDraft(entry); setSelectedId(entry.id); setGuidedOpen(false); setSaveState("idle");
  };

  const updateDraft = (patch: Partial<DailyJournalEntry>) => {
    if (mutationBlocked) return;
    setDraft((current) => {
      if (!current) return current;
      const next = { ...current, ...patch, updatedAt: Date.now() };
      revisionRef.current += 1;
      untouchedEntryIdRef.current = null;
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

  const insertPlainText = (text: string) => {
    if (!text || mutationBlocked) return;
    editorRef.current?.focus();
    document.execCommand("insertText", false, text);
    captureEditor();
  };

  const insertPrompt = (prompt: string) => {
    if (tutorialMode || !REFLECTION_PROMPTS.some((item) => item === prompt)) return;
    editorRef.current?.focus();
    document.execCommand("insertHTML", false, `<h2>${prompt}</h2><p><br></p>`);
    captureEditor();
    setPromptOpen(false);
  };

  const format = (command: string, value?: string) => {
    if (mutationBlocked) return;
    editorRef.current?.focus();
    if (selectionRangeRef.current && editorRef.current?.contains(selectionRangeRef.current.commonAncestorContainer)) {
      const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(selectionRangeRef.current);
    }
    document.execCommand(command, false, value);
    if (command === "removeFormat") {
      if (document.queryCommandState("insertUnorderedList")) document.execCommand("insertUnorderedList");
      if (document.queryCommandState("insertOrderedList")) document.execCommand("insertOrderedList");
      document.execCommand("formatBlock", false, "p");
    }
    setFormatState(Object.fromEntries(["bold", "italic", "underline", "strikeThrough", "insertUnorderedList", "insertOrderedList"].map(cmd => [cmd, document.queryCommandState(cmd)])));
    captureEditor();
  };

  const save = async (silent = false) => {
    if (!draft || mutationBlocked || conflictRef.current || mutationBusyRef.current) return;
    if (untouchedEntryIdRef.current === draft.id) {
      if (!silent) showToast("Write something first", "info", "Add a thought before saving this new entry.");
      return;
    }
    const revision = revisionRef.current;
    const contentHtml = sanitizeJournalHtml(editorRef.current?.innerHTML ?? draft.contentHtml);
    const ready = withJournalVersion({ ...draft, contentHtml, plainText: journalPlainText(contentHtml) }, savedEntriesRef.current.get(draft.id));
    if (!ready.plainText && !hasJournalDetails(ready.details) && (!ready.title.trim() || ready.title === "Untitled reflection")) {
      showToast("Write something first", "info", "Add a title or a reflection before saving."); return;
    }
    if (!navigator.onLine) { setDraft(ready); setSaveState("offline"); return; }
    setSaveState("saving");
    const queuedSave = saveQueueRef.current.then(async () => {
      if (conflictRef.current) throw new Error("JOURNAL_CONFLICT");
      await saveSupabaseDailyJournalEntry(userId, ready, savedEntriesRef.current.get(ready.id)?.updatedAt ?? null);
      savedEntriesRef.current.set(ready.id, ready);
    });
    saveQueueRef.current = queuedSave.then(() => undefined, () => undefined);
    try {
      await queuedSave;
      setEntries((current) => [ready, ...current.filter((entry) => entry.id !== ready.id)]);
      const isCurrent = latestDraftRef.current?.id === ready.id;
      const unchanged = isCurrent && revisionRef.current === revision;
      if (unchanged) {
        clearBrowserDraft(draftStorageKey, ready.id);
        latestDraftRef.current = ready;
        setDraft(ready);
        setSaveState("saved");
      } else if (isCurrent) {
        setSaveState("draft");
      } else {
        const archived = browserDrafts(draftStorageKey).find((entry) => entry.id === ready.id);
        if (!archived || (archived.updatedAt === ready.updatedAt && archived.contentHtml === ready.contentHtml)) clearBrowserDraft(draftStorageKey, ready.id);
      }
      if (!silent && unchanged) showToast("Journal entry saved", "success", "Your private entry is synced.");
    } catch (error) {
      if (error instanceof Error && error.message === "JOURNAL_CONFLICT") { conflictRef.current = true; setConflict(true); }
      if (latestDraftRef.current?.id === ready.id) setSaveState("draft");
      showToast("Entry was not synced", "error", "Your browser draft is safe. Try saving again.");
    }
  };

  useEffect(() => {
    if (!draft || tutorialMode || saveState !== "draft" || !navigator.onLine) return;
    if (!draft.plainText.trim() && !hasJournalDetails(draft.details) && (!draft.title.trim() || draft.title === "Untitled reflection")) return;
    const timer = window.setTimeout(() => void save(true), 1800);
    return () => window.clearTimeout(timer);
  // `save` intentionally uses the latest draft captured by this render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, saveState, tutorialMode]);

  const remove = async () => {
    if (!draft || mutationBlocked) return;
    const removingId = draft.id;
    mutationBusyRef.current = true; setMutationBusy(true); setSaveState("idle");
    try {
      await saveQueueRef.current;
      const removed = { ...draft, updatedAt: Date.now(), details: { ...cleanJournalDetails(draft.details), deletedAt: Date.now() } };
      await saveSupabaseDailyJournalEntry(userId, removed, savedEntriesRef.current.get(removingId)?.updatedAt ?? null);
      savedEntriesRef.current.set(removingId, removed);
      revisionRef.current += 1;
      setEntries((current) => [removed, ...current.filter((entry) => entry.id !== removingId)]);
      latestDraftRef.current = null;
      setDraft(null); setSelectedId(null); setDeleteOpen(false); clearBrowserDraft(draftStorageKey, removingId);
      showToast("Entry moved to Trash", "success", "Restore it from Recovery & history.");
    } catch { showToast("Entry could not be deleted", "error", "Try again in a moment."); }
    finally { mutationBusyRef.current = false; setMutationBusy(false); }
  };

  const removeAll = async () => {
    if (deleteAllConfirmation !== "DELETE JOURNAL" || tutorialMode) return;
    mutationBusyRef.current = true; setMutationBusy(true); setSaveState("idle");
    try {
      await saveQueueRef.current;
      await deleteAllSupabaseDailyJournalEntries(userId);
      revisionRef.current += 1;
      latestDraftRef.current = null;
      setEntries([]); setDraft(null); setSelectedId(null); setDeleteAllOpen(false); setDeleteAllConfirmation("");
      localStorage.removeItem(draftStorageKey);
      localStorage.removeItem(`${draftStorageKey}_archive`);
      savedEntriesRef.current.clear();
      showToast("Daily journal cleared", "success", "All reflections and the unfinished draft were removed.");
    } catch { showToast("Daily journal could not be cleared", "error", "Try again in a moment."); }
    finally { mutationBusyRef.current = false; setMutationBusy(false); }
  };

  const recoverDraft = () => {
    try {
      const stored = browserDrafts(draftStorageKey)[0] ?? JSON.parse(localStorage.getItem(draftStorageKey) || "null") as unknown;
      if (!isDailyJournalDraft(stored)) return showToast("No unfinished draft found", "info");
      const restored = stored;
      revisionRef.current += 1;
      restored.contentHtml = sanitizeJournalHtml(restored.contentHtml || "");
      restored.plainText = journalPlainText(restored.contentHtml);
      restored.details = cleanJournalDetails(restored.details);
      untouchedEntryIdRef.current = null;
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
    const days = [...Array(first.getDay()).fill(null), ...Array.from({ length: count }, (_, index) => index + 1)] as Array<number | null>;
    while (days.length % 7) days.push(null);
    return days;
  }, [calendarCursor]);

  const calendarDateKey = (day: number) => `${calendarCursor.getFullYear()}-${String(calendarCursor.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const selectedDayEntries = selectedCalendarDate
    ? visibleEntries.filter((entry) => entry.entryDate === selectedCalendarDate)
    : [];
  const pickerDays = useMemo(() => {
    const first = new Date(datePickerCursor.getFullYear(), datePickerCursor.getMonth(), 1);
    const count = new Date(datePickerCursor.getFullYear(), datePickerCursor.getMonth() + 1, 0).getDate();
    const days = [...Array(first.getDay()).fill(null), ...Array.from({ length: count }, (_, index) => index + 1)] as Array<number | null>;
    while (days.length % 7) days.push(null);
    return days;
  }, [datePickerCursor]);
  const chooseEntryDate = (day: number) => {
    const date = `${datePickerCursor.getFullYear()}-${String(datePickerCursor.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    updateDraft({ entryDate: date });
    setDatePickerOpen(false);
  };
  const placeCaretOnRuledLine = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (mutationBlocked || event.button !== 0 || event.target !== event.currentTarget) return;
    const editor = event.currentTarget;
    const styles = getComputedStyle(editor);
    const lineHeight = Number.parseFloat(styles.lineHeight) || preferences.spacing;
    const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
    const line = Math.max(0, Math.floor((event.clientY - editor.getBoundingClientRect().top - paddingTop) / lineHeight));
    const blocks = Array.from(editor.children).filter((node): node is HTMLElement => node instanceof HTMLElement);
    while (blocks.length <= line) {
      const paragraph = document.createElement("p");
      paragraph.append(document.createElement("br"));
      editor.append(paragraph);
      blocks.push(paragraph);
    }
    const target = blocks[line];
    const range = document.createRange();
    range.selectNodeContents(target);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    editor.focus();
    captureEditor();
  };
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

  const changePreferences = (value: JournalPreferences) => {
    setPreferences(value);
    try { localStorage.setItem(preferencesKey, JSON.stringify(value)); }
    catch { showToast("Preferences could not be stored", "error", "Your browser storage may be full."); }
  };
  const newCustomEntry = (title: string, html: string, details?: JournalDetails) => {
    if (tutorialMode) return;
    if (latestDraftRef.current && ["draft", "saving", "offline"].includes(saveState)) preserveBrowserDraft(draftStorageKey, latestDraftRef.current);
    const contentHtml = sanitizeJournalHtml(html);
    const entry = { ...createDailyJournalEntry("free"), title, contentHtml, plainText: journalPlainText(contentHtml), details: cleanJournalDetails(details) };
    revisionRef.current += 1; untouchedEntryIdRef.current = null; conflictRef.current = false;
    setConflict(false); setLocked(false); selectionRangeRef.current = null;
    latestDraftRef.current = entry; setEditorInitialHtml(contentHtml); setDraft(entry); setSelectedId(entry.id); setSaveState("draft");
  };
  const insertHtml = (html: string) => {
    if (mutationBlocked || !editorRef.current) return;
    editorRef.current.focus();
    const selection = window.getSelection();
    if (selectionRangeRef.current && editorRef.current.contains(selectionRangeRef.current.commonAncestorContainer)) {
      selection?.removeAllRanges(); selection?.addRange(selectionRangeRef.current);
    } else {
      const range = document.createRange(); range.selectNodeContents(editorRef.current); range.collapse(false); selection?.removeAllRanges(); selection?.addRange(range);
    }
    document.execCommand("insertHTML", false, sanitizeJournalHtml(html)); captureEditor(); setSlashOpen(false);
  };
  const replaceWriting = (html: string, title: string) => {
    if (!draft || mutationBlocked) return;
    const contentHtml = sanitizeJournalHtml(html);
    const next = withJournalVersion({...draft, title, contentHtml, plainText:journalPlainText(contentHtml)},draft);
    if (editorRef.current) editorRef.current.innerHTML = contentHtml;
    updateDraft(next);
  };
  const restoreEntry = async (entry: DailyJournalEntry) => {
    const next = {...entry, updatedAt:Date.now(), details:{...cleanJournalDetails(entry.details),deletedAt:undefined}};
    await saveSupabaseDailyJournalEntry(userId,next,savedEntriesRef.current.get(entry.id)?.updatedAt ?? null);
    savedEntriesRef.current.set(entry.id,next); setEntries(current=>[next,...current.filter(e=>e.id!==entry.id)]);
    showToast("Entry restored", "success");
  };
  const eraseEntry = async (entry: DailyJournalEntry) => {
    await saveSupabaseDailyJournalEntry(userId,entry,savedEntriesRef.current.get(entry.id)?.updatedAt ?? null);
    await deleteSupabaseDailyJournalEntry(userId,entry.id);
    savedEntriesRef.current.delete(entry.id); clearBrowserDraft(draftStorageKey,entry.id);
    setEntries(current=>current.filter(e=>e.id!==entry.id));
  };
  const todayEntry = entries.find(e=>!e.details?.deletedAt && e.entryDate===journalLocalDate(new Date()));
  const dueCount = entries.filter(e=>!e.details?.deletedAt && e.details?.reviewDate && e.details.reviewDate<=journalLocalDate(new Date())).length;
  const reminderDue = !!preferences.reminder && new Date().toTimeString().slice(0,5)>=preferences.reminder && !todayEntry && !reminderDismissed;
  const bookStyle = { "--journal-font":activeFont.family, "--journal-text-size":`${preferences.size}px`, "--journal-line-height":`${preferences.spacing}px` } as CSSProperties;

  return (
    <section data-tour="daily-journal-workspace" className={`daily-journal-workspace journal-page py-7 ${focusMode ? "fixed inset-0 z-[70] overflow-y-auto px-6 lg:px-12" : ""}`}>
      <header className={`mb-6 flex flex-wrap items-start justify-between gap-4 ${focusMode ? "mx-auto max-w-6xl" : ""}`}>
        <div className="flex items-start gap-3"><span className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-[#2383e2]"><BookHeart size={21} /></span><div><h1 className="text-2xl font-bold">Daily Journal</h1><p className="mt-1 text-sm text-[#787774]">Write what happened, how you felt, and what you want to remember.</p></div></div>
        <div ref={guidedMenuRef} className="relative flex flex-wrap gap-2">
          {!focusMode && <button type="button" onClick={() => setLibraryOpen(true)} className="daily-journal-secondary flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold"><Library size={16} /> Entries</button>}
          {!focusMode && draft && <button type="button" onClick={() => setDetailsOpen(true)} className="daily-journal-secondary flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold"><SlidersHorizontal size={16} /> Entry details</button>}
          {focusMode && <button type="button" onClick={() => setFocusMode(false)} className="daily-journal-secondary flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold" aria-label="Exit focus mode"><Minimize2 size={16} /> Exit focus</button>}
          {!focusMode && <><div data-tour="daily-journal-new-entry" className="flex gap-2">
          <button type="button" onClick={() => startEntry("free")} disabled={tutorialMode} className="flex h-10 items-center gap-2 rounded-xl bg-[#2383e2] px-4 text-sm font-semibold text-white hover:bg-[#1a73ca] disabled:opacity-60"><Plus size={16} /> Free writing</button>
          <button type="button" onClick={() => setGuidedOpen((open) => !open)} disabled={tutorialMode} className="flex h-10 items-center gap-2 rounded-xl border border-[#d8d7d3] bg-white px-4 text-sm font-semibold hover:bg-[#f7f6f3] disabled:opacity-60"><WandSparkles size={16} /> Guided entry</button>
          </div>
          {guidedOpen && <div className="absolute right-0 top-12 z-30 w-56 rounded-xl border border-[#d8d7d3] bg-white p-2 shadow-xl">{(["pre_trade", "post_trade", "end_of_day"] as const).map((type) => <button key={type} type="button" onClick={() => startEntry(type)} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[#f1f1ef]">{TYPE_LABELS[type]}</button>)}</div>}
          <button type="button" aria-label="More journal actions" onClick={() => setMoreOpen((open) => !open)} className="daily-journal-secondary flex h-10 w-10 items-center justify-center rounded-xl border"><Ellipsis size={18} /></button>
          {moreOpen && <div className="absolute right-0 top-12 z-30 w-60 rounded-xl border border-[#d8d7d3] bg-white p-2 shadow-xl">{draft && <button type="button" onClick={() => { setFocusMode(true); setMoreOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-[#f1f1ef]"><Expand size={14} /> Focus mode</button>}<button type="button" onClick={() => { recoverDraft(); setMoreOpen(false); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[#f1f1ef]">Recover unfinished draft</button><button type="button" onClick={() => { exportEntries(); setMoreOpen(false); }} disabled={!entries.length} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-[#f1f1ef] disabled:opacity-40"><Download size={14} /> Export journal</button><button type="button" onClick={() => { setDeleteAllOpen(true); setMoreOpen(false); }} disabled={!entries.length || tutorialMode} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-40"><Trash2 size={14} /> Delete all entries</button></div>}
          </>}
        </div>
      </header>

      {!focusMode && <nav aria-label="Journal actions" className="journal-action-dock">
        <div className="journal-action-primary">
          <button type="button" onClick={()=>{if(!draft)startEntry("free");setWorkbench("context");}} disabled={mutationBlocked}><WandSparkles size={15}/>Quick thought</button>
          {todayEntry && <button type="button" onClick={()=>openEntry(todayEntry)}><BookHeart size={15}/>Continue today</button>}
          <button type="button" disabled={tutorialMode} onClick={()=>newCustomEntry(`Session · ${new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}`,"<p><br></p>",{session:new Date().getHours()<12?"Morning":"Afternoon / evening"})}><Plus size={15}/>New session</button>
        </div>
        <div className="journal-tools-menu relative">
          <button type="button" data-tour="daily-journal-tools-menu" aria-expanded={toolsMenuOpen} onClick={()=>setToolsMenuOpen(open=>!open)}><SlidersHorizontal size={15}/>Journal tools{dueCount ? <span className="journal-due-count">{dueCount}</span> : null}<ChevronDown size={14} className={toolsMenuOpen ? "rotate-180" : ""}/></button>
          {toolsMenuOpen && <div className="journal-tools-popover">
            <button type="button" data-tour="daily-journal-writing-tools" disabled={tutorialMode} onClick={()=>{setWorkbench("writing");setToolsMenuOpen(false);}}><strong>Writing tools</strong><span>Paper, prompts, templates, images, and checklists</span></button>
            <button type="button" disabled={!draft || mutationBlocked} onClick={()=>{setWorkbench("context");setToolsMenuOpen(false);}}><strong>Reflection & trade context</strong><span>Capture decisions, emotions, trades, and lessons</span></button>
            <button type="button" data-tour="daily-journal-review-tools" disabled={tutorialMode} onClick={()=>{setWorkbench("review");setToolsMenuOpen(false);}}><strong>Review{dueCount ? ` · ${dueCount} due` : ""}</strong><span>Find patterns across your writing and results</span></button>
            <button type="button" data-tour="daily-journal-recovery-tools" disabled={tutorialMode} onClick={()=>{setWorkbench("recovery");setToolsMenuOpen(false);}}><strong>Recovery & history</strong><span>Restore drafts, earlier versions, or deleted pages</span></button>
          </div>}
        </div>
      </nav>}
      {reminderDue && <div className="journal-notice" role="status">A quiet moment to write? Your page is ready.<button onClick={()=>setReminderDismissed(true)}>Dismiss</button></div>}
      {storageError && <div className="journal-notice" role="alert">Browser storage is full. Keep this page open and save online or export your current entry before leaving.<button onClick={()=>{if(draft){const url=URL.createObjectURL(new Blob([JSON.stringify(draft,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download="unfinished-journal-entry.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}}>Export current draft</button></div>}
      {locked && <div className="journal-notice" role="alert">This entry is being edited in another tab. Close that editor, then reopen this entry here.<button onClick={()=>{setDraft(null);setSelectedId(null);setLibraryOpen(true);}}>Back to entries</button></div>}
      {conflict && <div className="journal-notice" role="alert">This entry changed elsewhere. Your draft is preserved. Save a separate copy to keep both versions.<button onClick={()=>{if(draft)newCustomEntry(`${draft.title.slice(0,140)} (recovered copy)`,draft.contentHtml,draft.details);}}>Keep my writing as a copy</button><button onClick={()=>{setDraft(null);setSelectedId(null);void loadEntries();setLibraryOpen(true);setConflict(false);conflictRef.current=false;}}>Reload saved entries</button></div>}

      {workbench && !tutorialMode && <JournalWorkbench panel={workbench} onClose={()=>setWorkbench(null)}
        entry={draft} entries={entries} trades={trades} research={research} drafts={browserDrafts(draftStorageKey)} preferences={preferences}
        onPreferences={changePreferences} onDetails={patch=>{const current=latestDraftRef.current;if(!current || current.id!==draft?.id)return;const details={...current.details,...patch};updateDraft({details,linkedTradeIds:[...new Set([...(current.linkedTradeIds||[]),...(details.snapshots||[]).map(s=>s.id),...(details.notes||[]).map(n=>n.tradeId).filter((id): id is string=>!!id)])].slice(0,50)});}}
        onInsert={insertHtml} onNew={newCustomEntry} onOpen={openEntry} onRestore={restoreEntry} onErase={eraseEntry} onReplace={replaceWriting}
        onDiscardDraft={id=>{clearBrowserDraft(draftStorageKey,id);setEntries(current=>[...current]);}} />}

      <div className="mx-auto w-full min-h-[650px] max-w-5xl">
        {libraryOpen && !focusMode && <>{!tutorialMode && <button type="button" aria-label="Close entries" onClick={() => setLibraryOpen(false)} className="fixed inset-0 z-[71] cursor-default bg-black/45" />}<aside data-tour="daily-journal-library" className="daily-journal-drawer daily-journal-surface fixed bottom-0 left-0 top-0 z-[72] w-[440px] max-w-[92vw] overflow-y-auto border-r border-[#e3e2de] bg-white p-5 shadow-2xl">
          <div data-tour="daily-journal-library-guide" className="journal-library-guide"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-bold">Your entries</h2><p className="text-xs text-[#787774]">Find a reflection or browse by date.</p></div>{!tutorialMode && <button type="button" aria-label="Close entries panel" onClick={() => setLibraryOpen(false)} className="rounded-lg p-2 hover:bg-[#f7f6f3]"><X size={18} /></button>}</div>
          <label className="flex h-10 items-center gap-2 rounded-xl border border-[#e3e2de] px-3"><Search size={15} className="text-[#787774]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reflections" className="w-full bg-transparent text-sm outline-none" /></label>
          <div className="journal-library-view-switch" role="group" aria-label="Journal library view"><button type="button" aria-pressed={view === "entries"} onClick={()=>setView("entries")}><Library size={14}/>Entries</button><button type="button" aria-pressed={view === "calendar"} onClick={()=>setView("calendar")} aria-label="Toggle journal calendar"><CalendarDays size={14}/>Calendar</button></div></div>
          <details className="journal-library-filters"><summary>Filter entries</summary><label>Entry type<select value={filterType} onChange={e=>setFilterType(e.target.value)}><option value="">All types</option>{Object.entries(TYPE_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>Emotion<select value={filterEmotion} onChange={e=>setFilterEmotion(e.target.value)}><option value="">All emotions</option>{DAILY_JOURNAL_EMOTIONS.map(e=><option key={e}>{e}</option>)}</select></label><label>From<input type="date" value={filterFrom} onChange={e=>setFilterFrom(e.target.value)}/></label><label>To<input type="date" value={filterTo} onChange={e=>setFilterTo(e.target.value)}/></label><label><input type="checkbox" checked={pinnedOnly} onChange={e=>setPinnedOnly(e.target.checked)}/> Bookmarked only</label><button type="button" onClick={()=>{setFilterType("");setFilterEmotion("");setFilterFrom("");setFilterTo("");setPinnedOnly(false);setSearch("");}}>Clear filters</button><p>Search also matches tags, sessions, lessons, rules and notes.</p></details>
          <div className="mt-3 flex items-center justify-between px-1 text-[11px] text-[#787774]"><span>{visibleEntries.length} entries</span></div>
          {view === "entries" ? <div className="mt-2 space-y-2">{loading ? <p className="p-4 text-sm text-[#787774]">Loading reflections…</p> : visibleEntries.map((entry) => <button key={entry.id} type="button" onClick={() => openEntry(entry)} className={`w-full rounded-xl border p-3 text-left transition ${selectedId === entry.id ? "border-blue-300 bg-blue-50" : "border-transparent hover:border-[#e3e2de] hover:bg-[#f7f6f3]"}`}><div className="flex items-center justify-between gap-2"><strong className="truncate text-sm">{entry.details?.pinned ? "★ " : ""}{entry.title}</strong><span className="shrink-0 text-[10px] text-[#787774]">{dateLabel(entry.entryDate)}</span></div><p className="mt-1 line-clamp-2 text-xs leading-5 text-[#787774]">{entry.plainText || "Empty reflection"}</p><div className="mt-2 flex flex-wrap gap-1">{entry.emotions.slice(0, 2).map((emotion) => <span key={emotion} className="rounded-md bg-[#f1f1ef] px-1.5 py-0.5 text-[9px]">{emotion}</span>)}<span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[9px] text-blue-700">{TYPE_LABELS[entry.entryType]}</span></div></button>)}</div> : <div className="mt-4"><div className="mb-3 flex items-center justify-between"><button type="button" aria-label="Previous month" onClick={() => { setCalendarCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1)); setSelectedCalendarDate(null); }} className="rounded-lg p-1 hover:bg-[#f7f6f3]"><ChevronLeft size={16} /></button><button type="button" onClick={()=>{const now=new Date();setCalendarCursor(new Date(now.getFullYear(),now.getMonth(),1));setSelectedCalendarDate(journalLocalDate(now));}} className="rounded-lg px-2 py-1 text-xs font-bold hover:bg-[#f7f6f3]">{new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(calendarCursor)}<span className="ml-2 text-[9px] font-normal text-[#787774]">Today</span></button><button type="button" aria-label="Next month" onClick={() => { setCalendarCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1)); setSelectedCalendarDate(null); }} className="rounded-lg p-1 hover:bg-[#f7f6f3]"><ChevronRight size={16} /></button></div><div className="grid grid-cols-7 gap-1.5 text-center text-[9px] text-[#787774]">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((day) => <span key={day} className="pb-1 font-semibold">{day}</span>)}{calendarDays.map((day, index) => { const date = day ? calendarDateKey(day) : ""; const count = day ? visibleEntries.filter((entry) => entry.entryDate === date).length : 0; const isToday = date === journalLocalDate(new Date()); return <button key={index} type="button" disabled={!day} onClick={() => setSelectedCalendarDate(date)} aria-label={day ? `${date}${count ? `, ${count} entries` : ", no entries"}` : undefined} className={`relative min-h-[50px] rounded-xl border text-[11px] ${selectedCalendarDate === date ? "border-blue-400 ring-2 ring-blue-200" : "border-[#e9e9e7]"} ${count ? "bg-blue-50 font-bold text-blue-700 hover:bg-blue-100" : "text-[#787774] hover:bg-[#f7f6f3]"}`}>{day}{isToday && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-blue-500" />}{count > 0 && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-blue-100 px-1.5 text-[8px] leading-3 text-blue-700">{count}</span>}</button>; })}</div>{selectedCalendarDate && <div className="mt-4 rounded-xl border border-[#e9e9e7] bg-[#f7f6f3] p-3"><p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#787774]">{dateLabel(selectedCalendarDate)} · {selectedDayEntries.length} {selectedDayEntries.length === 1 ? "entry" : "entries"}</p>{selectedDayEntries.length ? <div className="space-y-1.5">{selectedDayEntries.map((entry) => <button key={entry.id} type="button" onClick={() => openEntry(entry)} className="w-full rounded-lg border border-[#e3e2de] bg-white p-2.5 text-left text-xs hover:border-blue-300"><strong className="block truncate">{entry.title}</strong><span className="text-[10px] text-[#787774]">{TYPE_LABELS[entry.entryType]} · {entry.plainText.slice(0,60) || "Empty reflection"}</span></button>)}</div> : <p className="text-xs text-[#787774]">No reflections on this day.</p>}</div>}</div>}
        </aside></>}

        <main data-tour="daily-journal-editor" className="daily-journal-book-shell">
          {!draft ? <div className="daily-journal-book is-simple" data-paper={preferences.paper} style={bookStyle}><section className="daily-journal-paper flex min-h-[660px] flex-col items-center justify-center text-center"><BookHeart size={38} className="text-[#9b8f7b]" /><h2 className="mt-4 text-xl font-bold">A blank page is ready</h2><p className="mt-2 max-w-md text-sm leading-6 text-[#746955]">Start freely, or choose a guided reflection when you want a little structure.</p><button type="button" onClick={() => startEntry("free")} disabled={tutorialMode} className="mt-6 flex items-center gap-2 rounded-xl bg-[#2383e2] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1a73ca] disabled:opacity-60"><Plus size={16} /> Start writing</button></section></div> : <>
            <div className={`daily-journal-book is-simple ${focusMode ? "is-focus" : ""}`} data-paper={preferences.paper} style={bookStyle}>
            <section className="daily-journal-paper daily-journal-left-page">
            <div className="daily-journal-book-heading"><input data-tour="daily-journal-title" value={draft.title} onChange={(event) => updateDraft({ title: event.target.value.slice(0, 160) })} disabled={mutationBlocked} placeholder="Reflection title" className="min-w-0 flex-1 bg-transparent text-2xl font-bold outline-none placeholder:text-[#9b8f7b]" /><div ref={datePickerRef} className="journal-date-picker"><button type="button" aria-labelledby="journal-entry-date-label" aria-expanded={datePickerOpen} disabled={mutationBlocked} onClick={()=>{const selected=new Date(`${draft.entryDate}T12:00:00`);setDatePickerCursor(Number.isNaN(selected.getTime())?new Date():selected);setDatePickerOpen(open=>!open);}} className="journal-date-trigger"><span id="journal-entry-date-label"><small>Entry date</small>{new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric",year:"numeric"}).format(new Date(`${draft.entryDate}T12:00:00`))}</span><CalendarDays size={16}/></button>{datePickerOpen && <div role="dialog" aria-label="Choose journal entry date" className="journal-date-popover"><div className="journal-date-popover-header"><button type="button" aria-label="Previous calendar month" onClick={()=>setDatePickerCursor(current=>new Date(current.getFullYear(),current.getMonth()-1,1))}><ChevronLeft size={16}/></button><strong>{new Intl.DateTimeFormat(undefined,{month:"long",year:"numeric"}).format(datePickerCursor)}</strong><button type="button" aria-label="Next calendar month" onClick={()=>setDatePickerCursor(current=>new Date(current.getFullYear(),current.getMonth()+1,1))}><ChevronRight size={16}/></button></div><div className="journal-date-weekdays">{["S","M","T","W","T","F","S"].map((day,index)=><span key={`${day}-${index}`}>{day}</span>)}</div><div className="journal-date-days">{pickerDays.map((day,index)=>{const value=day?`${datePickerCursor.getFullYear()}-${String(datePickerCursor.getMonth()+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`:"";const today=value===journalLocalDate(new Date());const selected=value===draft.entryDate;return <button key={index} type="button" disabled={!day} aria-label={day?value:undefined} aria-pressed={selected} className={today?"is-today":""} onClick={()=>day&&chooseEntryDate(day)}>{day}</button>;})}</div><button type="button" className="journal-date-today" onClick={()=>{const today=new Date();setDatePickerCursor(new Date(today.getFullYear(),today.getMonth(),1));updateDraft({entryDate:journalLocalDate(today)});setDatePickerOpen(false);}}>Use today</button></div>}</div></div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-b border-[#d8cdb9] pb-3"><span className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-700">{TYPE_LABELS[draft.entryType]}</span><div className="flex items-center gap-2 text-[11px] text-[#746955]">{saveState === "offline" ? <CloudOff size={14} /> : saveState === "saved" ? <Check size={14} className="text-emerald-600" /> : <Cloud size={14} />}<span>{saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "offline" ? "Offline — draft kept here" : saveState === "draft" ? "Browser draft" : "Synced entry"}</span></div></div>
            <div data-tour="daily-journal-toolbar" role="toolbar" aria-label="Journal formatting" className="mt-5 flex flex-wrap gap-1 rounded-xl border border-[#e3e2de] bg-[#f7f6f3] p-1.5">{[
              [Bold, "bold", "Bold"], [Italic, "italic", "Italic"], [Underline, "underline", "Underline"], [Strikethrough, "strikeThrough", "Strikethrough"], [List, "insertUnorderedList", "Bullet list"], [ListOrdered, "insertOrderedList", "Numbered list"], [Quote, "formatBlock", "Quote", "blockquote"],
            ].map(([Icon, command, label, value]) => <button key={String(command)} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => format(String(command), value ? String(value) : undefined)} disabled={mutationBlocked} aria-pressed={!!formatState[String(command)]} aria-label={String(label)} title={String(label)} className="rounded-lg p-2 text-[#5a5957] hover:bg-white hover:text-[#2383e2] disabled:opacity-50"><Icon size={15} /></button>)}{[["undo","Undo"],["redo","Redo"],["removeFormat","Clear formatting"],["formatBlock","Heading"]].map(([command,label])=><button key={command} type="button" disabled={mutationBlocked} onMouseDown={e=>e.preventDefault()} onClick={()=>format(command,command==="formatBlock"?"h2":undefined)} className="journal-text-tool">{label}</button>)}<label className="ml-auto flex items-center gap-2 px-2 text-[10px] font-bold text-[#746955]">Font<select aria-label="Journal font" value={journalFont} onChange={(event) => chooseFont(event.target.value as JournalFont)} className="h-8 rounded-lg border border-[#d8cdb9] bg-white px-2 text-[11px]">{JOURNAL_FONTS.map((font) => <option key={font.id} value={font.id}>{font.label}</option>)}</select></label></div>
            <div ref={promptMenuRef} className="daily-journal-prompt-row mt-4 flex flex-wrap items-center justify-between gap-2">
              <div className="relative">
                <button type="button" aria-expanded={promptOpen} onClick={() => setPromptOpen((open) => !open)} disabled={tutorialMode} className="daily-journal-prompt-button flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50"><WandSparkles size={14} /> Add a reflection prompt</button>
                {promptOpen && <div className="daily-journal-prompt-menu absolute left-0 top-11 z-10 w-64 rounded-xl border p-2 shadow-xl">{REFLECTION_PROMPTS.map((prompt) => <button key={prompt} type="button" onClick={() => insertPrompt(prompt)} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[#f7f6f3]">{prompt}</button>)}</div>}
              </div>
              <span className="text-xs text-[#746955]">{draft.plainText.trim() ? draft.plainText.trim().split(/\s+/).length : 0} words</span>
            </div>
            <div key={draft.id} ref={editorRef} data-tour="daily-journal-writing" role="textbox" aria-label="Journal reflection" aria-multiline="true" contentEditable={!mutationBlocked} suppressContentEditableWarning onPointerDown={placeCaretOnRuledLine} onFocus={()=>document.execCommand("defaultParagraphSeparator", false, "p")} onKeyDown={(event) => { if (event.key === "Enter" && !mutationBlocked) { event.preventDefault(); document.execCommand(event.shiftKey ? "insertLineBreak" : "insertParagraph"); captureEditor(); return; } if (event.key === "/" && !event.ctrlKey && !event.metaKey && !mutationBlocked && !(window.getSelection()?.anchorNode?.textContent || "").slice(0, window.getSelection()?.anchorOffset || 0).trim()) { event.preventDefault(); setSlashOpen(true); } if (event.key === "Escape") setSlashOpen(false); }} onInput={captureEditor} onPaste={(event) => { event.preventDefault(); insertPlainText(event.clipboardData.getData("text/plain")); }} onDrop={(event) => { event.preventDefault(); insertPlainText(event.dataTransfer.getData("text/plain")); }} dangerouslySetInnerHTML={{ __html: editorInitialHtml }} className="daily-journal-editor daily-journal-lined-paper mt-4 min-h-[440px] outline-none" />
            <div className="journal-inline-extras">
              {!!draft.details?.notes?.length && <details><summary>Timestamped thoughts ({draft.details.notes.length})</summary>{draft.details.notes.map(n=><p key={n.id}><strong>{new Date(n.at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})} · {n.phase}</strong> {n.text}</p>)}</details>}
              {!!draft.details?.checks?.length && <div>{draft.details.checks.map(c=><label key={c.id}><input type="checkbox" checked={c.done} disabled={mutationBlocked} onChange={e=>updateDraft({details:{...draft.details,checks:draft.details?.checks?.map(x=>x.id===c.id?{...x,done:e.target.checked}:x)}})}/>{c.text}</label>)}</div>}
              {!!draft.details?.images?.length && draft.details.images.map(image=><figure key={image.id}>{/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.data} alt={image.caption || "Journal attachment"}/><figcaption>{image.caption}</figcaption></figure>)}
              {!!draft.details?.snapshots?.length && <details><summary>Trade snapshots ({draft.details.snapshots.length})</summary>{draft.details.snapshots.map(t=><p key={t.id}>{t.name} · Realized P&amp;L {formatRealizedPnl(t.pnlSol, "SOL")}{t.pnlUsd!==undefined?` · ${formatUsd(t.pnlUsd, { signed: true })}`:""}</p>)}</details>}
            </div>
            <span className="daily-journal-page-number">{selectedEntryIndex >= 0 ? selectedEntryIndex * 2 + 1 : 1}</span>
            </section>
            {(tutorialMode || detailsOpen) && !focusMode && <><button type="button" aria-label="Close entry details" onClick={() => setDetailsOpen(false)} className="fixed inset-0 z-[71] cursor-default bg-black/45" /><section data-tour="daily-journal-reflection-tools" className="daily-journal-paper daily-journal-details-drawer fixed bottom-0 right-0 top-0 z-[72] w-[430px] max-w-[94vw] overflow-y-auto shadow-2xl"><div className="mb-6 flex items-center justify-between"><div><h2 className="font-bold">Entry details</h2><p className="text-xs text-[#746955]">Optional context for this reflection.</p></div>{!tutorialMode && <button type="button" aria-label="Close entry details panel" onClick={() => setDetailsOpen(false)} className="rounded-lg p-2 hover:bg-[#f7f0e3]"><X size={18} /></button>}</div><div><h3 className="flex items-center gap-2 text-xs font-bold"><BookHeart size={14} /> Emotions</h3><div className="mt-2 flex flex-wrap gap-2">{DAILY_JOURNAL_EMOTIONS.map((emotion) => <button key={emotion} type="button" disabled={tutorialMode} onClick={() => updateDraft({ emotions: draft.emotions.includes(emotion) ? draft.emotions.filter((item) => item !== emotion) : [...draft.emotions, emotion].slice(0, 12) })} className={`rounded-lg border px-2.5 py-1.5 text-[11px] ${draft.emotions.includes(emotion) ? "border-blue-300 bg-blue-50 text-blue-700" : "border-[#d8cdb9] hover:bg-[#f7f0e3]"}`}>{emotion}</button>)}</div>{(["emotionIntensity", "energyLevel", "confidenceLevel"] as const).map((field) => <label key={field} className="mt-3 block text-[11px] text-[#746955]">{field === "emotionIntensity" ? "Emotion intensity" : field === "energyLevel" ? "Energy" : "Confidence"} · {draft[field] ?? "not set"}<input type="range" min="1" max="5" value={draft[field] ?? 3} onChange={(event) => updateDraft({ [field]: Number(event.target.value) })} disabled={tutorialMode} className="mt-1 w-full" /></label>)}</div><div className="mt-7 border-t border-[#d8cdb9] pt-6"><h3 className="flex items-center gap-2 text-xs font-bold"><Tags size={14} /> Tags & linked trades</h3><div className="mt-2 flex gap-2"><input value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); const tag = tagInput.trim().slice(0, 30); if (tag && !draft.tags.includes(tag)) updateDraft({ tags: [...draft.tags, tag].slice(0, 20) }); setTagInput(""); } }} disabled={tutorialMode} placeholder="Type a tag and press Enter" className="h-9 flex-1 rounded-lg border border-[#d8cdb9] px-3 text-xs outline-none" /></div><div className="mt-2 flex flex-wrap gap-1">{draft.tags.map((tag) => <button key={tag} type="button" onClick={() => updateDraft({ tags: draft.tags.filter((item) => item !== tag) })} className="rounded-md bg-[#eee4d2] px-2 py-1 text-[10px]">#{tag} ×</button>)}</div><label className="mt-4 flex items-center gap-2 text-[11px] font-semibold"><Link2 size={13} /> Link a trade<select value="" disabled={tutorialMode} onChange={(event) => { if (event.target.value && !draft.linkedTradeIds.includes(event.target.value)) updateDraft({ linkedTradeIds: [...draft.linkedTradeIds, event.target.value].slice(0, 50) }); }} className="h-9 min-w-0 flex-1 rounded-lg border border-[#d8cdb9] bg-white px-2"><option value="">Choose a trade…</option>{trades.filter((trade) => !draft.linkedTradeIds.includes(trade.id)).map((trade) => <option key={trade.id} value={trade.id}>{trade.name} · {trade.result}</option>)}</select></label>{linkedTrades.length ? <div className="mt-3 space-y-2">{linkedTrades.map((trade) => <div key={trade.id} className="daily-journal-linked-trade flex items-center justify-between gap-3 rounded-xl border border-[#d8cdb9] p-3"><div className="min-w-0"><strong className="block truncate text-xs">{trade.name} <span className="font-normal text-[#746955]">${trade.symbol}</span></strong><span className={`text-[10px] font-semibold ${trade.pnlSol < 0 ? "text-rose-600" : "text-emerald-600"}`}>{trade.result} · {trade.pnlSol >= 0 ? "+" : ""}{trade.pnlSol.toFixed(2)} SOL</span></div><button type="button" onClick={() => updateDraft({ linkedTradeIds: draft.linkedTradeIds.filter((id) => id !== trade.id) })} disabled={tutorialMode} aria-label={`Remove ${trade.name} from this entry`} className="rounded-lg p-1.5 text-[#746955] hover:bg-[#f7f0e3] hover:text-rose-600"><X size={14} /></button></div>)}</div> : <div className="mt-2 text-[10px] text-[#746955]">No trades linked yet</div>}<p className="mt-4 rounded-lg bg-[#f4ead8] p-2 text-[10px] leading-4 text-[#746955]">Daily Journal entries are not sent to the AI coach. Any future AI use will require a separate, explicit choice.</p></div></section></>}
            </div>
            <footer className="daily-journal-book-footer mt-4 flex flex-wrap items-center justify-between gap-3"><div>{!focusMode && (deleteOpen ? <div className="flex items-center gap-2 text-xs"><span>Move this entry to Trash?</span><button type="button" onClick={() => void remove()} className="rounded-lg bg-rose-600 px-3 py-2 font-semibold text-white">Yes, delete</button><button type="button" onClick={() => setDeleteOpen(false)} className="rounded-lg px-3 py-2">Cancel</button></div> : <button type="button" disabled={tutorialMode || draft.id === "tutorial-example"} onClick={() => setDeleteOpen(true)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-40"><Trash2 size={14} /> Delete</button>)}</div><div className="flex items-center gap-2"><button type="button" onClick={() => turnPage(-1)} disabled={selectedEntryIndex <= 0} className="daily-journal-secondary flex h-10 items-center gap-1 rounded-xl border px-3 text-xs font-semibold disabled:opacity-35"><ChevronLeft size={15} /> Previous</button><button type="button" onClick={() => turnPage(1)} disabled={selectedEntryIndex < 0 || selectedEntryIndex >= visibleEntries.length - 1} className="daily-journal-secondary flex h-10 items-center gap-1 rounded-xl border px-3 text-xs font-semibold disabled:opacity-35">Next <ChevronRight size={15} /></button></div><button type="button" data-tour="daily-journal-save" onClick={() => void save()} disabled={mutationBlocked || saveState === "saving" || saveState === "saved"} className="rounded-xl bg-[#2383e2] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1a73ca] disabled:opacity-50">{saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : "Save now"}</button></footer>
          </>}
        </main>
      </div>
      {selectionToolbar && !workbench && !mutationBlocked && <div role="toolbar" aria-label="Selection formatting" className="journal-selection-toolbar" style={{position:"fixed",...selectionToolbar}}>{[["bold","B"],["italic","I"],["underline","U"]].map(([command,label])=><button type="button" key={command} aria-label={`Selection ${command}`} aria-pressed={!!formatState[command]} onMouseDown={e=>e.preventDefault()} onClick={()=>format(command)}>{label}</button>)}</div>}
      {slashOpen && <div className="journal-slash-menu" role="dialog" aria-label="Insert into journal"><button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>insertHtml(`<h3>${escapeJournalText(new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}))}</h3><p><br></p>`)}>Timestamp</button><button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>{setSlashOpen(false);setWorkbench("writing");}}>Checklist or image</button><button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>insertHtml("<h2>What did I learn?</h2><p><br></p>")}>Reflection prompt</button><button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>{insertPlainText("/");setSlashOpen(false);}}>Insert / character</button><button type="button" onClick={()=>setSlashOpen(false)}>Cancel</button></div>}
      {deleteAllOpen && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"><section role="dialog" aria-modal="true" aria-labelledby="delete-daily-journal-title" className="w-full max-w-md rounded-2xl border border-[#e3e2de] bg-white p-6 shadow-2xl"><h2 id="delete-daily-journal-title" className="text-lg font-bold">Delete every Daily Journal entry?</h2><p className="mt-2 text-sm leading-6 text-[#787774]">This permanently removes all reflections, emotions, tags, trade links, and the unfinished browser draft. Your trades are not affected.</p><label className="mt-4 block text-xs font-semibold">Type DELETE JOURNAL to confirm<input autoFocus value={deleteAllConfirmation} onChange={(event) => setDeleteAllConfirmation(event.target.value)} className="mt-2 h-10 w-full rounded-xl border border-[#d8d7d3] px-3 text-sm outline-none focus:border-rose-400" /></label><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => { setDeleteAllOpen(false); setDeleteAllConfirmation(""); }} className="rounded-xl px-4 py-2 text-sm font-semibold">Cancel</button><button type="button" onClick={() => void removeAll()} disabled={deleteAllConfirmation !== "DELETE JOURNAL"} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Delete all entries</button></div></section></div>}
    </section>
  );
}
