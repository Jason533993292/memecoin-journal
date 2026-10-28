import { NextResponse } from "next/server";
import { MARKET_ASSETS, isMarketAssetSymbol, type MarketAssetSymbol } from "@/lib/marketAssets";
import { allowPriceRequest } from "@/lib/publicRateLimit";

type Price = { price: number; change24h: number; timestamp: number };
type PriceResult = { value: Price; status: "live" | "stale" } | { error: string };

const CACHE_DURATION_MS = 60 * 1000;
const cachedPrices = new Map<MarketAssetSymbol, Price>();
const pendingRequests = new Map<MarketAssetSymbol, Promise<PriceResult>>();

function clientIdentifier(request: Request) {
  return request.headers.get("x-real-ip")?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
}

const responseHeaders = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
};

async function fetchFreshPrice(symbol: MarketAssetSymbol): Promise<PriceResult> {
  const now = Date.now();
  const allCoinGeckoIds = Object.values(MARKET_ASSETS).map((item) => item.coinGeckoId).join(",");

  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${allCoinGeckoIds}&vs_currencies=usd&include_24hr_change=true`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 60 },
        signal: AbortSignal.timeout(3_000),
      }
    );
    if (response.ok) {
      const data = await response.json();
      for (const [assetSymbol, marketAsset] of Object.entries(MARKET_ASSETS) as [MarketAssetSymbol, typeof MARKET_ASSETS[MarketAssetSymbol]][]) {
        const price = data?.[marketAsset.coinGeckoId]?.usd;
        const change24h = data?.[marketAsset.coinGeckoId]?.usd_24h_change;
        if (typeof price === "number" && Number.isFinite(price) && price > 0) {
          cachedPrices.set(assetSymbol, {
            price,
            change24h: typeof change24h === "number" && Number.isFinite(change24h) ? change24h : 0,
            timestamp: now,
          });
        }
      }
      const requestedPrice = cachedPrices.get(symbol);
      if (requestedPrice?.timestamp === now) return { status: "live", value: requestedPrice };
    }
  } catch (error) {
    console.error(`${symbol} CoinGecko fetch failed, trying fallback:`, error);
  }

  try {
    const response = await fetch(
      `https://min-api.cryptocompare.com/data/price?fsym=${symbol}&tsyms=USD`,
      { signal: AbortSignal.timeout(3_000), headers: { Accept: "application/json" } }
    );
    if (response.ok) {
      const data = await response.json();
      const price = data?.USD;
      if (typeof price === "number" && Number.isFinite(price) && price > 0) {
        return { status: "live", value: { price, change24h: 0, timestamp: now } };
      }
    }
  } catch (error) {
    console.error(`${symbol} fallback price fetch failed:`, error);
  }

  const cached = cachedPrices.get(symbol);
  if (cached) return { status: "stale", value: cached };
  return { error: `Live ${symbol} price is temporarily unavailable.` };
}

export async function GET(request: Request) {
  if (!allowPriceRequest(clientIdentifier(request))) {
    return NextResponse.json(
      { error: "Too many price requests. Please wait a moment and retry." },
      { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "60" } }
    );
  }

  const requestedAsset = new URL(request.url).searchParams.get("asset")?.toUpperCase() ?? "SOL";
  if (!isMarketAssetSymbol(requestedAsset)) {
    return NextResponse.json(
      { error: "Unsupported asset. Choose SOL, ETH, or BNB." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const now = Date.now();
  const cached = cachedPrices.get(requestedAsset);
  if (cached && now - cached.timestamp < CACHE_DURATION_MS) {
    return NextResponse.json(
      { ...cached, asset: requestedAsset, name: MARKET_ASSETS[requestedAsset].name, status: "cached", ageMs: now - cached.timestamp },
      { headers: responseHeaders }
    );
  }

  let pending = pendingRequests.get(requestedAsset);
  if (!pending) {
    pending = fetchFreshPrice(requestedAsset).finally(() => pendingRequests.delete(requestedAsset));
    pendingRequests.set(requestedAsset, pending);
  }
  const result = await pending;
  if ("value" in result) {
    cachedPrices.set(requestedAsset, result.value);
    return NextResponse.json(
      { ...result.value, asset: requestedAsset, name: MARKET_ASSETS[requestedAsset].name, status: result.status, ageMs: Math.max(0, Date.now() - result.value.timestamp) },
      { headers: result.status === "live" ? responseHeaders : { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    { error: result.error },
    { status: 503, headers: { "Cache-Control": "no-store" } }
  );
}
