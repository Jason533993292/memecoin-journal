import { getSupabaseClient } from "@/lib/supabase";
import { cleanJournalDetails } from "@/lib/journalWorkbench";
import type { Json, TablesInsert } from "@/lib/database.types";
import type { DailyJournalEntry, GoalSettings, JournalRules, ResearchItem, Trade, Wallet, WalletTransaction } from "@/lib/types";

type JsonRecord = Record<string, unknown>;
const SUPABASE_PAGE_SIZE = 1000;

export const usesSupabaseJournal = () => process.env.NEXT_PUBLIC_DATA_BACKEND === "supabase";

function fromDailyJournalRow(row: JsonRecord): DailyJournalEntry {
  return {
    id: String(row.id),
    title: String(row.title ?? "Untitled entry"),
    contentHtml: String(row.content_html ?? ""),
    plainText: String(row.plain_text ?? ""),
    entryType: row.entry_type as DailyJournalEntry["entryType"],
    entryDate: String(row.entry_date),
    emotions: Array.isArray(row.emotions) ? row.emotions.filter((item): item is string => typeof item === "string") : [],
    emotionIntensity: optionalNumber(row.emotion_intensity) ?? undefined,
    energyLevel: optionalNumber(row.energy_level) ?? undefined,
    confidenceLevel: optionalNumber(row.confidence_level) ?? undefined,
    tags: Array.isArray(row.tags) ? row.tags.filter((item): item is string => typeof item === "string") : [],
    linkedTradeIds: Array.isArray(row.linked_trade_ids) ? row.linked_trade_ids.filter((item): item is string => typeof item === "string") : [],
    createdAt: epoch(row.created_at) ?? Date.now(),
    updatedAt: epoch(row.updated_at) ?? Date.now(),
    details: cleanJournalDetails(row.details),
  };
}

