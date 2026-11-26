import assert from "node:assert/strict";
import test from "node:test";
import { nextSyncCursor, planSignatureWindow, type SignatureRow } from "../src/lib/walletSyncWindow.ts";

// getSignaturesForAddress returns newest first. Build rows named s<N> where a higher N is newer.
function rows(count: number, failedEvery = 0): SignatureRow[] {
  return Array.from({ length: count }, (_, index) => count - index).map((n) => ({ signature: `s${n}`, err: failedEvery && n % failedEvery === 0 ? { InstructionError: 1 } : null }));
}

test("an incremental sync takes the OLDEST batch so the cursor never skips activity", () => {
  const window = planSignatureWindow(rows(120), { incrementalWithCursor: true });
  assert.equal(window.ordered.length, 50);
  assert.equal(window.ordered[0].signature, "s1");
  assert.equal(window.ordered[49].signature, "s50");
  assert.equal(window.windowEnd, "s50");
  assert.equal(window.hasMore, true);
  const cursor = nextSyncCursor({ previousCursor: "s0", mode: "incremental", window, usableCount: 50 });
  assert.equal(cursor, "s50");
});

test("repeated incremental syncs eventually process every transaction exactly once", () => {
  const all = rows(130);
  const seen: string[] = [];
  let cursor = "s0";
  for (let round = 0; round < 5; round += 1) {
    const newer = all.filter((row) => Number(row.signature!.slice(1)) > Number(cursor.slice(1)));
    const window = planSignatureWindow(newer, { incrementalWithCursor: true });
    if (!window.ordered.length) break;
    seen.push(...window.ordered.map((entry) => entry.signature));
    cursor = nextSyncCursor({ previousCursor: cursor, mode: "incremental", window, usableCount: window.ordered.length })!;
  }
  assert.equal(seen.length, 130);
  assert.equal(new Set(seen).size, 130);
});

test("failed transactions are counted but never processed, and trailing failures move the cursor", () => {
  const input: SignatureRow[] = [{ signature: "s5", err: {} }, { signature: "s4", err: {} }, { signature: "s3" }, { signature: "s2", err: {} }];
  const window = planSignatureWindow(input, { incrementalWithCursor: true });
  assert.deepEqual(window.ordered.map((entry) => entry.signature), ["s3"]);
  assert.equal(window.failedTransactions, 3);
  assert.equal(window.windowEnd, "s5");
  assert.equal(window.hasMore, false);
});

test("a first sync looks only at the newest successful transactions and does not backfill", () => {
  const window = planSignatureWindow(rows(200), { incrementalWithCursor: false });
  assert.equal(window.ordered.length, 50);
  assert.equal(window.ordered[0].signature, "s151");
  assert.equal(window.ordered[49].signature, "s200");
  assert.equal(window.windowEnd, "s200");
  assert.equal(window.hasMore, false);
});

test("when the provider drops a transaction the cursor stops before it", () => {
  const window = planSignatureWindow(rows(10), { incrementalWithCursor: true });
  assert.equal(nextSyncCursor({ previousCursor: "s0", mode: "incremental", window, usableCount: 4 }), "s4");
});

test("a rescan never moves an existing cursor", () => {
  const window = planSignatureWindow(rows(10), { incrementalWithCursor: false });
  assert.equal(nextSyncCursor({ previousCursor: "s3", mode: "rescan", window, usableCount: window.ordered.length }), "s3");
  assert.equal(nextSyncCursor({ previousCursor: null, mode: "rescan", window, usableCount: window.ordered.length }), "s10");
});
