import assert from "node:assert/strict";
import test from "node:test";
import { allowPriceRequest } from "../src/lib/publicRateLimit.ts";

test("SOL price burst limiter permits sixty requests and rejects the next one", () => {
  const client = `test-${Date.now()}-${Math.random()}`;
  const now = 1_000;
  for (let request = 0; request < 60; request += 1) {
    assert.equal(allowPriceRequest(client, { now }), true);
  }
  assert.equal(allowPriceRequest(client, { now }), false);
});

test("SOL price burst limiter resets after one minute", () => {
  const client = `test-reset-${Date.now()}-${Math.random()}`;
  assert.equal(allowPriceRequest(client, { now: 5_000 }), true);
  assert.equal(allowPriceRequest(client, { now: 65_000 }), true);
});
