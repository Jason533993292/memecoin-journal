import assert from "node:assert/strict";
import test from "node:test";
import { ACCOUNT_SECURITY_EVENT_LABELS, parseAccountSecurityEvent } from "../src/lib/securityHistory.ts";

test("security history accepts only supported account events", () => {
  assert.equal(parseAccountSecurityEvent({ eventType: "password_reset_requested" }), "password_reset_requested");
  assert.equal(parseAccountSecurityEvent({ eventType: "admin_override" }), null);
  assert.equal(parseAccountSecurityEvent("signed_out"), null);
});

test("every accepted security event has a user-facing label", () => {
  for (const eventType of ["password_reset_requested", "verification_email_requested", "trading_data_deleted", "signed_out"] as const) {
    assert.ok(ACCOUNT_SECURITY_EVENT_LABELS[eventType].length > 5);
  }
});
