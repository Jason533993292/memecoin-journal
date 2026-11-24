import { randomBytes } from "node:crypto";
import bs58 from "bs58";
import nacl from "tweetnacl";
import type { Json } from "@/lib/database.types";
import { nextSyncCursor, planSignatureWindow, SYNC_BATCH_LIMIT, type SignatureRow, type SignatureWindow } from "./walletSyncWindow";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const SOLANA_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const HELIUS_RPC_URL = process.env.HELIUS_API_KEY?.trim() ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY.trim()}` : "";
const PRIVATE_RPC_URLS = [process.env.SOLANA_RPC_URL?.trim(), HELIUS_RPC_URL].filter(Boolean) as string[];
const RPC_URLS = PRIVATE_RPC_URLS.length ? PRIVATE_RPC_URLS : ["https://api.mainnet-beta.solana.com", "https://rpc.ankr.com/solana"];
const SYSTEM_PROGRAM_ID = "11111111111111111111111111111111";
const TOKEN_PROGRAM_IDS = new Set(["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"]);
const WRAPPED_SOL_MINT = "So11111111111111111111111111111111111111112";
const TRANSACTION_BATCH_SIZE = 5;
const TRANSACTION_BATCH_DELAY_MS = 650;
const TRANSACTION_RETRY_DELAY_MS = 175;
const TRANSACTION_FETCH_DEADLINE_MS = 22_000;
const SIGNATURE_PAGE_LIMIT = 30;
const SIGNATURE_PAGE_DELAY_MS = 200;

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

function usableRpcPayload(payload: unknown) {
  if (Array.isArray(payload)) return true;
  return Boolean(payload && typeof payload === "object" && !("error" in payload));
}

async function rpc(body: unknown, isUsable: (payload: unknown) => boolean = usableRpcPayload, options: { attempts?: number; timeoutMs?: number; deadline?: number } = {}) {
  const attempts = options.attempts ?? 3;
  const timeoutMs = options.timeoutMs ?? 8_000;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    for (const url of RPC_URLS) {
      if (options.deadline && Date.now() >= options.deadline) throw new Error("The wallet scan reached its safe time limit.");
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          cache: "no-store",
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!response.ok) continue;
        const payload = await response.json();
        if (!isUsable(payload)) continue;
        return payload;
      } catch {
        // Try the next configured provider, then retry with backoff.
      }
    }
    if (attempt < attempts - 1) await wait(350 * (2 ** attempt));
  }
  throw new Error("Solana data providers are temporarily unavailable. Wait a moment or configure a private RPC provider.");
}

async function indexedSignatureWindow(address: string, cursor: string): Promise<SignatureWindow | null> {
  if (!HELIUS_RPC_URL) return null;
  try {
    const response = await fetch(HELIUS_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTransactionsForAddress",
        params: [address, {
          transactionDetails: "signatures",
          limit: SYNC_BATCH_LIMIT + 1,
          sortOrder: "asc",
          filters: {
            status: "succeeded",
            signature: { gt: cursor },
            tokenAccounts: "all",
          },
        }],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    const payload = await response.json() as { result?: { data?: SignatureRow[] }; error?: unknown };
    if (payload.error || !Array.isArray(payload.result?.data)) return null;
    const rows = payload.result.data.filter((row): row is SignatureRow & { signature: string } => Boolean(row.signature));
    const ordered = rows.slice(0, SYNC_BATCH_LIMIT).map((row) => ({ signature: row.signature, blockTime: row.blockTime }));
    return {
      ordered,
      windowEnd: ordered.at(-1)?.signature ?? null,
      failedTransactions: 0,
      hasMore: rows.length > SYNC_BATCH_LIMIT,
      skippedOlder: false,
    };
  } catch {
    // Fall back to standard Solana RPC. Its page limit still refuses to skip a large backlog.
    return null;
  }
}

async function fetchTransactions(signatures: Array<{ signature: string }>) {
  const transactions = new Map<number, unknown>();
  const requests = signatures.map((item, index) => ({ jsonrpc: "2.0", id: index + 10, method: "getTransaction", params: [item.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 1 }] }));
  const deadline = Date.now() + TRANSACTION_FETCH_DEADLINE_MS;

  // Small paced batches stay below provider burst limits. Null batch entries are
  // retried individually so a partial provider response never advances the cursor.
  for (let offset = 0; offset < requests.length; offset += TRANSACTION_BATCH_SIZE) {
    if (Date.now() >= deadline) break;
    const batch = requests.slice(offset, offset + TRANSACTION_BATCH_SIZE);
    try {
      const results = await rpc(batch, Array.isArray, { attempts: 2, timeoutMs: 4_000, deadline }) as Array<{ id?: number; result?: unknown }>;
      for (const result of results) {
        if (typeof result.id === "number" && result.result && typeof result.result === "object" && "meta" in result.result && result.result.meta) transactions.set(result.id, result.result);
      }
    } catch {
      // The unresolved signatures below receive targeted retries.
    }
    if (offset + TRANSACTION_BATCH_SIZE < requests.length) await wait(TRANSACTION_BATCH_DELAY_MS);
  }

  const unresolved = requests.filter((request) => !transactions.has(request.id));
  for (const request of unresolved) {
    if (Date.now() >= deadline) break;
    try {
      const payload = await rpc(
        request,
        (candidate) => Boolean(candidate && typeof candidate === "object" && !Array.isArray(candidate) && "result" in candidate && candidate.result && typeof candidate.result === "object" && "meta" in candidate.result && candidate.result.meta),
        { attempts: 2, timeoutMs: 4_000, deadline },
      ) as { result: unknown };
      transactions.set(request.id, payload.result);
    } catch {
      // Report any still-unresolved signature without advancing the sync cursor.
    }
    await wait(TRANSACTION_RETRY_DELAY_MS);
  }

  const missingIds = requests.filter((request) => !transactions.has(request.id)).map((request) => request.id);
  return { transactions, missingIds };
}

async function assertLikelyWalletAddress(address: string) {
  const payload = await rpc({ jsonrpc: "2.0", id: 2, method: "getAccountInfo", params: [address, { encoding: "jsonParsed" }] }) as { result?: { value?: { executable?: boolean; owner?: string } | null } };
  const account = payload.result?.value;
  if (!account) return;
  if (account.executable) throw new Error("This address belongs to an on-chain program, not a personal Solana wallet.");
  if (account.owner && account.owner !== SYSTEM_PROGRAM_ID) {
    const kind = TOKEN_PROGRAM_IDS.has(account.owner) ? "token mint or token account" : "program-owned account";
    throw new Error(`This address is a ${kind}, not a personal Solana wallet. Link the public address shown in your wallet app instead.`);
  }
}

async function successfulSignatures(address: string, cursor: string | null, mode: "incremental" | "rescan") {
  const incrementalWithCursor = Boolean(cursor) && mode === "incremental";
  if (incrementalWithCursor && cursor) {
    const indexed = await indexedSignatureWindow(address, cursor);
    if (indexed) return indexed;
  }
  const rows: SignatureRow[] = [];
  let before: string | undefined;
  let successfulSeen = 0;
  let pageLimitHit = false;

  // Active wallets can have a full page of failed attempts, so keep paging. An incremental sync
  // pages until it reaches the saved cursor so the batch can be taken oldest-first without gaps.
  // A first sync or rescan only needs the newest successful transactions.
  for (let page = 0; page < SIGNATURE_PAGE_LIMIT; page += 1) {
    const options: Record<string, unknown> = { limit: 100 };
    if (incrementalWithCursor && cursor) options.until = cursor;
    if (before) options.before = before;
    const payload = await rpc({ jsonrpc: "2.0", id: 1, method: "getSignaturesForAddress", params: [address, options] }) as { result?: SignatureRow[] };
    const pageRows = Array.isArray(payload.result) ? payload.result : [];
    for (const row of pageRows) {
      if (!row.signature) continue;
      rows.push(row);
      if (!row.err) successfulSeen += 1;
    }
    if (pageRows.length < 100) break;
    if (!incrementalWithCursor && successfulSeen >= 50) break;
    before = pageRows.at(-1)?.signature;
    if (!before) break;
    if (page === SIGNATURE_PAGE_LIMIT - 1) pageLimitHit = true;
    else await wait(SIGNATURE_PAGE_DELAY_MS);
  }

  if (incrementalWithCursor && pageLimitHit) {
    throw new Error("More than 3,000 new wallet transactions are waiting. The sync stopped without advancing its cursor so older activity is not skipped. Use an indexed wallet-history provider before continuing.");
  }

  return planSignatureWindow(rows, { incrementalWithCursor, pageLimitHit });
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

// Sample only the hour preceding each execution. Sparse or unavailable history stays blank.
async function enrichHistoricalCaps(events: ParsedEvent[]) {
  const groups = new Map<string, ParsedEvent[]>();
  for (const event of events) {
    if (!SOLANA_ADDRESS_PATTERN.test(event.mint) || !["buy", "sell"].includes(event.direction)) continue;
    const hour = Math.floor(Date.parse(event.block_time) / 3_600_000);
    const key = event.mint + ":" + hour;
    const group = groups.get(key);
    if (group) group.push(event);
    else if (groups.size < 4) groups.set(key, [event]);
  }
  await Promise.all([...groups.values()].map(async group => {
    const first = group[0];
    const hour = Math.floor(Date.parse(first.block_time) / 3_600_000) * 3600;
    try {
      const response = await fetch(`https://api.coingecko.com/api/v3/coins/solana/contract/${first.mint}/market_chart/range?vs_currency=usd&from=${hour - 3600}&to=${hour + 3600}`, { signal: AbortSignal.timeout(2200) });
      if (!response.ok) return;
      const { market_caps: samples } = await response.json();
      if (!Array.isArray(samples)) return;
      for (const event of group) {
        const time = Date.parse(event.block_time);
        const match = samples.filter(p => Array.isArray(p) && Number.isFinite(p[0]) && p[0] <= time && time - p[0] <= 3_600_000 && Number.isFinite(p[1]) && p[1] > 0).sort((a,b) => b[0]-a[0])[0];
        if (match) event.raw = { ...(event.raw as Record<string, Json>), executionMarketCapUsd: match[1], marketCapSampleAt: match[0] };
      }
    } catch { /* Market data is optional; a missing quote must not block a sync. */ }
  }));
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
      const marketCap = Number(pair.marketCap ?? NaN);
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
  await assertLikelyWalletAddress(cleanAddress);
  const { data, error } = await admin().from("wallet_links").upsert({ user_id: userId, address: cleanAddress, label: cleanLabel, updated_at: new Date().toISOString() }, { onConflict: "user_id,address" }).select("id,address,label,last_synced_signature,last_synced_at,verified_at,created_at,updated_at").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteWalletLink(userId: string, id: string) {
  const { error } = await admin().from("wallet_links").delete().eq("user_id", userId).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listWalletEvents(userId: string, status = "open") {
  const query = admin().from("wallet_events").select("id,wallet_link_id,signature,event_index,block_time,mint,direction,sol_change,token_change,fee_sol,status,source,raw,created_at,wallet_links(label,address)").eq("user_id", userId).order("block_time", { ascending: false }).limit(500);
  // "open" keeps dismissed events: a later sell needs the original buy to value the position.
  const { data, error } = status === "all" ? await query : status === "open" ? await query.in("status", ["needs_review", "ignored"]) : await query.eq("status", status);
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
  await assertLikelyWalletAddress(link.address);
  const cursor = link.last_synced_signature;
  const window = await successfulSignatures(link.address, cursor, mode);
  const { failedTransactions } = window;
  const signatures = window.ordered;
  const { transactions: byId } = await fetchTransactions(signatures);

  // Keep the contiguous prefix the provider returned. Everything before the first missing
  // transaction is saved and the cursor stops there, so the next update retries the gap.
  const firstMissing = signatures.findIndex((_, index) => !byId.has(index + 10));
  const usableCount = firstMissing === -1 ? signatures.length : firstMissing;
  if (firstMissing === 0) throw new Error("The provider did not return the transactions. Nothing was saved and the sync cursor was not advanced. Try again shortly.");
  const usable = signatures.slice(0, usableCount);
  const incomplete = usableCount < signatures.length;
  const events: ParsedEvent[] = [];
  let swapTransactions = 0;
  let transferTransactions = 0;
  let unclassifiedTransactions = 0;

  usable.forEach((signature: { signature: string; blockTime?: number }, signatureIndex: number) => {
    const tx = byId.get(signatureIndex + 10) as { meta?: { fee?: number; preBalances?: number[]; postBalances?: number[]; preTokenBalances?: RpcTokenBalance[]; postTokenBalances?: RpcTokenBalance[] }; transaction?: { message?: { accountKeys?: Array<string | { pubkey?: string }> } } } | null;
    if (!tx?.meta) return;
    const keys = tx.transaction?.message?.accountKeys || [];
    const ownerIndex = keys.findIndex((key) => (typeof key === "string" ? key : key.pubkey) === link.address);
    const feeSol = ownerIndex === 0 ? (tx.meta.fee || 0) / 1e9 : 0;
    const solChange = ownerIndex >= 0 ? ((tx.meta.postBalances?.[ownerIndex] || 0) - (tx.meta.preBalances?.[ownerIndex] || 0)) / 1e9 : 0;
    const before = ownedTokenMap(tx.meta.preTokenBalances, link.address);
    const after = ownedTokenMap(tx.meta.postTokenBalances, link.address);
    const tokenChanges = [...new Set([...before.keys(), ...after.keys()])].map((mint) => ({ mint, change: (after.get(mint) || 0) - (before.get(mint) || 0) })).filter((item) => Math.abs(item.change) > 0.000000001);
    const wrappedSolChange = tokenChanges.find((item) => item.mint === WRAPPED_SOL_MINT)?.change;
    const quoteChange = typeof wrappedSolChange === "number" && Math.abs(wrappedSolChange) > 0.000000001 ? wrappedSolChange : solChange + feeSol;
    const effectiveSolChange = typeof wrappedSolChange === "number" && Math.abs(wrappedSolChange) > 0.000000001 ? wrappedSolChange - feeSol : solChange;
    const tradedTokens = tokenChanges.filter((item) => item.mint !== WRAPPED_SOL_MINT);
    const blockTime = new Date((signature.blockTime || Math.floor(Date.now() / 1000)) * 1000).toISOString();
    let transactionHasSwap = false;
    let transactionHasTransfer = false;
    tradedTokens.forEach((token, eventIndex) => {
      const direction: ParsedEvent["direction"] = tradedTokens.length > 1 ? "unknown" : token.change > 0 && quoteChange < 0 ? "buy" : token.change < 0 && quoteChange > 0 ? "sell" : "transfer";
      transactionHasSwap ||= direction === "buy" || direction === "sell";
      transactionHasTransfer ||= direction === "transfer";
      events.push({ signature: signature.signature, event_index: eventIndex, block_time: blockTime, mint: token.mint, direction, sol_change: direction === "buy" || direction === "sell" ? effectiveSolChange : solChange, token_change: token.change, fee_sol: feeSol, source: "rpc", raw: { classification: direction, usedWrappedSol: typeof wrappedSolChange === "number" } });
    });
    if (transactionHasSwap) swapTransactions += 1;
    else if (transactionHasTransfer || (!tradedTokens.length && Math.abs(quoteChange) > 0.000000001)) transferTransactions += 1;
    else {
      unclassifiedTransactions += 1;
      events.push({ signature: signature.signature, event_index: 9999, block_time: blockTime, mint: "", direction: "unknown", sol_change: solChange, token_change: 0, fee_sol: feeSol, source: "rpc", raw: { classification: "unclassified" } });
    }
  });

  await enrichHistoricalCaps(events);
  const snapshots = await tokenSnapshots(events.map((event) => event.mint));
  for (const event of events) {
    const token = snapshots.get(event.mint);
    if (token) event.raw = { ...(event.raw as Record<string, Json | undefined>), token, marketCapSnapshotAt: new Date().toISOString() };
  }

  const signaturesInBatch = [...new Set(events.map((event) => event.signature))];
  type ExistingEvent = { signature: string; event_index: number; status: string; direction: string };
  const existing: ExistingEvent[] = [];
  for (let offset = 0; offset < signaturesInBatch.length; offset += 25) {
    const { data, error } = await admin().from("wallet_events").select("signature,event_index,status,direction").eq("wallet_link_id", link.id).in("signature", signaturesInBatch.slice(offset, offset + 25));
    if (error) throw new Error(error.message);
    existing.push(...((data || []) as ExistingEvent[]));
  }
  const eventKey = (signature: string, index: number) => `${signature}:${index}`;
  const existingKeys = new Set(existing.map((row) => eventKey(row.signature, row.event_index)));
  const importedSignatures = new Set(existing.filter((row) => row.status === "imported").map((row) => row.signature));
  const newEvents = events.filter((event) => !importedSignatures.has(event.signature) && !existingKeys.has(eventKey(event.signature, event.event_index))).length;

  // Rows already in the journal are never touched. Every other row is refreshed, so a rescan
  // can reclassify earlier "unknown" activity. The payload omits `status` on purpose: an upsert
  // only updates the columns it sends, so a dismissed or pending decision is preserved.
  const now = new Date().toISOString();
  const rows = events.filter((event) => !importedSignatures.has(event.signature)).map((event) => ({ ...event, user_id: userId, wallet_link_id: link.id, updated_at: now }));
  if (rows.length) {
    const { error } = await admin().from("wallet_events").upsert(rows, { onConflict: "wallet_link_id,signature,event_index", defaultToNull: false });
    if (error) throw new Error(error.message);
  }

  // A transaction that is now understood no longer needs its "unknown" placeholder row.
  const classifiedSignatures = new Set(events.filter((event) => event.direction !== "unknown").map((event) => event.signature));
  const staleUnknown = existing.filter((row) => row.direction === "unknown" && row.event_index === 9999 && row.status !== "imported" && classifiedSignatures.has(row.signature)).map((row) => row.signature);
  if (staleUnknown.length) {
    const { error } = await admin().from("wallet_events").delete().eq("wallet_link_id", link.id).eq("event_index", 9999).eq("direction", "unknown").neq("status", "imported").in("signature", staleUnknown);
    if (error) throw new Error(error.message);
  }

  const nextCursor = nextSyncCursor({ previousCursor: cursor, mode, window, usableCount });
  const { error: updateError } = await admin().from("wallet_links").update({ last_synced_signature: nextCursor, last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("user_id", userId).eq("id", link.id);
  if (updateError) throw new Error(updateError.message);
  return {
    checkedTransactions: usable.length,
    failedTransactions,
    swapTransactions,
    transferTransactions,
    unclassifiedTransactions,
    detectedEvents: events.filter((event) => event.direction === "buy" || event.direction === "sell").length,
    newEvents,
    hasMore: window.hasMore || incomplete,
    incomplete,
    skippedOlder: window.skippedOlder,
    incremental: mode === "incremental" && Boolean(cursor),
    rescan: mode === "rescan",
    cursor: nextCursor,
  };
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

export async function ingestWebhookEvents(input: Array<{ address: string; signature: string; blockTime: number; mint: string; direction: string; solChange?: number; tokenChange?: number; feeSol?: number; executionMarketCapUsd?: number; eventIndex?: number }>) {
  let stored = 0;
  for (const event of input.slice(0, 100)) {
    if (!SOLANA_ADDRESS_PATTERN.test(event.address) || !SOLANA_ADDRESS_PATTERN.test(event.mint) || !/^[1-9A-HJ-NP-Za-km-z]{64,128}$/.test(event.signature)) continue;
    const { data: links, error } = await admin().from("wallet_links").select("id,user_id").eq("address", event.address);
    if (error) throw new Error(error.message);
    for (const link of links || []) {
      const direction = ["buy", "sell", "transfer", "unknown"].includes(event.direction) ? event.direction : "unknown";
      const { error: insertError } = await admin().from("wallet_events").upsert({ user_id: link.user_id, wallet_link_id: link.id, signature: event.signature, event_index: Number.isInteger(event.eventIndex) ? event.eventIndex : 0, block_time: new Date(event.blockTime).toISOString(), mint: event.mint, direction, sol_change: Number(event.solChange) || 0, token_change: Number(event.tokenChange) || 0, fee_sol: Math.max(0, Number(event.feeSol) || 0), source: "webhook", raw: typeof event.executionMarketCapUsd === "number" && Number.isFinite(event.executionMarketCapUsd) && event.executionMarketCapUsd > 0 ? { executionMarketCapUsd: event.executionMarketCapUsd } : {} }, { onConflict: "wallet_link_id,signature,event_index", ignoreDuplicates: true });
      if (insertError) throw new Error(insertError.message);
      stored += 1;
    }
  }
  return stored;
}
