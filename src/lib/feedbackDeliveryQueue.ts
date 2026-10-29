import { randomUUID } from "node:crypto";
import { sendFeedbackNotificationWithRetry } from "@/lib/feedbackEmail";
import { feedbackReference } from "@/lib/requestId";
import {
  claimFeedbackDeliveryJobs,
  completeFeedbackDeliveryJob,
  getFeedbackForDelivery,
  recordFeedbackEmailStatus,
  rescheduleFeedbackDeliveryJob,
} from "@/lib/supabase-admin";

export async function processFeedbackDeliveryQueue(limit = 10) {
  const jobs = await claimFeedbackDeliveryJobs(randomUUID(), limit);
  let sent = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      const feedback = await getFeedbackForDelivery(job.feedback_id);
      if (!["bug", "suggestion", "other"].includes(feedback.category)) throw new Error("Stored feedback category is invalid.");
      const delivery = await sendFeedbackNotificationWithRetry({
        reference: feedbackReference(feedback.id),
        category: feedback.category as "bug" | "suggestion" | "other",
        message: feedback.message,
        contactEmail: feedback.contact_email,
        page: feedback.page,
        device: feedback.device,
        browser: feedback.browser,
        viewport: feedback.viewport,
        theme: feedback.theme,
      });
      await recordFeedbackEmailStatus(feedback.id, { ...delivery, attempts: job.attempts * delivery.attempts });
      await completeFeedbackDeliveryJob(feedback.id);
      if (delivery.status === "sent") sent += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : "unknown";
      const outcome = await rescheduleFeedbackDeliveryJob(job.feedback_id, job.attempts, message);
      await recordFeedbackEmailStatus(job.feedback_id, {
        status: "failed",
        attempts: job.attempts * 3,
        error: outcome.exhausted ? `Delivery stopped after repeated failures: ${message}` : message,
      });
    }
  }

  return { claimed: jobs.length, sent, failed };
}
