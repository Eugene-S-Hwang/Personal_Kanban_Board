import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** Single browser instance so auth state and listeners stay consistent. */
export function createClient() {
  return createBrowserClient(supabaseUrl!, supabaseKey!, {
    isSingleton: true,
  });
}