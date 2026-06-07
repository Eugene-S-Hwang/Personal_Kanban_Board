"use client";

import { createClient } from "@/app/utils/supabase/client";
import { type ReactNode, useEffect } from "react";

/**
 * Ensures a Supabase session exists: validates with getUser() (not getSession(),
 * which can return stale cookies), then signs in anonymously when needed.
 */
export function EnsureAnonymousSession({ children }: { children: ReactNode }) {
  useEffect(() => {
    const supabase = createClient();

    void (async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (user) return;

      if (userError) {
        await supabase.auth.signOut();
      }

      const { error } = await supabase.auth.signInAnonymously();
      if (error) {
        console.error("[auth] Anonymous sign-in failed:", error.message);
      }
    })();
  }, []);

  return <>{children}</>;
}
