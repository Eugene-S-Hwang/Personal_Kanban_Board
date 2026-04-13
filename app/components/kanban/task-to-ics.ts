import type { Task } from "./types";
import { COLUMN_LABELS, COLUMN_ORDER, type ColumnId } from "./types";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** UTC `YYYYMMDDTHHmmssZ` for DTSTAMP. */
function toIcsUtcStamp(d: Date): string {
  return (
    d.getUTCFullYear() +
    pad2(d.getUTCMonth() + 1) +
    pad2(d.getUTCDate()) +
    "T" +
    pad2(d.getUTCHours()) +
    pad2(d.getUTCMinutes()) +
    pad2(d.getUTCSeconds()) +
    "Z"
  );
}

/** `YYYY-MM-DD` → `YYYYMMDD` */
function toIcsDateValue(ymd: string): string {
  return ymd.replace(/-/g, "");
}

/** Next calendar day as `YYYY-MM-DD` (for exclusive DTEND on all-day events). */
function addOneCalendarDayYmd(ymd: string): string {
  const parts = ymd.split("-").map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (y === undefined || m === undefined || d === undefined) return ymd;
  const dt = new Date(y, m - 1, d + 1);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

/** Local calendar date from an ISO timestamp. */
function ymdFromCreatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    const n = new Date();
    return `${n.getFullYear()}-${pad2(n.getMonth() + 1)}-${pad2(n.getDate())}`;
  }
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** RFC 5545 TEXT escaping for SUMMARY/DESCRIPTION. */
function escapeIcsText(s: string): string {
  return s
    .replace(/\r\n/g, "\n")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
}

/** Fold long lines per RFC 5545 (max 75 octets per line; continuation with space). */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  let out = "";
  let rest = line;
  while (rest.length > 75) {
    out += `${rest.slice(0, 75)}\r\n `;
    rest = rest.slice(75);
  }
  return out + rest;
}

function formatContentLine(name: string, value: string): string {
  return foldLine(`${name}:${value}`);
}

export function buildTaskIcsContent(task: Task): string {
  const uid = `${task.id}@kanban-board`;
  const dtstamp = toIcsUtcStamp(new Date());
  const startYmd = task.due_date ?? ymdFromCreatedAt(task.created_at);
  const endYmd = addOneCalendarDayYmd(startYmd);

  const col = COLUMN_ORDER.includes(task.status as ColumnId)
    ? COLUMN_LABELS[task.status as ColumnId]
    : task.status;

  const metaLines: string[] = [
    `Column: ${col}`,
    `Priority: ${task.priority}`,
  ];
  if (task.tags && task.tags.length > 0) {
    metaLines.push(`Tags: ${task.tags.join(", ")}`);
  }
  const descBody = [task.description?.trim(), metaLines.join("\n")]
    .filter(Boolean)
    .join("\n\n");

  const summary = escapeIcsText(task.title);
  const description = escapeIcsText(descBody || "(no description)");

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kanban Board//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    formatContentLine("UID", uid),
    formatContentLine("DTSTAMP", dtstamp),
    formatContentLine(
      "DTSTART;VALUE=DATE",
      toIcsDateValue(startYmd),
    ),
    formatContentLine("DTEND;VALUE=DATE", toIcsDateValue(endYmd)),
    formatContentLine("SUMMARY", summary),
    formatContentLine("DESCRIPTION", description),
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.join("\r\n") + "\r\n";
}

export function sanitizeIcsFilename(title: string): string {
  const base = title
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);
  return base.length > 0 ? base : "task";
}

/** Trigger a browser download of one task as an `.ics` file (e.g. import into Google Calendar). */
export function downloadTaskAsIcs(task: Task): void {
  const body = buildTaskIcsContent(task);
  const blob = new Blob([body], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitizeIcsFilename(task.title)}.ics`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
