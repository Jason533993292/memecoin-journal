import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_FEEDBACK_EMAIL_TO, sendFeedbackNotification } from "../src/lib/feedbackEmail.ts";

const feedback = {
  category: "bug" as const,
  message: "The calendar did not change when I selected last month.",
  contactEmail: "trader@example.com",
  page: "/#statistics",
  device: "Desktop",
  browser: "Chrome",
  viewport: "1440x900",
  theme: "midnight",
};

test("feedback notifications default to the journal inbox and escape submitted HTML", async () => {
  let requestBody: Record<string, unknown> | undefined;
  const fetchImpl: typeof fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ id: "email_test" }), { status: 200 });
  };

  const status = await sendFeedbackNotification(
    { ...feedback, message: "A <script>alert('test')</script> appeared in the form." },
    { apiKey: "re_test_key", fetchImpl },
  );

  assert.equal(status, "sent");
  assert.deepEqual(requestBody?.to, [DEFAULT_FEEDBACK_EMAIL_TO]);
  assert.equal(requestBody?.reply_to, feedback.contactEmail);
  assert.match(String(requestBody?.html), /&lt;script&gt;/);
  assert.doesNotMatch(String(requestBody?.html), /<script>/);
});

test("feedback notifications stay disabled when no provider key is configured", async () => {
  const previousKey = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  try {
    assert.equal(await sendFeedbackNotification(feedback), "not_configured");
  } finally {
    if (previousKey) process.env.RESEND_API_KEY = previousKey;
  }
});

test("feedback notifications surface provider failures", async () => {
  const fetchImpl: typeof fetch = async () => new Response("invalid sender", { status: 422 });
  await assert.rejects(
    sendFeedbackNotification(feedback, { apiKey: "re_test_key", fetchImpl }),
    /HTTP 422/,
  );
});
