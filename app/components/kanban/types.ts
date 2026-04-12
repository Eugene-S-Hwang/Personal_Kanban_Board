export type ColumnId = "to-do" | "in-progress" | "review" | "done";

export type TaskPriority = "low" | "medium" | "high";

export type Task = {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  tags: string[];
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
