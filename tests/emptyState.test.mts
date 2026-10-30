import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("major empty screens explain what happened and offer a useful next action", async () => {
  const [journal, statistics] = await Promise.all([
    readFile(new URL("../src/components/TradeJournalView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/StatisticsView.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(journal, /title="No matching trades"/);
  assert.match(journal, /actionLabel="Clear filters"/);
  assert.match(statistics, /title="Analytics begin with your first trade"/);
});
