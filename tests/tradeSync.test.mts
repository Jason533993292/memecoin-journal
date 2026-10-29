import assert from "node:assert/strict";
import test from "node:test";
import { isTradeSyncMessage } from "../src/lib/tradeSync.ts";

test("trade sync accepts bounded save and delete notifications", () => {
  assert.equal(isTradeSyncMessage({ type: "saved", tradeId: "trade-1", sentAt: Date.now() }), true);
  assert.equal(isTradeSyncMessage({ type: "deleted", tradeId: "trade-2", sentAt: 1 }), true);
});

test("trade sync rejects malformed cross-tab messages", () => {
  assert.equal(isTradeSyncMessage({ type: "updated", tradeId: "trade-1", sentAt: 1 }), false);
  assert.equal(isTradeSyncMessage({ type: "saved", tradeId: "", sentAt: 1 }), false);
  assert.equal(isTradeSyncMessage({ type: "saved", tradeId: "x".repeat(151), sentAt: 1 }), false);
  assert.equal(isTradeSyncMessage({ type: "saved", tradeId: "trade-1", sentAt: "now" }), false);
});
