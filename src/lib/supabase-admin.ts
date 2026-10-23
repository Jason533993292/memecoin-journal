import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;

function getSupabaseAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase server migration configuration is incomplete.");
  }
  if (!adminClient) {
    adminClient = createClient(url, serviceRoleKey, {
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
  const tables = ["wallet_transactions", "trades", "coin_research", "wallets", "user_settings", "user_feedback"];
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

export async function createUserFeedback(input: {
  userId: string;
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
  const { data, error } = await admin.from("user_feedback").insert({
    user_id: input.userId,
    category: input.category,
    message: input.message,
    contact_email: input.contactEmail,
    page: input.page,
    device: input.device,
    browser: input.browser,
    viewport: input.viewport,
    theme: input.theme,
  }).select("id").single();
  if (error) throw new Error(error.message);
  if (!data || typeof data.id !== "number") throw new Error("Feedback receipt was not returned.");
  return data.id;
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
