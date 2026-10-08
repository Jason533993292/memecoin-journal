import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const [inputArg] = process.argv.slice(2);
if (!inputArg) throw new Error("Usage: node scripts/import-supabase-migration.mjs migration-data/firestore-export.json");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const targetConfirmation = process.env.SUPABASE_MIGRATION_TARGET;
if (!supabaseUrl || !serviceKey) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your local environment.");
}
if (targetConfirmation !== "staging") {
  throw new Error("Set SUPABASE_MIGRATION_TARGET=staging only after confirming the URL belongs to a non-production Supabase project.");
}
if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to import with NODE_ENV=production. Run a reviewed staging import first.");
}

const bundle = JSON.parse(await readFile(resolve(inputArg), "utf8"));
if (!Array.isArray(bundle.users)) throw new Error("Export file is missing its users array.");

const renameKeys = (data, mapping, knownKeys) => {
  const output = {};
  for (const [source, destination] of Object.entries(mapping)) {
    if (data[source] !== undefined) output[destination] = data[source];
  }
  const extra = Object.fromEntries(Object.entries(data).filter(([key]) => !knownKeys.has(key)));
  if (Object.keys(extra).length) output.extra = extra;
  return output;
};
const isoDate = (value) => {
  if (value == null) return null;
  if (typeof value === "number") return new Date(value).toISOString();
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
};
const upsert = async (table, rows) => {
  for (let offset = 0; offset < rows.length; offset += 100) {
    const response = await fetch(`${supabaseUrl}/rest/v1/${table}?on_conflict=user_id,id`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows.slice(offset, offset + 100)),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 1000);
      throw new Error(`Supabase import failed for ${table} (HTTP ${response.status}): ${detail}`);
    }
  }
};

const tradeMapping = {
  ca: "ca", name: "name", symbol: "symbol", wallet: "wallet", result: "result", setupType: "setup_type",
  mcap: "mcap", liquidity: "liquidity", entryLiquidityUsd: "entry_liquidity_usd", exitLiquidityUsd: "exit_liquidity_usd",
  entryMarketCapUsd: "entry_market_cap_usd", exitMarketCapUsd: "exit_market_cap_usd", slippagePct: "slippage_pct",
  dex: "dex", executionType: "execution_type", wouldTakeAgain: "would_take_again", tradeQualityScore: "trade_quality_score",
  price: "price", boughtSol: "bought_sol", boughtUsd: "bought_usd", soldSol: "sold_sol", soldUsd: "sold_usd",
  pnlSol: "pnl_sol", pnlUsd: "pnl_usd", mistakes: "mistakes", goodTags: "good_tags", isPaper: "is_paper",
  notes: "notes", screenshotUrl: "screenshot_url", durationMinutes: "duration_minutes", entryTime: "entry_time",
  exitTime: "exit_time", initialRiskSol: "initial_risk_sol", stopPrice: "stop_price", feesSol: "fees_sol",
  entryTimezoneOffset: "entry_timezone_offset", tradedAt: "traded_at", solUsdRate: "sol_usd_rate",
  solUsdRateSource: "sol_usd_rate_source", tradeMode: "trade_mode", date: "date", createdAt: "created_at",
};
const tradeKeys = new Set(Object.keys(tradeMapping));
const walletMapping = { name: "name", balanceSol: "balance_sol", address: "address", updatedAt: "updated_at" };
const transactionMapping = {
  walletId: "wallet_id", walletName: "wallet_name", type: "type", amountSol: "amount_sol", amountUsd: "amount_usd",
  notes: "notes", date: "date", createdAt: "created_at",
};

const trades = [];
const wallets = [];
const transactions = [];
const settings = [];
for (const user of bundle.users) {
  if (!user.uid || typeof user.uid !== "string") throw new Error("Encountered export record without a valid Firebase UID.");
  for (const row of user.trades || []) {
    const mapped = renameKeys(row.data, tradeMapping, tradeKeys);
    mapped.user_id = user.uid;
    mapped.id = row.id;
    mapped.date = isoDate(mapped.date);
    mapped.created_at = mapped.created_at == null ? null : isoDate(mapped.created_at);
    mapped.traded_at = mapped.traded_at == null ? null : isoDate(mapped.traded_at);
    // Legacy entry/exit fields can be arbitrary text; only import valid dates
    // into timestamptz columns and preserve any non-date originals in extra.
    for (const field of ["entry_time", "exit_time"]) {
      if (mapped[field] != null && !isoDate(mapped[field])) {
        mapped.extra = { ...(mapped.extra || {}), [field]: mapped[field] };
        delete mapped[field];
      } else if (mapped[field] != null) mapped[field] = isoDate(mapped[field]);
    }
    if (!mapped.date) throw new Error(`Trade ${row.id} for user ${user.uid} has no valid date.`);
    trades.push(mapped);
  }
  for (const row of user.wallets || []) {
    const mapped = renameKeys(row.data, walletMapping, new Set(Object.keys(walletMapping)));
    wallets.push({ user_id: user.uid, id: row.id, ...mapped, updated_at: isoDate(mapped.updated_at) || new Date(0).toISOString() });
  }
  for (const row of user.walletTransactions || []) {
    const mapped = renameKeys(row.data, transactionMapping, new Set(Object.keys(transactionMapping)));
    transactions.push({
      user_id: user.uid, id: row.id, ...mapped,
      date: isoDate(mapped.date) || new Date(0).toISOString(),
      created_at: isoDate(mapped.created_at) || new Date(0).toISOString(),
    });
  }
  for (const setting of user.settings || []) {
    if (!["preferences", "walletConfig"].includes(setting.id)) continue;
    settings.push({ user_id: user.uid, setting_key: setting.id, data: setting.data, updated_at: new Date().toISOString() });
  }
}

console.log(`Importing ${trades.length} trades, ${wallets.length} wallets, ${transactions.length} wallet transactions, and ${settings.length} settings rows.`);
await upsert("trades", trades);
await upsert("wallets", wallets);
await upsert("wallet_transactions", transactions);
for (let offset = 0; offset < settings.length; offset += 100) {
  const response = await fetch(`${supabaseUrl}/rest/v1/user_settings?on_conflict=user_id,setting_key`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(settings.slice(offset, offset + 100)),
  });
  if (!response.ok) throw new Error(`Supabase import failed for settings (HTTP ${response.status}): ${(await response.text()).slice(0, 1000)}`);
}
console.log("Import finished. Compare database row counts and per-user isolation before any production cutover.");
