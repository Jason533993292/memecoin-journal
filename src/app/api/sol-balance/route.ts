import { NextResponse } from "next/server";
import {
  consumeUserRateLimits,
  FirebaseAdminConfigurationError,
  readBoundedJson,
  verifyFirebaseUser,
} from "../../../lib/firebase-admin";

export const maxDuration = 15;

export async function POST(request: Request) {
  const parsed = await readBoundedJson(request, 2_000);
  if (!("data" in parsed) || !parsed.data || typeof parsed.data !== "object" || Array.isArray(parsed.data)) {
    return NextResponse.json({ error: "Enter a valid Solana wallet address." }, { status: 400 });
  }
  const address =
    "address" in parsed.data && typeof parsed.data.address === "string"
      ? parsed.data.address.trim()
      : "";
  if (!address || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    return NextResponse.json({ error: "Enter a valid Solana wallet address." }, { status: 400 });
  }

  let user;
  try {
    user = await verifyFirebaseUser(request);
  } catch (error) {
    const configError = error instanceof FirebaseAdminConfigurationError;
    return NextResponse.json(
      { error: configError ? "Balance lookup is temporarily unavailable." : "Sign in to check a wallet." },
      { status: configError ? 503 : 401 }
    );
  }
  if (!user) {
    return NextResponse.json({ error: "Sign in to check a wallet." }, { status: 401 });
  }

  try {
    const allowed = await consumeUserRateLimits(user.uid, "sol-balance", [
      { key: "minute", limit: 20, durationMs: 60_000 },
      { key: "day", limit: 300, durationMs: 86_400_000 },
    ]);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many wallet checks. Please wait before trying again." },
        { status: 429 }
      );
    }
  } catch {
    return NextResponse.json({ error: "Balance lookup is temporarily unavailable." }, { status: 503 });
  }

  const rpcUrls = [
    "https://api.mainnet-beta.solana.com",
    "https://rpc.ankr.com/solana",
    "https://solana-mainnet.g.alchemy.com/v2/demo",
  ];

  for (const rpcUrl of rpcUrls) {
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getBalance",
          params: [address],
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(2_000),
      });
      if (!response.ok) continue;

      const data = await response.json();
      const balanceLamports = data?.result?.value;
      if (
        typeof balanceLamports !== "number" ||
        !Number.isSafeInteger(balanceLamports) ||
        balanceLamports < 0
      ) {
        continue;
      }

      return NextResponse.json(
        {
          address,
          balanceSol: Number((balanceLamports / 1_000_000_000).toFixed(4)),
          balanceLamports,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    } catch {
      // Try the next public RPC after an upstream timeout or malformed response.
    }
  }

  return NextResponse.json(
    { error: "Solana RPC providers could not return a balance right now." },
    { status: 502, headers: { "Cache-Control": "no-store" } }
  );
}
