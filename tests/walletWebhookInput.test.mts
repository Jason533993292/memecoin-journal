import assert from "node:assert/strict";
import test from "node:test";
import { isWebhookBatch } from "../src/lib/walletWebhookInput.ts";

test("webhook batches validate every event before ingestion", () => {
  const event = { address: "A".repeat(32), mint: "B".repeat(32), signature: "C".repeat(88), direction: "buy", blockTime: 1780000000000 };
  assert.ok(isWebhookBatch(Array(100).fill(event)));
  for (const batch of [[], Array(101).fill(event), [event, null], [{ ...event, blockTime: 1e20 }],
    [{ ...event, solChange: "1" }], [{ ...event, eventIndex: -1 }]]) {
    assert.equal(isWebhookBatch(batch), false);
  }
});
