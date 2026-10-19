import assert from "node:assert/strict";
import test from "node:test";
import { parseFeedbackPayload } from "../src/lib/feedback.ts";

test("accepts and bounds a valid feedback submission", () => {
  const parsed = parseFeedbackPayload({
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
  assert.equal(parseFeedbackPayload({ category: "complaint", message: "This message is long enough" }), null);
  assert.equal(parseFeedbackPayload({ category: "bug", message: "Too short" }), null);
});

test("normalizes optional diagnostics without accepting arbitrary values", () => {
  const parsed = parseFeedbackPayload({
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
