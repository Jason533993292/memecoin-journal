import assert from "node:assert/strict";
import test from "node:test";
import { stripUndefinedFields } from "../src/lib/firestoreSanitize.ts";

test("Firestore payloads remove undefined optional fields without removing null or zero", () => {
  const payload = stripUndefinedFields({
    processGrade: undefined,
    pnlSol: 0,
    notes: null,
    fills: [{ note: undefined, feeSol: 0 }],
  });
  assert.deepEqual(payload, { pnlSol: 0, notes: null, fills: [{ feeSol: 0 }] });
});
