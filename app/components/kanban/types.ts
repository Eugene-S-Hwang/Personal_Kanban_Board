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

/** DB row plus optional UI-only fields not stored in Supabase yet. */
export type Task = Tables<"Tasks"> & {
  tags?: string[];
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
