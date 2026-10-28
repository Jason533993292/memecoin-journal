"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DailyJournalEntry, ResearchItem, Trade } from "@/lib/types";
import { cleanJournalDetails, escapeJournalText, journalImage, journalReview, tradeJournalDay } from "@/lib/journalWorkbench";
import type { JournalDetails } from "@/lib/journalWorkbench";
import { journalLocalDate, sanitizeJournalHtml } from "@/lib/dailyJournal";
import { formatRealizedPnl, formatUsd } from "@/lib/utils";
import { X } from "lucide-react";

export type WorkbenchPanel = "writing" | "context" | "review" | "recovery";
export interface JournalPreferences {
  size: number; spacing: number; paper: string; reminder: string;
  favourites: string[]; templates: { name: string; html: string }[];
}
export const DEFAULT_JOURNAL_PREFERENCES: JournalPreferences = { size: 16, spacing: 32, paper: "theme", reminder: "", favourites: [], templates: [] };
export function readJournalPreferences(key: string): JournalPreferences {
  try {
    const p = JSON.parse(localStorage.getItem(key) || "{}");
    return {
      size: [14,16,18,20].includes(p.size) ? p.size : 16,
      spacing: [28,32,40].includes(p.spacing) ? p.spacing : 32,
      paper: ["theme", "plain", "cream", "dark"].includes(p.paper) ? p.paper : "theme",
      reminder: typeof p.reminder === "string" && /^\d{2}:\d{2}$/.test(p.reminder) ? p.reminder : "",
      favourites: Array.isArray(p.favourites) ? p.favourites.filter((s: unknown) => typeof s === "string").slice(0,20) : [],
      templates: Array.isArray(p.templates) ? p.templates.filter((t: {name?: unknown; html?: unknown}) => typeof t?.name === "string" && typeof t?.html === "string").slice(0,20) : [],
    };
  } catch { return DEFAULT_JOURNAL_PREFERENCES; }
}

interface Props {
  panel: WorkbenchPanel;
  onClose: () => void;
  entry: DailyJournalEntry | null;
  entries: DailyJournalEntry[];
  trades: Trade[];
  research: ResearchItem[];
  drafts: DailyJournalEntry[];
  preferences: JournalPreferences;
  onPreferences: (p: JournalPreferences) => void;
  onDetails: (d: JournalDetails) => void;
  onInsert: (html: string) => void;
  onNew: (title: string, html: string, details?: JournalDetails) => void;
  onOpen: (entry: DailyJournalEntry) => void;
  onRestore: (entry: DailyJournalEntry) => Promise<void>;
  onDiscardDraft: (id: string) => void;
  onErase: (entry: DailyJournalEntry) => Promise<void>;
  onReplace: (html: string, title: string) => void;
}

const prompts = ["What did I notice?", "What was I feeling?", "Did I follow my plan?", "What will I do differently?"];
const labelDate = (at: number) => new Date(at).toLocaleString();
const htmlText = (s: string) => `<p>${escapeJournalText(s).replaceAll("\n", "<br>")}</p>`;

