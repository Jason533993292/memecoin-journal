import { NextResponse } from "next/server";
import { readBoundedJson, verifyFirebaseUser } from "@/lib/firebase-admin";
import { setWalletEventStatus } from "@/lib/walletSyncServer";

export async function PATCH(request: Request) {
  let user;
  try { user = await verifyFirebaseUser(request); } catch { user = null; }
  if (!user) return NextResponse.json({ error: "Sign in again to update the review inbox." }, { status: 401 });
  const parsed = await readBoundedJson(request, 5_000);
  if (!("data" in parsed) || !parsed.data || typeof parsed.data !== "object" || Array.isArray(parsed.data)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const data = parsed.data as { ids?: unknown; status?: unknown };
  const ids = Array.isArray(data.ids) ? data.ids.filter((id): id is string => typeof id === "string") : [];
  const status = data.status === "imported" || data.status === "ignored" || data.status === "needs_review" ? data.status : null;
  if (!status || !ids.length) return NextResponse.json({ error: "Select wallet events and a valid status." }, { status: 400 });
  try {
    await setWalletEventStatus(user.uid, ids, status);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Review inbox could not be updated." }, { status: 503 });
  }
}
