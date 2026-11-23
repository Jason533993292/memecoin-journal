import assert from "node:assert/strict";
import test from "node:test";
import { compareSnapshots, parseSnapshot } from "../scripts/restore-drill-compare.mjs";

test("restore comparison detects policy changes even when policy counts match", () => {
  const source = parseSnapshot("policy|public.trades.owner_only|hash-a\nrows|public.trades|4");
  const restored = parseSnapshot("policy|public.trades.owner_only|hash-b\nrows|public.trades|4");
  assert.equal(compareSnapshots(source, restored).failures.length, 1);
});

test("restore comparison detects exact grants and owners", () => {
  const source = parseSnapshot("grant|public.trades.authenticated.SELECT|a\ntable_owner|public.trades|postgres");
  const restored = parseSnapshot("grant|public.trades.authenticated.SELECT|b\ntable_owner|public.trades|other");
  assert.equal(compareSnapshots(source, restored).failures.length, 2);
});

test("older backup row counts are notes, not failures", () => {
  const result = compareSnapshots(parseSnapshot("rows|public.trades|8"), parseSnapshot("rows|public.trades|6"));
  assert.deepEqual(result.failures, []);
  assert.equal(result.notes.length, 1);
});

test("duplicate snapshot keys are rejected", () => {
  assert.throws(() => parseSnapshot("rows|public.trades|1\nrows|public.trades|1"), /Duplicate/);
});
