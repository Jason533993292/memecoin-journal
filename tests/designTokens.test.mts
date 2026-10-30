import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("semantic interface tokens are documented and used by shared cards", async () => {
  const [css, docs] = await Promise.all([
    readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../docs/design-tokens.md", import.meta.url), "utf8"),
  ]);
  for (const token of ["--ui-page", "--ui-surface", "--ui-raised", "--ui-border", "--ui-text", "--ui-muted", "--ui-accent", "--ui-card-shadow"]) {
    assert.match(css, new RegExp(token));
    assert.match(docs, new RegExp(token));
  }
  assert.match(css, /\.analytics-card/);
});
