import { NextResponse } from "next/server";
import { consumeUserRateLimits, readBoundedJson, verifyFirebaseUser } from "@/lib/firebase-admin";
import { createWalletLink, deleteWalletLink, listWalletEvents, listWalletLinks } from "@/lib/walletSyncServer";

export const maxDuration = 20;

async function userFor(request: Request) {
  try { return await verifyFirebaseUser(request); } catch { return null; }
}

export async function GET(request: Request) {
  const user = await userFor(request);
  if (!user) return NextResponse.json({ error: "Sign in again to load linked wallets." }, { status: 401 });
  try {
    const [links, events] = await Promise.all([listWalletLinks(user.uid), listWalletEvents(user.uid)]);
    return NextResponse.json({ links, events }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Linked wallets could not be loaded." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const user = await userFor(request);
  if (!user) return NextResponse.json({ error: "Sign in again to link a wallet." }, { status: 401 });
  const parsed = await readBoundedJson(request, 2_000);
  if (!("data" in parsed) || !parsed.data || typeof parsed.data !== "object" || Array.isArray(parsed.data)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const data = parsed.data as { address?: unknown; label?: unknown };
  try {
    const allowed = await consumeUserRateLimits(user.uid, "wallet-link", [{ key: "minute", limit: 10, durationMs: 60_000 }]);
    if (!allowed) return NextResponse.json({ error: "Too many wallet changes. Wait a minute and try again." }, { status: 429 });
    const link = await createWalletLink(user.uid, typeof data.address === "string" ? data.address : "", typeof data.label === "string" ? data.label : "");
    return NextResponse.json({ link }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Wallet could not be linked." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const user = await userFor(request);
  if (!user) return NextResponse.json({ error: "Sign in again to unlink a wallet." }, { status: 401 });
  const parsed = await readBoundedJson(request, 500);
  const id = "data" in parsed && parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data) && "id" in parsed.data && typeof parsed.data.id === "string" ? parsed.data.id : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid linked wallet." }, { status: 400 });
  try {
    await deleteWalletLink(user.uid, id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Wallet could not be unlinked." }, { status: 503 });
  }
}
