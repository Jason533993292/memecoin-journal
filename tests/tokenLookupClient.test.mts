import assert from "node:assert/strict";
import test from "node:test";

import { lookupTokenMetadata } from "../src/lib/tokenLookupClient.ts";

test("looks up a token through the authenticated server fallback route", async () => {
  let requestedUrl = "";
  let authorization = "";
  const fetchImpl: typeof fetch = async (input, init) => {
    requestedUrl = String(input);
    authorization = new Headers(init?.headers).get("Authorization") || "";
    return Response.json({
      name: "Bonk",
      symbol: "BONK",
      priceUsd: "0.00002",
      marketCap: 1_000_000,
      liquidity: 250_000,
      imageUrl: "https://example.com/bonk.png",
    });
  };

  const result = await lookupTokenMetadata("Mint/With Space", "firebase-token", fetchImpl);

  assert.equal(requestedUrl, "/api/token/Mint%2FWith%20Space");
  assert.equal(authorization, "Bearer firebase-token");
  assert.deepEqual(result, {
    data: {
      name: "Bonk",
      symbol: "BONK",
      priceUsd: "0.00002",
      marketCap: 1_000_000,
      liquidity: 250_000,
      imageUrl: "https://example.com/bonk.png",
    },
    error: null,
  });
});

test("returns the server's actionable token lookup error", async () => {
  const fetchImpl: typeof fetch = async () => Response.json(
    { error: "Token not found on supported market-data services." },
    { status: 404 }
  );

  const result = await lookupTokenMetadata("Mint", "firebase-token", fetchImpl);

  assert.deepEqual(result, {
    data: null,
    error: "Token not found on supported market-data services.",
  });
});
