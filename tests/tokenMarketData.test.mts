import assert from "node:assert/strict";
import test from "node:test";

import { lookupPublicTokenPair, selectSolanaTokenPair } from "../src/lib/tokenMarketData.ts";

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

test("public lookup returns a listed Solana token without Firebase credentials", async () => {
  const mint = "3nUw6gYGCWAVpbaPnwVr3KJuP1unJKUtKmeMNuFzpump";
  const pair = await lookupPublicTokenPair(mint, async () => Response.json({
    schemaVersion: "1.0.0",
    pairs: [{
      chainId: "solana",
      baseToken: { address: mint, name: "Omega Protocol", symbol: "OPROTOCOL" },
      priceUsd: "0.000003431",
      liquidity: { usd: 2_500 },
    }],
  }));

  assert.equal(pair?.baseToken?.name, "Omega Protocol");
});
