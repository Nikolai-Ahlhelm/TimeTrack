import type { PublicTimeEntry } from "../types.js";

function csvField(value: string | number | null): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatDuration(totalMinutes: number | null): string {
  if (totalMinutes === null) return "";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

export function entriesToCsv(entries: PublicTimeEntry[], includeUser: boolean, usernameById: Map<number, string>): string {
  const header = includeUser
    ? ["User", "Date", "Start", "End", "Break (min)", "Total (h:mm)", "Note"]
    : ["Date", "Start", "End", "Break (min)", "Total (h:mm)", "Note"];
  const lines = [header.map(csvField).join(",")];

  for (const e of entries) {
    const row = includeUser
      ? [
          usernameById.get(e.userId) ?? String(e.userId),
          e.workDate,
          e.startTime,
          e.endTime ?? "",
          e.breakMinutes,
          formatDuration(e.totalMinutes),
          e.note ?? "",
        ]
      : [e.workDate, e.startTime, e.endTime ?? "", e.breakMinutes, formatDuration(e.totalMinutes), e.note ?? ""];
    lines.push(row.map(csvField).join(","));
  }

  return lines.join("\r\n") + "\r\n";
}
