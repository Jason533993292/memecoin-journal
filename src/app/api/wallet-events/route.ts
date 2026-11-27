import { NextResponse } from "next/server";
import { readBoundedJson, verifyFirebaseUser } from "@/lib/firebase-admin";
import { setWalletEventStatus } from "@/lib/walletSyncServer";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { Json } from "@/lib/database.types";

export async function POST(request: Request) {
  const user = await verifyFirebaseUser(request).catch(() => null);
  if (!user) return NextResponse.json({ error: "Sign in to save this trade." }, { status: 401 });
  const payload = await readBoundedJson(request, 200_000);
  const data = "data" in payload ? payload.data as { ids?: unknown; row?: Json } | null : null;
  const ids = data?.ids;
  if (!Array.isArray(ids) || !ids.length || ids.length > 500 || !ids.every(id => typeof id === "string" &&
      /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) || !data?.row ||
      typeof data.row !== "object" || Array.isArray(data.row) || !data.row.setup_type || !data.row.notes) {
    return NextResponse.json({ error: "Select a position and add a reason and setup." }, { status: 400 });
  }
  const { data: id, error } = await getSupabaseAdminClient().rpc("save_wallet_position", {
    p_owner: user.uid, p_ids: ids, p_row: data.row,
  });
  if (error) return NextResponse.json({ error: "Refresh wallet activity and review the position again." }, { status: 409 });
  return NextResponse.json({ id });
}

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
