import { NextResponse } from "next/server";
import { readBoundedJson, verifyFirebaseUser } from "@/lib/firebase-admin";
import { confirmWalletOwnership, createVerificationChallenge } from "@/lib/walletSyncServer";

export async function POST(request: Request) {
  let user;
  try { user = await verifyFirebaseUser(request); } catch { user = null; }
  if (!user) return NextResponse.json({ error: "Sign in again to verify wallet ownership." }, { status: 401 });
  const parsed = await readBoundedJson(request, 3_000);
  if (!("data" in parsed) || !parsed.data || typeof parsed.data !== "object" || Array.isArray(parsed.data)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const data = parsed.data as { linkId?: unknown; action?: unknown; signature?: unknown };
  const linkId = typeof data.linkId === "string" ? data.linkId : "";
  if (!/^[0-9a-f-]{36}$/i.test(linkId)) return NextResponse.json({ error: "Invalid linked wallet." }, { status: 400 });
  try {
    if (data.action === "challenge") return NextResponse.json(await createVerificationChallenge(user.uid, linkId));
    if (data.action === "confirm" && typeof data.signature === "string") {
      await confirmWalletOwnership(user.uid, linkId, data.signature);
      return NextResponse.json({ verified: true });
    }
    return NextResponse.json({ error: "Invalid verification action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Wallet ownership could not be verified." }, { status: 400 });
  }
}
