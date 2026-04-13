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
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
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
  stripTagIdFromTask,
  tagLabelsForIds,
  syncTaskTagsForTask,
} from "./kanban-board-utils";
import { KanbanColumn } from "./kanban-column";
import { KanbanSidebar } from "./kanban-sidebar";
import { TaskDetailPanel } from "./task-detail-panel";
import { TaskFormDialog } from "./task-form-dialog";
import type { TagRow } from "./tag-create-form";
import type { ColumnId, Task, TaskPriority } from "./types";
import { COLUMN_LABELS, COLUMN_ORDER } from "./types";

const PRIORITY_FILTER_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];



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
  const [availableTags, setAvailableTags] = useState<TagRow[]>(initialTags ?? []);
  /** Whether the board filters by tag (label) or by priority. */
  const [filterBy, setFilterBy] = useState<"tag" | "priority">("tag");
  /** When set (tag mode), each column only lists tasks that include this tag id. */
  const [filterTagId, setFilterTagId] = useState<string | null>(null);
  /** When set (priority mode), each column only lists tasks with this priority. */
  const [filterPriority, setFilterPriority] = useState<TaskPriority | null>(null);
  /** Substring match on task title (case-insensitive); applied after tag/priority filters. */
  const [titleSearch, setTitleSearch] = useState("");
  /** Task id whose detail panel is open; latest task row is resolved from `columns`. */
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);

  const detailTask = useMemo(() => {
    if (!detailTaskId) return null;
    for (const col of COLUMN_ORDER) {
      const t = columns[col].find((x) => String(x.id) === detailTaskId);
      if (t) return t;
    }
    return null;
  }, [columns, detailTaskId]);

  useEffect(() => {
    startTransition(() => {
      setAvailableTags(initialTags ?? []);
    });
  }, [initialTags]);

  const activeFilterTagId = useMemo(() => {
    if (filterTagId === null) return null;
    return availableTags.some((t) => t.id === filterTagId)
      ? filterTagId
      : null;
  }, [filterTagId, availableTags]);

  const filteredColumns = useMemo(() => {
    if (filterBy === "tag") {
      if (activeFilterTagId === null) return columns;
      const next = emptyColumns();
      for (const col of COLUMN_ORDER) {
        next[col] = columns[col].filter((t) =>
          (t.tagIds ?? []).includes(activeFilterTagId),
        );
      }
      return next;
    }
    if (filterPriority === null) return columns;
    const next = emptyColumns();
    for (const col of COLUMN_ORDER) {
      next[col] = columns[col].filter(
        (t) => (t.priority as TaskPriority) === filterPriority,
      );
    }
    return next;
  }, [columns, filterBy, activeFilterTagId, filterPriority]);

  const displayColumns = useMemo(() => {
    const q = titleSearch.trim().toLowerCase();
    if (!q) return filteredColumns;
    const next = emptyColumns();
    for (const col of COLUMN_ORDER) {
      next[col] = filteredColumns[col].filter((t) =>
        t.title.toLowerCase().includes(q),
      );
    }
    return next;
  }, [filteredColumns, titleSearch]);

  const handleTagDeleted = useCallback((tagId: string) => {
    setFilterTagId((prev) => (prev === tagId ? null : prev));
    setColumns((prev) => {
      const next = { ...prev };
      for (const col of COLUMN_ORDER) {
        next[col] = prev[col].map((t) => stripTagIdFromTask(t, tagId));
      }
      return next;
    });
    setActiveTask((t) => (t ? stripTagIdFromTask(t, tagId) : null));
    setFormMode((fm) => {
      if (fm.type !== "edit") return fm;
      const hadTag = (fm.task.tagIds ?? []).includes(tagId);
      const nextTask = stripTagIdFromTask(fm.task, tagId);
      if (nextTask === fm.task) return fm;
      if (hadTag) {
        queueMicrotask(() => setFormInstanceKey((k) => k + 1));
      }
      return { type: "edit", task: nextTask };
    });
  }, []);

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

      queueMicrotask(() => {
        void (async () => {
          const supabase = createClient();
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) return;
          const { error } = await supabase
            .from("Tasks")
            .update({ status: overColumn })
            .eq("id", activeId)
            .eq("user_id", user.id);
          if (error) console.error("Failed to persist task column:", error);
        })();
      });

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

  const openTaskDetails = useCallback((task: Task) => {
    setDetailTaskId(String(task.id));
  }, []);

  const handleSave = async (payload: {
    title: string;
    description: string;
    priority: TaskPriority;
    tagIds: string[];
    columnId: ColumnId;
  }) => {

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("You must be authenticated to create or update a task.");
    }

    const { tagIds: resolvedTagIds, tags: resolvedTagLabels } = tagLabelsForIds(
      payload.tagIds,
      availableTags,
    );

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

      await syncTaskTagsForTask(supabase, data.id, user.id, resolvedTagIds);

      const task: Task = {
        ...data,
        tagIds: resolvedTagIds.length > 0 ? resolvedTagIds : undefined,
        tags: resolvedTagLabels.length > 0 ? resolvedTagLabels : undefined,
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
      tagIds: resolvedTagIds.length > 0 ? resolvedTagIds : undefined,
      tags: resolvedTagLabels.length > 0 ? resolvedTagLabels : undefined,
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
        await syncTaskTagsForTask(supabase, data.id, user.id, resolvedTagIds);
        updated = {
          ...data,
          tagIds: resolvedTagIds.length > 0 ? resolvedTagIds : undefined,
          tags: resolvedTagLabels.length > 0 ? resolvedTagLabels : undefined,
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
    setDetailTaskId((prev) => (prev === sid ? null : prev));
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

    const { error: taskTagsError } = await supabase
      .from("task_tags")
      .delete()
      .eq("task_id", sid)
      .eq("user_id", user.id);

    if (taskTagsError) {
      throw taskTagsError;
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="h-7 w-48 max-w-full animate-pulse rounded-full bg-white/[0.07]" />
              <div className="flex shrink-0 gap-2 self-end sm:self-auto">
                <div className="h-9 w-24 animate-pulse rounded-xl bg-white/[0.07]" />
                <div className="h-9 w-32 animate-pulse rounded-xl bg-white/[0.07]" />
              </div>
            </div>
            <div className="h-10 max-w-xl animate-pulse rounded-xl bg-white/[0.07]" />
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
          initialTags={availableTags}
          setAvailableTags={setAvailableTags}
          onTagDeleted={handleTagDeleted}
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2 text-xs text-white/70">
                <span className="inline-flex min-h-[1.75rem] items-center rounded-full bg-black/15 px-3 py-1 ring-1 ring-white/10">
                  Drag the handle or card between columns
                </span>
                <span className="inline-flex min-h-[1.75rem] items-center rounded-full bg-black/15 px-3 py-1 ring-1 ring-white/10">
                  Reorder within a column
                </span>
              </div>
              <div className="flex shrink-0 flex-col items-stretch gap-2 self-end sm:flex-row sm:items-center sm:self-auto">
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="kanban-filter-by"
                    className="whitespace-nowrap text-xs font-medium uppercase tracking-wide text-[#a2ad59]"
                  >
                    Filter by
                  </label>
                  <select
                    id="kanban-filter-by"
                    value={filterBy}
                    onChange={(e) => {
                      const next = e.target.value as "tag" | "priority";
                      setFilterBy(next);
                      setFilterTagId(null);
                      setFilterPriority(null);
                    }}
                    className="min-w-[6.5rem] rounded-xl border border-white/15 bg-[#08605f]/35 px-2.5 py-1.5 text-xs font-medium text-[#f4f7f2] outline-none ring-[#177e89] focus:ring-2"
                  >
                    <option value="tag" className="bg-[#0f3534]">
                      Label
                    </option>
                    <option value="priority" className="bg-[#0f3534]">
                      Priority
                    </option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="kanban-filter-value"
                    className="sr-only"
                  >
                    {filterBy === "tag" ? "Tag" : "Priority"} filter value
                  </label>
                  {filterBy === "tag" ? (
                    <select
                      id="kanban-filter-value"
                      value={activeFilterTagId ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setFilterTagId(v === "" ? null : v);
                      }}
                      className="min-w-[8.5rem] max-w-[min(100vw-2rem,220px)] rounded-xl border border-white/15 bg-[#08605f]/35 px-2.5 py-1.5 text-xs font-medium text-[#f4f7f2] outline-none ring-[#177e89] focus:ring-2"
                    >
                      <option value="">All tasks</option>
                      {availableTags.map((t) => (
                        <option key={t.id} value={t.id} className="bg-[#0f3534]">
                          {t.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      id="kanban-filter-value"
                      value={filterPriority ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setFilterPriority(
                          v === "" ? null : (v as TaskPriority),
                        );
                      }}
                      className="min-w-[8.5rem] rounded-xl border border-white/15 bg-[#08605f]/35 px-2.5 py-1.5 text-xs font-medium text-[#f4f7f2] outline-none ring-[#177e89] focus:ring-2"
                    >
                      <option value="">All tasks</option>
                      {PRIORITY_FILTER_OPTIONS.map((p) => (
                        <option
                          key={p.value}
                          value={p.value}
                          className="bg-[#0f3534]"
                        >
                          {p.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>

            <div className="w-full max-w-xl">
              <label
                htmlFor="kanban-title-search"
                className="block text-xs font-medium uppercase tracking-wide text-[#a2ad59]"
              >
                Search
              </label>
              <input
                id="kanban-title-search"
                type="search"
                value={titleSearch}
                onChange={(e) => setTitleSearch(e.target.value)}
                placeholder="Filter by title…"
                autoComplete="off"
                className="mt-1 w-full rounded-xl border border-white/15 bg-[#08605f]/35 px-3 py-2 text-sm text-[#f4f7f2] placeholder:text-white/35 outline-none ring-[#177e89] focus:ring-2"
              />
            </div>

            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:overflow-x-auto lg:pb-2">
              {COLUMN_ORDER.map((columnId) => (
                <div key={columnId} className="flex flex-col gap-3">
                  <KanbanColumn
                    columnId={columnId}
                    title={COLUMN_LABELS[columnId]}
                    subtitle={COLUMN_SUBTITLES[columnId]}
                    tasks={displayColumns[columnId]}
                    accentClassName={COLUMN_ACCENTS[columnId]}
                    onOpenTaskDetails={openTaskDetails}
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

      <TaskDetailPanel
        task={detailTask}
        open={detailTask !== null}
        onClose={() => setDetailTaskId(null)}
        onEditTask={openEdit}
      />

      <TaskFormDialog
        open={formOpen}
        instanceKey={`${formInstanceKey}-${formMode.type}-${
          formMode.type === "edit" ? formMode.task.id : newTaskDefaultColumn
        }`}
        mode={formMode}
        initialColumn={formInitialColumn}
        availableTags={availableTags}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
