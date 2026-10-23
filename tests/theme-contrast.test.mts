import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { contrastRatio } from "../src/lib/contrast.ts";

const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const themes = ["terminal", "premium-journal", "modern-platform", "ocean", "graphite"];

function themeVariable(theme: string, variable: string) {
  const block = css.match(new RegExp(`html\\[data-theme-preview="${theme}"\\] \\{([\\s\\S]*?)\\n\\}`))?.[1];
  assert.ok(block, `Missing CSS variables for ${theme}`);
  const value = block.match(new RegExp(`--${variable}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
  assert.ok(value, `Missing --${variable} for ${theme}`);
  return value;
}

for (const theme of themes) {
  test(`${theme} theme meets normal-text contrast targets`, () => {
    const surface = themeVariable(theme, "preview-surface");
    const input = themeVariable(theme, "preview-input");

    assert.ok(contrastRatio(themeVariable(theme, "preview-text"), surface) >= 4.5, "primary text on surface");
    assert.ok(contrastRatio(themeVariable(theme, "preview-muted"), surface) >= 4.5, "muted text on surface");
    assert.ok(contrastRatio(themeVariable(theme, "preview-subtle"), input) >= 4.5, "subtle text on input");
  });
}
