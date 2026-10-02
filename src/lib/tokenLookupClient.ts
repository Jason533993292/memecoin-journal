export interface TokenLookupData {
  name: string;
  symbol: string;
  priceUsd: string;
  marketCap: number;
  liquidity: number;
  imageUrl?: string;
}

export interface TokenLookupResult {
  data: TokenLookupData | null;
  error: string | null;
}

export async function lookupTokenMetadata(
  contractAddress: string,
  idToken: string,
  fetchImpl: typeof fetch = fetch
): Promise<TokenLookupResult> {
  try {
    const response = await fetchImpl(`/api/token/${encodeURIComponent(contractAddress)}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    const payload: unknown = await response.json();

    if (!response.ok) {
      const message = payload && typeof payload === "object" && "error" in payload &&
        typeof payload.error === "string"
        ? payload.error
        : "Token lookup is temporarily unavailable.";
      return { data: null, error: message };
    }

    if (!payload || typeof payload !== "object") {
      return { data: null, error: "Token lookup returned invalid market data." };
    }

    const record = payload as Record<string, unknown>;
    return {
      data: {
        name: typeof record.name === "string" ? record.name : "Unknown Token",
        symbol: typeof record.symbol === "string" ? record.symbol : "MEME",
        priceUsd: typeof record.priceUsd === "string" ? record.priceUsd : "0",
        marketCap: Number(record.marketCap) || 0,
        liquidity: Number(record.liquidity) || 0,
        imageUrl: typeof record.imageUrl === "string" ? record.imageUrl : undefined,
      },
      error: null,
    };
  } catch {
    return { data: null, error: "Token lookup timed out. You can enter the token name manually." };
  }
}
