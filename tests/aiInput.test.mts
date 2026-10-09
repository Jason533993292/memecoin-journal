import assert from "node:assert/strict";
import test from "node:test";

import { isInputTradeRecord } from "../src/lib/aiInput.ts";

test("AI input guard accepts trade records and rejects malformed list entries", () => {
  assert.equal(isInputTradeRecord({ symbol: "TEST", pnlSol: 1 }), true);
  assert.equal(isInputTradeRecord(null), false);
  assert.equal(isInputTradeRecord([]), false);
  assert.equal(isInputTradeRecord("trade"), false);
});
