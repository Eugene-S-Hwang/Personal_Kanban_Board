"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Task, TaskPriority } from "./types";

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

type TaskCardProps = {
  task: Task;
  onOpenDetails: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
};

export function TaskCard({
  task,
  onOpenDetails,
  onEdit,
  onDelete,
}: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const pr =
    priorityStyles[task.priority as TaskPriority] ?? priorityStyles.medium;

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-xl border border-white/15 bg-[var(--kb-surface)] p-3 shadow-sm shadow-black/20 backdrop-blur-sm transition-[box-shadow,opacity] ${
        isDragging ? "z-10 opacity-40 shadow-lg" : "hover:border-[#a2ad59]/45"
      }`}
    >
      <div className="flex gap-2">
        <button
          type="button"
          className="mt-0.5 flex h-8 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg bg-[#08605f]/15 text-[#a2ad59] ring-1 ring-[#177e89]/30 active:cursor-grabbing"
          aria-label={`Drag ${task.title}`}
          {...attributes}
          {...listeners}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
          >
            <path d="M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM8 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM8 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM20 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM20 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM20 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold leading-snug text-[#0c2524]">
              {task.title}
            </h3>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${pr.className}`}
            >
              {pr.label}
            </span>
          </div>
          {task.description ? (
            <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-[#598381]">
              {task.description}
            </p>
          ) : null}
          {(task.tags ?? []).length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {(task.tags ?? []).map((tag) => (
                <li
                  key={tag}
                  className="rounded-md bg-[#8e936d]/20 px-2 py-0.5 text-[10px] font-medium text-[#0c2524] ring-1 ring-[#8e936d]/35"
                >
                  {tag}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <button
          type="button"
          className="rounded-lg px-2 py-1 text-xs font-medium text-[#a2ad59] hover:bg-[#a2ad59]/15"
          onClick={() => onOpenDetails(task)}
          onPointerDown={(e) => e.stopPropagation()}
        >
          Details
        </button>
        <button
          type="button"
          className="rounded-lg px-2 py-1 text-xs font-medium text-[#177e89] hover:bg-[#177e89]/15"
          onClick={() => onEdit(task)}
          onPointerDown={(e) => e.stopPropagation()}
        >
          Edit
        </button>
        <button
          type="button"
          className="rounded-lg px-2 py-1 text-xs font-medium text-red-700/90 hover:bg-red-500/10"
          onClick={() => onDelete(String(task.id))}
          onPointerDown={(e) => e.stopPropagation()}
        >
          Delete
        </button>
      </div>
    </article>
  );
}
