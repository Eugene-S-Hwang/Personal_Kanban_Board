"use client";

import {
  defaultDropAnimationSideEffects,
  type DropAnimation,
} from "@dnd-kit/core";
import { useSyncExternalStore } from "react";

import type { ColumnId, Task } from "./types";
import { COLUMN_ORDER } from "./types";
import { createClient } from "@/app/utils/supabase/client";
import { TagRow } from "./tag-create-form";

export function isColumnId(id: string): id is ColumnId {
  return (COLUMN_ORDER as readonly string[]).includes(id);
}

export const COLUMN_ACCENTS: Record<ColumnId, string> = {
  "to-do": "bg-[#6ec9bc]",
  "in-progress": "bg-[#7dd3df]",
  review: "bg-[#c4cf95]",
  done: "bg-[#e3eb9a]",
};

export const COLUMN_SUBTITLES: Record<ColumnId, string> = {
  "to-do": "Ideas and upcoming work",
  "in-progress": "Active focus",
  review: "Ready for feedback",
  done: "Shipped or accepted",
};

export function emptyColumns(): Record<ColumnId, Task[]> {
  return {
    "to-do": [],
    "in-progress": [],
    review: [],
    done: [],
  };
}

export function groupTasksByColumn(tasks: Task[]): Record<ColumnId, Task[]> {
  const next = emptyColumns();
  for (const task of tasks) {
    const col: ColumnId = isColumnId(task.status) ? task.status : "to-do";
    next[col].push(task);
  }
  return next;
}

export function findColumnForTask(
  columns: Record<ColumnId, Task[]>,
  taskId: string,
): ColumnId | undefined {
  for (const col of COLUMN_ORDER) {
    if (columns[col].some((t) => String(t.id) === taskId)) return col;
  }
  return undefined;
}

export const dropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: "0.45" } },
  }),
};

const noopSubscribe = () => () => {};

export function useIsClient() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export function tagLabelsForIds(
  tagIds: string[],
  tagRows: TagRow[] | null,
): { tagIds: string[]; tags: string[] } {
  const validIds = new Set((tagRows ?? []).map((t) => t.id));
  const resolvedTagIds = tagIds.filter((id) => validIds.has(id));
  const nameById = new Map((tagRows ?? []).map((t) => [t.id, t.name]));
  const tags = resolvedTagIds
    .map((id) => nameById.get(id))
    .filter((n): n is string => n !== undefined);
  return { tagIds: resolvedTagIds, tags };
}

/** Drop one tag id (and its paired label) from a task after the tag is deleted globally. */
export function stripTagIdFromTask(task: Task, removedTagId: string): Task {
  const ids = task.tagIds ?? [];
  if (!ids.includes(removedTagId)) {
    return task;
  }
  const labels = task.tags ?? [];
  const pairs = ids.map((id, i) => ({
    id,
    name: labels[i],
  }));
  const kept = pairs.filter((p) => p.id !== removedTagId);
  const nextIds = kept.map((p) => p.id);
  const nextTags = kept
    .map((p) => p.name)
    .filter((n): n is string => Boolean(n));

  return {
    ...task,
    tagIds: nextIds.length > 0 ? nextIds : undefined,
    tags: nextTags.length > 0 ? nextTags : undefined,
  };
}

export async function syncTaskTagsForTask(
  supabase: ReturnType<typeof createClient>,
  taskId: string,
  userId: string,
  tagIds: string[],
) {
  const { error: deleteError } = await supabase
    .from("task_tags")
    .delete()
    .eq("task_id", taskId)
    .eq("user_id", userId);

  if (deleteError) {
    throw deleteError;
  }

  if (tagIds.length === 0) return;

  const { error: insertError } = await supabase.from("task_tags").insert(
    tagIds.map((tag_id) => ({
      task_id: taskId,
      tag_id,
      user_id: userId,
    })),
  );

  if (insertError) {
    throw insertError;
  }
}