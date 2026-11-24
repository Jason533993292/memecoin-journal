"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import bs58 from "bs58";
import { CheckCircle2, History, Link2, Loader2, RefreshCw, ShieldCheck, Trash2, WalletCards, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import type { Trade } from "@/lib/types";
import { formatSol } from "@/lib/utils";
import { useToast } from "@/components/Toast";
import { buildWalletPositions, type WalletEventLike, type WalletPosition } from "@/lib/walletPositions";

type WalletLink = { id: string; address: string; label: string; last_synced_signature: string | null; last_synced_at: string | null; verified_at: string | null; created_at: string; updated_at: string };
type WalletEvent = WalletEventLike;
type ReviewCandidate = WalletPosition;
type SolanaProvider = { publicKey?: { toBase58(): string }; connect(): Promise<{ publicKey: { toBase58(): string } }>; signMessage(message: Uint8Array, encoding: "utf8"): Promise<{ signature: Uint8Array }> };

async function authenticatedFetch(user: NonNullable<ReturnType<typeof useAuth>["user"]>, url: string, init?: RequestInit) {
  const token = await user.getIdToken();
  const response = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers || {}) }, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "The request could not be completed.");
  return payload;
}

export default function WalletSyncPanel({ onImportWalletTrade, existingWalletSignatures = [] }: { onImportWalletTrade?: (draft: Partial<Trade>) => void; existingWalletSignatures?: string[] }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [links, setLinks] = useState<WalletLink[]>([]);
  const [events, setEvents] = useState<WalletEvent[]>([]);
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<ReviewCandidate | null>(null);
  const [reason, setReason] = useState("");
  const [setup, setSetup] = useState("");
  const [confidence, setConfidence] = useState("50");

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const payload = await authenticatedFetch(user, "/api/wallet-links");
      setLinks(Array.isArray(payload.links) ? payload.links : []);
      setEvents(Array.isArray(payload.events) ? payload.events : []);
    } catch (error) {
      showToast("Wallet sync could not load", "error", error instanceof Error ? error.message : "Try again shortly.");
    } finally {
      setLoading(false);
    }
  }, [showToast, user]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    const refresh = () => void load();
    window.addEventListener("wallet-events-updated", refresh);
    return () => window.removeEventListener("wallet-events-updated", refresh);
  }, [load]);

  const existingSignatureSet = useMemo(() => new Set(existingWalletSignatures), [existingWalletSignatures]);
  const positions = useMemo(() => buildWalletPositions(events, existingSignatureSet), [events, existingSignatureSet]);
  const candidates = useMemo(() => positions.filter((position) => !position.dismissed), [positions]);
  const dismissedPositions = useMemo(() => positions.filter((position) => position.dismissed), [positions]);

  const linkWallet = async () => {
    if (!user) return;
    setBusyId("link");
    try {
      const payload = await authenticatedFetch(user, "/api/wallet-links", { method: "POST", body: JSON.stringify({ address, label }) });
      if (payload.link) setLinks((current) => [payload.link, ...current.filter((item) => item.id !== payload.link.id)]);
      setAddress(""); setLabel("");
      showToast("Read-only wallet linked", "success", "No private key or seed phrase is stored.");
    } catch (error) {
      showToast("Wallet could not be linked", "error", error instanceof Error ? error.message : "Check the address.");
    } finally { setBusyId(null); }
  };

  const sync = async (link: WalletLink, mode: "incremental" | "rescan" = "incremental") => {
    if (!user) return;
    if (mode === "rescan" && !window.confirm(`Repair history for ${link.label}? This re-checks the 50 most recent successful transactions and reclassifies activity that was not understood before. Your dismissed and imported decisions are kept and nothing is duplicated.`)) return;
    setBusyId(link.id);
    try {
      const payload = await authenticatedFetch(user, "/api/wallet-sync", { method: "POST", body: JSON.stringify({ linkId: link.id, mode }) });
      setEvents(Array.isArray(payload.events) ? payload.events : []);
      setLinks((current) => current.map((item) => item.id === link.id ? { ...item, last_synced_at: new Date().toISOString(), last_synced_signature: payload.result?.cursor || item.last_synced_signature } : item));
      const result = payload.result || {};
      const checked = Number(result.checkedTransactions) || 0;
      const failed = Number(result.failedTransactions) || 0;
      const swaps = Number(result.swapTransactions) || 0;
      const transfers = Number(result.transferTransactions) || 0;
      const unclassified = Number(result.unclassifiedTransactions) || 0;
      const detail = [`${checked} checked`, `${swaps} swap${swaps === 1 ? "" : "s"} detected`, `${transfers} transfer${transfers === 1 ? "" : "s"}`, `${unclassified} need${unclassified === 1 ? "s" : ""} review or ${unclassified === 1 ? "is" : "are"} unsupported`, failed ? `${failed} failed on-chain attempt${failed === 1 ? "" : "s"} skipped` : ""].filter(Boolean).join(" · ") + ".";
      const more = result.hasMore ? " More activity is waiting. Press Sync wallet again to continue." : "";
      const skipped = result.skippedOlder ? " This wallet had more than 3,000 new transactions, so the oldest ones were skipped." : "";
      if (result.incomplete) showToast("Wallet partly synced", "info", `${detail} The provider did not return every transaction, so the sync stopped early and will retry the rest.${skipped}`);
      else if (checked > 0 && swaps === 0 && transfers === 0) showToast("No supported trades found", "info", `${detail} These were successful on-chain transactions, but none contained a swap or transfer this tracker can safely identify. No journal trades were created.${result.rescan ? " Repair finished; repeating it will not change these transactions until parser support improves." : " You can use Repair history after a parser update."}${more}${skipped}`);
      else showToast(result.rescan ? "History repaired" : result.incremental ? "Wallet synced" : "First sync complete", "success", `${detail}${more}${skipped}`);
    } catch (error) {
      showToast("Wallet sync failed", "error", error instanceof Error ? error.message : "Try again shortly.");
    } finally { setBusyId(null); }
  };

  const unlink = async (link: WalletLink) => {
    if (!user || !window.confirm(`Unlink ${link.label}? Its pending review events will also be removed.`)) return;
    const previousLinks = links;
    const previousEvents = events;
    setBusyId(link.id);
    setLinks((current) => current.filter((item) => item.id !== link.id));
    setEvents((current) => current.filter((event) => event.wallet_link_id !== link.id));
    try {
      await authenticatedFetch(user, "/api/wallet-links", { method: "DELETE", body: JSON.stringify({ id: link.id }) });
      showToast("Wallet unlinked", "success");
    } catch (error) { setLinks(previousLinks); setEvents(previousEvents); showToast("Wallet could not be unlinked", "error", error instanceof Error ? error.message : "Try again."); }
    finally { setBusyId(null); }
  };

  const verify = async (link: WalletLink) => {
    if (!user) return;
    const provider = (window as typeof window & { solana?: SolanaProvider }).solana;
    if (!provider?.signMessage) {
      showToast("Wallet app not found", "info", "Open this page in a browser with Phantom or Solflare installed. Verification is optional.");
      return;
    }
    setBusyId(link.id);
    try {
      const connected = await provider.connect();
      if (connected.publicKey.toBase58() !== link.address) throw new Error("Connect the same address that you linked.");
      const challenge = await authenticatedFetch(user, "/api/wallet-verify", { method: "POST", body: JSON.stringify({ action: "challenge", linkId: link.id }) });
      const signed = await provider.signMessage(new TextEncoder().encode(challenge.challenge), "utf8");
      await authenticatedFetch(user, "/api/wallet-verify", { method: "POST", body: JSON.stringify({ action: "confirm", linkId: link.id, signature: bs58.encode(signed.signature) }) });
      await load();
      showToast("Wallet ownership verified", "success", "The signature proved ownership without sending a transaction.");
    } catch (error) { showToast("Verification was not completed", "error", error instanceof Error ? error.message : "Try again."); }
    finally { setBusyId(null); }
  };

  const setCandidateStatus = async (candidate: ReviewCandidate, status: "ignored" | "needs_review") => {
    if (!user) return;
    try {
      await authenticatedFetch(user, "/api/wallet-events", { method: "PATCH", body: JSON.stringify({ ids: candidate.eventIds, status }) });
      // Events stay in memory: a dismissed buy is still needed to value a later sell.
      setEvents((current) => current.map((event) => candidate.eventIds.includes(event.id) ? { ...event, status } : event));
      if (status === "ignored") showToast("Dismissed for now", "success", "It comes back automatically if a matching sell or new buy appears.");
      else showToast("Restored to the review inbox", "success");
    } catch (error) { showToast("Review inbox could not update", "error", error instanceof Error ? error.message : "Try again."); }
  };

  const createDraft = () => {
    if (!reviewing || !onImportWalletTrade) return;
    if (reviewing.status === "exit_only") {
      showToast("No entry was found", "info", "This sell has no matching buy in the synced history, so profit and loss cannot be calculated. Repair history to look further back.");
      return;
    }
    if (reviewing.status === "partial") {
      showToast("Part of this position is still open", "info", "Wait for the remaining exit before importing. This keeps the original entry cost attached to the position and prevents incorrect realized P&L.");
      return;
    }
    if (!reviewing.exitAt || reviewing.soldSol <= 0) {
      showToast("This position is still open", "info", "A buy without a detected sell is not a realized loss. Sync again after an exit appears.");
      return;
    }
    if (!reason.trim() || !setup.trim()) {
      showToast("Add your trade context", "error", "Reason and setup are required before creating the journal draft.");
      return;
    }
    const pnl = reviewing.soldSol - reviewing.boughtSol - reviewing.feesSol;
    onImportWalletTrade({
      ca: reviewing.mint,
      wallet: reviewing.walletLabel,
      setupType: setup.trim(),
      confidenceAtEntry: Math.max(0, Math.min(100, Number(confidence) || 0)),
      boughtSol: reviewing.boughtSol,
      soldSol: reviewing.soldSol,
      pnlSol: pnl,
      feesSol: reviewing.feesSol,
      result: pnl > 0 ? "Win" : pnl < 0 ? "Loss" : "BE",
      entryTime: new Date(reviewing.entryAt).toISOString(),
      exitTime: reviewing.exitAt ? new Date(reviewing.exitAt).toISOString() : undefined,
      tradedAt: reviewing.entryAt,
      fills: reviewing.fills,
      notes: `Reason for entry: ${reason.trim()}\nImported from read-only wallet sync. Verify amounts before saving. Transactions: ${reviewing.signatures.join(", ")}`,
      walletSource: reviewing.source,
      walletSourceSignatures: reviewing.signatures,
      walletEventIds: reviewing.eventIds,
    });
    setReviewing(null); setReason(""); setSetup(""); setConfidence("50");
  };

  if (!user) return (
    <section data-tour="wallet-sync" className="wallet-sync-wip-frame relative rounded-xl p-[7px]" aria-labelledby="wallet-sync-guest-heading">
      <span className="absolute -top-3 left-5 z-10 rounded-md bg-[#171717] px-3 py-1 text-[10px] font-black tracking-[0.24em] text-[#ffd84d] shadow-lg">W.I.P.</span>
      <div className="rounded-[9px] bg-white p-4 shadow-xs">
        <div className="flex gap-2"><span className="rounded-lg bg-blue-50 p-2 text-blue-700"><WalletCards size={16}/></span><div><h2 id="wallet-sync-guest-heading" className="text-sm font-semibold text-[#37352f]">Linked wallet activity</h2><p className="mt-1 max-w-2xl text-[11px] leading-5 text-[#787774]">Account holders can link a public Solana address and review supported swaps before adding them to the journal. Guest mode shows this preview only; it never asks for a private key or seed phrase.</p></div></div>
      </div>
    </section>
  );
  return (
    <section data-tour="wallet-sync" className="wallet-sync-wip-frame relative rounded-xl p-[7px]" aria-labelledby="wallet-sync-heading">
      <span className="absolute -top-3 left-5 z-10 rounded-md bg-[#171717] px-3 py-1 text-[10px] font-black tracking-[0.24em] text-[#ffd84d] shadow-lg" role="status">W.I.P.</span>
      <div className="rounded-[9px] bg-white p-4 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-2"><span className="rounded-lg bg-blue-50 p-2 text-blue-700"><WalletCards size={16}/></span><div><h2 id="wallet-sync-heading" className="text-sm font-semibold text-[#37352f]">Linked wallet activity</h2><p className="mt-1 max-w-2xl text-[11px] text-[#787774]">Sync wallet checks transactions newer than the last saved signature, 50 at a time, oldest first, so nothing is skipped. The first sync looks at the latest 50 successful transactions. Detected swaps wait for your approval and are never journaled automatically.</p></div></div>
        {loading && <span role="status" className="flex items-center gap-2 text-[11px] text-[#787774]"><Loader2 size={13} className="animate-spin"/>Loading</span>}
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto]">
        <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Wallet label (e.g. Phantom main)" maxLength={80} className="rounded-lg border border-[#d8d7d3] bg-[#fbfbfa] px-3 py-2 text-xs text-[#37352f] focus:border-blue-500 focus:outline-none"/>
        <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Public Solana address" aria-label="Public Solana address to link" className="rounded-lg border border-[#d8d7d3] bg-[#fbfbfa] px-3 py-2 font-mono text-xs text-[#37352f] focus:border-blue-500 focus:outline-none"/>
        <button type="button" onClick={() => void linkWallet()} disabled={busyId === "link" || !address.trim()} className="flex items-center justify-center gap-2 rounded-lg bg-[#1a73ca] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{busyId === "link" ? <Loader2 size={13} className="animate-spin"/> : <Link2 size={13}/>}Link wallet</button>
      </div>

      {links.length > 0 && <div className="mt-4 grid gap-2">
        {links.map((link) => <article key={link.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#e9e9e7] bg-[#fbfbfa] p-3">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="text-xs text-[#37352f]">{link.label}</strong>{link.verified_at && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-emerald-700"><CheckCircle2 size={10}/>Verified owner</span>}</div><p className="mt-1 truncate font-mono text-[10px] text-[#787774]" title={link.address}>{link.address}</p><p className="mt-1 text-[10px] text-[#9b9a97]">{link.last_synced_at ? `Last synced ${new Date(link.last_synced_at).toLocaleString()}` : "Not synced yet"}</p></div>
          <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => void sync(link)} disabled={busyId === link.id} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-[10px] font-semibold text-blue-700 transition-colors hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-50">{busyId === link.id ? <Loader2 size={12} className="animate-spin"/> : <RefreshCw size={12}/>}Sync wallet</button><details className="relative"><summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-semibold text-[#5a5957] hover:bg-[#f1f1ef]"><History size={12}/>Advanced</summary><div className="absolute right-0 z-10 mt-1 w-56 rounded-lg border border-[#e9e9e7] bg-white p-2 shadow-lg"><button type="button" onClick={() => void sync(link, "rescan")} disabled={busyId === link.id} className="w-full rounded-md px-2 py-2 text-left text-[10px] font-semibold text-[#37352f] hover:bg-[#f1f1ef] disabled:opacity-50" title="Re-checks the 50 most recent transactions and reclassifies activity that was not understood. Dismissed and imported decisions are kept.">Repair history<span className="mt-0.5 block font-normal text-[#787774]">Re-check recent transactions if a trade looks missing.</span></button></div></details>{!link.verified_at && <button type="button" onClick={() => void verify(link)} disabled={busyId === link.id} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-[10px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:opacity-50"><ShieldCheck size={12}/>Verify ownership</button>}<button type="button" onClick={() => void unlink(link)} disabled={busyId === link.id} aria-label={`Unlink ${link.label}`} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 disabled:opacity-50"><Trash2 size={13}/></button></div>
        </article>)}
      </div>}

      <div className="mt-5 border-t border-[#f1f1ef] pt-4"><div className="flex items-center justify-between gap-3"><div><h3 className="text-xs font-semibold text-[#37352f]">Review inbox</h3><p className="mt-1 text-[10px] text-[#787774]">Nothing is journaled automatically. Add your reason and setup before opening the final trade form.</p></div><span className="rounded-full bg-[#f1f1ef] px-2 py-1 text-[10px] font-semibold text-[#5a5957]">{candidates.length} pending</span></div>
            {candidates.length === 0 ? <p className="mt-3 rounded-lg bg-[#fbfbfa] p-4 text-center text-[11px] text-[#787774]">Sync one linked wallet. Its detected buys and sells will appear here.</p> : <div className="mt-3 space-y-2">{candidates.map((candidate) => {
              const pnl = candidate.soldSol - candidate.boughtSol - candidate.feesSol;
              const heldPct = candidate.tokensBought > 0 ? Math.round((candidate.remainingTokens / candidate.tokensBought) * 100) : 0;
              const statusLabel = candidate.status === "closed" ? "Closed" : candidate.status === "partial" ? `Partly sold · ${heldPct}% still held` : candidate.status === "exit_only" ? "Sell without a detected buy" : "Open position";
              const canImport = candidate.status === "closed";
              const buttonLabel = candidate.status === "closed" ? "Review as trade" : candidate.status === "partial" ? "Waiting for full exit" : candidate.status === "exit_only" ? "No entry found" : "Waiting for exit";
              const buttonHint = candidate.status === "closed" ? "Review and import this completed position" : candidate.status === "partial" ? "The remaining position must close before it can be imported with accurate realized P&L." : candidate.status === "exit_only" ? "The matching buy is not in the synced history. Repair history to look further back." : "Sync again after a sell is detected";
              return <article key={candidate.key} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#e9e9e7] p-3"><div className="min-w-0"><strong className="block truncate text-xs text-[#37352f]">{candidate.tokenName} · ${candidate.tokenSymbol}</strong><p className="mt-0.5 truncate font-mono text-[9px] text-[#9b9a97]">{candidate.mint}</p><p className="mt-1 text-[10px] text-[#787774]"><span className="font-semibold text-[#5a5957]">{statusLabel}</span> · {candidate.walletLabel} · Bought {candidate.tokensBought.toLocaleString(undefined, { maximumFractionDigits: 4 })} tokens for {formatSol(candidate.boughtSol)} SOL · Sold {candidate.tokensSold.toLocaleString(undefined, { maximumFractionDigits: 4 })} for {formatSol(candidate.soldSol)} SOL{candidate.status === "closed" ? ` · ${pnl >= 0 ? "+" : ""}${formatSol(pnl)} SOL estimated P&L` : ""}{candidate.currentMarketCapUsd !== null ? ` · Current MC $${candidate.currentMarketCapUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : ""}</p></div><div className="flex gap-2"><button type="button" onClick={() => void setCandidateStatus(candidate, "ignored")} className="rounded-lg px-3 py-2 text-[10px] font-semibold text-[#787774] hover:bg-[#f1f1ef]" title="Hide this for now. It returns automatically if a matching sell or new buy appears.">Dismiss for now</button><button type="button" onClick={() => setReviewing(candidate)} disabled={!canImport} title={buttonHint} className="rounded-lg bg-[#1a73ca] px-3 py-2 text-[10px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45">{buttonLabel}</button></div></article>;
            })}</div>}
            {dismissedPositions.length > 0 && <details className="mt-3"><summary className="cursor-pointer text-[10px] font-semibold text-[#787774]">{dismissedPositions.length} dismissed for now</summary><div className="mt-2 space-y-1">{dismissedPositions.map((position) => <div key={position.key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#fbfbfa] px-3 py-2"><span className="truncate text-[10px] text-[#5a5957]">{position.tokenName} · ${position.tokenSymbol} · {position.status === "closed" ? "closed" : position.status === "partial" ? "partly sold" : position.status === "exit_only" ? "sell only" : "open"}</span><button type="button" onClick={() => void setCandidateStatus(position, "needs_review")} className="rounded-lg px-2 py-1 text-[10px] font-semibold text-blue-700 hover:bg-blue-50">Restore</button></div>)}</div></details>}
      </div>

          {reviewing && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-labelledby="wallet-review-title"><div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><h3 id="wallet-review-title" className="text-base font-semibold text-[#37352f]">Add your trade context</h3><p className="mt-1 text-[11px] text-[#787774]">On-chain data shows what happened. Your journal still needs to know why.</p></div><button type="button" onClick={() => setReviewing(null)} aria-label="Close wallet review" className="rounded-lg p-2 text-[#787774] hover:bg-[#f1f1ef]"><X size={15}/></button></div><div className="mt-4 space-y-3"><label className="block text-xs font-medium text-[#37352f]">Reason for entering <span className="text-rose-600">*</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={1000} placeholder="What did you see before entering?" className="mt-1 w-full rounded-lg border border-[#d8d7d3] bg-[#fbfbfa] px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"/></label><label className="block text-xs font-medium text-[#37352f]">Setup <span className="text-rose-600">*</span><input value={setup} onChange={(event) => setSetup(event.target.value)} maxLength={120} placeholder="e.g. Breakout / ATH Push" className="mt-1 w-full rounded-lg border border-[#d8d7d3] bg-[#fbfbfa] px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"/></label><label className="block text-xs font-medium text-[#37352f]">Confidence at entry · {confidence}%<input type="range" min="0" max="100" value={confidence} onChange={(event) => setConfidence(event.target.value)} className="mt-2 w-full"/></label></div><button type="button" onClick={createDraft} className="mt-5 w-full rounded-lg bg-[#1a73ca] px-4 py-2.5 text-xs font-semibold text-white">Continue to final trade review</button></div></div>}
      </div>
    </section>
  );
}
