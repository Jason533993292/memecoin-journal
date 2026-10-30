import assert from "node:assert/strict";
import test from "node:test";
import { TRADE_BADGE_LABELS, TRADE_BADGE_STYLES } from "../src/lib/tradeBadges.ts";

test("trade mode and outcome badges have one complete shared vocabulary", () => {
  assert.deepEqual(Object.keys(TRADE_BADGE_LABELS).sort(), ["BE", "Loss", "Win", "live", "paper"]);
  assert.equal(TRADE_BADGE_LABELS.BE, "Breakeven");
});

test("every trade badge uses a visible border, background, and text color", () => {
  for (const styles of Object.values(TRADE_BADGE_STYLES)) {
    assert.match(styles, /border-/);
    assert.match(styles, /bg-/);
    assert.match(styles, /text-/);
  }
});
