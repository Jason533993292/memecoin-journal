import assert from "node:assert/strict";
import test from "node:test";
import { fetchWithTimeout } from "../src/lib/fetchWithTimeout.ts";

test("fetch timeout aborts a stalled request", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
  })) as typeof fetch;
  try {
    await assert.rejects(fetchWithTimeout("https://example.invalid", {}, 5), (error: unknown) => error instanceof DOMException && error.name === "TimeoutError");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetch timeout forwards caller cancellation", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
  })) as typeof fetch;
  const controller = new AbortController();
  try {
    const request = fetchWithTimeout("https://example.invalid", { signal: controller.signal }, 1_000);
    controller.abort(new DOMException("Navigation", "AbortError"));
    await assert.rejects(request, (error: unknown) => error instanceof DOMException && error.name === "AbortError");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
