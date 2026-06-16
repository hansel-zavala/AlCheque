import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const safeUrl = url && url.startsWith("http") ? url : "https://placeholder-url.supabase.co";
  const safeKey = anonKey || "placeholder-anon-key";

  return createBrowserClient<Database>(safeUrl, safeKey);
}
