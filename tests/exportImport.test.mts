import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTradesCsv,
  parseTradeImport,
  serializeTradesToJson,
  tradeImportKey,
} from "../src/lib/exportImport.ts";

test("CSV imports preserve the exported trade date and supported expert fields", () => {
  const imported = parseTradeImport(
    [
      "Date,Name,Symbol,Contract Address,Wallet,Result,Bought SOL,Sold SOL,Net PnL SOL,Net PnL USD,Setup Type,Duration Mins,MCap USD,Liquidity USD,Price USD,Mistakes / Tags,Good Tags,Notes,Initial Risk SOL,Fees SOL,Entry Liquidity USD,Exit Liquidity USD,Entry MCap USD,Exit MCap USD,Slippage %,SOL/USD Rate,Trade Mode",
      "2024-01-05T12:30:00.000Z,Token,TKN,So11111111111111111111111111111111111111112,Main,Win,1,2,1,100,Setup,15,1000,500,0.01,Chased; Late,Patience; Plan,#note,0.2,0.01,300,400,1000,1200,2,100,real",
    ].join("\n"),
    "csv"
  );

  assert.equal(imported.length, 1);
  assert.equal(imported[0].tradedAt, Date.parse("2024-01-05T12:30:00.000Z"));
  assert.deepEqual(imported[0].goodTags, ["Patience", "Plan"]);
  assert.equal(imported[0].entryLiquidityUsd, 300);
  assert.equal(imported[0].solUsdRate, 100);
});

test("invalid import rows reject the whole import before any write", () => {
  assert.throws(
    () => parseTradeImport('[{"name":"Missing amounts"}]', "json"),
    /row 1/i
  );
});

test("JSON backup round-trips every supported trade field without changing its date", () => {
  const original = {
    id: "trade-1",
    ca: "So11111111111111111111111111111111111111112",
    name: "Full Trade",
    symbol: "FULL",
    wallet: "Main",
    result: "Win" as const,
    setupType: "Breakout",
    boughtSol: 1,
    boughtUsd: 90,
    soldSol: 1.5,
    soldUsd: 135,
    pnlSol: 0.5,
    pnlUsd: 45,
    mistakes: ["Chased"],
    goodTags: ["Waited"],
    screenshotUrl: "data:image/jpeg;base64,abc",
    notes: "#journal, quoted \"note\"",
    durationMinutes: 12,
    initialRiskSol: 0.2,
    stopPrice: 0.001,
    feesSol: 0.01,
    entryLiquidityUsd: 1000,
    exitLiquidityUsd: 1500,
    entryMarketCapUsd: 5000,
    exitMarketCapUsd: 7500,
    slippagePct: 1.5,
    executionType: "momentum" as const,
    wouldTakeAgain: true,
    tradeQualityScore: 8,
    entryTimezoneOffset: -120,
    tradedAt: Date.parse("2024-02-03T10:20:30.000Z"),
    solUsdRate: 90,
    solUsdRateSource: "live-at-entry" as const,
    tradeMode: "real" as const,
    createdAt: Date.parse("2024-02-03T10:21:00.000Z"),
  };

  const [restored] = parseTradeImport(serializeTradesToJson([original]), "json");
  const expected = { ...original } as Partial<typeof original>;
  delete expected.id;

  assert.deepEqual(restored, expected);
});

test("CSV serialization keeps hashes, commas, quotes, and formula prefixes inside fields", () => {
  const csv = buildTradesCsv([{ id: "csv", ca: "ca", name: "=TOKEN", symbol: "T", wallet: "Main", result: "BE", boughtSol: 1, pnlSol: 0, pnlUsd: 0, mistakes: [], notes: "#tag, said \"hello\"", tradedAt: 1_700_000_000_000 }]);
  const [restored] = parseTradeImport(csv, "csv");

  assert.equal(restored.name, "'=TOKEN");
  assert.equal(restored.notes, "#tag, said \"hello\"");
  assert.equal(restored.tradedAt, 1_700_000_000_000);
});

test("JSON import rejects a non-object row instead of silently dropping it", () => {
  assert.throws(
    () => parseTradeImport('[{"name":"valid-looking"}, null]', "json"),
    /row 2/i
  );
});

test("duplicate detection uses the original time, address, and amounts", () => {
  const base = { id: "a", ca: "Mint", name: "A", symbol: "A", wallet: "Main", result: "Win" as const, boughtSol: 1, pnlSol: 0.5, pnlUsd: 50, mistakes: [], tradedAt: 1234 };
  assert.equal(tradeImportKey(base), tradeImportKey({ ...base, id: "b", name: "Renamed" }));
  assert.notEqual(tradeImportKey(base), tradeImportKey({ ...base, pnlSol: 0.6 }));
});
