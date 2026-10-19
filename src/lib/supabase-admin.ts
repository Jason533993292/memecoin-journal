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

  const deletions = await Promise.all([
    admin.from("trades").delete().eq("user_id", userId),
    admin.from("coin_research").delete().eq("user_id", userId),
    admin.from("wallet_transactions").delete().eq("user_id", userId),
    admin.from("wallets").delete().eq("user_id", userId),
    admin.from("user_settings").delete().eq("user_id", userId),
    admin.from("user_feedback").delete().eq("user_id", userId),
  ]);
  const failed = deletions.find(({ error }) => error);
  if (failed?.error) throw new Error(failed.error.message);
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
  const { error } = await admin.from("user_feedback").insert({
    user_id: input.userId,
    category: input.category,
    message: input.message,
    contact_email: input.contactEmail,
    page: input.page,
    device: input.device,
    browser: input.browser,
    viewport: input.viewport,
    theme: input.theme,
  });
  if (error) throw new Error(error.message);
}
