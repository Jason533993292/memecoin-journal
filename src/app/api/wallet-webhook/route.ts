import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { readBoundedJson } from "@/lib/firebase-admin";
import { ingestWebhookEvents } from "@/lib/walletSyncServer";

import { isWebhookBatch } from "@/lib/walletWebhookInput";

export const maxDuration = 30;

function validSecret(request: Request) {
  const expected = process.env.WALLET_WEBHOOK_SECRET?.trim() || "";
  const supplied = request.headers.get("x-wallet-webhook-secret") || "";
  if (expected.length < 32 || Buffer.byteLength(expected) !== Buffer.byteLength(supplied)) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
}

export async function POST(request: Request) {
  if (!validSecret(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const parsed = await readBoundedJson(request, 250_000);
  if (!("data" in parsed) || !parsed.data || typeof parsed.data !== "object" || Array.isArray(parsed.data)) return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  const events = "events" in parsed.data && Array.isArray(parsed.data.events) ? parsed.data.events : [];
  if (!isWebhookBatch(events)) return NextResponse.json({ error: "Send 1–100 valid wallet events." }, { status: 400 });
  try {
    const stored = await ingestWebhookEvents(events);
    return NextResponse.json({ accepted: events.length, stored });
  } catch {
    return NextResponse.json({ error: "Webhook events could not be stored." }, { status: 503 });
  }
}
