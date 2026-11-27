import { NextResponse } from "next/server";
import { consumeUserRateLimits, readBoundedJson, verifyFirebaseUser } from "@/lib/firebase-admin";
import { listWalletEvents, syncWalletLink } from "@/lib/walletSyncServer";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const maxDuration = 60;

export async function POST(request: Request) {
  let user;
  try { user = await verifyFirebaseUser(request); } catch { user = null; }
  if (!user) return NextResponse.json({ error: "Sign in again to sync this wallet." }, { status: 401 });
  const parsed = await readBoundedJson(request, 500);
  const linkId = "data" in parsed && parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data) && "linkId" in parsed.data && typeof parsed.data.linkId === "string" ? parsed.data.linkId : "";
  const mode = "data" in parsed && parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data) && "mode" in parsed.data && parsed.data.mode === "rescan" ? "rescan" : "incremental";
  if (!/^[0-9a-f-]{36}$/i.test(linkId)) return NextResponse.json({ error: "Invalid linked wallet." }, { status: 400 });
  try {
    const allowed = await consumeUserRateLimits(user.uid, "wallet-sync", [{ key: "minute", limit: 5, durationMs: 60_000 }, { key: "day", limit: 100, durationMs: 86_400_000 }]);
    if (!allowed) return NextResponse.json({ error: "Too many sync requests. Wait a minute and try again." }, { status: 429 });
    const client = getSupabaseAdminClient();
    const lease = crypto.randomUUID();
    const { data: claimed, error } = await client.from("wallet_links")
      .update({ sync_lease: lease, sync_lease_until: new Date(Date.now() + 120_000).toISOString() })
      .eq("id", linkId).eq("user_id", user.uid).or(`sync_lease_until.is.null,sync_lease_until.lt.${new Date().toISOString()}`)
      .select("id").maybeSingle();
    if (error) throw new Error("Could not start wallet sync.");
    if (!claimed) return NextResponse.json({ error: "This wallet is already syncing or has been unlinked." }, { status: 409 });
    try {
      let result;
      try {
        result = await syncWalletLink(user.uid, linkId, mode);
      } catch (error) {
        await client.rpc("record_wallet_sync", { p_failed: true, p_unsupported: 0 });
        throw error;
      }
      await client.rpc("record_wallet_sync", { p_failed: !!result.incomplete, p_unsupported: result.unclassifiedTransactions });
      const events = await listWalletEvents(user.uid);
      return NextResponse.json({ result, ...events }, { headers: { "Cache-Control": "no-store" } });
    } finally {
      await client.from("wallet_links").update({ sync_lease: null, sync_lease_until: null }).eq("id",linkId).eq("user_id",user.uid).eq("sync_lease",lease);
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Wallet sync failed." }, { status: 502 });
  }
}
