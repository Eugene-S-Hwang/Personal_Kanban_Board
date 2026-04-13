"use client";

import { useEffect, useId, useState } from "react";
import { createClient } from "@/app/utils/supabase/client";
import type { Tables } from "@/app/utils/supabase/database.types";
import type { ColumnId, Task, TaskPriority } from "./types";
import { COLUMN_LABELS, COLUMN_ORDER } from "./types";

type CommentRow = Tables<"comments">;

const priorityStyles: Record<
  TaskPriority,
  { label: string; className: string }
> = {
  low: {
    label: "Low",
    className:
      "bg-[#598381]/25 text-[#f4f7f2] ring-1 ring-[#598381]/50",
  },
  medium: {
    label: "Medium",
    className:
      "bg-[#177e89]/35 text-[#f4f7f2] ring-1 ring-[#177e89]/45",
  },
  high: {
    label: "High",
    className:
      "bg-[#a2ad59]/35 text-[#0c2524] ring-1 ring-[#8e936d]/70",
  },
};

function formatCommentTimestamp(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

type TaskDetailPanelProps = {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  onEditTask: (task: Task) => void;
};

type TaskDetailPanelInnerProps = {
  task: Task;
  onClose: () => void;
  onEditTask: (task: Task) => void;
};

function TaskDetailPanelInner({
  task,
  onClose,
  onEditTask,
}: TaskDetailPanelInnerProps) {
  const titleId = useId();
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const taskId = String(task.id);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!cancelled) setCurrentUserId(user?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const { data, error: qErr } = await supabase
        .from("comments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (qErr) {
        setError(qErr.message);
        setComments([]);
        setLoadingComments(false);
        return;
      }
      setComments(data ?? []);
      setLoadingComments(false);
      setError(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const canDeleteComment = (c: CommentRow) =>
    currentUserId !== null &&
    (c.user_id === currentUserId || task.user_id === currentUserId);

  const handleDeleteComment = async (comment: CommentRow) => {
    if (!canDeleteComment(comment) || deletingId !== null) return;
    setError(null);
    setDeletingId(comment.id);
    const supabase = createClient();
    const { error: delErr } = await supabase
      .from("comments")
      .delete()
      .eq("id", comment.id);
    setDeletingId(null);
    if (delErr) {
      setError(delErr.message);
      return;
    }
    setComments((prev) => prev.filter((x) => x.id !== comment.id));
  };

  const handleSubmitComment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("You must be signed in to add a comment.");
      setSubmitting(false);
      return;
    }
    const { data, error: insErr } = await supabase
      .from("comments")
      .insert({ task_id: taskId, user_id: user.id, text: trimmed })
      .select()
      .single();
    setSubmitting(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    if (data) setComments((prev) => [...prev, data]);
    setBody("");
  };

  const pr =
    priorityStyles[task.priority as TaskPriority] ?? priorityStyles.medium;
  const col = task.status as ColumnId;
  const columnLabel = COLUMN_ORDER.includes(col) ? COLUMN_LABELS[col] : null;

  return (
    <div className="fixed inset-0 z-[45] flex items-end justify-center p-4 sm:items-stretch sm:justify-end sm:p-0">
      <button
        type="button"
        className="absolute inset-0 bg-[#08605f]/60 backdrop-blur-sm"
        aria-label="Close task details"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[min(100vh,720px)] w-full max-w-lg flex-col rounded-t-2xl border border-white/20 bg-[#0f3534] shadow-2xl shadow-black/40 sm:max-h-none sm:h-full sm:max-w-md sm:rounded-none sm:border-l sm:border-t-0 sm:border-r-0 sm:border-b-0"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 p-5 sm:p-6">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="text-lg font-semibold leading-snug text-[#f4f7f2]"
            >
              {task.title}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${pr.className}`}
              >
                {pr.label}
              </span>
              {columnLabel ? (
                <span className="text-xs text-white/55">{columnLabel}</span>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              className="rounded-xl px-3 py-1.5 text-sm font-medium text-[#177e89] hover:bg-[#177e89]/15"
              onClick={() => {
                onEditTask(task);
                onClose();
              }}
            >
              Edit
            </button>
            <button
              type="button"
              className="rounded-xl px-3 py-1.5 text-sm font-medium text-[#f4f7f2]/80 hover:bg-white/10"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          {task.description ? (
            <section className="mb-6">
              <h3 className="text-xs font-medium uppercase tracking-wide text-[#a2ad59]">
                Description
              </h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#f4f7f2]/90">
                {task.description}
              </p>
            </section>
          ) : null}

          {(task.tags ?? []).length > 0 ? (
            <section className="mb-6">
              <h3 className="text-xs font-medium uppercase tracking-wide text-[#a2ad59]">
                Tags
              </h3>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {(task.tags ?? []).map((tag) => (
                  <li
                    key={tag}
                    className="rounded-md bg-[#8e936d]/20 px-2 py-0.5 text-xs font-medium text-[#f4f7f2] ring-1 ring-[#8e936d]/35"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <h3 className="text-xs font-medium uppercase tracking-wide text-[#a2ad59]">
              Comments
            </h3>

            {loadingComments ? (
              <p className="mt-3 text-sm text-white/45">Loading comments…</p>
            ) : comments.length === 0 ? (
              <p className="mt-3 text-sm text-white/45">
                No comments yet. Add one below.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {comments.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-xl border border-white/10 bg-[#08605f]/20 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <time
                        className="shrink-0 text-[11px] tabular-nums text-white/50"
                        dateTime={c.created_at}
                      >
                        {formatCommentTimestamp(c.created_at)}
                      </time>
                      {canDeleteComment(c) ? (
                        <button
                          type="button"
                          disabled={deletingId !== null}
                          title="Delete comment"
                          onClick={() => void handleDeleteComment(c)}
                          className="shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-medium text-red-400 hover:bg-red-500/15 disabled:cursor-wait disabled:opacity-60"
                        >
                          {deletingId === c.id ? "Deleting…" : "Delete"}
                        </button>
                      ) : null}
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#f4f7f2]/95">
                      {c.text}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={handleSubmitComment} className="mt-4 space-y-2">
              <label
                htmlFor="task-detail-new-comment"
                className="sr-only"
              >
                New comment
              </label>
              <textarea
                id="task-detail-new-comment"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                placeholder="Write a comment…"
                className="w-full resize-y rounded-xl border border-white/15 bg-[#08605f]/25 px-3 py-2 text-sm text-[#f4f7f2] placeholder:text-white/35 outline-none ring-[#177e89] focus:ring-2"
              />
              {error ? (
                <p className="text-xs text-red-300/90" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting || !body.trim()}
                  className="rounded-xl bg-[#a2ad59] px-4 py-2 text-sm font-semibold text-[#0c2524] shadow-md shadow-black/20 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? "Adding…" : "Add comment"}
                </button>
              </div>
            </form>
          </section>
        </div>
      </aside>
    </div>
  );
}

export function TaskDetailPanel({
  task,
  open,
  onClose,
  onEditTask,
}: TaskDetailPanelProps) {
  if (!open || !task) return null;

  return (
    <TaskDetailPanelInner
      key={String(task.id)}
      task={task}
      onClose={onClose}
      onEditTask={onEditTask}
    />
  );
}
