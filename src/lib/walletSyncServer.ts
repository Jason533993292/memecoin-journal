import { randomBytes } from "node:crypto";
import bs58 from "bs58";
import nacl from "tweetnacl";
import type { Json } from "@/lib/database.types";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const SOLANA_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const HELIUS_RPC_URL = process.env.HELIUS_API_KEY?.trim() ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY.trim()}` : "";
const RPC_URLS = [process.env.SOLANA_RPC_URL?.trim(), HELIUS_RPC_URL, "https://api.mainnet-beta.solana.com", "https://rpc.ankr.com/solana"].filter(Boolean) as string[];
const WRAPPED_SOL_MINT = "So11111111111111111111111111111111111111112";
const TRANSACTION_BATCH_SIZE = 8;

type RpcTokenBalance = { mint?: string; owner?: string; uiTokenAmount?: { uiAmount?: number | null; uiAmountString?: string } };
type WalletLinkRow = { id: string; user_id: string; address: string; label: string; last_synced_signature: string | null; last_synced_at: string | null; verified_at: string | null; created_at: string; updated_at: string };
type ParsedEvent = { signature: string; event_index: number; block_time: string; mint: string; direction: "buy" | "sell" | "transfer" | "unknown"; sol_change: number; token_change: number; fee_sol: number; source: "rpc" | "webhook"; raw: Json };
type TokenSnapshot = { name: string; symbol: string; marketCapUsd: number | null };

function admin() {
  return getSupabaseAdminClient();
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function rpc(body: unknown) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    for (const url of RPC_URLS) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          cache: "no-store",
          signal: AbortSignal.timeout(8_000),
        });
        if (!response.ok) continue;
        const payload = await response.json();
        if (!Array.isArray(payload) && payload?.error) continue;
        return payload;
      } catch {
        // Try the next configured provider, then retry with backoff.
      }
    }
    if (attempt < 2) await wait(350 * (2 ** attempt));
  }
  throw new Error("Solana data providers are temporarily unavailable. Wait a moment or configure a private RPC provider.");
}

function tokenAmount(balance: RpcTokenBalance) {
  const amount = balance.uiTokenAmount?.uiAmount ?? Number(balance.uiTokenAmount?.uiAmountString || 0);
  return Number.isFinite(amount) ? Number(amount) : 0;
}

function ownedTokenMap(items: RpcTokenBalance[] | undefined, owner: string) {
  const map = new Map<string, number>();
  for (const item of items || []) {
    if (item.owner !== owner || !item.mint) continue;
    map.set(item.mint, (map.get(item.mint) || 0) + tokenAmount(item));
  }
  return map;
}

async function tokenSnapshots(mints: string[]) {
  const unique = [...new Set(mints)].filter((mint) => SOLANA_ADDRESS_PATTERN.test(mint)).slice(0, 30);
  const snapshots = new Map<string, TokenSnapshot>();
  if (!unique.length) return snapshots;
  try {
    const response = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${unique.join(",")}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return snapshots;
    const pairs = await response.json() as Array<{ baseToken?: { address?: string; name?: string; symbol?: string }; marketCap?: number; fdv?: number; liquidity?: { usd?: number } }>;
    const liquidityByMint = new Map<string, number>();
    for (const pair of Array.isArray(pairs) ? pairs : []) {
      const mint = pair.baseToken?.address;
      if (!mint || !unique.includes(mint)) continue;
      const liquidity = Number(pair.liquidity?.usd) || 0;
      if (snapshots.has(mint) && liquidity <= (liquidityByMint.get(mint) || 0)) continue;
      const marketCap = Number(pair.marketCap ?? pair.fdv);
      snapshots.set(mint, {
        name: pair.baseToken?.name?.trim() || "Solana token",
        symbol: pair.baseToken?.symbol?.trim() || mint.slice(0, 5),
        marketCapUsd: Number.isFinite(marketCap) && marketCap >= 0 ? marketCap : null,
      });
      liquidityByMint.set(mint, liquidity);
    }
  } catch {
    // Token metadata is optional; transaction detection must still succeed.
  }
  return snapshots;
}

export async function listWalletLinks(userId: string) {
  const { data, error } = await admin().from("wallet_links").select("id,address,label,last_synced_signature,last_synced_at,verified_at,created_at,updated_at").eq("user_id", userId).order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function createWalletLink(userId: string, address: string, label: string) {
  const cleanAddress = address.trim();
  const cleanLabel = label.trim().slice(0, 80) || "Solana wallet";
  if (!SOLANA_ADDRESS_PATTERN.test(cleanAddress)) throw new Error("Enter a valid Solana wallet address.");
  const { data, error } = await admin().from("wallet_links").upsert({ user_id: userId, address: cleanAddress, label: cleanLabel, updated_at: new Date().toISOString() }, { onConflict: "user_id,address" }).select("id,address,label,last_synced_signature,last_synced_at,verified_at,created_at,updated_at").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteWalletLink(userId: string, id: string) {
  const { error } = await admin().from("wallet_links").delete().eq("user_id", userId).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listWalletEvents(userId: string, status = "needs_review") {
  const query = admin().from("wallet_events").select("id,wallet_link_id,signature,event_index,block_time,mint,direction,sol_change,token_change,fee_sol,status,source,raw,created_at,wallet_links(label,address)").eq("user_id", userId).order("block_time", { ascending: false }).limit(300);
  const { data, error } = status === "all" ? await query : await query.eq("status", status);
  if (error) throw new Error(error.message);
  return data || [];
}

export async function setWalletEventStatus(userId: string, ids: string[], status: "imported" | "ignored" | "needs_review") {
  const boundedIds = ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 100);
  if (!boundedIds.length) throw new Error("No wallet events were selected.");
  const { error } = await admin().from("wallet_events").update({ status, updated_at: new Date().toISOString() }).eq("user_id", userId).in("id", boundedIds);
  if (error) throw new Error(error.message);
}

async function ownedLink(userId: string, linkId: string): Promise<WalletLinkRow> {
  const { data, error } = await admin().from("wallet_links").select("*").eq("user_id", userId).eq("id", linkId).single();
  if (error || !data) throw new Error("Linked wallet was not found.");
  return data as WalletLinkRow;
}

export async function syncWalletLink(userId: string, linkId: string, mode: "incremental" | "rescan" = "incremental") {
  const link = await ownedLink(userId, linkId);
  const cursor = link.last_synced_signature;
  const options: Record<string, unknown> = { limit: 50 };
  if (cursor && mode === "incremental") options.until = cursor;
  const signatureResult = await rpc({ jsonrpc: "2.0", id: 1, method: "getSignaturesForAddress", params: [link.address, options] });
  const signatures = Array.isArray(signatureResult?.result) ? signatureResult.result.filter((item: { err?: unknown; signature?: string }) => !item.err && item.signature).slice(0, 50) : [];
  const transactionBatch = signatures.map((item: { signature: string }, index: number) => ({ jsonrpc: "2.0", id: index + 10, method: "getTransaction", params: [item.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }] }));
  const transactionResults: Array<{ id?: number; result?: unknown }> = [];
  for (let offset = 0; offset < transactionBatch.length; offset += TRANSACTION_BATCH_SIZE) {
    const result = await rpc(transactionBatch.slice(offset, offset + TRANSACTION_BATCH_SIZE));
    if (!Array.isArray(result)) throw new Error("The Solana provider returned an incomplete transaction batch. No sync cursor was advanced.");
    transactionResults.push(...result);
  }
  const byId = new Map(transactionResults.map((item) => [item.id, item.result]));
  const events: ParsedEvent[] = [];
  let swapTransactions = 0;
  let transferTransactions = 0;
  let unclassifiedTransactions = 0;
  let missingTransactions = 0;

  signatures.forEach((signature: { signature: string; blockTime?: number }, signatureIndex: number) => {
    const tx = byId.get(signatureIndex + 10) as { meta?: { fee?: number; preBalances?: number[]; postBalances?: number[]; preTokenBalances?: RpcTokenBalance[]; postTokenBalances?: RpcTokenBalance[] }; transaction?: { message?: { accountKeys?: Array<string | { pubkey?: string }> } } } | null;
    if (!tx?.meta) { missingTransactions += 1; return; }
    const keys = tx.transaction?.message?.accountKeys || [];
    const ownerIndex = keys.findIndex((key) => (typeof key === "string" ? key : key.pubkey) === link.address);
    const feeSol = (tx.meta.fee || 0) / 1e9;
    const solChange = ownerIndex >= 0 ? ((tx.meta.postBalances?.[ownerIndex] || 0) - (tx.meta.preBalances?.[ownerIndex] || 0)) / 1e9 : 0;
    const before = ownedTokenMap(tx.meta.preTokenBalances, link.address);
    const after = ownedTokenMap(tx.meta.postTokenBalances, link.address);
    const tokenChanges = [...new Set([...before.keys(), ...after.keys()])].map((mint) => ({ mint, change: (after.get(mint) || 0) - (before.get(mint) || 0) })).filter((item) => Math.abs(item.change) > 0.000000001);
    const wrappedSolChange = tokenChanges.find((item) => item.mint === WRAPPED_SOL_MINT)?.change;
    const quoteChange = typeof wrappedSolChange === "number" && Math.abs(wrappedSolChange) > 0.000000001 ? wrappedSolChange : solChange;
    const effectiveSolChange = typeof wrappedSolChange === "number" && Math.abs(wrappedSolChange) > 0.000000001 ? wrappedSolChange - feeSol : solChange;
    const tradedTokens = tokenChanges.filter((item) => item.mint !== WRAPPED_SOL_MINT);
    const blockTime = new Date((signature.blockTime || Math.floor(Date.now() / 1000)) * 1000).toISOString();
    let transactionHasSwap = false;
    let transactionHasTransfer = false;
    tradedTokens.forEach((token, eventIndex) => {
      const direction: ParsedEvent["direction"] = token.change > 0 && quoteChange < 0 ? "buy" : token.change < 0 && quoteChange > 0 ? "sell" : "transfer";
      transactionHasSwap ||= direction === "buy" || direction === "sell";
      transactionHasTransfer ||= direction === "transfer";
      events.push({ signature: signature.signature, event_index: eventIndex, block_time: blockTime, mint: token.mint, direction, sol_change: direction === "buy" || direction === "sell" ? effectiveSolChange : solChange, token_change: token.change, fee_sol: feeSol, source: "rpc", raw: { classification: direction, usedWrappedSol: typeof wrappedSolChange === "number" } });
    });
    if (transactionHasSwap) swapTransactions += 1;
    else if (transactionHasTransfer || Math.abs(solChange) > 0.000000001) transferTransactions += 1;
    else {
      unclassifiedTransactions += 1;
      events.push({ signature: signature.signature, event_index: 9999, block_time: blockTime, mint: "", direction: "unknown", sol_change: solChange, token_change: 0, fee_sol: feeSol, source: "rpc", raw: { classification: "unclassified" } });
    }
  });

  if (missingTransactions > 0) throw new Error(`${missingTransactions} transaction${missingTransactions === 1 ? " was" : "s were"} not returned by the provider. Nothing was skipped and the sync cursor was not advanced.`);

  const snapshots = await tokenSnapshots(events.map((event) => event.mint));
  for (const event of events) {
    const token = snapshots.get(event.mint);
    if (token) event.raw = { ...(event.raw as Record<string, Json | undefined>), token, marketCapSnapshotAt: new Date().toISOString() };
  }

  if (events.length) {
    const rows = events.map((event) => ({ ...event, user_id: userId, wallet_link_id: link.id }));
    const { error } = await admin().from("wallet_events").upsert(rows, { onConflict: "wallet_link_id,signature,event_index", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }
  const newestSignature = signatures[0]?.signature || cursor;
  const { error: updateError } = await admin().from("wallet_links").update({ last_synced_signature: newestSignature, last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("user_id", userId).eq("id", link.id);
  if (updateError) throw new Error(updateError.message);
  return { checkedTransactions: signatures.length, swapTransactions, transferTransactions, unclassifiedTransactions, detectedEvents: events.filter((event) => event.direction === "buy" || event.direction === "sell").length, incremental: mode === "incremental" && Boolean(cursor), rescan: mode === "rescan", cursor: newestSignature };
}

export async function createVerificationChallenge(userId: string, linkId: string) {
  const link = await ownedLink(userId, linkId);
  const nonce = randomBytes(24).toString("base64url");
  const expires = new Date(Date.now() + 10 * 60_000);
  const challenge = `Memecoin Journal wallet verification\nAddress: ${link.address}\nNonce: ${nonce}\nExpires: ${expires.toISOString()}`;
  const { error } = await admin().from("wallet_links").update({ verification_nonce: challenge, verification_expires_at: expires.toISOString(), updated_at: new Date().toISOString() }).eq("user_id", userId).eq("id", link.id);
  if (error) throw new Error(error.message);
  return { address: link.address, challenge };
}

export async function confirmWalletOwnership(userId: string, linkId: string, signature: string) {
  const { data, error } = await admin().from("wallet_links").select("address,verification_nonce,verification_expires_at").eq("user_id", userId).eq("id", linkId).single();
  if (error || !data?.verification_nonce || !data.verification_expires_at) throw new Error("Request a fresh verification challenge.");
  if (Date.parse(data.verification_expires_at) < Date.now()) throw new Error("The verification challenge expired.");
  let verified = false;
  try {
    verified = nacl.sign.detached.verify(new TextEncoder().encode(data.verification_nonce), bs58.decode(signature), bs58.decode(data.address));
  } catch {
    verified = false;
  }
  if (!verified) throw new Error("The wallet signature could not be verified.");
  const { error: updateError } = await admin().from("wallet_links").update({ verified_at: new Date().toISOString(), verification_nonce: null, verification_expires_at: null, updated_at: new Date().toISOString() }).eq("user_id", userId).eq("id", linkId);
  if (updateError) throw new Error(updateError.message);
}

export async function ingestWebhookEvents(input: Array<{ address: string; signature: string; blockTime: number; mint: string; direction: string; solChange?: number; tokenChange?: number; feeSol?: number; eventIndex?: number }>) {
  let stored = 0;
  for (const event of input.slice(0, 100)) {
    if (!SOLANA_ADDRESS_PATTERN.test(event.address) || !SOLANA_ADDRESS_PATTERN.test(event.mint) || !/^[1-9A-HJ-NP-Za-km-z]{64,128}$/.test(event.signature)) continue;
    const { data: links, error } = await admin().from("wallet_links").select("id,user_id").eq("address", event.address);
    if (error) throw new Error(error.message);
    for (const link of links || []) {
      const direction = ["buy", "sell", "transfer", "unknown"].includes(event.direction) ? event.direction : "unknown";
      const { error: insertError } = await admin().from("wallet_events").upsert({ user_id: link.user_id, wallet_link_id: link.id, signature: event.signature, event_index: Number.isInteger(event.eventIndex) ? event.eventIndex : 0, block_time: new Date(event.blockTime).toISOString(), mint: event.mint, direction, sol_change: Number(event.solChange) || 0, token_change: Number(event.tokenChange) || 0, fee_sol: Math.max(0, Number(event.feeSol) || 0), source: "webhook", raw: {} }, { onConflict: "wallet_link_id,signature,event_index", ignoreDuplicates: true });
      if (insertError) throw new Error(insertError.message);
      stored += 1;
    }
  }
  return stored;
}
