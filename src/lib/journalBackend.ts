import { getSupabaseClient } from "@/lib/supabase";
import type { GoalSettings, JournalRules, Trade, Wallet, WalletTransaction } from "@/lib/types";

type JsonRecord = Record<string, unknown>;

export const usesSupabaseJournal = () => process.env.NEXT_PUBLIC_DATA_BACKEND === "supabase";

function epoch(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }
  return undefined;
}

function iso(value: unknown): string | null {
  const milliseconds = epoch(value);
  return milliseconds == null ? null : new Date(milliseconds).toISOString();
}

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toTradeRow(userId: string, id: string, trade: Omit<Trade, "id">): JsonRecord {
  return {
    user_id: userId,
    id,
    ca: trade.ca ?? "",
    name: trade.name,
    symbol: trade.symbol,
    wallet: trade.wallet,
    result: trade.result,
    setup_type: trade.setupType || "Other",
    mcap: optionalNumber(trade.mcap),
    liquidity: optionalNumber(trade.liquidity),
    entry_liquidity_usd: optionalNumber(trade.entryLiquidityUsd),
    exit_liquidity_usd: optionalNumber(trade.exitLiquidityUsd),
    entry_market_cap_usd: optionalNumber(trade.entryMarketCapUsd),
    exit_market_cap_usd: optionalNumber(trade.exitMarketCapUsd),
    slippage_pct: optionalNumber(trade.slippagePct),
    dex: trade.dex ?? null,
    execution_type: trade.executionType ?? null,
    would_take_again: trade.wouldTakeAgain ?? null,
    trade_quality_score: optionalNumber(trade.tradeQualityScore),
    price: optionalNumber(trade.price),
    bought_sol: trade.boughtSol,
    bought_usd: optionalNumber(trade.boughtUsd),
    sold_sol: optionalNumber(trade.soldSol),
    sold_usd: optionalNumber(trade.soldUsd),
    pnl_sol: trade.pnlSol,
    pnl_usd: optionalNumber(trade.pnlUsd) ?? 0,
    mistakes: trade.mistakes ?? [],
    good_tags: trade.goodTags ?? [],
    is_paper: trade.isPaper ?? null,
    notes: trade.notes || null,
    screenshot_url: trade.screenshotUrl || null,
    duration_minutes: optionalNumber(trade.durationMinutes),
    initial_risk_sol: optionalNumber(trade.initialRiskSol),
    stop_price: optionalNumber(trade.stopPrice),
    fees_sol: optionalNumber(trade.feesSol),
    entry_timezone_offset: optionalNumber(trade.entryTimezoneOffset),
    traded_at: iso(trade.tradedAt),
    sol_usd_rate: optionalNumber(trade.solUsdRate),
    sol_usd_rate_source: trade.solUsdRateSource ?? null,
    trade_mode: trade.tradeMode ?? (trade.isPaper ? "paper" : "real"),
    date: iso(trade.date ?? trade.tradedAt) ?? new Date().toISOString(),
    created_at: iso(trade.createdAt),
  };
}

