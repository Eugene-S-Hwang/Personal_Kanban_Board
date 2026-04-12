"use client";

import { createClient } from "@/app/utils/supabase/client";
import { type ReactNode, useEffect } from "react";

/**
 * Ensures a Supabase session exists: on first visit (no session cookie) signs
 * in anonymously so each browser gets a stable auth user_id for RLS.
 */
export function EnsureAnonymousSession({ children }: { children: ReactNode }) {
  useEffect(() => {
    const supabase = createClient();

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) return;

      const { error } = await supabase.auth.signInAnonymously();
      if (error) {
        console.error("[auth] Anonymous sign-in failed:", error.message);
      }
    })();
  }, []);

  return <>{children}</>;
}
