"use client";

import { type ChangeEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, getDocs, setDoc } from "firebase/firestore";
import { Bell, BookOpenCheck, Check, Clipboard, Download, ExternalLink, FileUp, Plus, Save, Search, Trash2 } from "lucide-react";
import type { ResearchDecision, ResearchItem, ResearchReminder, ResearchStage, ResearchSnapshot, Trade } from "@/lib/types";
import { db } from "@/lib/firebase";
import { deleteSupabaseResearch, listSupabaseResearch, saveSupabaseResearch, usesSupabaseJournal } from "@/lib/journalBackend";
import { useToast } from "@/components/Toast";
import { formatSol, getTradeDate } from "@/lib/utils";
import ResearchEvidenceImage from "@/components/ResearchEvidenceImage";
import BetaBadge from "@/components/BetaBadge";

const STAGES: { id: ResearchStage; label: string }[] = [
  { id: "idea", label: "Idea" }, { id: "watching", label: "Watching" }, { id: "researching", label: "Researching" },
  { id: "planned", label: "Planned" }, { id: "active", label: "Active" },
  { id: "invalidated", label: "Invalidated" }, { id: "archived", label: "Archived" },
];
const blank = (): ResearchItem => ({ ca: "", name: "", symbol: "", stage: "idea", thesis: "", bullCase: "", bearCase: "", catalysts: [], risks: [], invalidation: "", entryPlan: "", stopPlan: "", targetPlan: "", horizon: "", confidence: 50, tags: [], sources: [], snapshots: [], decisions: [], reminders: [], createdAt: Date.now(), updatedAt: Date.now() });
const lines = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 20);
const text = (value: string[] | undefined) => (value ?? []).join("\n");
const bulletList = (values: string[]) => values.map((value) => `- ${value}`).join("\n");

function buildShareableThesis(item: ResearchItem) {
  const stage = STAGES.find((entry) => entry.id === item.stage)?.label ?? item.stage;
  const sections = [
    `# ${item.name.trim()}${item.symbol.trim() ? ` ($${item.symbol.trim()})` : ""}`,
    [
      item.ca.trim() ? `**Contract:** \`${item.ca.trim()}\`` : "",
      `**Stage:** ${stage}`,
      `**Confidence:** ${item.confidence}%`,
      item.horizon.trim() ? `**Time horizon:** ${item.horizon.trim()}` : "",
      item.sizeSol !== undefined ? `**Planned size:** ${formatSol(item.sizeSol)} SOL` : "",
    ].filter(Boolean).join("\n"),
    item.thesis.trim() ? `## Core thesis\n${item.thesis.trim()}` : "",
    item.bullCase.trim() ? `## Bull case\n${item.bullCase.trim()}` : "",
    item.bearCase.trim() ? `## Bear case\n${item.bearCase.trim()}` : "",
    item.catalysts.length ? `## Catalysts\n${bulletList(item.catalysts)}` : "",
    item.risks.length ? `## Risks\n${bulletList(item.risks)}` : "",
    item.invalidation.trim() ? `## Invalidation\n${item.invalidation.trim()}` : "",
    [
      item.entryPlan.trim() ? `**Entry:** ${item.entryPlan.trim()}` : "",
      item.stopPlan.trim() ? `**Stop / risk:** ${item.stopPlan.trim()}` : "",
      item.targetPlan.trim() ? `**Targets:** ${item.targetPlan.trim()}` : "",
    ].filter(Boolean).length
      ? `## Trade plan\n${[
          item.entryPlan.trim() ? `**Entry:** ${item.entryPlan.trim()}` : "",
          item.stopPlan.trim() ? `**Stop / risk:** ${item.stopPlan.trim()}` : "",
          item.targetPlan.trim() ? `**Targets:** ${item.targetPlan.trim()}` : "",
        ].filter(Boolean).join("\n")}`
      : "",
    item.tags.length ? `**Tags:** ${item.tags.map((tag) => `#${tag.replace(/\s+/g, "-")}`).join(" ")}` : "",
    item.sources.length ? `## Sources\n${bulletList(item.sources)}` : "",
    item.snapshots.length
      ? `## Research updates\n${item.snapshots.map((snapshot) => `- ${new Date(snapshot.createdAt).toLocaleDateString()}: ${snapshot.note}`).join("\n")}`
      : "",
  ];

  return sections.filter(Boolean).join("\n\n");
}
const validResearch = (value: unknown): value is ResearchItem => {
  if (!value || typeof value !== "object") return false;
  const item = value as ResearchItem;
  const boundedLists: Array<{ values: string[]; maxLength: number }> = [
    { values: item.catalysts, maxLength: 500 }, { values: item.risks, maxLength: 500 },
    { values: item.tags, maxLength: 80 }, { values: item.sources, maxLength: 500 },
  ];
  return typeof item.ca === "string" && item.ca.length >= 20 && item.ca.length <= 128
    && typeof item.name === "string" && item.name.length <= 120
    && typeof item.symbol === "string" && item.symbol.length <= 40
    && STAGES.some((stage) => stage.id === item.stage)
    && typeof item.thesis === "string" && item.thesis.length <= 5000
    && typeof item.bullCase === "string" && item.bullCase.length <= 3000
    && typeof item.bearCase === "string" && item.bearCase.length <= 3000
    && typeof item.invalidation === "string" && item.invalidation.length <= 2000
    && typeof item.entryPlan === "string" && item.entryPlan.length <= 2000
    && typeof item.stopPlan === "string" && item.stopPlan.length <= 1000
    && typeof item.targetPlan === "string" && item.targetPlan.length <= 1000
    && typeof item.horizon === "string" && item.horizon.length <= 80
    && typeof item.confidence === "number" && item.confidence >= 0 && item.confidence <= 100
    && (item.sizeSol === undefined || (typeof item.sizeSol === "number" && Number.isFinite(item.sizeSol) && item.sizeSol >= 0 && item.sizeSol <= 100000000))
    && boundedLists.every(({ values, maxLength }) => Array.isArray(values) && values.length <= 20 && values.every((entry) => typeof entry === "string" && entry.length <= maxLength))
    && Array.isArray(item.snapshots) && item.snapshots.length <= 100 && item.snapshots.every((snapshot) => snapshot && typeof snapshot.id === "string" && typeof snapshot.note === "string" && snapshot.note.length <= 1000 && Number.isFinite(snapshot.createdAt))
    && Array.isArray(item.decisions) && item.decisions.length <= 100 && item.decisions.every((decision) => decision && typeof decision.id === "string" && typeof decision.note === "string" && decision.note.length <= 2000 && Number.isFinite(decision.createdAt) && ["calm", "confident", "uncertain", "fearful", "fomo"].includes(decision.mood))
    && (item.reminders === undefined || (Array.isArray(item.reminders) && item.reminders.length <= 20 && item.reminders.every((reminder) => reminder && typeof reminder.id === "string" && reminder.id.length <= 100 && typeof reminder.title === "string" && reminder.title.length > 0 && reminder.title.length <= 200 && Number.isFinite(reminder.dueAt) && (reminder.completedAt === undefined || Number.isFinite(reminder.completedAt)))))
    && Number.isFinite(item.createdAt) && Number.isFinite(item.updatedAt)
    && JSON.stringify(item).length <= 90000;
};

