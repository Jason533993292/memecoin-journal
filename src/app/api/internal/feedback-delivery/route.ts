import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processFeedbackDeliveryQueue } from "@/lib/feedbackDeliveryQueue";
import { requestHeaders, requestIdFor } from "@/lib/requestId";

function authorized(request: Request) {
  const expected = process.env.FEEDBACK_WORKER_TOKEN?.trim();
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!expected || !supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

export async function POST(request: Request) {
  const requestId = requestIdFor(request);
  if (!authorized(request)) return NextResponse.json({ error: "Not found." }, { status: 404, headers: requestHeaders(requestId) });
  try {
    const result = await processFeedbackDeliveryQueue(10);
    return NextResponse.json(result, { headers: requestHeaders(requestId) });
  } catch (error) {
    console.error("Feedback delivery worker failed", { requestId, reason: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ error: "Feedback delivery worker failed.", requestId }, { status: 500, headers: requestHeaders(requestId) });
  }
}