export async function listSupabaseDailyJournalEntries(userId: string): Promise<DailyJournalEntry[]> {
  const { data, error } = await getSupabaseClient()
    .from("daily_journal_entries")
    .select("*")
    .eq("user_id", userId)
    .order("entry_date", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(500);
  throwIfError(error);
  return (data ?? []).map((row) => fromDailyJournalRow(row as JsonRecord));
}

export async function saveSupabaseDailyJournalEntry(userId: string, entry: DailyJournalEntry, expectedUpdatedAt?: number | null) {
  const row = {
    user_id: userId,
    id: entry.id,
    title: entry.title.trim() || "Untitled entry",
    content_html: entry.contentHtml,
    plain_text: entry.plainText,
    entry_type: entry.entryType,
    entry_date: entry.entryDate,
    emotions: entry.emotions,
    emotion_intensity: entry.emotionIntensity ?? null,
    energy_level: entry.energyLevel ?? null,
    confidence_level: entry.confidenceLevel ?? null,
    tags: entry.tags,
    linked_trade_ids: entry.linkedTradeIds,
    created_at: new Date(entry.createdAt).toISOString(),
    updated_at: new Date(entry.updatedAt).toISOString(),
    details: cleanJournalDetails(entry.details) as unknown as Json,
  };
  if (typeof expectedUpdatedAt === "number") {
    const { data, error } = await getSupabaseClient().from("daily_journal_entries").update(row)
      .eq("user_id", userId).eq("id", entry.id).eq("updated_at", new Date(expectedUpdatedAt).toISOString()).select("id");
    throwIfError(error);
    if (!data?.length) throw new Error("JOURNAL_CONFLICT");
    return;
  }
  const { error } = expectedUpdatedAt === null
    ? await getSupabaseClient().from("daily_journal_entries").insert(row)
    : await getSupabaseClient().from("daily_journal_entries").upsert(row, { onConflict: "user_id,id" });
  throwIfError(error);
}

export async function deleteSupabaseDailyJournalEntry(userId: string, id: string) {
  const { error } = await getSupabaseClient().from("daily_journal_entries").delete().eq("user_id", userId).eq("id", id);
  throwIfError(error);
}

export async function deleteAllSupabaseDailyJournalEntries(userId: string) {
  const { error } = await getSupabaseClient().from("daily_journal_entries").delete().eq("user_id", userId);
  throwIfError(error);
}

export async function listSupabaseResearch(userId: string): Promise<ResearchItem[]> {
  const { data, error } = await getSupabaseClient()
    .from("coin_research")
    .select("ca,data,created_at,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(100);
  throwIfError(error);
  return (data ?? []).map((row) => {
    const record = row as unknown as { ca: string; data: ResearchItem; created_at: string; updated_at: string };
    return { ...record.data, ca: record.ca, createdAt: Date.parse(record.created_at) || record.data.createdAt, updatedAt: Date.parse(record.updated_at) || record.data.updatedAt };
  });
}

export async function saveSupabaseResearch(userId: string, item: ResearchItem) {
  const normalizedCa = item.ca.trim();
  const payload = { ...item, ca: normalizedCa };
  if (!normalizedCa || JSON.stringify(payload).length > 90000) throw new Error("Research entry is too large or missing a contract address.");
  const { error } = await getSupabaseClient().from("coin_research").upsert({
    user_id: userId,
    ca: normalizedCa,
    data: payload as unknown as Json,
    created_at: new Date(item.createdAt).toISOString(),
    updated_at: new Date(item.updatedAt).toISOString(),
  }, { onConflict: "user_id,ca" });
  throwIfError(error);
}

export async function deleteSupabaseResearch(userId: string, ca: string) {
  const { error } = await getSupabaseClient().from("coin_research").delete().eq("user_id", userId).eq("ca", ca);
  throwIfError(error);
}

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
  const currencyExtra = Object.fromEntries(
    (["quoteCurrency", "quoteSymbol", "boughtQuote", "soldQuote", "pnlQuote", "quoteUsdRate", "venue", "processGrade", "confidenceAtEntry", "fills", "playbookId", "playbookName", "playbookChecks"] as const)
      .filter((field) => trade[field] !== undefined)
      .map((field) => [field, trade[field]])
  );
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
    entry_time: iso(trade.entryTime),
    exit_time: iso(trade.exitTime),
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
    extra: currencyExtra,
  };
}

function fromTradeRow(row: JsonRecord): Trade {
  const extra = row.extra && typeof row.extra === "object" && !Array.isArray(row.extra) ? row.extra as JsonRecord : {};
  const quoteCurrency = ["SOL", "USD", "USDC", "USDT", "ETH", "BTC", "EUR", "GBP", "OTHER"].includes(String(extra.quoteCurrency))
    ? extra.quoteCurrency as Trade["quoteCurrency"] : undefined;
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
    processGrade: ["A", "B", "C", "D"].includes(String(extra.processGrade)) ? extra.processGrade as Trade["processGrade"] : undefined,
    confidenceAtEntry: optionalNumber(extra.confidenceAtEntry) ?? undefined,
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
    entryTime: typeof row.entry_time === "string" ? row.entry_time : undefined,
    exitTime: typeof row.exit_time === "string" ? row.exit_time : undefined,
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
    quoteCurrency,
    quoteSymbol: typeof extra.quoteSymbol === "string" ? extra.quoteSymbol.slice(0, 12) : undefined,
    boughtQuote: optionalNumber(extra.boughtQuote) ?? undefined,
    soldQuote: optionalNumber(extra.soldQuote) ?? undefined,
    pnlQuote: optionalNumber(extra.pnlQuote) ?? undefined,
    quoteUsdRate: optionalNumber(extra.quoteUsdRate) ?? undefined,
    venue: typeof extra.venue === "string" ? extra.venue.slice(0, 80) : undefined,
    fills: Array.isArray(extra.fills) ? extra.fills.filter((fill): fill is NonNullable<Trade["fills"]>[number] => {
      if (!fill || typeof fill !== "object" || Array.isArray(fill)) return false;
      const item = fill as JsonRecord;
      return typeof item.id === "string" && ["entry", "exit"].includes(String(item.side)) && typeof item.quoteAmount === "number" && typeof item.feeSol === "number" && typeof item.executedAt === "number";
    }).slice(0, 100) : undefined,
    playbookId: typeof extra.playbookId === "string" ? extra.playbookId.slice(0, 80) : undefined,
    playbookName: typeof extra.playbookName === "string" ? extra.playbookName.slice(0, 120) : undefined,
    playbookChecks: Array.isArray(extra.playbookChecks) ? extra.playbookChecks.filter((item): item is string => typeof item === "string").slice(0, 20) : undefined,
  };
}

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function listSupabaseTrades(userId: string): Promise<Trade[]> {
  const client = getSupabaseClient();
  const rows: JsonRecord[] = [];
  for (let offset = 0; ; offset += SUPABASE_PAGE_SIZE) {
    const { data, error } = await client
      .from("trades")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .order("id", { ascending: true })
      .range(offset, offset + SUPABASE_PAGE_SIZE - 1);
    throwIfError(error);
    const page = (data ?? []) as JsonRecord[];
    rows.push(...page);
    if (page.length < SUPABASE_PAGE_SIZE) break;
  }
  return rows.map(fromTradeRow);
}

