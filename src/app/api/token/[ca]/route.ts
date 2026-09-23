import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ca: string }> }
) {
  try {
    const { ca } = await params;
    const cleanCa = ca?.trim();

    if (!cleanCa || cleanCa.length < 30 || cleanCa.length > 50) {
      return NextResponse.json({ error: 'Valid Solana contract address is required (32-44 characters)' }, { status: 400 });
    }

    // 1. Try DexScreener token endpoint
    try {
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${cleanCa}`, {
        headers: { Accept: 'application/json' },
        next: { revalidate: 30 },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.pairs && data.pairs.length > 0) {
          // Sort by liquidity USD descending to pick best pair
          const sortedPairs = [...data.pairs].sort(
            (a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
          );
          const bestPair = sortedPairs[0];

          return NextResponse.json({
            name: bestPair.baseToken.name || 'Unknown Token',
            symbol: bestPair.baseToken.symbol || 'MEME',
            priceUsd: bestPair.priceUsd || '0',
            marketCap: bestPair.marketCap || bestPair.fdv || 0,
            liquidity: bestPair.liquidity?.usd || 0,
            chainId: bestPair.chainId || 'solana',
            dexId: bestPair.dexId,
            url: bestPair.url,
            imageUrl: bestPair.info?.imageUrl || null,
          });
        }
      }
    } catch (e) {
      console.warn('Dexscreener tokens endpoint error, trying tokens/v1/solana:', e);
    }

    // 2. Try DexScreener Solana token endpoint
    try {
      const resV1 = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${cleanCa}`, {
        headers: { Accept: 'application/json' },
        next: { revalidate: 30 },
      });
      if (resV1.ok) {
        const pairs = await resV1.json();
        if (Array.isArray(pairs) && pairs.length > 0) {
          const sorted = [...pairs].sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
          const best = sorted[0];
          return NextResponse.json({
            name: best.baseToken.name || 'Unknown Token',
            symbol: best.baseToken.symbol || 'MEME',
            priceUsd: best.priceUsd || '0',
            marketCap: best.marketCap || best.fdv || 0,
            liquidity: best.liquidity?.usd || 0,
            chainId: 'solana',
            dexId: best.dexId,
            url: best.url,
            imageUrl: best.info?.imageUrl || null,
          });
        }
      }
    } catch (e) {
      console.warn('Dexscreener v1 endpoint error:', e);
    }

    // 3. Fallback: Jupiter Price API
    try {
      const jupRes = await fetch(`https://api.jup.ag/price/v2?ids=${cleanCa}`);
      if (jupRes.ok) {
        const jupData = await jupRes.json();
        const tokenObj = jupData?.data?.[cleanCa];
        if (tokenObj) {
          return NextResponse.json({
            name: 'Solana Token',
            symbol: 'SOL-TOKEN',
            priceUsd: String(tokenObj.price || '0'),
            marketCap: 0,
            liquidity: 0,
            chainId: 'solana',
          });
        }
      }
    } catch (e) {
      console.warn('Jupiter fallback error:', e);
    }

    return NextResponse.json({ error: 'Token not found on DexScreener' }, { status: 404 });
  } catch (error) {
    console.error('Error fetching token data:', error);
    return NextResponse.json({ error: 'Failed to fetch token data' }, { status: 500 });
  }
}