function fromTradeRow(row: JsonRecord): Trade {
  return {
    id: String(row.id),
    ca: String(row.ca ?? ""),
    name: String(row.name),
    symbol: String(row.symbol),
    wallet: String(row.wallet),
    result: row.result as Trade["result"],
    setupType: typeof row.setup_type === "string" ? row.setup_type : undefined,
    mcap: optionalNumber(row.mcap) ?? undefined,
    liquidity: optionalNumber(row.liquidity) ?? undefined,
    entryLiquidityUsd: optionalNumber(row.entry_liquidity_usd) ?? undefined,
    exitLiquidityUsd: optionalNumber(row.exit_liquidity_usd) ?? undefined,
    entryMarketCapUsd: optionalNumber(row.entry_market_cap_usd) ?? undefined,
    exitMarketCapUsd: optionalNumber(row.exit_market_cap_usd) ?? undefined,
    slippagePct: optionalNumber(row.slippage_pct) ?? undefined,
    dex: typeof row.dex === "string" ? row.dex : undefined,
    executionType: row.execution_type as Trade["executionType"],
    wouldTakeAgain: typeof row.would_take_again === "boolean" ? row.would_take_again : undefined,
    tradeQualityScore: optionalNumber(row.trade_quality_score) ?? undefined,
    price: optionalNumber(row.price) ?? undefined,
    boughtSol: Number(row.bought_sol ?? 0),
    boughtUsd: optionalNumber(row.bought_usd) ?? undefined,
    soldSol: optionalNumber(row.sold_sol) ?? undefined,
    soldUsd: optionalNumber(row.sold_usd) ?? undefined,
    pnlSol: Number(row.pnl_sol ?? 0),
    pnlUsd: optionalNumber(row.pnl_usd) ?? undefined,
    mistakes: Array.isArray(row.mistakes) ? row.mistakes.filter((item): item is string => typeof item === "string") : [],
    goodTags: Array.isArray(row.good_tags) ? row.good_tags.filter((item): item is string => typeof item === "string") : [],
    isPaper: typeof row.is_paper === "boolean" ? row.is_paper : undefined,
    notes: typeof row.notes === "string" ? row.notes : undefined,
    screenshotUrl: typeof row.screenshot_url === "string" ? row.screenshot_url : undefined,
    durationMinutes: optionalNumber(row.duration_minutes) ?? undefined,
    initialRiskSol: optionalNumber(row.initial_risk_sol) ?? undefined,
    stopPrice: optionalNumber(row.stop_price) ?? undefined,
    feesSol: optionalNumber(row.fees_sol) ?? undefined,
    entryTimezoneOffset: optionalNumber(row.entry_timezone_offset) ?? undefined,
    tradedAt: epoch(row.traded_at),
    solUsdRate: optionalNumber(row.sol_usd_rate) ?? undefined,
    solUsdRateSource: row.sol_usd_rate_source as Trade["solUsdRateSource"],
    tradeMode: row.trade_mode as Trade["tradeMode"],
    date: typeof row.date === "string" ? row.date : undefined,
    createdAt: epoch(row.created_at),
  };
}

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function listSupabaseTrades(userId: string): Promise<Trade[]> {
  const { data, error } = await getSupabaseClient()
    .from("trades")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false });
  throwIfError(error);
  return (data ?? []).map((row) => fromTradeRow(row as JsonRecord));
}

export async function saveSupabaseTrade(userId: string, trade: Record<string, unknown>, id = crypto.randomUUID()) {
  // Form state intentionally represents blank optional values as null. Normalize
  // it at the persistence boundary rather than leaking nullable form types into
  // the journal's domain model.
  const normalizedTrade = trade as unknown as Omit<Trade, "id">;
  const { error } = await getSupabaseClient().from("trades").upsert(toTradeRow(userId, id, normalizedTrade), { onConflict: "user_id,id" });
  throwIfError(error);
  return id;
}

export async function deleteSupabaseTrade(userId: string, id: string) {
  const { error } = await getSupabaseClient().from("trades").delete().eq("user_id", userId).eq("id", id);
  throwIfError(error);
}

export async function loadSupabasePreferences(userId: string): Promise<{ rules?: JournalRules; goals?: GoalSettings }> {
  const { data, error } = await getSupabaseClient()
    .from("user_settings")
    .select("data")
    .eq("user_id", userId)
    .eq("setting_key", "preferences")
    .maybeSingle();
  throwIfError(error);
  return (data?.data as { rules?: JournalRules; goals?: GoalSettings } | null) ?? {};
}

