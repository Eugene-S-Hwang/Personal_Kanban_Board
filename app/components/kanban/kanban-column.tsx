"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { ColumnId, Task } from "./types";
import { TaskCard } from "./task-card";

type KanbanColumnProps = {
  columnId: ColumnId;
  title: string;
  subtitle: string;
  tasks: Task[];
  accentClassName: string;
  onOpenTaskDetails: (task: Task) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
};

export function KanbanColumn({
  columnId,
  title,
  subtitle,
  tasks,
  accentClassName,
  onOpenTaskDetails,
  onEditTask,
  onDeleteTask,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId });

  const ids = tasks.map((t) => t.id);

  return (
    <section className="flex min-h-[420px] min-w-[280px] max-w-[360px] flex-1 flex-col rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-3 shadow-inner shadow-black/20 backdrop-blur-md sm:min-w-[300px]">
      <header className="mb-3 flex items-start justify-between gap-2 border-b border-white/10 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${accentClassName}`}
              aria-hidden
            />
            <h2 className="text-sm font-semibold tracking-tight text-[#f4f7f2]">
              {title}
            </h2>
          </div>
          <p className="mt-1 pl-4 text-xs text-white/55">{subtitle}</p>
        </div>
        <span className="rounded-full bg-[#08605f]/40 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-[#a2ad59] ring-1 ring-[#177e89]/35">
          {tasks.length}
        </span>
      </header>

      <div
        ref={setNodeRef}
        className={`flex min-h-[320px] flex-1 flex-col gap-2 rounded-xl p-1 transition-colors ${
          isOver
            ? "bg-[#a2ad59]/10 ring-2 ring-[#a2ad59]/40 ring-inset"
            : "bg-black/10"
        }`}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {tasks.length === 0 ? (
            <p className="m-auto max-w-[14rem] text-center text-xs leading-relaxed text-white/45">
              Drop tasks here or add a new card — empty columns are valid
              landing zones.
            </p>
          ) : (
            tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onOpenDetails={onOpenTaskDetails}
                onEdit={onEditTask}
                onDelete={onDeleteTask}
              />
            ))
          )}
        </SortableContext>
      </div>
    </section>
  );
}
