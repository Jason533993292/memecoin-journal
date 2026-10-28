export const MARKET_ASSETS = {
  SOL: { symbol: "SOL", name: "Solana", coinGeckoId: "solana" },
  ETH: { symbol: "ETH", name: "Ethereum", coinGeckoId: "ethereum" },
  BNB: { symbol: "BNB", name: "BNB", coinGeckoId: "binancecoin" },
} as const;

export type MarketAssetSymbol = keyof typeof MARKET_ASSETS;

export function isMarketAssetSymbol(value: string | null): value is MarketAssetSymbol {
  return value !== null && Object.hasOwn(MARKET_ASSETS, value);
}
