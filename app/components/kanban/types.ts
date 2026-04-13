import { Tables } from "@/app/utils/supabase/database.types";

export type ColumnId = "to-do" | "in-progress" | "review" | "done";

export type TaskPriority = "low" | "medium" | "high";

// export type Task = {
//   id: string;
//   user_id: string;
//   title: string;
//   status: string;
//   description: string;
//   priority: TaskPriority;
//   // tags: string[];
// };

/** DB row plus tag labels for UI and tag ids for forms / task_tags sync. */
export type Task = Tables<"tasks"> & {
  /** Tag names for display (e.g. on cards). */
  tags?: string[];
  /** Selected tag row ids (from `tags` table). */
  tagIds?: string[];
};

export const COLUMN_ORDER: ColumnId[] = [
  "to-do",
  "in-progress",
  "review",
  "done",
];

export const COLUMN_LABELS: Record<ColumnId, string> = {
  "to-do": "To Do",
  "in-progress": "In progress",
  "review": "Review",
  "done": "Done",
};
