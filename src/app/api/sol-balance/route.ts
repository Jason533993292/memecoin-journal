import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address")?.trim();

  if (!address) {
    return NextResponse.json({ error: "Address is required" }, { status: 400 });
  }

  // Basic base58 check
  if (address.length < 32 || address.length > 44) {
    return NextResponse.json({ error: "Invalid Solana address length" }, { status: 400 });
  }

  try {
    const rpcUrls = [
      "https://api.mainnet-beta.solana.com",
      "https://solana-mainnet.g.alchemy.com/v2/demo",
      "https://rpc.ankr.com/solana",
    ];

    let balanceLamports: number | null = null;

    for (const rpcUrl of rpcUrls) {
      try {
        const res = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getBalance",
            params: [address],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data?.result?.value !== undefined) {
            balanceLamports = data.result.value;
            break;
          }
        }
      } catch (e) {
        // try next rpc
      }
    }

    if (balanceLamports === null) {
      return NextResponse.json({ error: "Failed to fetch on-chain balance" }, { status: 502 });
    }

    const balanceSol = balanceLamports / 1_000_000_000;

    return NextResponse.json({
      address,
      balanceSol: parseFloat(balanceSol.toFixed(4)),
      balanceLamports,
    });
  } catch (err: any) {
    console.error("Solana balance fetch error:", err);
    return NextResponse.json({ error: "Error fetching balance" }, { status: 500 });
  }
}
