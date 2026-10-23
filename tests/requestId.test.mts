import assert from "node:assert/strict";
import test from "node:test";

import { feedbackReference, requestHeaders, requestIdFor } from "../src/lib/requestId.ts";

test("request IDs accept a bounded safe upstream value", () => {
  const request = new Request("https://example.test", { headers: { "x-request-id": "railway:req-1234" } });
  assert.equal(requestIdFor(request), "railway:req-1234");
});

test("request IDs replace unsafe or undersized values", () => {
  const request = new Request("https://example.test", { headers: { "x-request-id": "bad value!" } });
  assert.match(requestIdFor(request), /^[0-9a-f-]{36}$/);
});

test("response headers expose the request ID and disable caching", () => {
  const headers = requestHeaders("request-1234", { "Content-Type": "application/json" });
  assert.equal(headers.get("x-request-id"), "request-1234");
  assert.equal(headers.get("cache-control"), "no-store, max-age=0");
});

test("feedback references are short and stable", () => {
  assert.equal(feedbackReference(1), "MJ-000001");
  assert.equal(feedbackReference(36), "MJ-000010");
  assert.throws(() => feedbackReference(0));
});
