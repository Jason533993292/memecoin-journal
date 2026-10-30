import assert from "node:assert/strict";
import test from "node:test";
import { buildContentSecurityPolicy } from "../src/lib/contentSecurityPolicy.ts";

test("browser policy permits both deployed Supabase journals", () => {
  const policy = buildContentSecurityPolicy("test-nonce", { development: false });

  assert.match(policy, /connect-src[^;]*https:\/\/tndqtaouizztihzggwnh\.supabase\.co/);
  assert.match(policy, /connect-src[^;]*https:\/\/klyrrvdoxgriclmbpqoi\.supabase\.co/);
});

test("browser policy accepts only a configured HTTPS Supabase origin", () => {
  const policy = buildContentSecurityPolicy("test-nonce", {
    development: false,
    supabaseUrl: "https://another-safe-project.supabase.co/path",
  });
  assert.match(policy, /https:\/\/another-safe-project\.supabase\.co/);
  assert.doesNotMatch(policy, /\/path/);

  const rejected = buildContentSecurityPolicy("test-nonce", {
    development: false,
    supabaseUrl: "https://supabase.co.attacker.example/path",
  });
  assert.doesNotMatch(rejected, /attacker\.example/);
});
