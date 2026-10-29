import assert from "node:assert/strict";
import test from "node:test";
import { calculateRiskAnalytics } from "../src/lib/riskAnalytics.ts";
import type { Trade } from "../src/lib/types.ts";

const trade = (overrides: Partial<Trade>): Trade => ({
  id: crypto.randomUUID(), ca: "token", name: "Token", symbol: "TKN", wallet: "Main", result: "Win", setupType: "Breakout",
  boughtSol: 1, soldSol: 1.2, boughtUsd: 100, soldUsd: 120, pnlSol: 0.2, pnlUsd: 20, mistakes: [], goodTags: [], isPaper: false,
  notes: "", screenshotUrl: "", durationMinutes: 1, date: new Date(), createdAt: Date.now(), ...overrides,
});

test("risk analytics separates deployed capital from realized pnl and finds concentration", () => {
  const result = calculateRiskAnalytics([
    trade({ boughtSol: 2, initialRiskSol: 0.2, feesSol: 0.01, wallet: "Main", ca: "a", name: "Alpha", pnlSol: 0.4 }),
    trade({ boughtSol: 1, initialRiskSol: 0.1, feesSol: 0.02, wallet: "Main", ca: "a", name: "Alpha", pnlSol: -0.2 }),
    trade({ boughtSol: 1, wallet: "Second", ca: "b", name: "Beta", pnlSol: 0.1 }),
  ]);
  assert.equal(result.totalCapitalDeployedSol, 4);
  assert.equal(result.recordedRiskCount, 2);
  assert.ok(Math.abs(result.averageInitialRiskSol - 0.15) < 1e-12);
  assert.equal(result.riskBreachCount, 1);
  assert.ok(Math.abs(result.totalFeesSol - 0.03) < 1e-12);
  assert.deepEqual(result.largestWallet, { name: "Main", amountSol: 3, share: 75 });
  assert.deepEqual(result.largestToken, { name: "Alpha", amountSol: 3, share: 75 });
});

test("risk analytics returns safe empty values", () => {
  const result = calculateRiskAnalytics([]);
  assert.equal(result.totalCapitalDeployedSol, 0);
  assert.equal(result.riskBreachCount, 0);
  assert.equal(result.largestWallet, null);
  assert.equal(result.largestToken, null);
});
