import type { User } from "@supabase/supabase-js";
import { createClient } from "@/app/utils/supabase/client";

/**
 * Returns a valid Supabase user, signing in anonymously if needed.
 * Clears stale local sessions that pass getSession() but fail getUser() (403).
 */
export async function ensureAuthUser(): Promise<User> {
  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (user) return user;

  if (userError) {
    await supabase.auth.signOut();
  }

  const { data, error: signInError } = await supabase.auth.signInAnonymously();
  if (signInError) {
    throw new Error(`Anonymous sign-in failed: ${signInError.message}`);
  }

  if (!data.user) {
    throw new Error("Anonymous sign-in did not return a user.");
  }

  return data.user;
}
