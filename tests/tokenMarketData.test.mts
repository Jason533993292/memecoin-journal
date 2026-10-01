import assert from "node:assert/strict";
import test from "node:test";

import { selectSolanaTokenPair } from "../src/lib/tokenMarketData.ts";

test("selects the highest-liquidity Solana pair for the requested mint only", () => {
  const selected = selectSolanaTokenPair({ pairs: [
    { chainId: "ethereum", baseToken: { address: "Mint", name: "Wrong chain" }, liquidity: { usd: 9_999 } },
    { chainId: "solana", baseToken: { address: "Other", name: "Wrong mint" }, liquidity: { usd: 8_000 } },
    { chainId: "solana", baseToken: { address: "Mint", name: "Right", symbol: "OK" }, liquidity: { usd: 500 } },
  ] }, "Mint");

  assert.equal(selected?.baseToken?.name, "Right");
});

test("returns null when market data has no exact Solana mint match", () => {
  assert.equal(selectSolanaTokenPair({ pairs: [{ chainId: "bsc", baseToken: { address: "Mint" } }] }, "Mint"), null);
});
