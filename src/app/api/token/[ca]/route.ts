import { NextResponse } from "next/server";
import {
  consumeUserRateLimits,
  FirebaseAdminConfigurationError,
  verifyFirebaseUser,
} from "../../../../lib/firebase-admin";

export const maxDuration = 15;

type Pair = {
  baseToken?: { name?: unknown; symbol?: unknown };
  priceUsd?: unknown;
  marketCap?: unknown;
  fdv?: unknown;
  liquidity?: { usd?: unknown };
  chainId?: unknown;
  dexId?: unknown;
  url?: unknown;
  info?: { imageUrl?: unknown };
};

function finiteNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function safeText(value: unknown, fallback: string, maxLength: number) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : fallback;
}

function safeHttpsUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function tokenResponse(pair: Pair) {
  return {
    name: safeText(pair.baseToken?.name, "Unknown Token", 120),
    symbol: safeText(pair.baseToken?.symbol, "MEME", 40),
    priceUsd: String(finiteNumber(pair.priceUsd)),
    marketCap: finiteNumber(pair.marketCap) || finiteNumber(pair.fdv),
    liquidity: finiteNumber(pair.liquidity?.usd),
    chainId: safeText(pair.chainId, "solana", 40),
    dexId: safeText(pair.dexId, "", 80),
    url: safeHttpsUrl(pair.url),
    imageUrl: safeHttpsUrl(pair.info?.imageUrl),
  };
}

async function fetchJson(url: string, revalidate = 30): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate },
    signal: AbortSignal.timeout(2_500),
  });
  if (!response.ok) return null;
  return response.json();
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ca: string }> }
) {
  const { ca } = await params;
  const cleanCa = ca?.trim();
  if (!cleanCa || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(cleanCa)) {
    return NextResponse.json(
      { error: "Enter a valid Solana token address (32–44 base58 characters)." },
      { status: 400 }
    );
  }

  let user;
  try {
    user = await verifyFirebaseUser(request);
  } catch (error) {
    const configError = error instanceof FirebaseAdminConfigurationError;
    return NextResponse.json(
      { error: configError ? "Token lookup is temporarily unavailable." : "Sign in to look up tokens." },
      { status: configError ? 503 : 401 }
    );
  }
  if (!user) {
    return NextResponse.json({ error: "Sign in to look up tokens." }, { status: 401 });
  }

  try {
    const allowed = await consumeUserRateLimits(user.uid, "token-lookup", [
      { key: "minute", limit: 60, durationMs: 60_000 },
      { key: "day", limit: 1000, durationMs: 86_400_000 },
    ]);
    if (!allowed) {
      return NextResponse.json({ error: "Too many lookups. Please wait before trying again." }, { status: 429 });
    }
  } catch {
    return NextResponse.json({ error: "Token lookup is temporarily unavailable." }, { status: 503 });
  }

  try {
    const latest = await fetchJson(
      "https://api.dexscreener.com/latest/dex/tokens/" + encodeURIComponent(cleanCa)
    );
    const latestPairs =
      latest && typeof latest === "object" && "pairs" in latest && Array.isArray(latest.pairs)
        ? (latest.pairs as Pair[])
        : [];
    const bestLatest = latestPairs
      .slice(0, 100)
      .sort((first, second) => finiteNumber(second.liquidity?.usd) - finiteNumber(first.liquidity?.usd))[0];
    if (bestLatest?.baseToken) return NextResponse.json(tokenResponse(bestLatest));

    const v1 = await fetchJson(
      "https://api.dexscreener.com/tokens/v1/solana/" + encodeURIComponent(cleanCa)
    );
    const v1Pairs = Array.isArray(v1) ? (v1 as Pair[]) : [];
    const bestV1 = v1Pairs
      .slice(0, 100)
      .sort((first, second) => finiteNumber(second.liquidity?.usd) - finiteNumber(first.liquidity?.usd))[0];
    if (bestV1?.baseToken) return NextResponse.json(tokenResponse(bestV1));

    const jupiter = await fetchJson(
      "https://api.jup.ag/price/v2?ids=" + encodeURIComponent(cleanCa)
    );
    const tokenPrice =
      jupiter && typeof jupiter === "object" && "data" in jupiter && jupiter.data &&
      typeof jupiter.data === "object"
        ? (jupiter.data as Record<string, { price?: unknown }>)[cleanCa]?.price
        : undefined;
    if (tokenPrice !== undefined) {
      return NextResponse.json({
        name: "Solana Token",
        symbol: "SOL-TOKEN",
        priceUsd: String(finiteNumber(tokenPrice)),
        marketCap: 0,
        liquidity: 0,
        chainId: "solana",
        imageUrl: null,
      });
    }

    return NextResponse.json({ error: "Token not found on supported market-data services." }, { status: 404 });
  } catch (error) {
    console.warn("Token metadata lookup failed", {
      reason: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      { error: "Token lookup timed out or the market-data services are unavailable." },
      { status: 502 }
    );
  }
}
