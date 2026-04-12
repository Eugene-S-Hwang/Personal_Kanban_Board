"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  defaultDropAnimationSideEffects,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DropAnimation,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useCallback, useState, useSyncExternalStore } from "react";
import { KanbanColumn } from "./kanban-column";
import { TaskFormDialog } from "./task-form-dialog";
import type { ColumnId, Task, TaskPriority } from "./types";
import { COLUMN_LABELS, COLUMN_ORDER } from "./types";

function isColumnId(id: string): id is ColumnId {
  return (COLUMN_ORDER as readonly string[]).includes(id);
}

const COLUMN_ACCENTS: Record<ColumnId, string> = {
  "to-do": "bg-[#6ec9bc]",
  "in-progress": "bg-[#7dd3df]",
  "review": "bg-[#c4cf95]",
  "done": "bg-[#e3eb9a]",
};

const COLUMN_SUBTITLES: Record<ColumnId, string> = {
  "to-do": "Ideas and upcoming work",
  "in-progress": "Active focus",
  "review": "Ready for feedback",
  "done": "Shipped or accepted",
};

const INITIAL_TASKS: Record<ColumnId, Task[]> = {
  "to-do": [
    {
      id: "seed-1",
      title: "Draft project README",
      description: "Explain setup, scripts, and folder layout for reviewers.",
      priority: "low",
      tags: ["docs"],
    },
    {
      id: "seed-2",
      title: "Design board color tokens",
      description: "Map palette to surfaces, borders, and accents.",
      priority: "medium",
      tags: ["design", "ui"],
    },
  ],
  "in-progress": [
    {
      id: "seed-3",
      title: "Implement drag and drop",
      description: "Columns accept drops; reorder within a column.",
      priority: "high",
      tags: ["frontend"],
    },
  ],
  "review": [
    {
      id: "seed-4",
      title: "Accessibility pass",
      description: "Verify focus order and screen reader labels on cards.",
      priority: "medium",
      tags: ["a11y"],
    },
  ],
  "done": [
    {
      id: "seed-5",
      title: "Scaffold Next.js app",
      description: "App Router, Tailwind, and base layout.",
      priority: "low",
      tags: ["chore"],
    },
  ],
};

function findColumnForTask(
  columns: Record<ColumnId, Task[]>,
  taskId: string,
): ColumnId | undefined {
  for (const col of COLUMN_ORDER) {
    if (columns[col].some((t) => t.id === taskId)) return col;
  }
  return undefined;
}

const dropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: "0.45" } },
  }),
};

const noopSubscribe = () => () => {};

