import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const baseUrl = (process.env.STAGING_BASE_URL || "").trim().replace(/\/$/, "");
const firebaseApiKey = process.env.STAGING_FIREBASE_API_KEY?.trim();
const supabaseUrl = process.env.STAGING_SUPABASE_URL?.trim();
const publishableKey = process.env.STAGING_SUPABASE_PUBLISHABLE_KEY?.trim();

if (!baseUrl || !firebaseApiKey || !supabaseUrl || !publishableKey) {
  throw new Error("Set STAGING_BASE_URL, STAGING_FIREBASE_API_KEY, STAGING_SUPABASE_URL, and STAGING_SUPABASE_PUBLISHABLE_KEY.");
}
if (!/staging/i.test(baseUrl) && process.env.ALLOW_NON_STAGING_TARGET !== "true") {
  throw new Error("Refusing to create disposable accounts outside a staging URL. Set ALLOW_NON_STAGING_TARGET=true only for an intentional test environment.");
}

const runId = `${Date.now()}-${randomBytes(4).toString("hex")}`;
const password = `Staging-${randomBytes(18).toString("base64url")}!7`;

async function firebaseRequest(path, body) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/${path}?key=${encodeURIComponent(firebaseApiKey)}`, {
    method: "POST",
    signal: AbortSignal.timeout(20_000),
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Firebase ${path} failed: ${data?.error?.message || response.status}`);
  return data;
}

async function createDisposableUser(label) {
  const email = `memecoin-journal-${label}-${runId}@example.com`;
  const created = await firebaseRequest("accounts:signUp", { email, password, returnSecureToken: true });
  const roleResponse = await fetch(`${baseUrl}/api/auth/supabase-role`, {
    method: "POST",
    signal: AbortSignal.timeout(20_000),
    headers: { authorization: `Bearer ${created.idToken}` },
  });
  if (!roleResponse.ok) throw new Error(`${label} role bridge returned HTTP ${roleResponse.status}.`);

  const refreshResponse = await fetch(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(firebaseApiKey)}`, {
    method: "POST",
    signal: AbortSignal.timeout(20_000),
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: created.refreshToken }),
  });
  const refreshed = await refreshResponse.json();
  if (!refreshResponse.ok) throw new Error(`${label} token refresh failed.`);
  return { email, uid: created.localId, token: refreshed.id_token };
}

function clientFor(user) {
  return createClient(supabaseUrl, publishableKey, {
    accessToken: async () => user.token,
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function expectNoError(label, operation) {
  const result = await operation;
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

async function deleteAccount(user) {
  const response = await fetch(`${baseUrl}/api/account/delete`, {
    method: "POST",
    signal: AbortSignal.timeout(60_000),
    headers: { authorization: `Bearer ${user.token}` },
  });
  if (!response.ok) throw new Error(`Cleanup for ${user.email} returned HTTP ${response.status}.`);
}

const users = [];
try {
  users.push(await createDisposableUser("a"));
  users.push(await createDisposableUser("b"));
  const [userA, userB] = users;
  const [clientA, clientB] = users.map(clientFor);
  const now = new Date().toISOString();
  const tradeIdA = `rls-a-${runId}`;
  const tradeIdB = `rls-b-${runId}`;
  const trade = (user, id) => ({
    user_id: user.uid,
    id,
    ca: "",
    name: "Automated staging privacy check",
    symbol: "TEST",
    wallet: "Paper",
    result: "Win",
    setup_type: "Release verification",
    bought_sol: 1,
    pnl_sol: 0.1,
    pnl_usd: 10,
    date: now,
    created_at: now,
  });

  await expectNoError("user A insert", clientA.from("trades").insert(trade(userA, tradeIdA)));
  await expectNoError("user B insert", clientB.from("trades").insert(trade(userB, tradeIdB)));

  const visibleToA = await expectNoError("user A select", clientA.from("trades").select("id,user_id").in("id", [tradeIdA, tradeIdB]));
  const visibleToB = await expectNoError("user B select", clientB.from("trades").select("id,user_id").in("id", [tradeIdA, tradeIdB]));
  if (visibleToA.length !== 1 || visibleToA[0].id !== tradeIdA || visibleToA[0].user_id !== userA.uid) {
    throw new Error("User A could see data outside its account.");
  }
  if (visibleToB.length !== 1 || visibleToB[0].id !== tradeIdB || visibleToB[0].user_id !== userB.uid) {
    throw new Error("User B could see data outside its account.");
  }

  const crossUpdate = await expectNoError("cross-account update", clientA.from("trades").update({ notes: "must not apply" }).eq("id", tradeIdB).select("id"));
  const crossDelete = await expectNoError("cross-account delete", clientA.from("trades").delete().eq("id", tradeIdB).select("id"));
  if (crossUpdate.length || crossDelete.length) throw new Error("Cross-account mutation unexpectedly affected a row.");

  const userBStillOwnsTrade = await expectNoError("user B verification", clientB.from("trades").select("id,notes").eq("id", tradeIdB).single());
  if (userBStillOwnsTrade.id !== tradeIdB || userBStillOwnsTrade.notes === "must not apply") {
    throw new Error("User B record changed during cross-account mutation test.");
  }

  console.log("PASS two disposable Firebase accounts can use the staging Supabase bridge.");
  console.log("PASS each account can see only its own rows.");
  console.log("PASS cross-account update and delete attempts affect zero rows.");
} finally {
  const cleanup = await Promise.allSettled(users.map(deleteAccount));
  const failures = cleanup.filter((result) => result.status === "rejected");
  if (failures.length) {
    throw new Error(`Privacy checks finished, but ${failures.length} disposable account cleanup operation(s) failed.`);
  }
  if (users.length) console.log(`PASS cleaned up ${users.length} disposable staging accounts.`);
}

