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
