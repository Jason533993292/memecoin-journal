import assert from "node:assert/strict";
import test from "node:test";

import { buildTradeAmounts, calculateTradePnl, isValidSolAmount, parseQuickTradePaste, reinterpretAmountForCurrency } from "../src/lib/tradeInput.ts";

const DIGIT_HEAVY_ADDRESS = "So11111111111111111111111111111111111111112";

test("quick paste never treats digits in a Solana address as a trade amount", () => {
  const result = parseQuickTradePaste(`${DIGIT_HEAVY_ADDRESS} 0.5 0.25`);

  assert.equal(result.contractAddress, DIGIT_HEAVY_ADDRESS);
  assert.equal(result.bought, "0.5");
  assert.equal(result.sold, "0.25");
});

test("quick paste prioritizes labelled amounts", () => {
  const result = parseQuickTradePaste(`buy: 0.75 ${DIGIT_HEAVY_ADDRESS} sold=1.2`);

  assert.equal(result.bought, "0.75");
  assert.equal(result.sold, "1.2");
});

test("quick paste leaves amounts empty when only a contract address is supplied", () => {
  const result = parseQuickTradePaste(DIGIT_HEAVY_ADDRESS);

  assert.equal(result.contractAddress, DIGIT_HEAVY_ADDRESS);
  assert.equal(result.bought, undefined);
  assert.equal(result.sold, undefined);
});

test("explicit zero sale proceeds are preserved for a fee-adjusted loss", () => {
  const result = buildTradeAmounts({
    boughtSol: "0.1",
    soldSol: "0",
    pnlSol: "-0.11",
    boughtUsd: "10",
    soldUsd: "0",
    pnlUsd: "-11",
    solPrice: 100,
  });

  assert.deepEqual(result, {
    boughtSol: 0.1,
    soldSol: 0,
    pnlSol: -0.11,
    boughtUsd: 10,
    soldUsd: 0,
    pnlUsd: -11,
  });
});

test("derived sale proceeds never become negative", () => {
  const result = buildTradeAmounts({
    boughtSol: "0.1",
    soldSol: "",
    pnlSol: "-0.11",
    boughtUsd: "10",
    soldUsd: "",
    pnlUsd: "-11",
    solPrice: 100,
  });

  assert.equal(result.soldSol, 0);
  assert.equal(result.soldUsd, 0);
});

test("quick-paste bought and sold values calculate a complete P&L", () => {
  const pasted = parseQuickTradePaste(`${DIGIT_HEAVY_ADDRESS} bought 0.5 sold 0.75`);
  const pnl = calculateTradePnl(Number(pasted.bought), Number(pasted.sold), 150);

  assert.deepEqual(pnl, { pnlSol: "0.250", pnlUsd: "37.50", result: "Win" });
});

test("SOL amounts preserve lamport precision and reject unsupported precision or range", () => {
  assert.equal(isValidSolAmount(0.000000001), true);
  assert.equal(isValidSolAmount(1.000000001), true);
  assert.equal(isValidSolAmount(1.0000000001), false);
  assert.equal(isValidSolAmount(100_000_001), false);
  assert.equal(isValidSolAmount(0, false), false);
});

test("switching from SOL to USD keeps the visible number and reinterprets its unit", () => {
  assert.deepEqual(reinterpretAmountForCurrency("1", "USD", 150), {
    sol: "0.006666667",
    usd: "1",
  });
});

test("switching from USD to SOL keeps the visible number and updates the hidden USD value", () => {
  assert.deepEqual(reinterpretAmountForCurrency("1", "SOL", 150), {
    sol: "1",
    usd: "150.00",
  });
});
