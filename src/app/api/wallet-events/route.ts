import { NextResponse } from "next/server";
import { readBoundedJson, verifyFirebaseUser } from "@/lib/firebase-admin";
import { setWalletEventStatus } from "@/lib/walletSyncServer";

export async function PATCH(request: Request) {
  let user;
  try { user = await verifyFirebaseUser(request); } catch { user = null; }
  if (!user) return NextResponse.json({ error: "Sign in again to update the review inbox." }, { status: 401 });
  const parsed = await readBoundedJson(request, 24_000);
  if (!("data" in parsed) || !parsed.data || typeof parsed.data !== "object" || Array.isArray(parsed.data)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const data = parsed.data as { ids?: unknown; status?: unknown };
  const ids = data.ids;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500 ||
      !ids.every((id) => typeof id === "string" && uuid.test(id))) {
    return NextResponse.json({ error: "Select between 1 and 500 valid wallet events." }, { status: 400 });
  }
  const status = data.status === "imported" || data.status === "ignored" || data.status === "needs_review" ? data.status : null;
  if (!status) return NextResponse.json({ error: "Select wallet events and a valid status." }, { status: 400 });
  try {
    await setWalletEventStatus(user.uid, ids, status);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Review inbox could not be updated." }, { status: 503 });
  }
}
