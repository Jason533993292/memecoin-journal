import assert from "node:assert/strict";
import test from "node:test";
import { TRADE_BADGE_LABELS, TRADE_BADGE_STYLES } from "../src/lib/tradeBadges.ts";

test("trade mode and outcome badges have one complete shared vocabulary", () => {
  assert.deepEqual(Object.keys(TRADE_BADGE_LABELS).sort(), ["BE", "Loss", "Win", "live", "paper"]);
  assert.equal(TRADE_BADGE_LABELS.BE, "Breakeven");
});

test("every trade badge uses a shared theme-aware semantic style without a bright outline", () => {
  for (const [kind, styles] of Object.entries(TRADE_BADGE_STYLES)) {
    assert.match(styles, new RegExp(`trade-status-${kind === "BE" ? "breakeven" : kind.toLowerCase()}`));
    assert.doesNotMatch(styles, /border-(?:white|indigo|sky|emerald|rose)/);
  }
});
