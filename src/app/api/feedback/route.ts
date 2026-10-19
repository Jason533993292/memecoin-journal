import { NextResponse } from "next/server";
import {
  consumeUserRateLimits,
  FirebaseAdminConfigurationError,
  readBoundedJson,
  verifyFirebaseUser,
} from "@/lib/firebase-admin";
import { parseFeedbackPayload } from "@/lib/feedback";
import { sendFeedbackNotification } from "@/lib/feedbackEmail";
import { createUserFeedback } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  let user;
  try {
    user = await verifyFirebaseUser(request);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof FirebaseAdminConfigurationError ? "Feedback is temporarily unavailable." : "Sign in again and retry." },
      { status: error instanceof FirebaseAdminConfigurationError ? 503 : 401 },
    );
  }
  if (!user) return NextResponse.json({ error: "Sign in to send feedback." }, { status: 401 });

  const body = await readBoundedJson(request, 16_384);
  if ("error" in body) {
    return NextResponse.json({ error: body.error === "too_large" ? "Feedback is too large." : "Feedback is not valid." }, { status: 400 });
  }
  const feedback = parseFeedbackPayload(body.data);
  if (!feedback) {
    return NextResponse.json({ error: "Choose a category and enter at least 15 characters." }, { status: 400 });
  }
  // Hidden field: real users never fill this. Return success so bots do not
  // learn which anti-spam signal rejected their submission.
  if (feedback.company) return NextResponse.json({ submitted: true });

  try {
    const allowed = await consumeUserRateLimits(user.uid, "feedback", [
      { key: "hour", limit: 5, durationMs: 60 * 60 * 1000 },
      { key: "day", limit: 20, durationMs: 24 * 60 * 60 * 1000 },
    ]);
    if (!allowed) {
      return NextResponse.json({ error: "You have sent several reports recently. Please try again later." }, { status: 429 });
    }

    const storedFeedback = {
      userId: user.uid,
      category: feedback.category,
      message: feedback.message,
      contactEmail: feedback.allowReply && typeof user.email === "string" ? user.email.slice(0, 320) : null,
      page: feedback.page,
      device: feedback.device,
      browser: feedback.browser,
      viewport: feedback.viewport,
      theme: feedback.theme,
    };
    await createUserFeedback(storedFeedback);
    try {
      const emailStatus = await sendFeedbackNotification(storedFeedback);
      if (emailStatus === "not_configured") console.warn("Feedback email notification is not configured.");
    } catch (emailError) {
      // The database remains the durable inbox. A provider outage should not
      // make the user resubmit and create a duplicate report.
      console.error("Feedback email notification failed", {
        reason: emailError instanceof Error ? emailError.message : "unknown",
      });
    }
    return NextResponse.json({ submitted: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Feedback submission failed", {
      uid: user.uid,
      reason: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json({ error: "Feedback could not be sent. Please try again." }, { status: 500 });
  }
}
