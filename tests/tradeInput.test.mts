import assert from "node:assert/strict";
import test from "node:test";

import { buildTradeAmounts, parseQuickTradePaste } from "../src/lib/tradeInput.ts";

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
