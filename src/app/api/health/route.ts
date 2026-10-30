import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getFirebaseAdmin } from "@/lib/firebase-admin";
import { checkSupabaseAdminHealth } from "@/lib/supabase-admin";
import { requestHeaders, requestIdFor } from "@/lib/requestId";

// Platform liveness endpoint. This intentionally does not disclose secrets or
// depend on either database while the app supports a staged backend migration.
function authorized(request: Request) {
  const expected = process.env.HEALTHCHECK_TOKEN?.trim();
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!expected || !supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

async function timedCheck(check: () => Promise<unknown>) {
  try {
    await Promise.race([
      check(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 4_000)),
    ]);
    return "ok" as const;
  } catch {
    return "unavailable" as const;
  }
}

export async function GET(request: Request) {
  const requestId = requestIdFor(request);
  if (!authorized(request)) {
    return NextResponse.json({ status: "ok" }, { headers: requestHeaders(requestId) });
  }

  const [firebaseAuth, firestore, supabase] = await Promise.all([
    timedCheck(async () => {
      const { auth } = getFirebaseAdmin();
      await auth.listUsers(1);
    }),
    timedCheck(async () => {
      const { db } = getFirebaseAdmin();
      await db.collection("_server_rate_limits").limit(1).get();
    }),
    timedCheck(checkSupabaseAdminHealth),
  ]);
  const resend = process.env.RESEND_API_KEY?.trim() ? "configured" : "not_configured";
  // Authentication and both data stores are required for the journal to work.
  // Feedback email is reported separately because submissions remain safely
  // queued when email delivery is not configured in an environment.
  const ready = firebaseAuth === "ok" && firestore === "ok" && supabase === "ok";

  return NextResponse.json(
    { status: ready ? "ready" : "degraded", checks: { firebaseAuth, firestore, supabase, resend } },
    { status: ready ? 200 : 503, headers: requestHeaders(requestId) },
  );
}
