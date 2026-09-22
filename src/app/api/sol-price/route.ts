import { NextResponse } from "next/server";

let cachedPrice: { price: number; change24h: number; timestamp: number } | null = null;
const CACHE_DURATION_MS = 60 * 1000; // 1 minute cache

export async function GET() {
  const now = Date.now();

  if (cachedPrice && now - cachedPrice.timestamp < CACHE_DURATION_MS) {
    return NextResponse.json(cachedPrice);
  }

  try {
    // Try CoinGecko free simple price API
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true",
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 60 },
      }
    );

    if (response.ok) {
      const data = await response.json();
      if (data?.solana?.usd) {
        cachedPrice = {
          price: data.solana.usd,
          change24h: data.solana.usd_24h_change || 0,
          timestamp: now,
        };
        return NextResponse.json(cachedPrice);
      }
    }
  } catch (err) {
    console.error("CoinGecko fetch failed, trying Jupiter fallback:", err);
  }

  try {
    // Fallback: Jupiter Price API
    const jupRes = await fetch("https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112", {
      next: { revalidate: 60 },
    });
    if (jupRes.ok) {
      const jupData = await jupRes.json();
      const solObj = jupData?.data?.["So11111111111111111111111111111111111111112"];
      if (solObj && solObj.price) {
        const p = parseFloat(solObj.price);
        cachedPrice = {
          price: p,
          change24h: 0,
          timestamp: now,
        };
        return NextResponse.json(cachedPrice);
      }
    }
  } catch (err) {
    console.error("Jupiter fallback failed:", err);
  }

  // If all fails, fallback to 150
  return NextResponse.json(
    cachedPrice || {
      price: 150.0,
      change24h: 0,
      timestamp: now,
    }
  );
}
