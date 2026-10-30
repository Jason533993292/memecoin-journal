import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("the equity chart exposes a legend, a descriptive empty state, and an accessible chart label", async () => {
  const source = await readFile(new URL("../src/components/EquityCurveCard.tsx", import.meta.url), "utf8");
  assert.match(source, /<ChartLegend/);
  assert.match(source, /<ChartEmptyState/);
  assert.match(source, /role="img"/);
  assert.match(source, /aria-label=/);
});
