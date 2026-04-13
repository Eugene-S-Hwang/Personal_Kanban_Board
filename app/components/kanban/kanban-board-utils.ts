"use client";

import {
  defaultDropAnimationSideEffects,
  type DropAnimation,
} from "@dnd-kit/core";
import { useSyncExternalStore } from "react";

import type { ColumnId, Task } from "./types";
import { COLUMN_ORDER } from "./types";

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
