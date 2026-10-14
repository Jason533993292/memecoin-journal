import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const required = [
  "NEXT_PUBLIC_DATA_BACKEND",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON",
];

const firebaseDefaults = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "AIzaSyDS2Rj1M0Jekub0uiUq_gjY0vylYvlmTa4",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "memecoin-journal.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "memecoin-journal",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "memecoin-journal.firebasestorage.app",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "748290550330",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:748290550330:web:04a33a9a36541e0f062303",
};

const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  throw new Error(`Missing deployment variables: ${missing.join(", ")}`);
}

const value = (name) => process.env[name].trim();
const firebaseValue = (name) => process.env[name]?.trim() || firebaseDefaults[name];
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const fetchWithTimeout = (url, init = {}) =>
  fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });

assert(value("NEXT_PUBLIC_DATA_BACKEND") === "supabase", "NEXT_PUBLIC_DATA_BACKEND must equal supabase.");

const supabaseUrl = value("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
assert(supabaseUrl === "https://tndqtaouizztihzggwnh.supabase.co", "The Supabase URL does not match this project.");

const publishableKey = value("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const serviceRoleKey = value("SUPABASE_SERVICE_ROLE_KEY");
assert(publishableKey.startsWith("sb_publishable_"), "The Supabase browser key must begin with sb_publishable_.");
assert(serviceRoleKey.startsWith("sb_secret_") || serviceRoleKey.split(".").length === 3, "The Supabase server key is not a secret/service-role key.");

async function verifySupabaseKey(label, key) {
  const response = await fetchWithTimeout(`${supabaseUrl}/rest/v1/trades?select=id&limit=1`, {
    headers: { apikey: key },
  });
  assert(response.ok, `${label} was rejected by Supabase (HTTP ${response.status}).`);
  console.log(`PASS: ${label} is accepted by Supabase.`);
}

await verifySupabaseKey("Supabase publishable key", publishableKey);
await verifySupabaseKey("Supabase server key", serviceRoleKey);

const firebaseApiKey = firebaseValue("NEXT_PUBLIC_FIREBASE_API_KEY");
assert(firebaseApiKey.startsWith("AIza"), "The Firebase web API key has an unexpected format.");
assert(firebaseValue("NEXT_PUBLIC_FIREBASE_PROJECT_ID") === "memecoin-journal", "The Firebase project ID must be memecoin-journal.");
assert(firebaseValue("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN") === "memecoin-journal.firebaseapp.com", "The Firebase auth domain does not match this project.");
assert(firebaseValue("NEXT_PUBLIC_FIREBASE_APP_ID").startsWith("1:748290550330:web:"), "The Firebase app ID does not match this web app.");
assert(/^\d+$/.test(firebaseValue("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID")), "The Firebase messaging sender ID is invalid.");

const appCheckSiteKey = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY?.trim();
if (appCheckSiteKey) {
  assert(appCheckSiteKey.length >= 20, "The Firebase App Check site key is invalid.");
  console.log("PASS: Firebase App Check site key is configured.");
} else {
  console.log("INFO: Firebase App Check is not configured, so the client leaves it inactive.");
}

const firebaseConfigResponse = await fetchWithTimeout(
  `https://identitytoolkit.googleapis.com/v1/projects?key=${encodeURIComponent(firebaseApiKey)}`
);
assert(firebaseConfigResponse.ok, `Firebase rejected the web API key (HTTP ${firebaseConfigResponse.status}).`);
console.log("PASS: Firebase web API key is accepted by Identity Toolkit.");

let credentials;
try {
  credentials = JSON.parse(value("FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON"));
} catch {
  throw new Error("FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON is not valid JSON.");
}
assert(credentials.project_id === "memecoin-journal", "The Firebase Admin credential belongs to the wrong project.");
assert(credentials.client_email && credentials.private_key, "The Firebase Admin credential is incomplete.");

const adminApp = initializeApp({ credential: cert(credentials) }, `deployment-check-${Date.now()}`);
await getAuth(adminApp).listUsers(1);
console.log("PASS: Firebase Admin credential can access Firebase Authentication.");
console.log("PASS: required deployment variables are present and correctly scoped.");

process.exit(0);