function makeWeeklyReview(trades: Trade[], items: ResearchItem[]) {
  const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = trades.filter((trade) => {
    const at = typeof trade.tradedAt === "number" ? trade.tradedAt : getTradeDate(trade).getTime();
    return Number.isFinite(at) && at >= since;
  });
  const pnl = recent.reduce((sum, trade) => sum + (trade.pnlSol || 0), 0);
  const mistakes = new Map<string, { count: number; pnl: number }>();
  recent.forEach((trade) => (trade.mistakes ?? []).forEach((tag) => {
    const current = mistakes.get(tag) ?? { count: 0, pnl: 0 };
    mistakes.set(tag, { count: current.count + 1, pnl: current.pnl + (trade.pnlSol || 0) });
  }));
  const topMistake = [...mistakes.entries()].sort((a, b) => a[1].pnl - b[1].pnl)[0];
  return [
    `Weekly journal review · ${new Date().toLocaleDateString()}`,
    `${recent.length} trades · ${pnl >= 0 ? "+" : ""}${formatSol(pnl)} SOL · ${recent.length ? `${Math.round((recent.filter((trade) => trade.pnlSol > 0).length / recent.length) * 100)}% winners` : "no trades logged"}`,
    `Research pipeline: ${items.filter((item) => !["archived", "invalidated"].includes(item.stage)).length} open ideas; ${items.filter((item) => item.stage === "planned").length} planned.`,
    topMistake ? `Largest tagged drag: ${topMistake[0]} (${topMistake[1].count} trades, ${formatSol(topMistake[1].pnl)} SOL).` : "No mistake tags recorded this week.",
    "Reflection: What did I do well? What will I change next week?",
  ].join("\n");
}

