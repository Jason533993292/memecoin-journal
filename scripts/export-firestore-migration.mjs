import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("Set FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON in your local environment.");

let credentials;
try {
  credentials = JSON.parse(rawCredentials);
} catch {
  throw new Error("FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON must contain valid JSON.");
}
if (credentials.project_id !== "memecoin-journal" || !credentials.client_email || !credentials.private_key) {
  throw new Error("The service account must belong to the memecoin-journal Firebase project.");
}

const app = getApps()[0] ?? initializeApp({
  credential: cert({
    projectId: credentials.project_id,
    clientEmail: credentials.client_email,
    privateKey: credentials.private_key,
  }),
});
const db = getFirestore(app);
const toJsonSafe = (value) => {
  if (value && typeof value.toDate === "function") return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !/(api.?key|access.?token|refresh.?token|secret|private.?key|credential)/i.test(key))
      .map(([key, item]) => [key, toJsonSafe(item)]));
  }
  return value;
};

const usersSnapshot = await db.collection("users").listDocuments();
const users = [];
for (const userRef of usersSnapshot) {
  const [trades, wallets, walletTransactions, preferences, walletConfig] = await Promise.all([
    userRef.collection("trades").get(),
    userRef.collection("wallets").get(),
    userRef.collection("walletTransactions").get(),
    userRef.collection("settings").doc("preferences").get(),
    userRef.collection("settings").doc("walletConfig").get(),
  ]);
  users.push({
    uid: userRef.id,
    trades: trades.docs.map((doc) => ({ id: doc.id, data: toJsonSafe(doc.data()) })),
    wallets: wallets.docs.map((doc) => ({ id: doc.id, data: toJsonSafe(doc.data()) })),
    walletTransactions: walletTransactions.docs.map((doc) => ({ id: doc.id, data: toJsonSafe(doc.data()) })),
    settings: [preferences, walletConfig]
      .filter((snapshot) => snapshot.exists)
      .map((snapshot) => ({ id: snapshot.id, data: toJsonSafe(snapshot.data()) })),
  });
}

const outputPath = resolve(process.argv[2] || "migration-data/firestore-export.json");
await mkdir(dirname(outputPath), { recursive: true, mode: 0o700 });
await writeFile(outputPath, JSON.stringify({ exportedAt: new Date().toISOString(), users }, null, 2), { mode: 0o600 });
const totals = users.reduce((sum, user) => ({
  users: sum.users + 1,
  trades: sum.trades + user.trades.length,
  wallets: sum.wallets + user.wallets.length,
  walletTransactions: sum.walletTransactions + user.walletTransactions.length,
  settings: sum.settings + user.settings.length,
}), { users: 0, trades: 0, wallets: 0, walletTransactions: 0, settings: 0 });
console.log(`Export complete: ${JSON.stringify(totals)}. Private export saved to ${outputPath}`);
