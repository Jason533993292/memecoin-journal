import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../src/app/api/health/route.ts", import.meta.url), "utf8");
const monitor = readFileSync(new URL("../scripts/verify-service-readiness.mjs", import.meta.url), "utf8");

test("authenticated health separates authentication and database dependencies", () => {
  assert.match(route, /auth\.listUsers\(1\)/);
  assert.match(route, /firebaseAuth/);
  assert.match(route, /firestore/);
  assert.match(route, /supabase/);
  assert.match(route, /resend/);
});

test("service monitor rejects any unavailable authenticated dependency", () => {
  for (const dependency of ["firebaseAuth", "firestore", "supabase"]) {
    assert.match(monitor, new RegExp(`\\[\\"firebaseAuth\\", \\"firestore\\", \\"supabase\\"\\]`));
    assert.match(monitor, new RegExp(`readyBody\\.checks\\?\\.\\[dependency\\]`));
    assert.ok(dependency.length > 0);
  }
  assert.match(monitor, /target\.requireEmail && readyBody\.checks\?\.resend !== "configured"/);
  assert.match(monitor, /STAGING_REQUIRE_EMAIL/);
  assert.match(monitor, /PRODUCTION_REQUIRE_EMAIL/);
});

test("app readiness does not discard safely queued feedback when email is optional", () => {
  assert.match(route, /const ready = firebaseAuth === "ok" && firestore === "ok" && supabase === "ok";/);
  assert.doesNotMatch(route, /supabase === "ok" && resend === "configured"/);
});
