import assert from "node:assert/strict";
import test from "node:test";
import { buildPerformanceReport } from "../src/lib/performanceReport.ts";
import type { Trade } from "../src/lib/types.ts";

const trade = (id: string, day: number, pnlSol: number, setupType: string, mistakes: string[] = []): Trade => ({ id, ca: id, name: id, symbol: id, wallet: "Main", result: pnlSol > 0 ? "Win" : "Loss", boughtSol: 1, pnlSol, pnlUsd: pnlSol * 100, mistakes, setupType, feesSol: 0.01, date: new Date(2026, 9, day) });

test("weekly performance reports keep sample sizes and repeated behavior visible", () => {
  const report = buildPerformanceReport([
    trade("a", 29, 2, "Breakout", ["Chased entry"]),
    trade("b", 28, -1, "Breakout", ["Chased entry"]),
    trade("old", 20, 5, "Pullback"),
  ], "week", new Date(2026, 9, 29, 12), 100);
  assert.equal(report.count, 2);
  assert.equal(report.winRate, 50);
  assert.equal(report.pnlSol, 1);
  assert.equal(report.bestSetup?.name, "Breakout");
  assert.deepEqual(report.repeatedMistake, { name: "Chased entry", count: 2 });
  assert.equal(report.feesSol, 0.02);
});

test("monthly performance reports compare the prior calendar month", () => {
  const report = buildPerformanceReport([
    trade("current", 10, 3, "Range"),
    { ...trade("previous", 30, -2, "Range"), date: new Date(2026, 8, 30) },
  ], "month", new Date(2026, 9, 29), 100);
  assert.equal(report.count, 1);
  assert.equal(report.pnlSol, 3);
  assert.equal(report.previousPnlSol, -2);
});
