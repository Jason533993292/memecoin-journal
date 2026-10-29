import assert from "node:assert/strict";
import test from "node:test";
import { parseFeedbackPayload } from "../src/lib/feedback.ts";

test("accepts and bounds a valid feedback submission", () => {
  const parsed = parseFeedbackPayload({
    submissionId: "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
    category: "suggestion",
    message: `  ${"a".repeat(2100)}  `,
    allowReply: true,
    page: "/#dashboard",
    device: "Mac",
    browser: "Chrome 141",
    viewport: "1440x900",
    theme: "midnight",
  });
  assert.equal(parsed?.category, "suggestion");
  assert.equal(parsed?.message.length, 2000);
  assert.equal(parsed?.allowReply, true);
});

test("rejects invalid categories and short messages", () => {
  const submissionId = "6ba7b810-9dad-41d1-80b4-00c04fd430c8";
  assert.equal(parseFeedbackPayload({ submissionId, category: "complaint", message: "This message is long enough" }), null);
  assert.equal(parseFeedbackPayload({ submissionId, category: "bug", message: "Too short" }), null);
  assert.equal(parseFeedbackPayload({ submissionId: "not-a-uuid", category: "bug", message: "This message is long enough" }), null);
});

test("normalizes optional diagnostics without accepting arbitrary values", () => {
  const parsed = parseFeedbackPayload({
    submissionId: "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
    category: "bug",
    message: "The save button did not respond.",
    allowReply: "yes",
    page: 123,
    company: "bot",
  });
  assert.equal(parsed?.allowReply, false);
  assert.equal(parsed?.page, "");
  assert.equal(parsed?.company, "bot");
});
