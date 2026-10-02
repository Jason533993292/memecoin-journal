export interface DexTokenPair {
  chainId?: unknown;
  baseToken?: { address?: unknown; name?: unknown; symbol?: unknown };
  priceUsd?: unknown;
  marketCap?: unknown;
  fdv?: unknown;
  liquidity?: { usd?: unknown };
  info?: { imageUrl?: unknown };
  dexId?: unknown;
  url?: unknown;
}

function liquidityUsd(pair: DexTokenPair): number {
  const value = typeof pair.liquidity?.usd === "number" ? pair.liquidity.usd : Number(pair.liquidity?.usd);
  return Number.isFinite(value) ? value : 0;
}

export function selectSolanaTokenPair(payload: unknown, requestedMint: string): DexTokenPair | null {
  const pairs = payload && typeof payload === "object" && "pairs" in payload && Array.isArray(payload.pairs)
    ? payload.pairs as DexTokenPair[]
    : Array.isArray(payload) ? payload as DexTokenPair[] : [];

  return pairs
    .filter((pair) =>
      pair.chainId === "solana" &&
      typeof pair.baseToken?.address === "string" &&
      pair.baseToken.address === requestedMint
    )
    .slice(0, 100)
    .sort((first, second) => liquidityUsd(second) - liquidityUsd(first))[0] || null;
}

export async function lookupPublicTokenPair(
  requestedMint: string,
  fetchImpl: typeof fetch = fetch
): Promise<DexTokenPair | null> {
  const endpoints = [
    `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(requestedMint)}`,
    `https://api.dexscreener.com/tokens/v1/solana/${encodeURIComponent(requestedMint)}`,
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetchImpl(endpoint, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(2_500),
      });
      if (!response.ok) continue;
      const pair = selectSolanaTokenPair(await response.json(), requestedMint);
      if (pair) return pair;
    } catch {
      // Try the next fixed market-data endpoint.
    }
  }

  return null;
}
