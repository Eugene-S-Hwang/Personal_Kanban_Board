"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { startTransition, useCallback, useEffect, useState } from "react";
import { createClient } from "@/app/utils/supabase/client";
import {
  COLUMN_ACCENTS,
  COLUMN_SUBTITLES,
  dropAnimation,
  emptyColumns,
  findColumnForTask,
  groupTasksByColumn,
  isColumnId,
  useIsClient,
} from "./kanban-board-utils";
import { KanbanColumn } from "./kanban-column";
import { KanbanSidebar } from "./kanban-sidebar";
import { TaskFormDialog } from "./task-form-dialog";
import type { TagRow } from "./tag-create-form";
import type { ColumnId, Task, TaskPriority } from "./types";
import { COLUMN_LABELS, COLUMN_ORDER } from "./types";

export function KanbanBoard({
  tasks,
  initialTags,
}: {
  tasks: Task[] | null;
  initialTags: TagRow[] | null;
}) {
  const boardReady = useIsClient();

  const [columns, setColumns] =
    useState<Record<ColumnId, Task[]>>(emptyColumns);

  useEffect(() => {
    startTransition(() => {
      if (tasks) {
        setColumns(groupTasksByColumn(tasks));
      } else {
        setColumns(emptyColumns());
      }
    });
  }, [tasks]);
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
    const task = columns[col].find((t) => String(t.id) === id);
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
        overIndex = prev[overColumn].findIndex((t) => String(t.id) === overId);
        if (overIndex < 0) return prev;
      }

      if (activeColumn === overColumn) {
        const list = prev[activeColumn];
        const oldIndex = list.findIndex((t) => String(t.id) === activeId);
        if (oldIndex < 0) return prev;
        if (oldIndex === overIndex) return prev;
        return {
          ...prev,
          [activeColumn]: arrayMove(list, oldIndex, overIndex),
        };
      }

      const sourceList = [...prev[activeColumn]];
      const from = sourceList.findIndex((t) => String(t.id) === activeId);
      if (from < 0) return prev;
      const [moved] = sourceList.splice(from, 1);
      const movedWithColumn: Task = { ...moved, status: overColumn };

      const destList = [...prev[overColumn]];

      if (isColumnId(overId)) {
        destList.push(movedWithColumn);
      } else {
        const idx = destList.findIndex((t) => String(t.id) === overId);
        if (idx >= 0) destList.splice(idx, 0, movedWithColumn);
        else destList.push(movedWithColumn);
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
    const col = findColumnForTask(columns, String(task.id));
    setFormMode({ type: "edit", task });
    if (col) setNewTaskDefaultColumn(col);
    setFormInstanceKey((k) => k + 1);
    setFormOpen(true);
  };

  const handleSave = async (payload: {
    title: string;
    description: string;
    priority: TaskPriority;
    tags: string[];
    columnId: ColumnId;
  }) => {

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("You must be authenticated to create or update a task.");
    }

    if (formMode.type === "create") {

      const { data, error } = await supabase
        .from("Tasks")
        .insert({
          title: payload.title,
          description: payload.description,
          priority: payload.priority,
          status: payload.columnId,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      const task: Task = {
        ...data,
        tags: payload.tags.length > 0 ? payload.tags : undefined,
      };
      setColumns((prev) => ({
        ...prev,
        [payload.columnId]: [...prev[payload.columnId], task],
      }));
      return;
    }

    const { task: existing } = formMode;
    const previousColumn = findColumnForTask(columns, String(existing.id));
    if (!previousColumn) return;

    let updated: Task = {
      ...existing,
      title: payload.title,
      description: payload.description,
      priority: payload.priority,
      status: payload.columnId,
      tags: payload.tags.length > 0 ? payload.tags : undefined,
    };
    
    if (existing.id !== undefined) {
      const { data, error } = await supabase
        .from("Tasks")
        .update({
          title: payload.title,
          description: payload.description,
          priority: payload.priority,
          status: payload.columnId,
        })
        .eq("id", existing.id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) {
        throw error;
      }
      if (data) {
        updated = {
          ...data,
          tags: payload.tags.length > 0 ? payload.tags : undefined,
        };
      }
    }

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

  const handleDelete = async(id: string | number) => {
    const sid = String(id);
    setColumns((prev) => {
      const col = findColumnForTask(prev, sid);
      if (!col) return prev;
      return {
        ...prev,
        [col]: prev[col].filter((t) => String(t.id) !== sid),
      };
    });

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("You must be authenticated to delete a task.");
    }

    const { error } = await supabase
      .from("Tasks")
      .delete()
      .eq("id", sid)
      .eq("user_id", user.id);

    if (error) {
      throw error;
    }
  };

  const formInitialColumn: ColumnId =
    formMode.type === "edit"
      ? findColumnForTask(columns, String(formMode.task.id)) ?? "to-do"
      : newTaskDefaultColumn;

  if (!boardReady) {
    return (
      <div className="flex min-h-screen flex-col bg-gradient-to-br from-[#08605f] via-[#177e89] to-[#598381]">
        <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 px-4 py-8 sm:px-8 lg:flex-row lg:items-start">
          <div className="h-48 w-full shrink-0 animate-pulse rounded-2xl bg-white/[0.07] lg:h-[min(480px,70vh)] lg:w-[150px]" />
          <div className="flex min-w-0 flex-1 flex-col gap-4 lg:overflow-x-auto lg:pb-2">
            <div className="flex flex-col gap-4 lg:flex-row">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-[min(420px,50vh)] min-h-[280px] min-w-[280px] flex-1 animate-pulse rounded-2xl bg-white/[0.07] sm:min-w-[300px]"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-[#08605f] via-[#177e89] to-[#598381]">
      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 px-4 py-8 sm:px-8 lg:flex-row lg:items-start">
        <KanbanSidebar
          initialTags={initialTags}
          onNewTask={() => openCreate("to-do")}
        />

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-white/70">
              <span className="inline-flex min-h-[1.75rem] items-center rounded-full bg-black/15 px-3 py-1 ring-1 ring-white/10">
                Drag the handle or card between columns
              </span>
              <span className="inline-flex min-h-[1.75rem] items-center rounded-full bg-black/15 px-3 py-1 ring-1 ring-white/10">
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
      </div>

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
