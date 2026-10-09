import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { auth } from "@/lib/firebase";

let client: SupabaseClient | null = null;

/**
 * Supabase client for deployments configured with NEXT_PUBLIC_DATA_BACKEND=supabase.
 * Firebase continues to provide the user's identity token. Never put a
 * service-role key in a NEXT_PUBLIC variable.
 */
export function getSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) {
    throw new Error("Supabase is not configured. Add the public project URL and publishable key first.");
  }

  if (!client) {
    client = createClient(url, publishableKey, {
      accessToken: async () => auth.currentUser?.getIdToken() ?? null,
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }

  return client;
}
