import { lookupPublicTokenPair, type DexTokenPair } from "../../../../lib/tokenMarketData";
import {
  consumeUserRateLimits,
  FirebaseAdminConfigurationError,
  verifyFirebaseUser,
} from "../../../../lib/firebase-admin";

export const maxDuration = 15;

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

function tokenResponse(pair: DexTokenPair) {
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
    return Response.json(
      { error: "Enter a valid Solana token address (32–44 base58 characters)." },
      { status: 400 }
    );
  }

  let user;
  try {
    user = await verifyFirebaseUser(request);
  } catch (error) {
    const configurationError = error instanceof FirebaseAdminConfigurationError;
    return Response.json(
      {
        error: configurationError
          ? "Token lookup is temporarily unavailable."
          : "Your sign-in has expired. Sign in again and retry.",
      },
      {
        status: configurationError ? 503 : 401,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
  if (!user) {
    return Response.json(
      { error: "Sign in to look up token details." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const allowed = await consumeUserRateLimits(user.uid, "token-lookup", [
      { key: "minute", limit: 30, durationMs: 60_000 },
      { key: "day", limit: 1_000, durationMs: 86_400_000 },
    ]);
    if (!allowed) {
      return Response.json(
        { error: "Too many token lookups. Please wait before trying again." },
        { status: 429, headers: { "Cache-Control": "no-store" } }
      );
    }
  } catch {
    return Response.json(
      { error: "Token lookup is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const dexPair = await lookupPublicTokenPair(cleanCa);
    if (dexPair?.baseToken) return Response.json(tokenResponse(dexPair));

    const jupiter = await fetchJson(
      "https://api.jup.ag/price/v2?ids=" + encodeURIComponent(cleanCa)
    );
    const tokenPrice =
      jupiter && typeof jupiter === "object" && "data" in jupiter && jupiter.data &&
      typeof jupiter.data === "object"
        ? (jupiter.data as Record<string, { price?: unknown }>)[cleanCa]?.price
        : undefined;
    if (tokenPrice !== undefined) {
      return Response.json({
        name: "Solana Token",
        symbol: "SOL-TOKEN",
        priceUsd: String(finiteNumber(tokenPrice)),
        marketCap: 0,
        liquidity: 0,
        chainId: "solana",
        imageUrl: null,
      });
    }

    return Response.json({ error: "Token not found on supported market-data services." }, { status: 404 });
  } catch (error) {
    console.warn("Token metadata lookup failed", {
      reason: error instanceof Error ? error.name : "unknown",
    });
    return Response.json(
      { error: "Token lookup timed out or the market-data services are unavailable." },
      { status: 502 }
    );
  }
}