export async function patchSupabasePreferences(userId: string, patch: { rules?: JournalRules; goals?: GoalSettings }) {
  const previous = await loadSupabasePreferences(userId);
  const { error } = await getSupabaseClient().from("user_settings").upsert({
    user_id: userId,
    setting_key: "preferences",
    data: { ...previous, ...patch },
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,setting_key" });
  throwIfError(error);
}

function fromWalletRow(row: JsonRecord): Wallet {
  return {
    id: String(row.id),
    name: String(row.name),
    balanceSol: Number(row.balance_sol ?? 0),
    address: String(row.address ?? "Address not set"),
    updatedAt: epoch(row.updated_at),
  };
}

function fromWalletTransactionRow(row: JsonRecord): WalletTransaction {
  return {
    id: String(row.id),
    walletId: String(row.wallet_id),
    walletName: String(row.wallet_name),
    type: row.type as WalletTransaction["type"],
    amountSol: Number(row.amount_sol ?? 0),
    amountUsd: optionalNumber(row.amount_usd) ?? undefined,
    notes: typeof row.notes === "string" ? row.notes : undefined,
    date: typeof row.date === "string" ? row.date : undefined,
    createdAt: epoch(row.created_at),
  };
}

export async function listSupabaseWallets(userId: string): Promise<Wallet[]> {
  const { data, error } = await getSupabaseClient()
    .from("wallets")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  throwIfError(error);
  return (data ?? []).map((row) => fromWalletRow(row as JsonRecord));
}

export async function saveSupabaseWallet(userId: string, wallet: Wallet) {
  const { error } = await getSupabaseClient().from("wallets").upsert({
    user_id: userId,
    id: wallet.id,
    name: wallet.name,
    balance_sol: wallet.balanceSol,
    address: wallet.address,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,id" });
  throwIfError(error);
}

export async function deleteSupabaseWallet(userId: string, id: string) {
  const { error } = await getSupabaseClient().from("wallets").delete().eq("user_id", userId).eq("id", id);
  throwIfError(error);
}

export async function listSupabaseWalletTransactions(userId: string): Promise<WalletTransaction[]> {
  const { data, error } = await getSupabaseClient()
    .from("wallet_transactions")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false });
  throwIfError(error);
  return (data ?? []).map((row) => fromWalletTransactionRow(row as JsonRecord));
}

export async function saveSupabaseWalletTransaction(userId: string, transaction: WalletTransaction) {
  const { error } = await getSupabaseClient().from("wallet_transactions").upsert({
    user_id: userId,
    id: transaction.id,
    wallet_id: transaction.walletId,
    wallet_name: transaction.walletName,
    type: transaction.type,
    amount_sol: transaction.amountSol,
    amount_usd: transaction.amountUsd ?? null,
    notes: transaction.notes ?? null,
    date: iso(transaction.date) ?? new Date().toISOString(),
    created_at: iso(transaction.createdAt) ?? new Date().toISOString(),
  }, { onConflict: "user_id,id" });
  throwIfError(error);
}

export async function loadSupabaseWalletConfig(userId: string): Promise<{ paperCapitalSol?: number }> {
  const { data, error } = await getSupabaseClient()
    .from("user_settings")
    .select("data")
    .eq("user_id", userId)
    .eq("setting_key", "walletConfig")
    .maybeSingle();
  throwIfError(error);
  return (data?.data as { paperCapitalSol?: number } | null) ?? {};
}

export async function saveSupabaseWalletConfig(userId: string, paperCapitalSol: number) {
  const { error } = await getSupabaseClient().from("user_settings").upsert({
    user_id: userId,
    setting_key: "walletConfig",
    data: { paperCapitalSol },
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,setting_key" });
  throwIfError(error);
}

export async function applySupabaseWalletTransaction(
  userId: string,
  transaction: WalletTransaction,
  deltaSol: number,
) {
  const { error } = await getSupabaseClient().rpc("apply_wallet_transaction", {
    p_user_id: userId,
    p_wallet_id: transaction.walletId,
    p_transaction_id: transaction.id,
    p_wallet_name: transaction.walletName,
    p_delta_sol: deltaSol,
    p_amount_usd: transaction.amountUsd ?? null,
    p_notes: transaction.notes ?? null,
    p_date: iso(transaction.date) ?? new Date().toISOString(),
    p_created_at: iso(transaction.createdAt) ?? new Date().toISOString(),
  });
  throwIfError(error);
}
