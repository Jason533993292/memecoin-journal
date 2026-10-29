import { NextResponse } from "next/server";
import {
  consumeUserRateLimits,
  FirebaseAdminConfigurationError,
  readBoundedJson,
  verifyFirebaseUser,
} from "@/lib/firebase-admin";
import { parseFeedbackPayload } from "@/lib/feedback";
import { sendFeedbackNotificationWithRetry } from "@/lib/feedbackEmail";
import { completeFeedbackDeliveryJob, createUserFeedback, enqueueFeedbackDelivery, listUserFeedback, recordFeedbackEmailStatus, rescheduleFeedbackDeliveryJob } from "@/lib/supabase-admin";
import { feedbackReference, requestHeaders, requestIdFor } from "@/lib/requestId";

export async function GET(request: Request) {
  const requestId = requestIdFor(request);
  const reply = (body: object, status = 200) => NextResponse.json(body, {
    status,
    headers: requestHeaders(requestId),
  });
  try {
    const user = await verifyFirebaseUser(request);
    if (!user) return reply({ error: "Sign in to view feedback." }, 401);
    const reports = await listUserFeedback(user.uid);
    return reply({
      reports: reports.map((report) => ({
        reference: feedbackReference(report.id),
        category: report.category,
        message: report.message,
        status: report.status,
        resolutionNote: report.resolution_note,
        createdAt: report.created_at,
        updatedAt: report.updated_at,
      })),
    });
  } catch (error) {
    console.error("Feedback history failed", { requestId, reason: error instanceof Error ? error.name : "unknown" });
    return reply({ error: "Feedback history could not be loaded.", requestId }, 500);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFor(request);
  const reply = (body: object, status = 200) => NextResponse.json(body, {
    status,
    headers: requestHeaders(requestId),
  });
  let user;
  try {
    user = await verifyFirebaseUser(request);
  } catch (error) {
    return reply(
      { error: error instanceof FirebaseAdminConfigurationError ? "Feedback is temporarily unavailable." : "Sign in again and retry." },
      error instanceof FirebaseAdminConfigurationError ? 503 : 401,
    );
  }
  if (!user) return reply({ error: "Sign in to send feedback." }, 401);

  const body = await readBoundedJson(request, 16_384);
  if ("error" in body) {
    return reply({ error: body.error === "too_large" ? "Feedback is too large." : "Feedback is not valid." }, 400);
  }
  const feedback = parseFeedbackPayload(body.data);
  if (!feedback) {
    return reply({ error: "Choose a category and enter at least 15 characters." }, 400);
  }
  // Hidden field: real users never fill this. Return success so bots do not
  // learn which anti-spam signal rejected their submission.
  if (feedback.company) return reply({ submitted: true });

  try {
    const allowed = await consumeUserRateLimits(user.uid, "feedback", [
      { key: "hour", limit: 5, durationMs: 60 * 60 * 1000 },
      { key: "day", limit: 20, durationMs: 24 * 60 * 60 * 1000 },
    ]);
    if (!allowed) {
      return reply({ error: "You have sent several reports recently. Please try again later." }, 429);
    }

    const storedFeedback = {
      userId: user.uid,
      idempotencyKey: feedback.submissionId,
      category: feedback.category,
      message: feedback.message,
      contactEmail: feedback.allowReply && typeof user.email === "string" ? user.email.slice(0, 320) : null,
      page: feedback.page,
      device: feedback.device,
      browser: feedback.browser,
      viewport: feedback.viewport,
      theme: feedback.theme,
    };
    const receipt = await createUserFeedback(storedFeedback);
    const feedbackId = receipt.id;
    const reference = feedbackReference(feedbackId);
    if (!receipt.created && ["sent", "not_configured"].includes(receipt.email_delivery_status)) {
      return reply({ submitted: true, reference, duplicate: true });
    }
    // Also repairs reports created by an older deployment that did not yet
    // create durable delivery jobs.
    await enqueueFeedbackDelivery(feedbackId);
    try {
      const delivery = await sendFeedbackNotificationWithRetry({ ...storedFeedback, reference });
      await recordFeedbackEmailStatus(feedbackId, delivery);
      await completeFeedbackDeliveryJob(feedbackId);
      if (delivery.status === "not_configured") console.warn("Feedback email notification is not configured.", { requestId, reference });
    } catch (emailError) {
      // The database remains the durable inbox. A provider outage should not
      // make the user resubmit and create a duplicate report.
      console.error("Feedback email notification failed", {
        requestId,
        reference,
        reason: emailError instanceof Error ? emailError.message : "unknown",
      });
      await recordFeedbackEmailStatus(feedbackId, {
        status: "failed",
        attempts: 3,
        error: emailError instanceof Error ? emailError.message : "unknown",
      }).catch((statusError) => console.error("Feedback delivery status update failed", {
        requestId,
        reference,
        reason: statusError instanceof Error ? statusError.name : "unknown",
      }));
      await rescheduleFeedbackDeliveryJob(feedbackId, Math.max(1, receipt.created ? 1 : 2), emailError instanceof Error ? emailError.message : "unknown").catch((queueError) => console.error("Feedback delivery reschedule failed", {
        requestId,
        reference,
        reason: queueError instanceof Error ? queueError.name : "unknown",
      }));
    }
    return reply({ submitted: true, reference });
  } catch (error) {
    console.error("Feedback submission failed", {
      requestId,
      uid: user.uid,
      reason: error instanceof Error ? error.name : "unknown",
    });
    return reply({ error: "Feedback could not be sent. Please try again.", requestId }, 500);
  }
}
