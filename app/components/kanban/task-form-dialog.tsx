"use client";

import { useId, useState } from "react";
import type { ColumnId, Task, TaskPriority } from "./types";
import { COLUMN_LABELS, COLUMN_ORDER } from "./types";

type Mode = { type: "create" } | { type: "edit"; task: Task };

type TaskFormDialogProps = {
  open: boolean;
  /** Changes when opening so the form remounts with fresh values. */
  instanceKey: string;
  mode: Mode;
  /** Column pre-selected when opening (create or edit). */
  initialColumn: ColumnId;
  onClose: () => void;
  onSave: (payload: {
    title: string;
    description: string;
    priority: TaskPriority;
    tags: string[];
    columnId: ColumnId;
  }) => void | Promise<void>;
};

const priorities: TaskPriority[] = ["low", "medium", "high"];

type TaskFormDialogBodyProps = {
  mode: Mode;
  initialColumn: ColumnId;
  titleId: string;
  onClose: TaskFormDialogProps["onClose"];
  onSave: TaskFormDialogProps["onSave"];
};

function TaskFormDialogBody({
  mode,
  initialColumn,
  titleId,
  onClose,
  onSave,
}: TaskFormDialogBodyProps) {
  const [title, setTitle] = useState(() =>
    mode.type === "edit" ? mode.task.title : "",
  );
  const [description, setDescription] = useState(() =>
    mode.type === "edit" ? mode.task.description : "",
  );
  const [priority, setPriority] = useState<TaskPriority>(() =>
    mode.type === "edit" ? (mode.task.priority as TaskPriority) : "medium",
  );
  const [tagsInput, setTagsInput] = useState(() =>
    mode.type === "edit" ? (mode.task.tags ?? []).join(", ") : "",
  );
  const [columnId, setColumnId] = useState<ColumnId>(() => initialColumn);

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    const tags = tagsInput
      .split(",")
      .map((t: string) => t.trim())
      .filter(Boolean);
    try {
      await onSave({
        title: trimmed,
        description: description.trim(),
        priority,
        tags,
        columnId,
      });
      onClose();
    } catch (error){
      // Keep dialog open; parent may surface errors (e.g. insert failed).
      console.error("Failed to save task ", error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-[#08605f]/60 backdrop-blur-sm"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-md rounded-2xl border border-white/20 bg-[#0f3534] p-6 shadow-2xl shadow-black/40"
      >
        <h2 id={titleId} className="text-lg font-semibold text-[#f4f7f2]">
          {mode.type === "create" ? "New task" : "Edit task"}
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="task-title"
              className="block text-xs font-medium uppercase tracking-wide text-[#a2ad59]"
            >
              Title
            </label>
            <input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/15 bg-[#08605f]/25 px-3 py-2 text-sm text-[#f4f7f2] placeholder:text-white/35 outline-none ring-[#177e89] focus:ring-2"
              placeholder="Ship the onboarding flow"
              autoFocus
              required
            />
          </div>
          <div>
            <label
              htmlFor="task-desc"
              className="block text-xs font-medium uppercase tracking-wide text-[#a2ad59]"
            >
              Description
            </label>
            <textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full resize-y rounded-xl border border-white/15 bg-[#08605f]/25 px-3 py-2 text-sm text-[#f4f7f2] placeholder:text-white/35 outline-none ring-[#177e89] focus:ring-2"
              placeholder="Acceptance criteria, links, notes…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="task-priority"
                className="block text-xs font-medium uppercase tracking-wide text-[#a2ad59]"
              >
                Priority
              </label>
              <select
                id="task-priority"
                value={priority}
                onChange={(e) =>
                  setPriority(e.target.value as TaskPriority)
                }
                className="mt-1 w-full rounded-xl border border-white/15 bg-[#08605f]/25 px-3 py-2 text-sm text-[#f4f7f2] outline-none ring-[#177e89] focus:ring-2"
              >
                {priorities.map((p) => (
                  <option key={p} value={p} className="bg-[#0f3534]">
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="task-column"
                className="block text-xs font-medium uppercase tracking-wide text-[#a2ad59]"
              >
                Column
              </label>
              <select
                id="task-column"
                value={columnId}
                onChange={(e) =>
                  setColumnId(e.target.value as ColumnId)
                }
                className="mt-1 w-full rounded-xl border border-white/15 bg-[#08605f]/25 px-3 py-2 text-sm text-[#f4f7f2] outline-none ring-[#177e89] focus:ring-2"
              >
                {COLUMN_ORDER.map((id) => (
                  <option key={id} value={id} className="bg-[#0f3534]">
                    {COLUMN_LABELS[id]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label
              htmlFor="task-tags"
              className="block text-xs font-medium uppercase tracking-wide text-[#a2ad59]"
            >
              Tags
            </label>
            <input
              id="task-tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/15 bg-[#08605f]/25 px-3 py-2 text-sm text-[#f4f7f2] placeholder:text-white/35 outline-none ring-[#177e89] focus:ring-2"
              placeholder="design, api, polish"
            />
            <p className="mt-1 text-[11px] text-white/45">
              Comma-separated — stored in the browser only for this session.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-[#f4f7f2]/80 hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-[#a2ad59] px-4 py-2 text-sm font-semibold text-[#0c2524] shadow-md shadow-black/20 hover:brightness-105"
            >
              {mode.type === "create" ? "Create task" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function TaskFormDialog({
  open,
  instanceKey,
  mode,
  initialColumn,
  onClose,
  onSave,
}: TaskFormDialogProps) {
  const titleId = useId();

  if (!open) return null;

  return (
    <TaskFormDialogBody
      key={instanceKey}
      mode={mode}
      initialColumn={initialColumn}
      titleId={titleId}
      onClose={onClose}
      onSave={onSave}
    />
  );
}
