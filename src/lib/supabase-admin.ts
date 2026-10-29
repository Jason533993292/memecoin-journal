import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type JournalTable = "wallet_transactions" | "trades" | "coin_research" | "daily_journal_entries" | "wallets" | "user_settings" | "user_feedback";

let adminClient: SupabaseClient<Database> | null = null;

function getSupabaseAdminClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase server migration configuration is incomplete.");
  }
  if (!adminClient) {
    adminClient = createClient<Database>(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return adminClient;
}

export async function deleteSupabaseJournalData(userId: string) {
  const admin = getSupabaseAdminClient();
  const { error: revokeError } = await admin.from("revoked_journal_users").upsert({
    user_id: userId,
    revoked_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (revokeError) throw new Error(revokeError.message);

  // Child/history tables go first. Every operation is safe to repeat, allowing
  // a later request to resume after a temporary provider failure.
  const tables: JournalTable[] = ["wallet_transactions", "trades", "coin_research", "daily_journal_entries", "wallets", "user_settings", "user_feedback"];
  for (const table of tables) {
    const { error } = await admin.from(table).delete().eq("user_id", userId);
    if (error) throw new Error(`${table}: ${error.message}`);
  }

  for (const table of tables) {
    const { count, error } = await admin.from(table).select("*", { count: "exact", head: true }).eq("user_id", userId);
    if (error) throw new Error(`${table} verification: ${error.message}`);
    if ((count ?? 0) !== 0) throw new Error(`${table} verification found remaining rows.`);
  }
}

export async function deleteSupabaseTrades(userId: string) {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("trades").delete().eq("user_id", userId);
  if (error) throw new Error(error.message);

  const { count, error: verificationError } = await admin
    .from("trades")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (verificationError) throw new Error(verificationError.message);
  if ((count ?? 0) !== 0) throw new Error("Trade deletion verification found remaining rows.");
}

export async function createUserFeedback(input: {
  userId: string;
  idempotencyKey: string;
  category: "bug" | "suggestion" | "other";
  message: string;
  contactEmail: string | null;
  page: string;
  device: string;
  browser: string;
  viewport: string;
  theme: string;
}) {
  const admin = getSupabaseAdminClient();
  const findExisting = async () => {
    const { data, error } = await admin
      .from("user_feedback")
      .select("id,email_delivery_status")
      .eq("user_id", input.userId)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  };

  const existing = await findExisting();
  if (existing) return { ...existing, created: false };

  const { data, error } = await admin.from("user_feedback").insert({
    user_id: input.userId,
    idempotency_key: input.idempotencyKey,
    category: input.category,
    message: input.message,
    contact_email: input.contactEmail,
    page: input.page,
    device: input.device,
    browser: input.browser,
    viewport: input.viewport,
    theme: input.theme,
  }).select("id,email_delivery_status").single();
  if (error?.code === "23505") {
    const raced = await findExisting();
    if (raced) return { ...raced, created: false };
  }
  if (error) throw new Error(error.message);
  if (!data || typeof data.id !== "number") throw new Error("Feedback receipt was not returned.");
  return { ...data, created: true };
}

export async function recordFeedbackEmailStatus(
  feedbackId: number,
  input: { status: "sent" | "not_configured" | "failed"; attempts: number; error?: string },
) {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("user_feedback").update({
    email_delivery_status: input.status,
    email_delivery_attempts: input.attempts,
    email_delivery_error: input.error?.slice(0, 500) ?? null,
    email_delivered_at: input.status === "sent" ? new Date().toISOString() : null,
  }).eq("id", feedbackId);
  if (error) throw new Error(error.message);
}

export async function checkSupabaseAdminHealth() {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("trades").select("id", { head: true, count: "exact" }).limit(1);
  if (error) throw new Error(error.message);
}

export async function listFeedbackForAdmin(limit = 50) {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("user_feedback")
    .select("id,category,message,contact_email,page,device,browser,viewport,theme,status,assigned_to,resolution_note,created_at,updated_at,email_delivery_status,email_delivery_attempts")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));
  if (error) throw new Error(error.message);
  return data;
}

export async function listUserFeedback(userId: string, limit = 20) {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("user_feedback")
    .select("id,category,message,status,resolution_note,created_at,updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 50));
  if (error) throw new Error(error.message);
  return data;
}

export async function updateFeedbackForAdmin(input: {
  id: number;
  status: "new" | "reviewing" | "resolved" | "closed";
  assignedTo: string | null;
  note: string | null;
  actorUid: string;
  actorEmail: string;
}) {
  const admin = getSupabaseAdminClient();
  const { data: previous, error: readError } = await admin
    .from("user_feedback")
    .select("status")
    .eq("id", input.id)
    .single();
  if (readError) throw new Error(readError.message);

  const now = new Date().toISOString();
  const { error: updateError } = await admin.from("user_feedback").update({
    status: input.status,
    assigned_to: input.assignedTo,
    resolution_note: input.note,
    resolved_at: input.status === "resolved" || input.status === "closed" ? now : null,
    updated_at: now,
  }).eq("id", input.id);
  if (updateError) throw new Error(updateError.message);

  const { error: auditError } = await admin.from("feedback_admin_audit").insert({
    feedback_id: input.id,
    actor_uid: input.actorUid,
    actor_email: input.actorEmail,
    action: "status_updated",
    previous_status: previous.status,
    new_status: input.status,
    note: input.note,
  });
  if (auditError) throw new Error(auditError.message);
}
