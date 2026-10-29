import { NextResponse } from "next/server";
import { consumeUserRateLimits, readBoundedJson, verifyFirebaseUser } from "@/lib/firebase-admin";
import { requestHeaders, requestIdFor } from "@/lib/requestId";
import { parseAccountSecurityEvent } from "@/lib/securityHistory";
import { listAccountSecurityEvents, recordAccountSecurityEvent } from "@/lib/supabase-admin";

const responseFor = (requestId: string, body: object, status = 200) => NextResponse.json(body, {
  status,
  headers: requestHeaders(requestId),
});

export async function GET(request: Request) {
  const requestId = requestIdFor(request);
  try {
    const user = await verifyFirebaseUser(request);
    if (!user) return responseFor(requestId, { error: "Sign in to view security history." }, 401);
    const events = await listAccountSecurityEvents(user.uid);
    return responseFor(requestId, { events: events.map((event) => ({ eventType: event.event_type, createdAt: event.created_at })) });
  } catch (error) {
    console.error("Security history read failed", { requestId, reason: error instanceof Error ? error.name : "unknown" });
    return responseFor(requestId, { error: "Security history could not be loaded.", requestId }, 500);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFor(request);
  try {
    const user = await verifyFirebaseUser(request);
    if (!user) return responseFor(requestId, { error: "Sign in to record this account action." }, 401);
    const body = await readBoundedJson(request, 1_024);
    if ("error" in body) return responseFor(requestId, { error: "Account action is not valid." }, 400);
    const eventType = parseAccountSecurityEvent(body.data);
    if (!eventType || eventType === "trading_data_deleted") return responseFor(requestId, { error: "Account action is not valid." }, 400);
    const allowed = await consumeUserRateLimits(user.uid, "security-history", [{ key: "day", limit: 30, durationMs: 86_400_000 }]);
    if (!allowed) return responseFor(requestId, { error: "Too many account actions were recorded today." }, 429);
    await recordAccountSecurityEvent(user.uid, eventType, requestId);
    return responseFor(requestId, { recorded: true });
  } catch (error) {
    console.error("Security history write failed", { requestId, reason: error instanceof Error ? error.name : "unknown" });
    return responseFor(requestId, { error: "Account action could not be recorded.", requestId }, 500);
  }
}