function useIsClient() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export function KanbanBoard() {
  const boardReady = useIsClient();

  const [columns, setColumns] =
    useState<Record<ColumnId, Task[]>>(INITIAL_TASKS);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<
    { type: "create" } | { type: "edit"; task: Task }
  >({ type: "create" });
  const [newTaskDefaultColumn, setNewTaskDefaultColumn] =
    useState<ColumnId>("to-do");
  const [formInstanceKey, setFormInstanceKey] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = String(event.active.id);
    const col = findColumnForTask(columns, id);
    if (!col) return;
    const task = columns[col].find((t) => t.id === id);
    if (task) setActiveTask(task);
  }, [columns]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId === overId) return;

    setColumns((prev) => {
      const activeColumn = findColumnForTask(prev, activeId);
      if (!activeColumn) return prev;

      let overColumn: ColumnId;
      let overIndex: number;

      if (isColumnId(overId)) {
        overColumn = overId;
        overIndex = prev[overColumn].length;
      } else {
        const oc = findColumnForTask(prev, overId);
        if (!oc) return prev;
        overColumn = oc;
        overIndex = prev[overColumn].findIndex((t) => t.id === overId);
        if (overIndex < 0) return prev;
      }

      if (activeColumn === overColumn) {
        const list = prev[activeColumn];
        const oldIndex = list.findIndex((t) => t.id === activeId);
        if (oldIndex < 0) return prev;
        if (oldIndex === overIndex) return prev;
        return {
          ...prev,
          [activeColumn]: arrayMove(list, oldIndex, overIndex),
        };
      }

      const sourceList = [...prev[activeColumn]];
      const from = sourceList.findIndex((t) => t.id === activeId);
      if (from < 0) return prev;
      const [moved] = sourceList.splice(from, 1);

      const destList = [...prev[overColumn]];

      if (isColumnId(overId)) {
        destList.push(moved);
      } else {
        const idx = destList.findIndex((t) => t.id === overId);
        if (idx >= 0) destList.splice(idx, 0, moved);
        else destList.push(moved);
      }

      return {
        ...prev,
        [activeColumn]: sourceList,
        [overColumn]: destList,
      };
    });
  }, []);

  const handleDragCancel = useCallback(() => {
    setActiveTask(null);
  }, []);

  const openCreate = (col: ColumnId) => {
    setFormMode({ type: "create" });
    setNewTaskDefaultColumn(col);
    setFormInstanceKey((k) => k + 1);
    setFormOpen(true);
  };

  const openEdit = (task: Task) => {
    const col = findColumnForTask(columns, task.id);
    setFormMode({ type: "edit", task });
    if (col) setNewTaskDefaultColumn(col);
    setFormInstanceKey((k) => k + 1);
    setFormOpen(true);
  };

  const handleSave = (payload: {
    title: string;
    description: string;
    priority: TaskPriority;
    tags: string[];
    columnId: ColumnId;
  }) => {
    if (formMode.type === "create") {
      const task: Task = {
        id: typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `task-${Date.now()}`,
        title: payload.title,
        description: payload.description,
        priority: payload.priority,
        tags: payload.tags,
      };
      setColumns((prev) => ({
        ...prev,
        [payload.columnId]: [...prev[payload.columnId], task],
      }));
      return;
    }

    const { task: existing } = formMode;
    const previousColumn = findColumnForTask(columns, existing.id);
    if (!previousColumn) return;

    const updated: Task = {
      ...existing,
      title: payload.title,
      description: payload.description,
      priority: payload.priority,
      tags: payload.tags,
    };

    setColumns((prev) => {
      if (previousColumn === payload.columnId) {
        return {
          ...prev,
          [payload.columnId]: prev[payload.columnId].map((t) =>
            t.id === existing.id ? updated : t,
          ),
        };
      }
      return {
        ...prev,
        [previousColumn]: prev[previousColumn].filter(
          (t) => t.id !== existing.id,
        ),
        [payload.columnId]: [...prev[payload.columnId], updated],
      };
    });
  };

  const handleDelete = (id: string) => {
    setColumns((prev) => {
      const col = findColumnForTask(prev, id);
      if (!col) return prev;
      return {
        ...prev,
        [col]: prev[col].filter((t) => t.id !== id),
      };
    });
  };

  const formInitialColumn: ColumnId =
    formMode.type === "edit"
      ? findColumnForTask(columns, formMode.task.id) ?? "to-do"
      : newTaskDefaultColumn;

  if (!boardReady) {
    return (
      <div className="flex min-h-screen flex-col bg-gradient-to-br from-[#08605f] via-[#177e89] to-[#598381]">
        <header className="border-b border-white/10 bg-[#08605f]/40 px-4 py-6 backdrop-blur-md sm:px-8">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#f4f7f2] sm:text-3xl">
                Kanban Board
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/75">
                Organize work visually: create tasks, prioritize, and drag cards
                across stages.
              </p>
            </div>
            <div className="inline-flex h-[48px] shrink-0 items-center justify-center rounded-xl bg-[#a2ad59]/50 px-5 text-sm font-semibold text-[#0c2524]/70 sm:h-[48px]">
              Loading…
            </div>
          </div>
        </header>
        <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-4 px-4 py-8 sm:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:overflow-x-auto lg:pb-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-[min(420px,50vh)] min-h-[280px] min-w-[280px] flex-1 animate-pulse rounded-2xl bg-white/[0.07] sm:min-w-[300px]"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-[#08605f] via-[#177e89] to-[#598381]">
      <header className="border-b border-white/10 bg-[#08605f]/40 px-4 py-6 backdrop-blur-md sm:px-8">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#f4f7f2] sm:text-3xl">
              Kanban Board
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/75">
              Organize work visually: create tasks, prioritize, and drag cards
              across stages.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openCreate("to-do")}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#a2ad59] px-5 py-3 text-sm font-semibold text-[#0c2524] shadow-lg shadow-black/25 transition hover:brightness-105"
          >
            <span className="text-lg leading-none">+</span>
            New task
          </button>
        </div>
      </header>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-4 px-4 py-8 sm:px-8">
          <div className="flex flex-wrap gap-3 text-xs text-white/70">
            <span className="rounded-full bg-black/15 px-3 py-1 ring-1 ring-white/10">
              Drag the handle or card between columns
            </span>
            <span className="rounded-full bg-black/15 px-3 py-1 ring-1 ring-white/10">
              Reorder within a column
            </span>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:overflow-x-auto lg:pb-2">
            {COLUMN_ORDER.map((columnId) => (
              <div key={columnId} className="flex flex-col gap-3">
                <KanbanColumn
                  columnId={columnId}
                  title={COLUMN_LABELS[columnId]}
                  subtitle={COLUMN_SUBTITLES[columnId]}
                  tasks={columns[columnId]}
                  accentClassName={COLUMN_ACCENTS[columnId]}
                  onEditTask={openEdit}
                  onDeleteTask={handleDelete}
                />
                <button
                  type="button"
                  onClick={() => openCreate(columnId)}
                  className="rounded-xl border border-dashed border-white/25 bg-white/5 py-2.5 text-sm font-medium text-white/80 transition hover:border-[#a2ad59]/55 hover:bg-[#a2ad59]/10 hover:text-[#f4f7f2]"
                >
                  + Add to {COLUMN_LABELS[columnId]}
                </button>
              </div>
            ))}
          </div>
        </div>

        <DragOverlay dropAnimation={dropAnimation}>
          {activeTask ? (
            <div className="w-[min(100vw-2rem,320px)] rounded-xl border border-[#a2ad59]/50 bg-[var(--kb-surface)] p-3 shadow-2xl shadow-black/40">
              <p className="text-sm font-semibold text-[#0c2524]">
                {activeTask.title}
              </p>
              {activeTask.description ? (
                <p className="mt-1 line-clamp-2 text-xs text-[#598381]">
                  {activeTask.description}
                </p>
              ) : null}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <TaskFormDialog
        open={formOpen}
        instanceKey={`${formInstanceKey}-${formMode.type}-${
          formMode.type === "edit" ? formMode.task.id : newTaskDefaultColumn
        }`}
        mode={formMode}
        initialColumn={formInitialColumn}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
