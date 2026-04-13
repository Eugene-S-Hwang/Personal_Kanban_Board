import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/app/utils/supabase/database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** Single browser instance so auth state and listeners stay consistent. */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl!, supabaseKey!, {
    isSingleton: true,
  });
}