// Printable files contain escaped plain text and allowlisted formatting only.
export function exportJournalDocument(entries: DailyJournalEntry[]) {
  const sections = entries.map(e => {
    const d = cleanJournalDetails(e.details);
    return `<article><h1>${escapeJournalText(e.title)}</h1><p>${escapeJournalText(e.entryDate)}</p>${sanitizeJournalHtml(e.contentHtml)}
      ${d.notes?.map(n => `<p><b>${escapeJournalText(labelDate(n.at))} ${escapeJournalText(n.phase || "")}</b> ${escapeJournalText(n.text)}</p>`).join("") || ""}
      ${["takeaway", "nextAction", "rule", "changed", "trigger", "mistakes", "positives"] .map(key => { const value = d[key as keyof JournalDetails]; return typeof value === "string" && value ? `<p><b>${key}:</b> ${escapeJournalText(value)}</p>` : ""; }).join("")}
      ${d.images?.map(i => `<figure><img src="${i.data}" alt="${escapeJournalText(i.caption)}"><figcaption>${escapeJournalText(i.caption)}</figcaption></figure>`).join("") || ""}</article>`;
  }).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><title>My journal</title><style>body{max-width:760px;margin:40px auto;padding:24px;font:18px/1.7 Georgia,serif;color:#222;background:#fff}article{break-after:page;margin-bottom:60px}img{max-width:100%}h1{line-height:1.2}p{white-space:pre-wrap}</style></head><body>${sections}</body></html>`;
  const url = URL.createObjectURL(new Blob([html], {type:"text/html"}));
  const link = document.createElement("a"); link.href = url; link.download = "journal-printable.html"; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function JournalWorkbench(p: Props) {
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef(p.onClose);
  useEffect(() => { closeRef.current = p.onClose; }, [p.onClose]);
  const [note, setNote] = useState("");
  const [noteTrade, setNoteTrade] = useState("");
  const [phase, setPhase] = useState("During");
  const [check, setCheck] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [find, setFind] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmErase, setConfirmErase] = useState<string | null>(null);
  const [period, setPeriod] = useState("week");
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate()-6); return journalLocalDate(d); });
  const [to, setTo] = useState(() => journalLocalDate(new Date()));
  const d = cleanJournalDetails(p.entry?.details);
  const patch = useCallback((value: Partial<JournalDetails>) => p.onDetails(value), [p]);
  const review = journalReview(p.entries, p.trades, from, to);
  const active = p.entries.filter(e => !e.details?.deletedAt);
  const today = journalLocalDate(new Date());
  const run = async (fn: () => Promise<void>) => { setBusy(true); setMessage(""); try { await fn(); } catch (e) { setMessage(e instanceof Error ? e.message : "Could not complete this action."); } finally { setBusy(false); } };
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const siblings = Array.from(ref.current?.closest(".daily-journal-workspace")?.children || [])
      .filter((node): node is HTMLElement => node instanceof HTMLElement && !node.contains(ref.current));
    const previousInert = siblings.map(node => node.inert);
    siblings.forEach(node => { node.inert = true; });
    ref.current?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.stopPropagation(); closeRef.current(); }
      if (event.key !== "Tab") return;
      const nodes = ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]');
      if (!nodes?.length) return;
      const first = nodes[0], last = nodes[nodes.length-1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    const overflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handler, true);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", handler, true); siblings.forEach((node,i)=>{node.inert=previousInert[i];}); previous?.focus(); };
  }, []);

  const field = (key: "takeaway"|"nextAction"|"rule"|"changed"|"trigger"|"mistakes"|"positives", label: string) => <label>{label}<textarea aria-label={label} maxLength={2000} value={d[key] || ""} onChange={e => patch({[key]:e.target.value})} rows={2}/></label>;
  const scale = (key: "confidenceBefore"|"confidenceAfter"|"processScore"|"outcomeScore", label: string) => <label>{label}<select aria-label={label} value={d[key] || ""} onChange={e=>patch({[key]:e.target.value ? Number(e.target.value) : undefined})}><option value="">Not rated</option>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n} / 5</option>)}</select></label>;
  const linkTrade = (t: Trade, at: number) => {
    if ((d.snapshots?.length || 0) >= 50 || d.snapshots?.some(s=>s.id===t.id)) return;
    patch({snapshots:[...(d.snapshots || []),{id:t.id,name:t.name,symbol:t.symbol,pnlSol:t.pnlSol,pnlUsd:t.pnlUsd,at}]});
  };
  const addNote = (at: number) => {
    if (!note.trim() || !p.entry) return;
    patch({notes:[...(d.notes || []),{id:crypto.randomUUID(),at,text:note.trim(),tradeId:noteTrade,phase}].slice(-100)});
    setNote(""); setMessage("Timestamped note added.");
  };

  return <div className="journal-workbench-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)p.onClose();}}>
    <section ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="journal-workbench-title" className="journal-workbench">
      <header><div><h2 id="journal-workbench-title">{p.panel === "writing" ? "Writing tools" : p.panel === "context" ? "Reflection & trade context" : p.panel === "review" ? "Review your journal" : "Recovery & history"}</h2><p>Optional tools. Your journal stays private.</p></div><button type="button" aria-label="Close journal tools" onClick={p.onClose}><X size={20}/></button></header>
      {message && <p role="status" className="journal-workbench-message">{message}</p>}
      {p.panel === "writing" && <>
        <section><h3>Make the page yours</h3><div className="journal-workbench-grid">
          <label>Text size<select aria-label="Text size" value={p.preferences.size} onChange={e=>p.onPreferences({...p.preferences,size:Number(e.target.value)})}>{[14,16,18,20].map(n=><option key={n} value={n}>{n} px</option>)}</select></label>
          <label>Line spacing<select aria-label="Line spacing" value={p.preferences.spacing} onChange={e=>p.onPreferences({...p.preferences,spacing:Number(e.target.value)})}>{[28,32,40].map(n=><option key={n} value={n}>{n === 28 ? "Compact" : n === 32 ? "Comfortable" : "Spacious"}</option>)}</select></label>
          <label>Paper<select aria-label="Paper" value={p.preferences.paper} onChange={e=>p.onPreferences({...p.preferences,paper:e.target.value})}>{["theme","plain","cream","dark"].map(s=><option key={s} value={s}>{s}</option>)}</select></label>
          <label>Daily writing reminder<input aria-label="Daily writing reminder" type="time" value={p.preferences.reminder} onChange={e=>p.onPreferences({...p.preferences,reminder:e.target.value})}/></label>
        </div><p className="journal-help">Appearance, templates, favourite prompts and reminders are remembered in this browser. Reminders appear when you visit the journal after your chosen time; no notifications or streaks.</p><button onClick={()=>p.onPreferences({...p.preferences,reminder:""})}>Turn reminders off</button></section>
        <section><h3>Prompts & templates</h3><div className="journal-chip-row">{[...new Set([...p.preferences.favourites,...prompts])].map(prompt=><div key={prompt}><button disabled={!p.entry} onClick={()=>{p.onInsert(`<h2>${escapeJournalText(prompt)}</h2><p><br></p>`);p.onClose();}}>{prompt}</button><button aria-label={`${p.preferences.favourites.includes(prompt)?"Unfavourite":"Favourite"} ${prompt}`} onClick={()=>p.onPreferences({...p.preferences,favourites:p.preferences.favourites.includes(prompt)?p.preferences.favourites.filter(s=>s!==prompt):[...p.preferences.favourites,prompt].slice(0,20)})}>{p.preferences.favourites.includes(prompt)?"★":"☆"}</button></div>)}</div>
          <label>Custom prompt<input aria-label="Custom prompt" value={customPrompt} maxLength={160} onChange={e=>setCustomPrompt(e.target.value)}/></label><button disabled={!customPrompt.trim()} onClick={()=>{p.onPreferences({...p.preferences,favourites:[...new Set([...p.preferences.favourites,customPrompt.trim()])].slice(0,20)});setCustomPrompt("");}}>Save favourite prompt</button>
          <label>Template name<input aria-label="Template name" value={templateName} maxLength={80} onChange={e=>setTemplateName(e.target.value)}/></label><button disabled={!p.entry || !templateName.trim()} onClick={()=>{p.onPreferences({...p.preferences,templates:[...p.preferences.templates.filter(t=>t.name!==templateName.trim()),{name:templateName.trim(),html:sanitizeJournalHtml(p.entry!.contentHtml)}].slice(-20)});setTemplateName("");setMessage("Template saved in this browser. It includes your current writing; remove personal text before reusing it.");}}>Save current writing as template</button>
          {p.preferences.templates.map(t=><div className="journal-tool-item" key={t.name}><button onClick={()=>{p.onNew(t.name,t.html);p.onClose();}}>Use {t.name}</button><button aria-label={`Remove template ${t.name}`} onClick={()=>p.onPreferences({...p.preferences,templates:p.preferences.templates.filter(x=>x.name!==t.name)})}>Remove</button></div>)}
        </section>
        {p.entry && <><section><h3>Find & navigate</h3><label>Find in this entry<input aria-label="Find in this entry" value={find} onChange={e=>setFind(e.target.value)} /></label>{find && <p>{p.entry.plainText.toLowerCase().split(find.toLowerCase()).length-1} matches</p>}
          {find && <p className="journal-find-preview">{p.entry.plainText.split(new RegExp(`(${find.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")})`,"gi")).slice(0,300).map((text,i)=>text.toLowerCase()===find.toLowerCase()?<mark key={i}>{text}</mark>:text)}</p>}
          <div className="journal-chip-row">{Array.from(new DOMParser().parseFromString(p.entry.contentHtml,"text/html").querySelectorAll("h2,h3")).map((h,i)=><button key={i} onClick={()=>{p.onClose();setTimeout(()=>document.querySelectorAll(".daily-journal-editor h2,.daily-journal-editor h3")[i]?.scrollIntoView({block:"center",behavior:"smooth"}),0);}}>{h.textContent}</button>)}</div><p className="journal-help">Use headings to navigate long entries. Type / in the writing area for insertion commands.</p></section>
        <section><h3>Checklist</h3>{d.checks?.map(c=><div className="journal-tool-item" key={c.id}><label className="journal-inline-label"><input type="checkbox" checked={c.done} onChange={e=>patch({checks:d.checks?.map(x=>x.id===c.id?{...x,done:e.target.checked}:x)})}/>{c.text}</label><button aria-label={`Remove checklist item ${c.text}`} onClick={()=>patch({checks:d.checks?.filter(x=>x.id!==c.id)})}>Remove</button></div>)}<label>New checklist item<input aria-label="New checklist item" maxLength={300} value={check} onChange={e=>setCheck(e.target.value)}/></label><button disabled={!check.trim() || (d.checks?.length || 0)>=50} onClick={()=>{patch({checks:[...(d.checks||[]),{id:crypto.randomUUID(),text:check.trim(),done:false}]});setCheck("");}}>Add checklist item</button></section>
        <section><h3>Images & captions</h3><p className="journal-help">Up to 3 private images per entry. PNG, JPEG or WebP, up to 8 MB each; compressed before saving.</p><label>Add image<input aria-label="Add image" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy || (d.images?.length||0)>=3} onChange={e=>{const file=e.target.files?.[0];e.target.value="";if(file)void run(async()=>{const data=await journalImage(file);patch({images:[...(d.images||[]),{id:crypto.randomUUID(),data,caption:""}]});});}}/></label>{d.images?.map(image=><figure key={image.id}>
          {/* User raster data is validated and re-encoded, never remote HTML or SVG. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.data} alt={image.caption || "Journal attachment"}/><label>Image caption<input aria-label="Image caption" disabled={busy} maxLength={500} value={image.caption} onChange={e=>patch({images:d.images?.map(i=>i.id===image.id?{...i,caption:e.target.value}:i)})}/></label><button disabled={busy} onClick={()=>patch({images:d.images?.filter(i=>i.id!==image.id)})}>Remove image</button></figure>)}</section></>}
      </>}
      {p.panel === "context" && (p.entry ? <>
        <section><h3>Quick thoughts & decision timeline</h3><label>Thought<textarea aria-label="Thought" autoFocus rows={3} maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} placeholder="What is happening right now?"/></label><div className="journal-workbench-grid"><label>Stage<select aria-label="Stage" value={phase} onChange={e=>setPhase(e.target.value)}>{["Before","During","After"].map(s=><option key={s}>{s}</option>)}</select></label><label>Related trade<select aria-label="Related trade" value={noteTrade} onChange={e=>setNoteTrade(e.target.value)}><option value="">General note</option>{p.trades.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label></div><button disabled={!note.trim()} onClick={event=>addNote(Math.round(performance.timeOrigin + event.timeStamp))}>Add timestamped note</button>
          {d.notes?.map(n=><div className="journal-tool-item journal-note" key={n.id}><p><strong>{labelDate(n.at)} · {n.phase}{n.tradeId ? ` · ${p.trades.find(t=>t.id===n.tradeId)?.name || "Linked trade"}` : ""}</strong><br/>{n.text}</p><button aria-label={`Remove note ${n.id}`} onClick={()=>patch({notes:d.notes?.filter(x=>x.id!==n.id)})}>Remove</button></div>)}</section>
        <section><h3>Trade context</h3><p className="journal-help">Suggested from {p.entry.entryDate}. Add a snapshot to keep the trade’s current numbers with your reflection.</p>
          <div className="journal-chip-row">{p.trades.filter(t=>tradeJournalDay(t)===p.entry!.entryDate).map(t=><button key={t.id} disabled={d.snapshots?.some(s=>s.id===t.id)} onClick={()=>linkTrade(t, Date.now())}>Snapshot {t.name}</button>)}</div>
          <label>Snapshot another trade<select aria-label="Snapshot another trade" value="" onChange={e=>{const t=p.trades.find(t=>t.id===e.target.value);if(t)linkTrade(t, Date.now());}}><option value="">Choose a trade</option>{p.trades.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          {d.snapshots?.map(s=><div key={s.id} className="journal-tool-item"><div><strong>{s.name} · {s.symbol}</strong><p>Realized P&amp;L: {formatRealizedPnl(s.pnlSol, "SOL")}{s.pnlUsd!==undefined?` · ${formatUsd(s.pnlUsd, { signed: true })}`:""}</p><small>Snapshot: {labelDate(s.at)}</small></div><button onClick={()=>patch({snapshots:d.snapshots?.filter(x=>x.id!==s.id)})}>Unlink snapshot</button></div>)}
          <label>Link a coin thesis<select aria-label="Link a coin thesis" value={d.thesis?.ca || ""} onChange={e=>{const t=p.research.find(t=>t.ca===e.target.value);patch({thesis:t?{ca:t.ca,name:t.name,text:t.thesis}:undefined});}}><option value="">None</option>{p.research.map(t=><option key={t.ca} value={t.ca}>{t.name || t.symbol}</option>)}</select></label>{d.thesis && <blockquote><strong>{d.thesis.name}</strong><p>{d.thesis.text}</p></blockquote>}
          {!p.research.length && <p className="journal-help">Create a coin thesis in Research first to link it here.</p>}
        </section>
        <section><h3>Reflect on the decision</h3><label>Session<input aria-label="Session" placeholder="Morning, afternoon, or a custom session" value={d.session||""} maxLength={100} onChange={e=>patch({session:e.target.value})}/></label>{field("changed","What changed?")}{field("trigger","What triggered the decision?")}{field("mistakes","Recurring mistakes")}{field("positives","Positive behaviours")}
          <div className="journal-workbench-grid">{scale("processScore","Process quality")}{scale("outcomeScore","Satisfaction with outcome")}{scale("confidenceBefore","Confidence before")}{scale("confidenceAfter","Confidence after")}<label>Emotion before<input aria-label="Emotion before" value={d.emotionBefore||""} maxLength={100} onChange={e=>patch({emotionBefore:e.target.value})}/></label><label>Emotion after<input aria-label="Emotion after" value={d.emotionAfter||""} maxLength={100} onChange={e=>patch({emotionAfter:e.target.value})}/></label></div><label>Would I make this decision again?<select aria-label="Would I make this decision again?" value={d.repeatDecision||""} onChange={e=>patch({repeatDecision:e.target.value})}><option value="">Not answered</option><option>Yes</option><option>No</option><option>With changes</option></select></label>
        </section><section><h3>Carry it forward</h3>{field("takeaway","One takeaway")}{field("nextAction","One action for next time")}{field("rule","Personal trading rule to keep")}<label>Review this entry on<input aria-label="Review this entry on" type="date" value={d.reviewDate||""} onChange={e=>patch({reviewDate:e.target.value})}/></label><label className="journal-inline-label"><input type="checkbox" checked={!!d.pinned} onChange={e=>patch({pinned:e.target.checked})}/>Bookmark / pin this entry</label></section>
      </> : <p>Start or open an entry first.</p>)}
      {p.panel === "review" && <>
        <section><h3>Weekly & monthly reflection</h3><div className="journal-workbench-grid"><label>Period<select aria-label="Period" value={period} onChange={e=>{setPeriod(e.target.value);const date=new Date();date.setDate(e.target.value==="month"?1:date.getDate()-6);setFrom(journalLocalDate(date));setTo(today);}}><option value="week">Last 7 days</option><option value="month">This month</option></select></label><label>From<input aria-label="From" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>To<input aria-label="To" type="date" value={to} min={from} onChange={e=>setTo(e.target.value)}/></label></div><p>{review.selected.length} entries · {review.linked.length} distinct linked trades</p>
          <button disabled={from>to} onClick={()=>{const lessons=review.selected.filter(e=>e.details?.takeaway).map(e=>`${e.entryDate}: ${e.details?.takeaway}`).join("\n");p.onNew(`${period==="month"?"Monthly":"Weekly"} review · ${from} to ${to}`,`<h2>What I learned</h2>${htmlText(lessons || "")}<h2>What kept repeating?</h2><p><br></p><h2>What will I do next?</h2><p><br></p>`);p.onClose();}}>Create review entry</button><button disabled={!review.selected.length || from>to} onClick={()=>exportJournalDocument(review.selected)}>Export date range for printing</button>{p.entry && <button onClick={()=>exportJournalDocument([p.entry!])}>Export current entry for printing</button>}<p className="journal-help">Open the downloaded document and use Print → Save as PDF.</p>
        </section>
        <section><h3>Emotion &amp; outcome observations</h3><p className="journal-help">Only explicitly linked trades are counted, once per emotion. Small samples and associations do not establish cause.</p>{review.emotions.length ? <table><thead><tr><th>Emotion</th><th>Entries</th><th>Trades</th><th>Wins</th><th>Realized P&amp;L</th></tr></thead><tbody>{review.emotions.map(e=><tr key={e.emotion}><td>{e.emotion}</td><td>{e.entries}</td><td>{e.trades}</td><td>{e.trades?`${e.wins}/${e.trades}`:"—"}</td><td>{e.trades?formatRealizedPnl(e.pnlSol, "SOL"):"No linked trades"}</td></tr>)}</tbody></table>:<p>Add emotions and link trades to entries to see observations here.</p>}</section>
        <section><h3>Lessons, actions & personal rules</h3>{review.selected.filter(e=>e.details?.takeaway||e.details?.nextAction).map(e=><div className="journal-tool-item" key={e.id}><div><strong>{e.title}</strong><p>{e.details?.takeaway}</p><p>Next: {e.details?.nextAction || "Not set"}</p></div><button onClick={()=>{p.onOpen(e);p.onClose();}}>Open</button></div>)}<ul>{[...new Set(active.map(e=>e.details?.rule).filter(Boolean))].map(rule=><li key={rule}>{rule}</li>)}</ul></section>
        <section><h3>Due for review</h3>{active.filter(e=>e.details?.reviewDate && e.details.reviewDate<=today).map(e=><div key={e.id} className="journal-tool-item"><span>{e.title} · {e.details?.reviewDate}</span><button onClick={()=>{p.onOpen(e);p.onClose();}}>Review entry</button></div>)}</section>
        <section><h3>Patterns to revisit</h3>{review.selected.filter(e=>e.details?.mistakes||e.details?.positives).map(e=><div className="journal-tool-item" key={e.id}><div><strong>{e.title}</strong><p>Repeat: {e.details?.positives||"—"}</p><p>Change: {e.details?.mistakes||"—"}</p></div></div>)}</section>
      </>}
      {p.panel === "recovery" && <>
        <section><h3>Unfinished browser drafts</h3><p className="journal-help">These drafts exist in this browser. Recover before clearing browser data.</p>{!p.drafts.length && <p>No unfinished drafts.</p>}{p.drafts.map(e=><div className="journal-tool-item" key={e.id}><div><strong>{e.title}</strong><p>{labelDate(e.updatedAt)}</p></div><button onClick={()=>{p.onOpen(e);p.onClose();}}>Recover draft</button><button onClick={()=>{p.onDiscardDraft(e.id);setMessage("Browser draft discarded.");}}>Discard draft</button></div>)}</section>
        <section><h3>Recent writing versions</h3><p className="journal-help">The last 8 changed writing versions of the open entry. Restoring makes a new draft and keeps the current writing in history.</p>{!d.versions?.length && <p>No earlier writing versions yet.</p>}{d.versions?.map((v,i)=><details key={`${v.at}-${i}`}><summary>{labelDate(v.at)} · {v.title}</summary><div dangerouslySetInnerHTML={{__html:sanitizeJournalHtml(v.html)}}/><button onClick={()=>{p.onReplace(v.html,v.title);p.onClose();}}>Restore this version</button></details>)}</section>
        <section><h3>Trash</h3><p className="journal-help">Deleted entries stay here until you permanently erase them. Account deletion and Delete all entries also clear trash.</p>{!p.entries.some(e=>e.details?.deletedAt) && <p>Trash is empty.</p>}{p.entries.filter(e=>e.details?.deletedAt).map(e=><div className="journal-tool-item" key={e.id}><strong>{e.title}</strong><button disabled={busy} onClick={()=>void run(()=>p.onRestore(e))}>Restore entry</button>{confirmErase===e.id?<><span>Erase forever?</span><button disabled={busy} onClick={()=>void run(async()=>{await p.onErase(e);setConfirmErase(null);})}>Confirm erase</button><button onClick={()=>setConfirmErase(null)}>Cancel</button></>:<button onClick={()=>setConfirmErase(e.id)}>Erase permanently</button>}</div>)}</section>
      </>}
    </section>
  </div>;
}
