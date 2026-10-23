import { NextResponse } from "next/server";
import { allowPriceRequest } from "@/lib/publicRateLimit";

let cachedPrice: { price: number; change24h: number; timestamp: number } | null = null;
let pendingPriceRequest: Promise<PriceResult> | null = null;
const CACHE_DURATION_MS = 60 * 1000; // 1 minute cache
type Price = { price: number; change24h: number; timestamp: number };
type PriceResult = { value: Price; status: "live" | "stale" } | { error: string };

function clientIdentifier(request: Request) {
  return request.headers.get("x-real-ip")?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
}

const responseHeaders = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
};

async function fetchFreshPrice(): Promise<PriceResult> {
  const now = Date.now();

  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true",
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 60 },
        signal: AbortSignal.timeout(3_000),
      }
    );

    if (response.ok) {
      const data = await response.json();
      if (typeof data?.solana?.usd === "number" && Number.isFinite(data.solana.usd) && data.solana.usd > 0) {
        return {
          status: "live",
          value: {
            price: data.solana.usd,
            change24h: typeof data.solana.usd_24h_change === "number" && Number.isFinite(data.solana.usd_24h_change)
              ? data.solana.usd_24h_change
              : 0,
            timestamp: now,
          },
        };
      }
    }
  } catch (err) {
    console.error("CoinGecko fetch failed, trying Jupiter fallback:", err);
  }

  try {
    const jupRes = await fetch("https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112", {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(3_000),
    });
    if (jupRes.ok) {
      const jupData = await jupRes.json();
      const rawPrice = jupData?.data?.["So11111111111111111111111111111111111111112"]?.price;
      const price = typeof rawPrice === "number" ? rawPrice : Number(rawPrice);
      if (Number.isFinite(price) && price > 0) {
        return { status: "live", value: { price, change24h: 0, timestamp: now } };
      }
    }
  } catch (err) {
    console.error("Jupiter fallback failed:", err);
  }

  if (cachedPrice) return { status: "stale", value: cachedPrice };
  return { error: "Live SOL price is temporarily unavailable." };
}

export async function GET(request: Request) {
  const now = Date.now();

  if (!allowPriceRequest(clientIdentifier(request), { now })) {
    return NextResponse.json(
      { error: "Too many price requests. Please wait a moment and retry." },
      { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "60" } }
    );
  }

  if (cachedPrice && now - cachedPrice.timestamp < CACHE_DURATION_MS) {
    return NextResponse.json(
      { ...cachedPrice, status: "cached", ageMs: now - cachedPrice.timestamp },
      { headers: responseHeaders }
    );
  }

  pendingPriceRequest ??= fetchFreshPrice().finally(() => {
    pendingPriceRequest = null;
  });
  const result = await pendingPriceRequest;
  if ("value" in result) {
    cachedPrice = result.value;
    return NextResponse.json(
      { ...result.value, status: result.status, ageMs: Math.max(0, Date.now() - result.value.timestamp) },
      { headers: result.status === "live" ? responseHeaders : { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    { error: result.error },
    { status: 503, headers: { "Cache-Control": "no-store" } }
  );
}