export default function ResearchView({ userId, trades, onLogTradeFromResearch }: { userId: string; trades: Trade[]; onLogTradeFromResearch?: (item: ResearchItem) => void }) {
  const { showToast } = useToast();
  const [items, setItems] = useState<ResearchItem[]>([]);
  const [selectedCa, setSelectedCa] = useState("");
  const [draft, setDraft] = useState<ResearchItem>(blank);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [exampleMode, setExampleMode] = useState(false);
  const [query, setQuery] = useState("");
  const [snapshotNote, setSnapshotNote] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const [decisionMood, setDecisionMood] = useState<ResearchDecision["mood"]>("calm");
  const [showReview, setShowReview] = useState(false);
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderDate, setReminderDate] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let result: ResearchItem[];
      if (usesSupabaseJournal()) result = await listSupabaseResearch(userId);
      else {
        const snapshot = await getDocs(collection(db, "users", userId, "research"));
        result = snapshot.docs.map((entry) => entry.data() as ResearchItem).filter(validResearch);
      }
      result = result.filter(validResearch).map((item) => ({ ...item, reminders: item.reminders ?? [] }));
      setItems(result);
      setSyncError(false);
      setLastSyncedAt(Date.now());
      const requestedCa = sessionStorage.getItem("memecoin_journal_open_research");
      const requestedItem = requestedCa ? result.find((item) => item.ca === requestedCa) : null;
      if (requestedItem) {
        setSelectedCa(requestedItem.ca);
        setDraft(structuredClone(requestedItem));
        sessionStorage.removeItem("memecoin_journal_open_research");
      } else {
        setSelectedCa((current) => current && result.some((item) => item.ca === current) ? current : "");
      }
    } catch (error) {
      console.error("Research workspace could not load", error);
      setSyncError(true);
      showToast("Research couldn’t load", "error", "Your existing trades are untouched. Refresh or check your connection.");
    } finally { setLoading(false); }
  }, [showToast, userId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const filtered = useMemo(() => items.filter((item) => `${item.name} ${item.symbol} ${item.ca} ${item.thesis} ${item.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase())), [items, query]);
  const relatedTrades = useMemo(() => selectedCa ? trades.filter((trade) => trade.ca?.trim() === selectedCa) : [], [selectedCa, trades]);
  const screenshotTrades = useMemo(() => relatedTrades.filter((trade) => typeof trade.screenshotUrl === "string" && (trade.screenshotUrl.startsWith("https://") || trade.screenshotUrl.startsWith("data:image/"))).sort((a, b) => getTradeDate(a).getTime() - getTradeDate(b).getTime()), [relatedTrades]);
  const pnl = relatedTrades.reduce((sum, trade) => sum + (trade.pnlSol || 0), 0);
  const review = useMemo(() => makeWeeklyReview(trades, items), [trades, items]);
  const upcomingReminders = useMemo(() => items.flatMap((item) => (item.reminders ?? []).filter((reminder) => reminder.completedAt === undefined).map((reminder) => ({ item, reminder }))).sort((a, b) => a.reminder.dueAt - b.reminder.dueAt).slice(0, 6), [items]);
  const researchStats = useMemo(() => {
    const linked = items.flatMap((item) => trades.filter((trade) => trade.ca?.trim() === item.ca).map((trade) => ({ item, trade })));
    const bandStats = (["0–49%", "50–79%", "80–100%"] as const).map((label, index) => {
      const group = linked.filter(({ item }) => index === 0 ? item.confidence < 50 : index === 1 ? item.confidence >= 50 && item.confidence < 80 : item.confidence >= 80);
      return { label, count: group.length, wins: group.filter(({ trade }) => trade.pnlSol > 0).length, pnl: group.reduce((sum, { trade }) => sum + (trade.pnlSol || 0), 0) };
    });
    const tagTotals = new Map<string, { count: number; pnl: number }>();
    linked.forEach(({ item, trade }) => item.tags.forEach((tag) => {
      const current = tagTotals.get(tag) ?? { count: 0, pnl: 0 };
      tagTotals.set(tag, { count: current.count + 1, pnl: current.pnl + (trade.pnlSol || 0) });
    }));
    return { ideas: items.filter((item) => !["archived", "invalidated"].includes(item.stage)).length, linkedCount: linked.length, bands: bandStats, tags: [...tagTotals.entries()].sort((a, b) => a[1].pnl - b[1].pnl).slice(0, 4) };
  }, [items, trades]);

  const update = <K extends keyof ResearchItem>(key: K, value: ResearchItem[K]) => { setExampleMode(false); setDraft((current) => ({ ...current, [key]: value })); };
  const loadExample = () => {
    setSelectedCa("");
    setExampleMode(true);
    setDraft({ ...blank(), name: "", symbol: "", stage: "researching", thesis: "Example only: This token may benefit from a growing community narrative, but attention alone is not proof of durable demand.", bullCase: "Organic engagement and liquidity continue to grow; holder distribution remains healthy.", bearCase: "Attention fades, insiders sell into demand, or liquidity cannot support exits.", catalysts: ["Sustained organic volume", "Clear catalyst confirmed by a primary source"], risks: ["Concentrated holders", "Thin or removable liquidity"], invalidation: "Invalidate if liquidity exits, insider distribution accelerates, or the stated catalyst is disproven.", entryPlan: "Wait for the thesis conditions; size conservatively and define risk before entry.", stopPlan: "Exit if thesis invalidation occurs; do not widen the risk after entry.", targetPlan: "Scale out at levels chosen before entry; leave no unplanned position.", horizon: "Example: days", confidence: 50, tags: ["example", "narrative"], snapshots: [], decisions: [] });
    showToast("Unsaved example loaded", "info", "This is fictional practice content. Add a real name and CA before saving.");
  };
  const save = async (overrides: Partial<ResearchItem> = {}, successMessage = "Research saved") => {
    const candidate = { ...draft, ...overrides };
    const ca = candidate.ca.trim();
    if (ca.length < 20 || ca.length > 128 || ca.includes("/")) { showToast("Enter a valid token address", "error", "Paste the token’s contract address; names alone can’t identify a unique research record."); return; }
    if (!candidate.name.trim()) { showToast("Add a token name", "error"); return; }
    if (candidate.thesis.length > 5000 || !validResearch(candidate) || JSON.stringify(candidate).length > 90000) { showToast("Research entry needs a quick cleanup", "error", "Check that each list has at most 20 lines, snapshots and decisions stay within their limits, and source URLs are under 500 characters."); return; }
    if (candidate.sizeSol !== undefined && (!Number.isFinite(candidate.sizeSol) || candidate.sizeSol < 0 || candidate.sizeSol > 100000000)) { showToast("Enter a valid planned size", "error", "Use a non-negative SOL amount within the supported limit."); return; }
    setSaving(true);
    const now = Date.now();
    const value: ResearchItem = { ...candidate, ca, name: candidate.name.trim(), symbol: candidate.symbol.trim().slice(0, 40), thesis: candidate.thesis.slice(0, 5000), confidence: Math.max(0, Math.min(100, Math.round(candidate.confidence))), updatedAt: now, createdAt: items.find((entry) => entry.ca === ca)?.createdAt ?? now };
    if (value.sizeSol === undefined) delete value.sizeSol;
    try {
      if (usesSupabaseJournal()) await saveSupabaseResearch(userId, value);
      else await setDoc(doc(db, "users", userId, "research", ca), value);
      setItems((current) => [value, ...current.filter((entry) => entry.ca !== ca)]);
      setSelectedCa(ca);
      setDraft(structuredClone(value));
      showToast(successMessage, "success", successMessage === "Plan adopted" ? `${value.name} is now marked Planned and ready to use beside your trade entry.` : `${value.name} is in your private idea pipeline.`);
    } catch (error) {
      console.error("Research save failed", error);
      showToast("Research couldn’t save", "error", "Check your connection and try again. Your existing trades are unaffected.");
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!selectedCa || !window.confirm("Delete this research entry? Its linked trades will remain.")) return;
    try {
      if (usesSupabaseJournal()) await deleteSupabaseResearch(userId, selectedCa);
      else await deleteDoc(doc(db, "users", userId, "research", selectedCa));
      setItems((current) => current.filter((item) => item.ca !== selectedCa)); setSelectedCa(""); setDraft(blank());
      showToast("Research entry deleted", "info", "Linked trade records were kept.");
    } catch { showToast("Couldn’t delete the research entry", "error", "Check your connection and retry."); }
  };

  const exportJson = () => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([JSON.stringify(items, null, 2)], { type: "application/json" }));
    link.download = `memecoin-journal-research-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(link.href);
  };
  const importJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast("Backup is too large", "error", "Choose a file under 5 MB."); return; }
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!Array.isArray(parsed) || parsed.length > 500 || !parsed.every(validResearch)) throw new Error("invalid backup");
      if (!window.confirm(`Import ${parsed.length} research entries? Entries with matching addresses will be replaced.`)) return;
      for (const entry of parsed as ResearchItem[]) {
        if (usesSupabaseJournal()) await saveSupabaseResearch(userId, entry);
        else await setDoc(doc(db, "users", userId, "research", entry.ca), entry);
      }
      await load(); showToast("Research backup restored", "success", `${parsed.length} entries imported.`);
    } catch { showToast("Backup import did not finish", "error", "No entries were deleted. If the connection failed during restore, some entries may already have been imported; retrying the same backup is safe."); }
  };
  const addSnapshot = () => {
    if (!snapshotNote.trim()) return;
    const snapshot: ResearchSnapshot = { id: crypto.randomUUID(), createdAt: Date.now(), note: snapshotNote.trim().slice(0, 1000) };
    update("snapshots", [...draft.snapshots, snapshot].slice(-100)); setSnapshotNote("");
  };
  const addDecision = () => {
    if (!decisionNote.trim()) return;
    const decision: ResearchDecision = { id: crypto.randomUUID(), createdAt: Date.now(), mood: decisionMood, note: decisionNote.trim().slice(0, 2000) };
    update("decisions", [...draft.decisions, decision].slice(-100)); setDecisionNote("");
  };
  const addReminder = () => {
    const dueAt = new Date(`${reminderDate}T12:00:00`).getTime();
    if (!reminderTitle.trim() || !reminderDate || !Number.isFinite(dueAt)) return;
    const reminder: ResearchReminder = { id: crypto.randomUUID(), title: reminderTitle.trim().slice(0, 200), dueAt };
    update("reminders", [...(draft.reminders ?? []), reminder].slice(-20));
    setReminderTitle(""); setReminderDate("");
  };
  const updateReminder = (id: string, action: "complete" | "delete") => update("reminders", action === "delete" ? (draft.reminders ?? []).filter((reminder) => reminder.id !== id) : (draft.reminders ?? []).map((reminder) => reminder.id === id ? { ...reminder, completedAt: reminder.completedAt === undefined ? Date.now() : undefined } : reminder));
  const copyThesis = async () => {
    const content = buildShareableThesis(draft);
    try {
      await navigator.clipboard.writeText(content);
      showToast(
        "Full thesis copied",
        "success",
        content.length > 1900
          ? "Ready to paste. Discord may ask you to split this longer thesis into multiple messages."
          : "Ready to paste into Discord. Your private decision journal was not included.",
      );
    }
    catch { showToast("Clipboard unavailable", "error", "Use Research backup to export a private copy."); }
  };

  return <div className="journal-page">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs text-[#787774]">Journal / Research</p><div className="mt-1 flex items-center gap-2"><h1 className="text-2xl font-bold tracking-tight">Coin Research</h1><BetaBadge /></div><p className="mt-1 text-sm text-[#787774]">Keep the thesis, the plan, and the evidence together—then compare it with your actual trades.</p></div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setShowReview((open) => !open)} className="rounded-lg border border-[#e3e2de] px-3 py-2 text-xs font-medium hover:bg-[#f7f6f3]"><BookOpenCheck size={14} className="mr-1 inline"/> Weekly review</button>
        <button onClick={exportJson} disabled={!items.length} className="rounded-lg border border-[#e3e2de] px-3 py-2 text-xs font-medium disabled:opacity-40 hover:bg-[#f7f6f3]"><Download size={14} className="mr-1 inline"/> Backup</button>
        <label className="cursor-pointer rounded-lg border border-[#e3e2de] px-3 py-2 text-xs font-medium hover:bg-[#f7f6f3]"><FileUp size={14} className="mr-1 inline"/> Restore<input type="file" accept="application/json,.json" className="sr-only" onChange={importJson}/></label>
        <button onClick={loadExample} className="rounded-lg border border-[#e3e2de] px-3 py-2 text-xs font-medium hover:bg-[#f7f6f3]">Try example</button>
        <button onClick={() => { setSelectedCa(""); setExampleMode(false); setDraft(blank()); }} className="rounded-lg bg-[#2383e2] px-3 py-2 text-xs font-semibold text-white hover:bg-[#176bbd]"><Plus size={14} className="mr-1 inline"/> New idea</button>
      </div>
    </header>

    <section className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-xs ${syncError ? "border-amber-200 bg-amber-50 text-amber-900" : "border-[#e9e9e7] bg-white text-[#5a5957]"}`} aria-live="polite">
      <div><b>Research data health:</b> {loading ? "Syncing…" : syncError ? "Could not sync" : `Connected · ${items.length} ${items.length === 1 ? "entry" : "entries"}`}{lastSyncedAt && !syncError ? <span className="ml-2 text-[#9b9a97]">Last synced {new Date(lastSyncedAt).toLocaleTimeString()}</span> : null}</div>
      {syncError && <button onClick={() => void load()} className="rounded-md border border-amber-300 bg-white px-2.5 py-1.5 font-semibold">Retry sync</button>}
    </section>

    {upcomingReminders.length > 0 && <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4"><div className="flex items-center gap-2"><Bell size={15} className="text-amber-700"/><div><h2 className="text-sm font-semibold text-amber-950">Upcoming catalyst reminders</h2><p className="text-xs text-amber-800">Open a thesis to complete or reschedule its reminder.</p></div></div><div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{upcomingReminders.map(({ item, reminder }) => { const overdue = reminder.dueAt < new Date().setHours(0, 0, 0, 0); return <button key={`${item.ca}-${reminder.id}`} onClick={() => { setSelectedCa(item.ca); setDraft(structuredClone(item)); }} className={`rounded-lg border bg-white p-3 text-left ${overdue ? "border-rose-200" : "border-amber-200"}`}><p className="truncate text-xs font-semibold">{item.name} · {reminder.title}</p><p className={`mt-1 text-[11px] ${overdue ? "text-rose-700" : "text-amber-800"}`}>{overdue ? "Overdue · " : "Due · "}{new Date(reminder.dueAt).toLocaleDateString()}</p></button>; })}</div></section>}

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Metric label="Open ideas" value={String(researchStats.ideas)} detail={`${items.length} total entries`} />
      <Metric label="Linked trades" value={String(researchStats.linkedCount)} detail="Matched by exact contract address" />
      {researchStats.bands.map((band) => <Metric key={band.label} label={`${band.label} confidence`} value={band.count ? `${Math.round((band.wins / band.count) * 100)}% win rate` : "—"} detail={band.count ? `${band.count} trades · ${band.pnl >= 0 ? "+" : ""}${formatSol(band.pnl)} SOL` : "No linked trades yet"} />)}
    </section>
    {researchStats.tags.length > 0 && <section className="rounded-xl border border-[#e9e9e7] bg-white p-4"><h2 className="text-sm font-semibold">Narrative / thesis tag outcomes</h2><p className="mt-1 text-xs text-[#787774]">Descriptive only; small samples are not evidence of predictive performance.</p><div className="mt-3 flex flex-wrap gap-2">{researchStats.tags.map(([tag, result]) => <span key={tag} className="rounded-full bg-[#f7f6f3] px-3 py-1.5 text-xs">{tag} · {result.count} · <b className={result.pnl >= 0 ? "text-emerald-700" : "text-rose-700"}>{result.pnl >= 0 ? "+" : ""}{formatSol(result.pnl)} SOL</b></span>)}</div></section>}

    {showReview && <section className="rounded-xl border border-[#e3e2de] bg-[#fcfbf9] p-4"><div className="flex justify-between gap-4"><div><h2 className="text-sm font-semibold">Your 7-day review</h2><p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#5a5957]">{review}</p></div><button className="h-fit rounded-md p-1 text-[#787774] hover:bg-white" title="Copy weekly review" onClick={() => void navigator.clipboard.writeText(review).then(() => showToast("Weekly review copied", "success")).catch(() => showToast("Could not copy review", "error"))}><Clipboard size={16}/></button></div></section>}

    <div className="grid gap-5 xl:grid-cols-[minmax(250px,0.75fr)_minmax(0,2fr)]">
      <aside className="overflow-hidden rounded-xl border border-[#e9e9e7] bg-white">
        <div className="border-b border-[#f1f1ef] p-3"><div className="relative"><Search size={14} className="absolute left-3 top-2.5 text-[#9b9a97]"/><input aria-label="Search research entries" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, thesis, tag…" className="w-full rounded-lg border border-[#e3e2de] py-2 pl-9 pr-3 text-xs outline-none focus:border-[#2383e2]"/></div></div>
        <div className="max-h-[70vh] overflow-y-auto p-2">
          {loading ? <p className="p-4 text-sm text-[#787774]">Loading research…</p> : filtered.length ? filtered.map((item) => {
            const linked = trades.filter((trade) => trade.ca?.trim() === item.ca);
            return <button key={item.ca} onClick={() => { setExampleMode(false); setSelectedCa(item.ca); setDraft(structuredClone(item)); }} className={`mb-1 w-full rounded-lg border p-3 text-left ${selectedCa === item.ca ? "border-blue-200 bg-blue-50/60" : "border-transparent hover:bg-[#f7f6f3]"}`}>
              <div className="flex items-start justify-between gap-2"><span className="truncate text-sm font-semibold">{item.name}{item.symbol ? ` · $${item.symbol}` : ""}</span><span className="shrink-0 rounded-full bg-[#f1f1ef] px-2 py-0.5 text-[10px] text-[#5a5957]">{STAGES.find((stage) => stage.id === item.stage)?.label}</span></div>
              <p className="mt-1 line-clamp-2 text-xs text-[#787774]">{item.thesis || "No thesis yet"}</p><p className="mt-2 text-[10px] text-[#9b9a97]">{linked.length} linked trades · {item.confidence}% confidence</p>
            </button>;
          }) : <div className="p-6 text-center"><p className="text-sm font-medium">No coin ideas yet</p><p className="mt-1 text-xs text-[#787774]">Start with a contract address, then build the thesis as you research.</p><button onClick={() => { setSelectedCa(""); setExampleMode(false); setDraft(blank()); }} className="mt-3 text-xs font-semibold text-[#2383e2]">Create your first idea</button></div>}
        </div>
      </aside>

      <main data-tour="research-editor" className="min-w-0 rounded-xl border border-[#e9e9e7] bg-white p-4 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-[#f1f1ef] pb-4"><div><h2 className="text-lg font-semibold">{selectedCa ? draft.name || "Coin thesis" : exampleMode ? "Example thesis · not saved" : "New coin thesis"}</h2><p className="text-xs text-[#787774]">Private to your account · autosave is off; use Save to keep edits.</p></div><div className="flex flex-wrap gap-2"><select aria-label="Apply a research template" defaultValue="" onChange={(event) => { const kind = event.target.value; if (!kind) return; if ((draft.thesis || draft.bullCase) && !window.confirm("Replace the current thesis fields with this template?")) { event.target.value = ""; return; } const templates: Record<string, Partial<ResearchItem>> = { narrative: { stage: "researching", thesis: "The market may be underestimating this token because…", bullCase: "Narrative strength, attention, holder growth…", bearCase: "Narrative fades, supply pressure, liquidity falls…", catalysts: ["Sustained organic attention", "Healthy liquidity and volume"], risks: ["Concentrated holders", "Thin liquidity"], invalidation: "The thesis is invalid if…", entryPlan: "Enter only after…", stopPlan: "Risk no more than…", targetPlan: "Scale out at…", horizon: "Days to weeks" }, catalyst: { stage: "researching", thesis: "The market may be underpricing the upcoming catalyst…", bullCase: "Catalyst is confirmed and attracts durable demand…", bearCase: "Catalyst is delayed, already priced in, or has weak follow-through…", catalysts: ["Confirmed event / launch", "Post-event follow-through"], risks: ["Rumor mistaken for confirmation", "Sell-the-news reaction"], invalidation: "Invalidate if the catalyst is cancelled or fails to attract follow-through.", entryPlan: "Wait for confirmation; define the maximum chase price…", stopPlan: "Exit if the catalyst thesis breaks…", targetPlan: "Trim into strength at predefined levels…", horizon: "Event window" }, liquidity: { stage: "researching", thesis: "The liquidity / market-structure setup may create an asymmetric trade because…", bullCase: "Liquidity deepens with stable holder distribution…", bearCase: "Liquidity is temporary or exits become crowded…", catalysts: ["Increasing organic volume", "Improving liquidity depth"], risks: ["High slippage", "LP concentration or removal"], invalidation: "Invalidate if liquidity quality deteriorates below my minimum…", entryPlan: "Use limit / staged entries; avoid thin liquidity…", stopPlan: "Define loss in SOL before entry…", targetPlan: "Scale out as liquidity or volume conditions change…", horizon: "Intraday" } }; setDraft((current) => ({ ...current, ...templates[kind] })); setExampleMode(false); event.target.value = ""; }} className="rounded-md border border-[#e3e2de] bg-white px-2.5 py-2 text-xs text-[#5a5957]"><option value="">Apply template…</option><option value="narrative">Narrative momentum</option><option value="catalyst">Catalyst / event</option><option value="liquidity">Liquidity / structure</option></select><button onClick={() => void copyThesis()} disabled={!draft.ca || !draft.name} title="Copy the complete shareable thesis in Discord-friendly Markdown" className="rounded-md border border-[#e3e2de] px-2.5 py-2 text-xs disabled:opacity-40"><Clipboard size={13} className="mr-1 inline"/> Copy full thesis</button><button onClick={() => void save({ stage: "planned" }, "Plan adopted")} disabled={saving || loading || exampleMode || !draft.ca || !draft.name} title="Save this thesis and move it to the Planned stage" className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-2 text-xs font-semibold text-blue-700 disabled:opacity-40"><BookOpenCheck size={13} className="mr-1 inline"/> Adopt plan</button>{selectedCa && onLogTradeFromResearch && <button onClick={() => onLogTradeFromResearch(draft)} className="rounded-md bg-emerald-600 px-2.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700">Log planned trade</button>}{selectedCa && <button onClick={() => void remove()} className="rounded-md border border-rose-200 px-2.5 py-2 text-xs text-rose-700 hover:bg-rose-50"><Trash2 size={13}/></button>}</div></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Token name"><input value={draft.name} onChange={(e) => update("name", e.target.value)} maxLength={120} placeholder="e.g. BONK" className={inputClass}/></Field>
          <Field label="Ticker"><input value={draft.symbol} onChange={(e) => update("symbol", e.target.value)} maxLength={40} placeholder="BONK" className={inputClass}/></Field>
          <Field label="Contract address" help="Used to match this thesis to journal trades. Addresses are case-sensitive."><input value={draft.ca} onChange={(e) => update("ca", e.target.value)} onBlur={() => { const existing = items.find((item) => item.ca === draft.ca.trim()); if (existing && selectedCa !== existing.ca && window.confirm(`${existing.name} already has a research entry. Open that entry instead?`)) { setSelectedCa(existing.ca); setDraft(structuredClone(existing)); } }} maxLength={128} placeholder="Paste Solana token address" className={`${inputClass} font-mono`}/></Field>
          <Field label="Pipeline stage"><select value={draft.stage} onChange={(e) => update("stage", e.target.value as ResearchStage)} className={inputClass}>{STAGES.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}</select></Field>
          <Field label={`Confidence · ${draft.confidence}%`}><input type="range" min="0" max="100" value={draft.confidence} onChange={(e) => update("confidence", Number(e.target.value))} className="mt-2 w-full accent-[#2383e2]"/></Field>
          <Field label="Expected time horizon"><input value={draft.horizon} onChange={(e) => update("horizon", e.target.value)} maxLength={80} placeholder="e.g. hours, days, cycle" className={inputClass}/></Field>
          <div className="sm:col-span-2"><Field label="Core thesis" help="What do you believe the market is missing? State the evidence, not just the hoped-for price."><textarea value={draft.thesis} onChange={(e) => update("thesis", e.target.value)} maxLength={5000} rows={4} placeholder="The reason this token may outperform…" className={inputClass}/></Field></div>
          <Field label="Bull case"><textarea value={draft.bullCase} onChange={(e) => update("bullCase", e.target.value)} maxLength={3000} rows={3} className={inputClass} placeholder="What needs to go right?"/></Field>
          <Field label="Bear case"><textarea value={draft.bearCase} onChange={(e) => update("bearCase", e.target.value)} maxLength={3000} rows={3} className={inputClass} placeholder="What could make this fail?"/></Field>
          <Field label="Catalysts · one per line"><textarea value={text(draft.catalysts)} onChange={(e) => update("catalysts", lines(e.target.value))} rows={3} className={inputClass} placeholder="Upcoming event or narrative trigger"/></Field>
          <Field label="Risks · one per line"><textarea value={text(draft.risks)} onChange={(e) => update("risks", lines(e.target.value))} rows={3} className={inputClass} placeholder="Liquidity, holders, concentration…"/></Field>
          <div className="sm:col-span-2"><Field label="Thesis invalidation"><textarea value={draft.invalidation} onChange={(e) => update("invalidation", e.target.value)} maxLength={2000} rows={2} className={inputClass} placeholder="What observable fact would prove this idea wrong?"/></Field></div>
          <Field label="Entry plan"><textarea value={draft.entryPlan} onChange={(e) => update("entryPlan", e.target.value)} maxLength={2000} rows={2} className={inputClass} placeholder="Entry conditions and scale-in levels"/></Field>
          <Field label="Position size (SOL)"><input type="number" min="0" step="any" value={draft.sizeSol ?? ""} onChange={(e) => update("sizeSol", e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)))} className={inputClass} placeholder="Optional planning amount"/></Field>
          <Field label="Stop / risk plan"><textarea value={draft.stopPlan} onChange={(e) => update("stopPlan", e.target.value)} maxLength={1000} rows={2} className={inputClass} placeholder="Risk limit and stop conditions"/></Field>
          <Field label="Targets / scale-out plan"><textarea value={draft.targetPlan} onChange={(e) => update("targetPlan", e.target.value)} maxLength={1000} rows={2} className={inputClass} placeholder="Targets and partial exit levels"/></Field>
          <Field label="Research tags · one per line"><textarea value={text(draft.tags)} onChange={(e) => update("tags", lines(e.target.value))} rows={2} className={inputClass} placeholder="meme, AI, catalyst…"/></Field>
          <Field label="Source URLs · one per line"><textarea value={text(draft.sources)} onChange={(e) => update("sources", lines(e.target.value).map((url) => url.slice(0, 500)))} rows={2} className={inputClass} placeholder="https://…"/></Field>
        </div>

        <section className="mt-6 rounded-lg border border-amber-200 bg-amber-50/40 p-4"><div><h3 className="flex items-center gap-2 text-sm font-semibold"><Bell size={14}/> Catalyst reminders</h3><p className="mt-1 text-xs text-[#787774]">Keep dated events visible without turning the thesis into a calendar app.</p></div><div className="mt-3 grid gap-2 sm:grid-cols-[1fr_170px_auto]"><input aria-label="Reminder title" value={reminderTitle} onChange={(event) => setReminderTitle(event.target.value)} maxLength={200} placeholder="Listing, unlock, announcement…" className={inputClass}/><input aria-label="Reminder date" type="date" value={reminderDate} onChange={(event) => setReminderDate(event.target.value)} className={inputClass}/><button onClick={addReminder} disabled={!reminderTitle.trim() || !reminderDate || (draft.reminders ?? []).length >= 20} className="rounded-md border border-amber-300 bg-white px-3 text-xs font-semibold disabled:opacity-40">Add reminder</button></div>{(draft.reminders ?? []).length > 0 && <ol className="mt-3 space-y-2">{[...(draft.reminders ?? [])].sort((a, b) => a.dueAt - b.dueAt).map((reminder) => <li key={reminder.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-100 bg-white p-2.5"><div><p className={`text-xs font-medium ${reminder.completedAt ? "text-[#9b9a97] line-through" : "text-[#37352f]"}`}>{reminder.title}</p><time className="text-[10px] text-[#787774]">{new Date(reminder.dueAt).toLocaleDateString()}</time></div><div className="flex gap-1"><button onClick={() => updateReminder(reminder.id, "complete")} title={reminder.completedAt ? "Mark incomplete" : "Mark complete"} className="rounded p-1.5 text-emerald-700 hover:bg-emerald-50"><Check size={14}/></button><button onClick={() => updateReminder(reminder.id, "delete")} title="Delete reminder" className="rounded p-1.5 text-rose-700 hover:bg-rose-50"><Trash2 size={14}/></button></div></li>)}</ol>}</section>

        <section className="mt-6 rounded-lg border border-[#f1f1ef] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-semibold">Research timeline</h3><p className="text-xs text-[#787774]">Add dated snapshots as new evidence arrives.</p></div>{draft.snapshots.length > 0 && <span className="text-xs text-[#787774]">{draft.snapshots.length} updates</span>}</div><div className="mt-3 flex gap-2"><input aria-label="Add research timeline note" value={snapshotNote} onChange={(e) => setSnapshotNote(e.target.value)} maxLength={1000} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSnapshot(); } }} placeholder="New finding, price context, or changed assumption…" className={inputClass}/><button onClick={addSnapshot} disabled={!snapshotNote.trim()} className="shrink-0 rounded-md border border-[#e3e2de] px-3 text-xs disabled:opacity-40">Add</button></div>{draft.snapshots.length > 0 && <ol className="mt-3 max-h-48 space-y-2 overflow-y-auto">{[...draft.snapshots].reverse().map((snapshot) => <li key={snapshot.id} className="border-l-2 border-blue-200 pl-3"><p className="text-xs text-[#5a5957]">{snapshot.note}</p><time className="text-[10px] text-[#9b9a97]">{new Date(snapshot.createdAt).toLocaleString()}</time></li>)}</ol>}</section>

        <section className="mt-4 rounded-lg border border-[#f1f1ef] p-4"><div><h3 className="text-sm font-semibold">Decision journal</h3><p className="text-xs text-[#787774]">Record the state of mind behind a plan change or entry. This is descriptive, not a score of you.</p></div><div className="mt-3 grid gap-2 sm:grid-cols-[150px_1fr_auto]"><select aria-label="Decision mood" value={decisionMood} onChange={(e) => setDecisionMood(e.target.value as ResearchDecision["mood"])} className={inputClass}><option value="calm">Calm</option><option value="confident">Confident</option><option value="uncertain">Uncertain</option><option value="fearful">Fearful</option><option value="fomo">FOMO</option></select><input aria-label="Decision journal note" value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)} maxLength={2000} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDecision(); } }} placeholder="What were you considering, and why?" className={inputClass}/><button onClick={addDecision} disabled={!decisionNote.trim()} className="rounded-md border border-[#e3e2de] px-3 text-xs disabled:opacity-40">Record</button></div>{draft.decisions.length > 0 && <ol className="mt-3 max-h-48 space-y-2 overflow-y-auto">{[...draft.decisions].reverse().map((decision) => <li key={decision.id} className="flex flex-wrap items-baseline gap-x-2 border-l-2 border-amber-200 pl-3"><span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] uppercase text-amber-800">{decision.mood}</span><time className="text-[10px] text-[#9b9a97]">{new Date(decision.createdAt).toLocaleString()}</time><p className="basis-full text-xs text-[#5a5957]">{decision.note}</p></li>)}</ol>}</section>

        {selectedCa && <section className="mt-6 rounded-lg border border-[#f1f1ef] p-4"><div className="flex flex-wrap justify-between gap-2"><div><h3 className="text-sm font-semibold">Thesis vs. execution</h3><p className="text-xs text-[#787774]">Trades are matched by exact token address; edits here never change trade records.</p></div><span className={`font-mono text-sm font-semibold ${pnl >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{pnl >= 0 ? "+" : ""}{formatSol(pnl)} SOL</span></div>{relatedTrades.length ? <div className="mt-3 grid gap-2 sm:grid-cols-3">{relatedTrades.map((trade) => <article key={trade.id} className="rounded-md bg-[#f7f6f3] p-3 text-xs"><p className="font-semibold">{trade.result} · {trade.pnlSol >= 0 ? "+" : ""}{formatSol(trade.pnlSol)} SOL</p><p className="mt-1 text-[#787774]">{getTradeDate(trade).toLocaleDateString()} · {trade.setupType || "Other"}</p>{trade.screenshotUrl && <a href={trade.screenshotUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-blue-700"><ExternalLink size={11}/> View chart evidence</a>}</article>)}</div> : <p className="mt-3 text-xs text-[#9b9a97]">No linked trades yet. Log this exact CA in the journal to see results here.</p>}{screenshotTrades.length >= 2 && <div className="mt-4 border-t border-[#f1f1ef] pt-4"><h4 className="text-xs font-semibold">Chart evidence comparison</h4><div className="mt-2 grid gap-3 sm:grid-cols-2">{[screenshotTrades[0], screenshotTrades[screenshotTrades.length - 1]].map((trade, index) => <figure key={trade.id}><figcaption className="mb-1 text-[10px] text-[#787774]">{index === 0 ? "Earlier" : "Latest"} · {getTradeDate(trade).toLocaleDateString()}</figcaption><ResearchEvidenceImage src={trade.screenshotUrl!} alt={`${trade.name} chart screenshot ${index === 0 ? "earlier" : "latest"}`}/></figure>)}</div></div>}</section>}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#f1f1ef] pt-4"><p className="text-[11px] text-[#9b9a97]">{exampleMode ? "Example content is not saved; load a real token address to continue." : draft.updatedAt ? `Last saved ${new Date(draft.updatedAt).toLocaleString()}` : "Unsaved draft"}</p><button onClick={() => void save()} disabled={saving || loading || exampleMode} className="rounded-lg bg-[#2383e2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#176bbd] disabled:opacity-50"><Save size={15} className="mr-2 inline"/>{saving ? "Saving…" : "Save research"}</button></div>
      </main>
    </div>
  </div>;
}

const inputClass = "w-full rounded-lg border border-[#e3e2de] bg-white px-3 py-2 text-sm text-[#37352f] outline-none placeholder:text-[#9b9a97] focus:border-[#2383e2] focus:ring-2 focus:ring-blue-100";
function Field({ label, help, children }: { label: string; help?: string; children: ReactNode }) { return <label className="block min-w-0 text-xs font-medium text-[#5a5957]"><span className="mb-1.5 block">{label}</span>{children}{help && <span className="mt-1 block text-[10px] font-normal leading-4 text-[#9b9a97]">{help}</span>}</label>; }
function Metric({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="rounded-xl border border-[#e9e9e7] bg-white p-4"><p className="text-xs text-[#787774]">{label}</p><p className="mt-1 text-lg font-semibold text-[#37352f]">{value}</p><p className="mt-1 text-[10px] text-[#9b9a97]">{detail}</p></div>; }
