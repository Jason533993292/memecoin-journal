import assert from "node:assert/strict";
import test from "node:test";

import { getPreviewThemeFromSearch, isThemePreviewEnabled } from "../src/lib/themePreview.ts";

test("enables preview mode only when theme-preview equals 1", () => {
  assert.equal(isThemePreviewEnabled("?theme-preview=1"), true);
  assert.equal(isThemePreviewEnabled("?theme-preview=0"), false);
  assert.equal(isThemePreviewEnabled(""), false);
});

test("accepts only supported preview themes from the URL", () => {
  assert.equal(getPreviewThemeFromSearch("?theme=terminal"), "terminal");
  assert.equal(getPreviewThemeFromSearch("?theme=premium-journal"), "premium-journal");
  assert.equal(getPreviewThemeFromSearch("?theme=modern-platform"), "modern-platform");
  assert.equal(getPreviewThemeFromSearch("?theme=unknown"), "modern-platform");
});
