import assert from "node:assert/strict";
import test from "node:test";
import { MARKET_ASSETS, isMarketAssetSymbol } from "../src/lib/marketAssets.ts";

test("market price selector exposes only the supported assets", () => {
  assert.deepEqual(Object.keys(MARKET_ASSETS), ["SOL", "ETH", "BNB"]);
});

test("market price asset validation rejects arbitrary upstream identifiers", () => {
  assert.equal(isMarketAssetSymbol("SOL"), true);
  assert.equal(isMarketAssetSymbol("ETH"), true);
  assert.equal(isMarketAssetSymbol("BNB"), true);
  assert.equal(isMarketAssetSymbol("BTC"), false);
  assert.equal(isMarketAssetSymbol("solana"), false);
  assert.equal(isMarketAssetSymbol(null), false);
});
