import assert from "node:assert/strict";
import test from "node:test";
import { parseTradeFilterPresets } from "../src/lib/tradeFilterPresets.ts";

const valid = { id: "one", name: "Focused losses", searchQuery: "", result: "Loss", wallet: "All", setup: "Breakout", mistake: "All", dateRange: "30d", sortBy: "pnl-asc", currency: "SOL", view: "cards" };

test("saved trade views accept bounded supported filter combinations", () => {
  assert.deepEqual(parseTradeFilterPresets(JSON.stringify([valid])), [valid]);
});

test("saved trade views ignore malformed browser data and cap stored presets", () => {
  assert.deepEqual(parseTradeFilterPresets("not-json"), []);
  assert.deepEqual(parseTradeFilterPresets(JSON.stringify([{ ...valid, result: "arbitrary" }])), []);
  assert.equal(parseTradeFilterPresets(JSON.stringify(Array.from({ length: 20 }, (_, index) => ({ ...valid, id: String(index) })))).length, 10);
});
