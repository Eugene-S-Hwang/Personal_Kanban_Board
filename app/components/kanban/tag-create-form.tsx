"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/app/utils/supabase/client";
import type { Tables } from "@/app/utils/supabase/database.types";

export type TagRow = Tables<"tags">;

type TagCreateFormProps = {
  initialTags: TagRow[] | null;
};

export function TagCreateForm({ initialTags }: TagCreateFormProps) {
  const [name, setName] = useState("");
  const [tags, setTags] = useState<TagRow[]>(() => initialTags ?? []);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTags(initialTags ?? []);
  }, [initialTags]);

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    setPending(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("You must be signed in to create tags.");
      }
      const { data, error: insertError } = await supabase
        .from("tags")
        .insert({
          name: trimmed,
          user_id: user.id,
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }
      if (data) {
        setTags((prev) =>
          [...prev, data].sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
          ),
        );
        setName("");
      }
    } catch (err: unknown) {
      console.error("Failed to create tag", err);
      const code =
        typeof err === "object" && err !== null && "code" in err
          ? String((err as { code?: string }).code)
          : "";
      if (code === "23505") {
        setError("That tag already exists.");
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Could not save the tag.");
      }
    } finally {
      setPending(false);
    }
  };

  const handleDelete = async (tagId: string) => {
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("You must be signed in to delete tags.");
      }
      const { data: deleted, error: rpcError } = await supabase.rpc(
        "delete_tag_and_task_links",
        { p_tag_id: tagId },
      );

      if (rpcError) {
        throw rpcError;
      }
      if (!deleted) {
        setError("Tag not found or you do not have permission to delete it.");
        return;
      }

      setTags((prev) => prev.filter((t) => t.id !== tagId));
    } catch (err: unknown) {
      console.error("Failed to delete tag", err);
      setError(
        err instanceof Error ? err.message : "Could not delete the tag.",
      );
    }
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div className="min-w-0">
          <label
            htmlFor="new-tag-name"
            className="block text-xs font-medium uppercase tracking-wide text-[#a2ad59]"
          >
            Tags
          </label>
          <input
            id="new-tag-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/15 bg-[#0f3534]/40 px-3 py-2 text-sm text-[#f4f7f2] placeholder:text-white/35 outline-none ring-[#177e89] focus:ring-2"
            placeholder="e.g. design"
            autoComplete="off"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-[#a2ad59] px-4 py-2 text-sm font-semibold text-[#0c2524] shadow-md shadow-black/20 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Creating…" : "New tag"}
        </button>
      </form>
      {error ? (
        <p className="mt-2 text-xs text-[#f4a09a]" role="alert">
          {error}
        </p>
      ) : null}
      {tags.length > 0 ? (
        <ul
          className="mt-3 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto pr-1 text-[#f4f7f2]/90"
          aria-label="Your tags"
        >
          {tags.map((t) => (
            <li
              key={t.id}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/15 bg-[#0f3534]/80 py-0.5 pl-2.5 pr-1 text-[11px] font-medium tracking-wide"
            >
              <span className="min-w-0 truncate">{t.name}</span>
              <button
                type="button"
                onClick={() => handleDelete(t.id)}
                className="shrink-0 rounded-full px-1 text-red-400/90 transition hover:bg-white/10 hover:text-red-300"
                aria-label={`Delete tag ${t.name}`}
              >
                x
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
