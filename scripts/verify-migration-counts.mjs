import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const credentialsRaw = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!credentialsRaw || !supabaseUrl || !serviceRoleKey) {
  throw new Error("Set FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON, NEXT_PUBLIC_SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY in your local shell. Never share these values.");
}
if (supabaseUrl !== "https://tndqtaouizztihzggwnh.supabase.co") {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL must be the plain project URL https://tndqtaouizztihzggwnh.supabase.co without Markdown brackets or parentheses.");
}
if (!serviceRoleKey.startsWith("sb_secret_") && serviceRoleKey.split(".").length !== 3) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY must be a current Supabase secret key, not the publishable key.");
}

let credentials;
try { credentials = JSON.parse(credentialsRaw); }
catch { throw new Error("FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON must contain valid JSON."); }
if (credentials.project_id !== "memecoin-journal" || !credentials.client_email || !credentials.private_key) {
  throw new Error("The service account must belong to the memecoin-journal Firebase project.");
}

const app = getApps()[0] ?? initializeApp({
  credential: cert({ projectId: credentials.project_id, clientEmail: credentials.client_email, privateKey: credentials.private_key }),
});
const firestore = getFirestore(app);
const source = new Map();
const fields = ["pnlSol", "pnlUsd", "boughtSol", "boughtUsd", "soldSol", "soldUsd"];
const supabaseFieldNames = {
  pnlSol: "pnl_sol",
  pnlUsd: "pnl_usd",
  boughtSol: "bought_sol",
  boughtUsd: "bought_usd",
  soldSol: "sold_sol",
  soldUsd: "sold_usd",
};
const createAccount = () => ({ trades: 0, wallets: 0, walletTransactions: 0, settings: 0, balanceSol: 0, transactionAmountSol: 0, transactionAmountUsd: 0, ...Object.fromEntries(fields.map((field) => [field, 0])) });

for (const userRef of await firestore.collection("users").listDocuments()) {
  const account = createAccount();
  const [trades, wallets, transactions, preferences, walletConfig] = await Promise.all([
    userRef.collection("trades").get(),
    userRef.collection("wallets").get(),
    userRef.collection("walletTransactions").get(),
    userRef.collection("settings").doc("preferences").get(),
    userRef.collection("settings").doc("walletConfig").get(),
  ]);
  account.trades = trades.size;
  for (const snapshot of trades.docs) {
    const trade = snapshot.data();
    for (const field of fields) if (typeof trade[field] === "number" && Number.isFinite(trade[field])) account[field] += trade[field];
  }
  account.wallets = wallets.size;
  for (const wallet of wallets.docs) if (typeof wallet.data().balanceSol === "number") account.balanceSol += wallet.data().balanceSol;
  account.walletTransactions = transactions.size;
  for (const transaction of transactions.docs) {
    const data = transaction.data();
    if (typeof data.amountSol === "number") account.transactionAmountSol += data.amountSol;
    if (typeof data.amountUsd === "number") account.transactionAmountUsd += data.amountUsd;
  }
  account.settings = Number(preferences.exists) + Number(walletConfig.exists);
  source.set(userRef.id, account);
}

async function readRows(table, selection) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const params = new URLSearchParams({ select: selection, limit: "1000", offset: String(offset) });
    const headers = { apikey: serviceRoleKey };
    // Modern secret API keys are not JWTs and belong only in the apikey header.
    // The legacy service_role key is a JWT and also needs the Bearer header.
    if (!serviceRoleKey.startsWith("sb_secret_")) headers.Authorization = `Bearer ${serviceRoleKey}`;
    const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${params}`, { headers });
    if (!response.ok) {
      const hint = response.status === 401
        ? " The supplied Supabase key was rejected. Copy the current sb_secret_ key from the project's API Keys page; do not use the sb_publishable_ key or a rotated key."
        : "";
      throw new Error(`Supabase read failed for ${table} (HTTP ${response.status}).${hint}`);
    }
    const page = await response.json();
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

const destination = new Map();
const getAccount = (id) => {
  if (!destination.has(id)) destination.set(id, createAccount());
  return destination.get(id);
};
const tableDefinitions = [
  ["trades", "user_id,pnl_sol,pnl_usd,bought_sol,bought_usd,sold_sol,sold_usd"],
  ["wallets", "user_id,balance_sol"],
  ["wallet_transactions", "user_id,amount_sol,amount_usd"],
  ["user_settings", "user_id,setting_key"],
];

for (const [table, selection] of tableDefinitions) {
  for (const row of await readRows(table, selection)) {
    const account = getAccount(row.user_id);
    if (table === "trades") {
      account.trades++;
      for (const field of fields) account[field] += Number(row[supabaseFieldNames[field]] ?? 0);
    } else if (table === "wallets") {
      account.wallets++;
      account.balanceSol += Number(row.balance_sol ?? 0);
    } else if (table === "wallet_transactions") {
      account.walletTransactions++;
      account.transactionAmountSol += Number(row.amount_sol ?? 0);
      account.transactionAmountUsd += Number(row.amount_usd ?? 0);
    } else account.settings++;
  }
}

const countFields = ["trades", "wallets", "walletTransactions", "settings"];
const aggregateFields = [...fields, "balanceSol", "transactionAmountSol", "transactionAmountUsd"];
const accountIds = new Set([...source.keys(), ...destination.keys()]);
let mismatchedAccounts = 0;
for (const id of accountIds) {
  const left = source.get(id) ?? createAccount();
  const right = destination.get(id) ?? createAccount();
  const countsMatch = countFields.every((field) => left[field] === right[field]);
  const aggregatesMatch = aggregateFields.every((field) => {
    const a = left[field]; const b = right[field];
    return Math.abs(a - b) <= Math.max(1, Math.abs(a), Math.abs(b)) * 1e-8;
  });
  if (!countsMatch || !aggregatesMatch) mismatchedAccounts++;
}

for (const field of countFields) {
  const sourceTotal = [...source.values()].reduce((sum, account) => sum + account[field], 0);
  const destinationTotal = [...destination.values()].reduce((sum, account) => sum + account[field], 0);
  console.log(`${field}: Firebase ${sourceTotal}; Supabase ${destinationTotal}; ${sourceTotal === destinationTotal ? "row totals match" : "row totals differ"}`);
}
console.log(`Compared ${accountIds.size} accounts without printing account IDs or financial totals.`);
console.log(mismatchedAccounts === 0
  ? "PASS: per-account row counts and financial aggregates match. This verifies counts and core totals, not every note, tag, image, or setting value."
  : `CHECK REQUIRED: ${mismatchedAccounts} account(s) differ in row counts or financial aggregates. No data was changed.`);
if (mismatchedAccounts > 0) process.exitCode = 1;
