import assert from "node:assert/strict";
import test from "node:test";

import { formatSol } from "../src/lib/utils.ts";

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
