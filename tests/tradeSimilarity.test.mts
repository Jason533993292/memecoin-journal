import assert from "node:assert/strict";
import test from "node:test";
import type { Trade } from "../src/lib/types.ts";
import { findSimilarTrades } from "../src/lib/tradeSimilarity.ts";

const trade = (id: string, overrides: Partial<Trade> = {}): Trade => ({
  id, ca: id, name: id, symbol: id, wallet: "Main", result: "Win", setupType: "Breakout", boughtSol: 1, soldSol: 1.2,
  boughtUsd: 100, soldUsd: 120, pnlSol: 0.2, pnlUsd: 20, mistakes: [], goodTags: [], isPaper: false, notes: "", screenshotUrl: "",
  durationMinutes: 10, date: new Date("2026-01-01"), createdAt: 1, ...overrides,
});

test("similar trades prioritize exact token, playbook, and tag overlap", () => {
  const source = trade("source", { ca: "same", playbookId: "breakout", goodTags: ["patient"] });
  const matches = findSimilarTrades(source, [source, trade("token", { ca: "same", setupType: "Range" }), trade("playbook", { playbookId: "breakout", goodTags: ["patient"] }), trade("unrelated", { setupType: "Range", result: "Loss" })]);
  assert.deepEqual(matches.map((match) => match.trade.id), ["token", "playbook"]);
  assert.ok(matches[0].reasons.includes("same token"));
  assert.ok(matches[1].reasons.includes("same playbook"));
});

test("similar trades exclude weak matches and the source trade", () => {
  const source = trade("source", { setupType: "Breakout" });
  const matches = findSimilarTrades(source, [source, trade("weak", { setupType: "Range" })]);
  assert.deepEqual(matches, []);
});
