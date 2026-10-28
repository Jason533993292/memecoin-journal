import assert from "node:assert/strict";
import test from "node:test";
import { isFeedbackAdmin, parseFeedbackAdminUpdate } from "../src/lib/feedbackAdmin.ts";

test("feedback administration requires a verified allowlisted email", () => {
  assert.equal(isFeedbackAdmin("owner@example.com", true, "owner@example.com, other@example.com"), true);
  assert.equal(isFeedbackAdmin("owner@example.com", false, "owner@example.com"), false);
  assert.equal(isFeedbackAdmin("stranger@example.com", true, "owner@example.com"), false);
});

test("feedback administration accepts only bounded status updates", () => {
  assert.deepEqual(parseFeedbackAdminUpdate({ id: 12, status: "resolved", assignedTo: " Owner ", note: " Fixed " }), {
    id: 12,
    status: "resolved",
    assignedTo: "Owner",
    note: "Fixed",
  });
  assert.equal(parseFeedbackAdminUpdate({ id: 0, status: "resolved" }), null);
  assert.equal(parseFeedbackAdminUpdate({ id: 12, status: "deleted" }), null);
});
