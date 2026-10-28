import { NextResponse } from "next/server";
import { FirebaseAdminConfigurationError, readBoundedJson, verifyFirebaseUser } from "@/lib/firebase-admin";
import { isFeedbackAdmin, parseFeedbackAdminUpdate } from "@/lib/feedbackAdmin";
import { listFeedbackForAdmin, updateFeedbackForAdmin } from "@/lib/supabase-admin";
import { requestHeaders, requestIdFor } from "@/lib/requestId";

async function authorize(request: Request) {
  const user = await verifyFirebaseUser(request);
  if (!user || !isFeedbackAdmin(user.email, user.email_verified)) return null;
  return user;
}

function responder(request: Request) {
  const requestId = requestIdFor(request);
  return (body: object, status = 200) => NextResponse.json(body, { status, headers: requestHeaders(requestId) });
}

export async function GET(request: Request) {
  const reply = responder(request);
  try {
    const user = await authorize(request);
    if (!user) return reply({ error: "Not found." }, 404);
    return reply({ reports: await listFeedbackForAdmin() });
  } catch (error) {
    if (error instanceof FirebaseAdminConfigurationError) return reply({ error: "Administration is unavailable." }, 503);
    console.error("Feedback administration list failed", { reason: error instanceof Error ? error.name : "unknown" });
    return reply({ error: "Reports could not be loaded." }, 500);
  }
}

export async function PATCH(request: Request) {
  const reply = responder(request);
  try {
    const user = await authorize(request);
    if (!user || typeof user.email !== "string") return reply({ error: "Not found." }, 404);
    const body = await readBoundedJson(request, 8_192);
    if ("error" in body) return reply({ error: "The update is not valid." }, 400);
    const update = parseFeedbackAdminUpdate(body.data);
    if (!update) return reply({ error: "The update is not valid." }, 400);
    await updateFeedbackForAdmin({ ...update, actorUid: user.uid, actorEmail: user.email });
    return reply({ updated: true });
  } catch (error) {
    if (error instanceof FirebaseAdminConfigurationError) return reply({ error: "Administration is unavailable." }, 503);
    console.error("Feedback administration update failed", { reason: error instanceof Error ? error.name : "unknown" });
    return reply({ error: "The report could not be updated." }, 500);
  }
}
