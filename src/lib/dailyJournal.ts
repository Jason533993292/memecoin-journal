import type { DailyJournalEntry, DailyJournalEntryType } from "@/lib/types";

export const DAILY_JOURNAL_EMOTIONS = ["Calm", "Confident", "Focused", "Excited", "Uncertain", "Fearful", "Frustrated", "FOMO"] as const;

export const GUIDED_JOURNAL_PROMPTS: Record<Exclude<DailyJournalEntryType, "free">, { title: string; html: string }> = {
  pre_trade: {
    title: "Pre-trade check-in",
    html: "<h2>What do I see?</h2><p><br></p><h2>What is my plan?</h2><p><br></p><h2>What would invalidate the idea?</h2><p><br></p><h2>How am I feeling before entry?</h2><p><br></p>",
  },
  post_trade: {
    title: "Post-trade reflection",
    html: "<h2>What happened?</h2><p><br></p><h2>Did I follow my plan?</h2><p><br></p><h2>What did I do well?</h2><p><br></p><h2>What will I change next time?</h2><p><br></p>",
  },
  end_of_day: {
    title: "End-of-day review",
    html: "<h2>Today in one sentence</h2><p><br></p><h2>Best decision</h2><p><br></p><h2>Hardest emotion</h2><p><br></p><h2>Lesson to carry forward</h2><p><br></p>",
  },
};

// Chromium uses DIV blocks when Enter is pressed inside contentEditable.
// Keeping those blocks preserves one visual line break instead of flattening
// several paragraphs into a single line during sanitization and autosave.
const ALLOWED_TAGS = new Set(["P", "DIV", "BR", "STRONG", "B", "EM", "I", "U", "S", "H2", "H3", "UL", "OL", "LI", "BLOCKQUOTE", "HR"]);

export function sanitizeJournalHtml(html: string): string {
  if (typeof window === "undefined") return "";
  const documentNode = new DOMParser().parseFromString(html, "text/html");
  const escapeText = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const clean = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return escapeText(node.textContent ?? "");
    if (!(node instanceof HTMLElement)) return "";
    const children = Array.from(node.childNodes).map(clean).join("");
    if (!ALLOWED_TAGS.has(node.tagName)) return children;
    return `<${node.tagName.toLowerCase()}>${children}</${node.tagName.toLowerCase()}>`;
  };
  return Array.from(documentNode.body.childNodes).map(clean).join("").slice(0, 100000);
}

export function journalPlainText(html: string): string {
  if (typeof window === "undefined") return "";
  const documentNode = new DOMParser().parseFromString(html, "text/html");
  return (documentNode.body.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40000);
}

export function createDailyJournalEntry(type: DailyJournalEntryType, now = new Date()): DailyJournalEntry {
  const guided = type === "free" ? null : GUIDED_JOURNAL_PROMPTS[type];
  return {
    id: crypto.randomUUID(),
    title: guided?.title ?? "Untitled reflection",
    contentHtml: guided?.html ?? "<p><br></p>",
    plainText: "",
    entryType: type,
    entryDate: now.toISOString().slice(0, 10),
    emotions: [],
    tags: [],
    linkedTradeIds: [],
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
  };
}

export function matchesDailyJournalSearch(entry: DailyJournalEntry, search: string): boolean {
  const term = search.trim().toLocaleLowerCase();
  if (!term) return true;
  return [entry.title, entry.plainText, ...entry.emotions, ...entry.tags].some((value) => value.toLocaleLowerCase().includes(term));
}
