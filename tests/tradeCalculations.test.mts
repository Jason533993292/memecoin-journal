import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateTradeOutcome,
  getRMultiple,
  getTradeBoughtUsd,
  getTradeSoldUsd,
  getUsdValueStatus,
  normalizeTrade,
} from "../src/lib/tradeCalculations.ts";

test("calculates realized R-multiple only when planned risk is valid", () => {
  const base = normalizeTrade({ id: "risk", ca: "ca", name: "Risk", symbol: "RISK", wallet: "Main", result: "Win", boughtSol: 1, pnlSol: 0.6, mistakes: [] });
  assert.ok(Math.abs((getRMultiple({ ...base, initialRiskSol: 0.2 }) || 0) - 3) < 0.000001);
  assert.equal(getRMultiple({ ...base, initialRiskSol: 0 }), null);
  assert.equal(getRMultiple(base), null);
});

test("normalizes a legacy createdAt timestamp without rewriting the trade", () => {
  const trade = normalizeTrade({
    id: "legacy",
    ca: "ca",
    name: "Legacy",
    symbol: "LEG",
    wallet: "Main",
    result: "Win",
    boughtSol: 1,
    pnlSol: 0.5,
    pnlUsd: 50,
    mistakes: [],
    createdAt: 1_700_000_000_000,
  });

  assert.equal(trade.tradedAt, 1_700_000_000_000);
});

test("uses the stored historical SOL rate before a current estimate", () => {
  const trade = normalizeTrade({
    id: "historical",
    ca: "ca",
    name: "Historical",
    symbol: "HIS",
    wallet: "Main",
    result: "Win",
    boughtSol: 1,
    pnlSol: 0.5,
    pnlUsd: 0,
    mistakes: [],
    solUsdRate: 80,
    solUsdRateSource: "live-at-entry",
  });

  assert.deepEqual(getUsdValueStatus(trade, 150), { value: 0, source: "stored" });
  assert.equal(calculateTradeOutcome(trade, 150).pnlUsd, 0);
});

test("labels a missing USD value as an estimate instead of historical fact", () => {
  const trade = normalizeTrade({
    id: "estimated",
    ca: "ca",
    name: "Estimated",
    symbol: "EST",
    wallet: "Main",
    result: "Win",
    boughtSol: 1,
    pnlSol: 0.5,
    mistakes: [],
  });

  assert.deepEqual(getUsdValueStatus(trade, 150), { value: 75, source: "estimated" });
});

test("uses the saved entry conversion rate for missing historical USD amounts", () => {
  const trade = normalizeTrade({
    id: "stored-rate",
    ca: "ca",
    name: "Stored Rate",
    symbol: "RATE",
    wallet: "Main",
    result: "Win",
    boughtSol: 1,
    soldSol: 1.5,
    pnlSol: 0.5,
    mistakes: [],
    solUsdRate: 80,
    solUsdRateSource: "live-at-entry",
  });

  assert.deepEqual(getUsdValueStatus(trade, 150), { value: 40, source: "stored" });
  assert.deepEqual(getTradeBoughtUsd(trade, 150), { value: 80, source: "stored" });
  assert.deepEqual(getTradeSoldUsd(trade, 150), { value: 120, source: "stored" });
});
