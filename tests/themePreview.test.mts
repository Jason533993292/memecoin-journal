import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizePreviewTheme,
  PREVIEW_THEME_OPTIONS,
} from "../src/lib/themePreview.ts";

test("keeps the public site on its default appearance until a valid theme is chosen", () => {
  assert.equal(normalizePreviewTheme(null), null);
  assert.equal(normalizePreviewTheme("unknown"), null);
  assert.equal(normalizePreviewTheme("terminal"), "terminal");
});

test("provides the three labelled theme choices for the public picker", () => {
  assert.deepEqual(PREVIEW_THEME_OPTIONS, [
    { id: "terminal", label: "Terminal" },
    { id: "premium-journal", label: "Journal" },
    { id: "modern-platform", label: "Platform" },
  ]);
});
