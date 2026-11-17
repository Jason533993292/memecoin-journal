import { NextResponse } from "next/server";
import { consumeUserRateLimits, readBoundedJson, verifyFirebaseUser } from "@/lib/firebase-admin";
import { listWalletEvents, syncWalletLink } from "@/lib/walletSyncServer";

export const maxDuration = 30;

export async function POST(request: Request) {
  let user;
  try { user = await verifyFirebaseUser(request); } catch { user = null; }
  if (!user) return NextResponse.json({ error: "Sign in again to sync this wallet." }, { status: 401 });
  const parsed = await readBoundedJson(request, 500);
  const linkId = "data" in parsed && parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data) && "linkId" in parsed.data && typeof parsed.data.linkId === "string" ? parsed.data.linkId : "";
  if (!/^[0-9a-f-]{36}$/i.test(linkId)) return NextResponse.json({ error: "Invalid linked wallet." }, { status: 400 });
  try {
    const allowed = await consumeUserRateLimits(user.uid, "wallet-sync", [{ key: "minute", limit: 5, durationMs: 60_000 }, { key: "day", limit: 100, durationMs: 86_400_000 }]);
    if (!allowed) return NextResponse.json({ error: "Too many sync requests. Wait a minute and try again." }, { status: 429 });
    const result = await syncWalletLink(user.uid, linkId);
    const events = await listWalletEvents(user.uid);
    return NextResponse.json({ result, events }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Wallet sync failed." }, { status: 502 });
  }
}
