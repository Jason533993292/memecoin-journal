import assert from "node:assert/strict";
import test from "node:test";
import { hasMeaningfulTradeDraft, parseStoredTradeDraft, tradeDraftStorageKey } from "../src/lib/tradeDraft.ts";

const emptyDraft = {
  ca: "", wallet: "Paper", result: "" as const, setupType: "Breakout / ATH Push", customSetup: "", durationMinutes: 15,
  tradedAtInput: "2026-10-21T12:00", initialRiskSol: "", feesSol: "", stopPrice: "", entryLiquidityUsd: "",
  exitLiquidityUsd: "", entryMarketCapUsd: "", exitMarketCapUsd: "", slippagePct: "", quoteCurrency: "SOL",
  quoteUsdRate: "108", venue: "", otherQuoteSymbol: "", otherVenue: "", boughtQuote: "", soldQuote: "", pnlQuote: "",
  screenshotUrl: "", selectedGoodTags: [], selectedMistakes: [], notes: "", confidenceAtEntry: "50",
};

test("trade drafts use an account-specific browser key", () => {
  assert.equal(tradeDraftStorageKey("abc"), "memecoin_journal_abc_new_trade_draft");
});

test("default fields alone do not create a recoverable draft", () => {
  assert.equal(hasMeaningfulTradeDraft(emptyDraft), false);
  assert.equal(hasMeaningfulTradeDraft({ ...emptyDraft, notes: "Review the breakout" }), true);
});

test("stored drafts reject corrupt or incompatible data", () => {
  assert.equal(parseStoredTradeDraft("not-json"), null);
  assert.equal(parseStoredTradeDraft(JSON.stringify({ version: 2, savedAt: Date.now(), data: emptyDraft })), null);
  const valid = parseStoredTradeDraft(JSON.stringify({ version: 1, savedAt: 123, data: { ...emptyDraft, ca: "mint" } }));
  assert.equal(valid?.data.ca, "mint");
});
