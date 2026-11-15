import { NextResponse } from "next/server";
import {
  consumeUserRateLimits,
  FirebaseAdminConfigurationError,
  readBoundedJson,
  verifyFirebaseUser,
} from "../../../lib/firebase-admin";

export const maxDuration = 20;

const RPC_URLS = ["https://api.mainnet-beta.solana.com", "https://rpc.ankr.com/solana"];

type RpcTokenBalance = { mint?: string; owner?: string; uiTokenAmount?: { uiAmount?: number | null; uiAmountString?: string } };

async function rpc(body: unknown) {
  for (const url of RPC_URLS) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(6_000),
      });
      if (response.ok) return response.json();
    } catch {
      // Try the next public endpoint.
    }
  }
  throw new Error("Solana RPC providers are unavailable.");
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

async function tokenPrices(mints: string[]) {
  if (!mints.length) return new Map<string, { symbol: string; name: string; priceUsd: number }>();
  try {
    const response = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${mints.slice(0, 30).join(",")}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return new Map();
    const pairs = await response.json() as Array<{ baseToken?: { address?: string; symbol?: string; name?: string }; priceUsd?: string; liquidity?: { usd?: number } }>;
    const best = new Map<string, { symbol: string; name: string; priceUsd: number; liquidity: number }>();
    for (const pair of Array.isArray(pairs) ? pairs : []) {
      const mint = pair.baseToken?.address;
      const priceUsd = Number(pair.priceUsd);
      if (!mint || !Number.isFinite(priceUsd) || priceUsd < 0) continue;
      const next = { symbol: pair.baseToken?.symbol || "TOKEN", name: pair.baseToken?.name || "Solana token", priceUsd, liquidity: Number(pair.liquidity?.usd) || 0 };
      if (!best.has(mint) || next.liquidity > (best.get(mint)?.liquidity || 0)) best.set(mint, next);
    }
    return new Map([...best].map(([mint, value]) => [mint, { symbol: value.symbol, name: value.name, priceUsd: value.priceUsd }]));
  } catch {
    return new Map();
  }
}

export async function POST(request: Request) {
  let user;
  try { user = await verifyFirebaseUser(request); }
  catch (error) {
    return NextResponse.json({ error: error instanceof FirebaseAdminConfigurationError ? "Wallet import is temporarily unavailable." : "Sign in again to import wallet activity." }, { status: error instanceof FirebaseAdminConfigurationError ? 503 : 401 });
  }
  if (!user) return NextResponse.json({ error: "Sign in to import wallet activity." }, { status: 401 });

  const parsed = await readBoundedJson(request, 2_000);
  const address = "data" in parsed && parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data) && "address" in parsed.data && typeof parsed.data.address === "string"
    ? parsed.data.address.trim()
    : "";
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return NextResponse.json({ error: "Enter a valid Solana wallet address." }, { status: 400 });

  try {
    const allowed = await consumeUserRateLimits(user.uid, "wallet-activity", [{ key: "minute", limit: 5, durationMs: 60_000 }, { key: "day", limit: 50, durationMs: 86_400_000 }]);
    if (!allowed) return NextResponse.json({ error: "Too many wallet imports. Wait a minute and try again." }, { status: 429 });
  } catch { return NextResponse.json({ error: "Wallet import is temporarily unavailable." }, { status: 503 }); }

  try {
    const [signatureResult, accountResult] = await Promise.all([
      rpc({ jsonrpc: "2.0", id: 1, method: "getSignaturesForAddress", params: [address, { limit: 40 }] }),
      rpc({ jsonrpc: "2.0", id: 2, method: "getTokenAccountsByOwner", params: [address, { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }, { encoding: "jsonParsed" }] }),
    ]);
    const signatures = Array.isArray(signatureResult?.result) ? signatureResult.result.filter((item: { err?: unknown; signature?: string }) => !item.err && item.signature).slice(0, 40) : [];
    const transactionBatch = signatures.map((item: { signature: string }, index: number) => ({ jsonrpc: "2.0", id: index + 10, method: "getTransaction", params: [item.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }] }));
    const transactionResults = transactionBatch.length ? await rpc(transactionBatch) : [];
    const byId = new Map((Array.isArray(transactionResults) ? transactionResults : []).map((item: { id?: number; result?: unknown }) => [item.id, item.result]));

    const activities = signatures.flatMap((signature: { signature: string; blockTime?: number }, index: number) => {
      const tx = byId.get(index + 10) as { meta?: { fee?: number; preBalances?: number[]; postBalances?: number[]; preTokenBalances?: RpcTokenBalance[]; postTokenBalances?: RpcTokenBalance[] }; transaction?: { message?: { accountKeys?: Array<string | { pubkey?: string }> } } } | null;
      if (!tx?.meta) return [];
      const keys = tx.transaction?.message?.accountKeys || [];
      const ownerIndex = keys.findIndex((key) => (typeof key === "string" ? key : key.pubkey) === address);
      const solChange = ownerIndex >= 0 ? ((tx.meta.postBalances?.[ownerIndex] || 0) - (tx.meta.preBalances?.[ownerIndex] || 0)) / 1e9 : 0;
      const before = ownedTokenMap(tx.meta.preTokenBalances, address);
      const after = ownedTokenMap(tx.meta.postTokenBalances, address);
      const tokenChanges = [...new Set([...before.keys(), ...after.keys()])].map((mint) => ({ mint, change: (after.get(mint) || 0) - (before.get(mint) || 0) })).filter((item) => Math.abs(item.change) > 0.000000001);
      if (!tokenChanges.length && Math.abs(solChange) < 0.000000001) return [];
      return [{ signature: signature.signature, blockTime: (signature.blockTime || 0) * 1000, feeSol: (tx.meta.fee || 0) / 1e9, solChange, tokenChanges }];
    });

    const holdings = (Array.isArray(accountResult?.result?.value) ? accountResult.result.value : []).flatMap((entry: { account?: { data?: { parsed?: { info?: { mint?: string; tokenAmount?: { uiAmount?: number | null; uiAmountString?: string } } } } } }) => {
      const info = entry.account?.data?.parsed?.info;
      const amount = info?.tokenAmount?.uiAmount ?? Number(info?.tokenAmount?.uiAmountString || 0);
      return info?.mint && Number(amount) > 0 ? [{ mint: info.mint, amount: Number(amount) }] : [];
    }).sort((a: { amount: number }, b: { amount: number }) => b.amount - a.amount).slice(0, 30);
    const prices = await tokenPrices(holdings.map((item: { mint: string }) => item.mint));
    const valuedHoldings = holdings.map((holding: { mint: string; amount: number }) => {
      const price = prices.get(holding.mint);
      return { ...holding, symbol: price?.symbol || "TOKEN", name: price?.name || "Solana token", priceUsd: price?.priceUsd ?? null, valueUsd: price ? holding.amount * price.priceUsd : null };
    });
    return NextResponse.json({ address, activities, holdings: valuedHoldings }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Recent wallet activity could not be read from Solana right now." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
