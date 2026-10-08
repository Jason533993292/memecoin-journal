import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient {
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
  const deletions = await Promise.all([
    admin.from("trades").delete().eq("user_id", userId),
    admin.from("wallet_transactions").delete().eq("user_id", userId),
    admin.from("wallets").delete().eq("user_id", userId),
    admin.from("user_settings").delete().eq("user_id", userId),
  ]);
  const failed = deletions.find(({ error }) => error);
  if (failed?.error) throw new Error(failed.error.message);
}
