import assert from "node:assert/strict";
import test from "node:test";

import { formatPercent, formatQuantity, formatRealizedPnl, formatSol, formatUsd } from "../src/lib/utils.ts";

test("displayed SOL values round to exactly two decimal places by default", () => {
  assert.equal(formatSol(2.481676376620936), "2.48");
  assert.equal(formatSol(0.9926705506483744), "0.99");
  assert.equal(formatSol(1), "1.00");
});

test("formatting does not mutate or reduce the source value", () => {
  const value = 3.4743469272693104;
  formatSol(value);
  assert.equal(value, 3.4743469272693104);
});

test("shared financial formatters keep signs, currencies, and precision consistent", () => {
  assert.equal(formatUsd(12.345, { signed: true }), "+$12.35");
  assert.equal(formatUsd(-12.345, { signed: true }), "−$12.35");
  assert.equal(formatRealizedPnl(1.236, "SOL"), "+1.24 SOL");
  assert.equal(formatRealizedPnl(-1.236, "SOL"), "-1.24 SOL");
  assert.equal(formatPercent(66.666, 1), "66.7%");
  assert.equal(formatQuantity(0.123456, 4), "0.1235");
});
