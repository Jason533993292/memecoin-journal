import type { DailyJournalEntry, Trade } from "./types";

export interface JournalDetails {
  session?: string;
  takeaway?: string;
  nextAction?: string;
  rule?: string;
  changed?: string;
  trigger?: string;
  mistakes?: string;
  positives?: string;
  emotionBefore?: string;
  emotionAfter?: string;
  confidenceBefore?: number;
  confidenceAfter?: number;
  processScore?: number;
  outcomeScore?: number;
  repeatDecision?: string;
  pinned?: boolean;
  reviewDate?: string;
  deletedAt?: number;
  thesis?: { ca: string; name: string; text: string };
  notes?: { id: string; at: number; text: string; tradeId?: string; phase?: string }[];
  checks?: { id: string; text: string; done: boolean }[];
  images?: { id: string; data: string; caption: string }[];
  snapshots?: { id: string; name: string; symbol: string; pnlSol: number; pnlUsd?: number; at: number }[];
  versions?: { at: number; title: string; html: string }[];
}

const record = (x: unknown): Record<string, unknown> => x && typeof x === "object" && !Array.isArray(x) ? x as Record<string, unknown> : {};
const str = (x: unknown, max = 2000) => typeof x === "string" ? x.slice(0, max) : "";
const finite = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const array = (x: unknown, max: number) => Array.isArray(x) ? x.slice(0, max).map(record) : [];
export const escapeJournalText = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export function hasJournalDetails(details?: JournalDetails): boolean {
  return !!(details?.notes?.length || details?.checks?.length || details?.images?.length || details?.takeaway || details?.nextAction || details?.rule || details?.trigger || details?.changed);
}

// Treat cloud rows, browser drafts and exports as untrusted structured data.
export function cleanJournalDetails(value: unknown): JournalDetails {
  const r = record(value);
  const d: JournalDetails = {};
  for (const key of ["session", "takeaway", "nextAction", "rule", "changed", "trigger", "mistakes", "positives", "emotionBefore", "emotionAfter", "repeatDecision"] as const) d[key] = str(r[key]);
  for (const key of ["confidenceBefore", "confidenceAfter", "processScore", "outcomeScore"] as const) if (finite(r[key]) && r[key] >= 1 && r[key] <= 5) d[key] = r[key];
  d.pinned = r.pinned === true;
  if (finite(r.deletedAt) && r.deletedAt > 0) d.deletedAt = r.deletedAt;
  if (typeof r.reviewDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.reviewDate)) d.reviewDate = r.reviewDate;
  const thesis = record(r.thesis);
  if (thesis.ca) d.thesis = { ca: str(thesis.ca, 150), name: str(thesis.name, 160), text: str(thesis.text, 4000) };
  d.notes = array(r.notes, 100).filter(n => finite(n.at) && typeof n.text === "string").map(n => ({ id: str(n.id, 150), at: n.at as number, text: str(n.text), tradeId: str(n.tradeId, 150), phase: str(n.phase, 40) }));
  d.checks = array(r.checks, 50).map(c => ({ id: str(c.id, 150), text: str(c.text, 300), done: c.done === true }));
  d.images = array(r.images, 3).filter(i => typeof i.data === "string" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(i.data) && i.data.length <= 250000).map(i => ({ id: str(i.id, 150), data: i.data as string, caption: str(i.caption, 500) }));
  d.snapshots = array(r.snapshots, 50).filter(s => finite(s.pnlSol)).map(s => ({ id: str(s.id, 150), name: str(s.name, 160), symbol: str(s.symbol, 80), pnlSol: s.pnlSol as number, pnlUsd: finite(s.pnlUsd) ? s.pnlUsd : undefined, at: finite(s.at) ? s.at : 0 }));
  d.versions = array(r.versions, 8).filter(v => finite(v.at)).map(v => ({ at: v.at as number, title: str(v.title, 160), html: str(v.html, 100000) }));
  return d;
}

export function withJournalVersion(entry: DailyJournalEntry, previous?: DailyJournalEntry): DailyJournalEntry {
  const details = cleanJournalDetails(entry.details);
  if (previous && (previous.contentHtml !== entry.contentHtml || previous.title !== entry.title)) {
    const version = { at: previous.updatedAt, title: previous.title, html: previous.contentHtml };
    const history = [...(details.versions ?? []), ...(previous.details?.versions ?? [])];
    details.versions = [version, ...history.filter((v,i) => v.at !== version.at && history.findIndex(other=>other.at===v.at)===i)].slice(0, 8);
  }
  return { ...entry, details };
}

export function tradeJournalDay(trade: Trade): string {
  const value = trade.tradedAt ?? trade.date ?? trade.createdAt;
  if (!value) return "";
  const date = typeof value === "object" && "toDate" in value ? value.toDate() : new Date(value as string | number | Date);
  if (!Number.isFinite(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function journalReview(entries: DailyJournalEntry[], trades: Trade[], from: string, to: string) {
  const selected = entries.filter(e => !e.details?.deletedAt && e.entryDate >= from && e.entryDate <= to);
  const byId = new Map(trades.map(t => [t.id, t]));
  const linked = [...new Set(selected.flatMap(e => e.linkedTradeIds))].map(id => byId.get(id)).filter((t): t is Trade => !!t);
  const emotions = [...new Set(selected.flatMap(e => e.emotions))].map(emotion => {
    const observations = selected.filter(e => e.emotions.includes(emotion));
    const ids = new Set(observations.flatMap(e => e.linkedTradeIds));
    const matches = linked.filter(t => ids.has(t.id));
    return { emotion, entries: observations.length, trades: matches.length, wins: matches.filter(t => t.result === "Win").length, pnlSol: matches.reduce((s, t) => s + t.pnlSol, 0) };
  });
  return { selected, linked, emotions };
}

export async function journalImage(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) throw new Error("Choose a PNG, JPEG or WebP smaller than 8 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image processing unavailable.");
    context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.8, 0.6, 0.4, 0.25]) {
      const data = canvas.toDataURL("image/jpeg", quality);
      if (data.length <= 250000) return data;
    }
    throw new Error("This image is too detailed. Crop it and try again.");
  } finally { bitmap.close(); }
}
