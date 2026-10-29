import assert from "node:assert/strict";
import test from "node:test";
import { getFeedbackDeliveryRetry } from "../src/lib/feedbackDeliveryPolicy.ts";

test("feedback delivery retries back off and stop after five claimed attempts", () => {
  assert.deepEqual(getFeedbackDeliveryRetry(1), { exhausted: false, delayMinutes: 1 });
  assert.deepEqual(getFeedbackDeliveryRetry(2), { exhausted: false, delayMinutes: 2 });
  assert.deepEqual(getFeedbackDeliveryRetry(4), { exhausted: false, delayMinutes: 8 });
  assert.deepEqual(getFeedbackDeliveryRetry(5), { exhausted: true, delayMinutes: 16 });
});

test("feedback delivery retry input is normalized and delay is bounded", () => {
  assert.deepEqual(getFeedbackDeliveryRetry(0), { exhausted: false, delayMinutes: 1 });
  assert.deepEqual(getFeedbackDeliveryRetry(20), { exhausted: true, delayMinutes: 60 });
});
