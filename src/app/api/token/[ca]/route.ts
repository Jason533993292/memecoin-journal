import { lookupPublicTokenPair, type DexTokenPair } from "../../../../lib/tokenMarketData";

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
  _request: Request,
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