export async function saveSupabaseTrade(userId: string, trade: Record<string, unknown>, id = crypto.randomUUID()) {
  // Form state intentionally represents blank optional values as null. Normalize
  // it at the persistence boundary rather than leaking nullable form types into
  // the journal's domain model.
  const normalizedTrade = trade as unknown as Omit<Trade, "id">;
  const client = getSupabaseClient();
  const { data: existing, error: readError } = await client.from("trades").select("extra").eq("user_id", userId).eq("id", id).maybeSingle();
  throwIfError(readError);
  const row = toTradeRow(userId, id, normalizedTrade);
  row.extra = {
    ...(existing?.extra && typeof existing.extra === "object" && !Array.isArray(existing.extra) ? existing.extra as JsonRecord : {}),
    ...((row.extra as JsonRecord | undefined) ?? {}),
  };
  const { error } = await client.from("trades").upsert(row as unknown as TablesInsert<"trades">, { onConflict: "user_id,id" });
  throwIfError(error);
  return id;
}

/**
 * Imports a validated set of trades with one PostgREST insert statement.
 * PostgreSQL treats the statement atomically, so a rejected row cannot leave
 * the user's journal half-imported.
 */
export async function importSupabaseTrades(
  userId: string,
  trades: Array<Record<string, unknown>>
) {
  if (!trades.length) return [];
  const ids = trades.map(() => crypto.randomUUID());
  const rows = trades.map((trade, index) =>
    toTradeRow(userId, ids[index], trade as unknown as Omit<Trade, "id">)
  );
  const { error } = await getSupabaseClient()
    .from("trades")
    .insert(rows as unknown as TablesInsert<"trades">[]);
  throwIfError(error);
  return ids;
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
  const { error } = await getSupabaseClient().rpc("patch_user_preferences", {
    p_user_id: userId,
    p_patch: patch as unknown as Json,
  });
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
  const client = getSupabaseClient();
  const rows: JsonRecord[] = [];
  for (let offset = 0; ; offset += SUPABASE_PAGE_SIZE) {
    const { data, error } = await client
      .from("wallet_transactions")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .order("id", { ascending: true })
      .range(offset, offset + SUPABASE_PAGE_SIZE - 1);
    throwIfError(error);
    const page = (data ?? []) as JsonRecord[];
    rows.push(...page);
    if (page.length < SUPABASE_PAGE_SIZE) break;
  }
  return rows.map(fromWalletTransactionRow);
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
    p_amount_usd: transaction.amountUsd ?? 0,
    p_notes: transaction.notes ?? "",
    p_date: iso(transaction.date) ?? new Date().toISOString(),
    p_created_at: iso(transaction.createdAt) ?? new Date().toISOString(),
  });
  throwIfError(error);
}
