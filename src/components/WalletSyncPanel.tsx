"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import bs58 from "bs58";
import { CheckCircle2, History, Link2, Loader2, RefreshCw, ShieldCheck, Trash2, WalletCards, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import type { Trade } from "@/lib/types";
import { formatSol } from "@/lib/utils";
import { useToast } from "@/components/Toast";

type WalletLink = { id: string; address: string; label: string; last_synced_signature: string | null; last_synced_at: string | null; verified_at: string | null; created_at: string; updated_at: string };
type TokenSnapshot = { name?: string; symbol?: string; marketCapUsd?: number | null };
type WalletEvent = { id: string; wallet_link_id: string; signature: string; event_index: number; block_time: string; mint: string; direction: "buy" | "sell" | "transfer" | "unknown"; sol_change: number; token_change: number; fee_sol: number; status: string; source: "rpc" | "webhook"; raw?: { token?: TokenSnapshot }; wallet_links?: { label?: string; address?: string } | null };
type ReviewCandidate = { key: string; walletLinkId: string; walletLabel: string; mint: string; tokenName: string; tokenSymbol: string; currentMarketCapUsd: number | null; eventIds: string[]; signatures: string[]; boughtSol: number; soldSol: number; tokensBought: number; tokensSold: number; feesSol: number; entryAt: number; exitAt?: number; source: "sync" | "webhook"; fills: NonNullable<Trade["fills"]> };
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
  const candidates = useMemo(() => {
    const grouped = new Map<string, ReviewCandidate>();
    for (const event of [...events].sort((a, b) => Date.parse(a.block_time) - Date.parse(b.block_time))) {
      if (existingSignatureSet.has(event.signature)) continue;
      if ((event.direction !== "buy" && event.direction !== "sell") || !event.mint) continue;
      const key = `${event.wallet_link_id}:${event.mint}`;
      const time = Date.parse(event.block_time);
      const token = event.raw?.token;
      const current = grouped.get(key) || { key, walletLinkId: event.wallet_link_id, walletLabel: event.wallet_links?.label || "Linked wallet", mint: event.mint, tokenName: token?.name || "Solana token", tokenSymbol: token?.symbol || event.mint.slice(0, 5), currentMarketCapUsd: typeof token?.marketCapUsd === "number" ? token.marketCapUsd : null, eventIds: [], signatures: [], boughtSol: 0, soldSol: 0, tokensBought: 0, tokensSold: 0, feesSol: 0, entryAt: time, source: event.source === "webhook" ? "webhook" : "sync", fills: [] };
      const quoteAmount = event.direction === "buy" ? Math.max(0, -Number(event.sol_change) - Number(event.fee_sol)) : Math.max(0, Number(event.sol_change) + Number(event.fee_sol));
      if (event.direction === "buy") {
        current.boughtSol += quoteAmount;
        current.tokensBought += Math.max(0, Number(event.token_change));
        current.entryAt = Math.min(current.entryAt, time);
        current.fills.push({ id: `${event.signature}-${event.event_index}`, side: "entry", quoteAmount, feeSol: Number(event.fee_sol), executedAt: time });
      } else {
        current.soldSol += quoteAmount;
        current.tokensSold += Math.max(0, -Number(event.token_change));
        current.exitAt = Math.max(current.exitAt || 0, time);
        current.fills.push({ id: `${event.signature}-${event.event_index}`, side: "exit", quoteAmount, feeSol: Number(event.fee_sol), executedAt: time });
      }
      current.feesSol += Number(event.fee_sol);
      current.eventIds.push(event.id);
      if (!current.signatures.includes(event.signature)) current.signatures.push(event.signature);
      if (event.source === "webhook") current.source = "webhook";
      grouped.set(key, current);
    }
    return [...grouped.values()].sort((a, b) => (b.exitAt || b.entryAt) - (a.exitAt || a.entryAt));
  }, [events, existingSignatureSet]);

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
    if (mode === "rescan" && !window.confirm(`Rescan the 50 most recent successful transactions for ${link.label}? Failed attempts are ignored and existing events will not be duplicated.`)) return;
    setBusyId(link.id);
    try {
      const payload = await authenticatedFetch(user, "/api/wallet-sync", { method: "POST", body: JSON.stringify({ linkId: link.id, mode }) });
      setEvents(Array.isArray(payload.events) ? payload.events : []);
      setLinks((current) => current.map((item) => item.id === link.id ? { ...item, last_synced_at: new Date().toISOString(), last_synced_signature: payload.result?.cursor || item.last_synced_signature } : item));
      const result = payload.result || {};
      const checked = Number(result.checkedTransactions) || 0;
      const failed = Number(result.failedTransactions) || 0;
      showToast(result.rescan ? "Recent history rescanned" : result.incremental ? "Wallet updated" : "First wallet update complete", "success", `${checked} checked · ${Number(result.swapTransactions) || 0} swap${Number(result.swapTransactions) === 1 ? "" : "s"} · ${Number(result.transferTransactions) || 0} transfer${Number(result.transferTransactions) === 1 ? "" : "s"} · ${Number(result.unclassifiedTransactions) || 0} unclassified${failed ? ` · ${failed} failed attempt${failed === 1 ? "" : "s"} ignored` : ""}.`);
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

  const ignore = async (candidate: ReviewCandidate) => {
    if (!user) return;
    try {
      await authenticatedFetch(user, "/api/wallet-events", { method: "PATCH", body: JSON.stringify({ ids: candidate.eventIds, status: "ignored" }) });
      setEvents((current) => current.filter((event) => !candidate.eventIds.includes(event.id)));
      showToast("Activity ignored", "success", "It was not added to your journal.");
    } catch (error) { showToast("Review inbox could not update", "error", error instanceof Error ? error.message : "Try again."); }
  };

  const createDraft = () => {
    if (!reviewing || !onImportWalletTrade) return;
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

  if (!user) return null;
  return (
    <section className="rounded-xl border border-[#e9e9e7] bg-white p-4 shadow-xs" aria-labelledby="wallet-sync-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-2"><span className="rounded-lg bg-blue-50 p-2 text-blue-700"><WalletCards size={16}/></span><div><h2 id="wallet-sync-heading" className="text-sm font-semibold text-[#37352f]">Linked wallet activity</h2><p className="mt-1 max-w-2xl text-[11px] text-[#787774]">Update activity checks transactions newer than the last saved signature. The first update and a manual rescan inspect the latest 50 successful transactions, paging past failed attempts. Detected swaps wait for your approval and are never journaled automatically.</p></div></div>
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
          <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => void sync(link)} disabled={busyId === link.id} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] font-semibold text-blue-700 disabled:opacity-50">{busyId === link.id ? <Loader2 size={12} className="animate-spin"/> : <RefreshCw size={12}/>}Update activity</button><button type="button" onClick={() => void sync(link, "rescan")} disabled={busyId === link.id} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-semibold text-[#5a5957] hover:bg-[#f1f1ef] disabled:opacity-50" title="Recheck the 50 most recent transactions without duplicating saved events"><History size={12}/>Rescan recent history</button>{!link.verified_at && <button type="button" onClick={() => void verify(link)} disabled={busyId === link.id} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-semibold text-emerald-700 disabled:opacity-50"><ShieldCheck size={12}/>Verify ownership</button>}<button type="button" onClick={() => void unlink(link)} disabled={busyId === link.id} aria-label={`Unlink ${link.label}`} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 disabled:opacity-50"><Trash2 size={13}/></button></div>
        </article>)}
      </div>}

      <div className="mt-5 border-t border-[#f1f1ef] pt-4"><div className="flex items-center justify-between gap-3"><div><h3 className="text-xs font-semibold text-[#37352f]">Review inbox</h3><p className="mt-1 text-[10px] text-[#787774]">Nothing is journaled automatically. Add your reason and setup before opening the final trade form.</p></div><span className="rounded-full bg-[#f1f1ef] px-2 py-1 text-[10px] font-semibold text-[#5a5957]">{candidates.length} pending</span></div>
            {candidates.length === 0 ? <p className="mt-3 rounded-lg bg-[#fbfbfa] p-4 text-center text-[11px] text-[#787774]">Update one linked wallet. Its detected buys and sells will appear here.</p> : <div className="mt-3 space-y-2">{candidates.map((candidate) => { const pnl = candidate.soldSol - candidate.boughtSol - candidate.feesSol; const isOpen = !candidate.exitAt || candidate.soldSol <= 0; return <article key={candidate.key} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#e9e9e7] p-3"><div className="min-w-0"><strong className="block truncate text-xs text-[#37352f]">{candidate.tokenName} · ${candidate.tokenSymbol}</strong><p className="mt-0.5 truncate font-mono text-[9px] text-[#9b9a97]">{candidate.mint}</p><p className="mt-1 text-[10px] text-[#787774]">{candidate.walletLabel} · Bought {candidate.tokensBought.toLocaleString(undefined, { maximumFractionDigits: 4 })} tokens for {formatSol(candidate.boughtSol)} SOL · Sold {candidate.tokensSold.toLocaleString(undefined, { maximumFractionDigits: 4 })} for {formatSol(candidate.soldSol)} SOL · {candidate.soldSol ? `${pnl >= 0 ? "+" : ""}${formatSol(pnl)} SOL estimated P&amp;L` : "Open position"}{candidate.currentMarketCapUsd !== null ? ` · Current MC $${candidate.currentMarketCapUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : ""}</p></div><div className="flex gap-2"><button type="button" onClick={() => void ignore(candidate)} className="rounded-lg px-3 py-2 text-[10px] font-semibold text-[#787774] hover:bg-[#f1f1ef]">Ignore</button><button type="button" onClick={() => setReviewing(candidate)} disabled={isOpen} title={isOpen ? "Sync again after a sell is detected" : "Review and import this completed position"} className="rounded-lg bg-[#1a73ca] px-3 py-2 text-[10px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45">{isOpen ? "Waiting for exit" : "Review as trade"}</button></div></article>; })}</div>}
      </div>

          {reviewing && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-labelledby="wallet-review-title"><div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><h3 id="wallet-review-title" className="text-base font-semibold text-[#37352f]">Add your trade context</h3><p className="mt-1 text-[11px] text-[#787774]">On-chain data shows what happened. Your journal still needs to know why.</p></div><button type="button" onClick={() => setReviewing(null)} aria-label="Close wallet review" className="rounded-lg p-2 text-[#787774] hover:bg-[#f1f1ef]"><X size={15}/></button></div><div className="mt-4 space-y-3"><label className="block text-xs font-medium text-[#37352f]">Reason for entering <span className="text-rose-600">*</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={1000} placeholder="What did you see before entering?" className="mt-1 w-full rounded-lg border border-[#d8d7d3] bg-[#fbfbfa] px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"/></label><label className="block text-xs font-medium text-[#37352f]">Setup <span className="text-rose-600">*</span><input value={setup} onChange={(event) => setSetup(event.target.value)} maxLength={120} placeholder="e.g. Breakout / ATH Push" className="mt-1 w-full rounded-lg border border-[#d8d7d3] bg-[#fbfbfa] px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"/></label><label className="block text-xs font-medium text-[#37352f]">Confidence at entry · {confidence}%<input type="range" min="0" max="100" value={confidence} onChange={(event) => setConfidence(event.target.value)} className="mt-2 w-full"/></label></div><button type="button" onClick={createDraft} className="mt-5 w-full rounded-lg bg-[#1a73ca] px-4 py-2.5 text-xs font-semibold text-white">Continue to final trade review</button></div></div>}
    </section>
  );
}
