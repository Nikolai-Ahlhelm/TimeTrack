import type { PublicDayLabel, PublicTimeEntry } from "../types.js";

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

const DAY_STATUS_LABEL: Record<PublicDayLabel["status"], string> = {
  vacation: "Vacation",
  sick: "Sick",
};

interface CsvRow {
  workDate: string;
  cells: (string | number)[];
}

export function entriesToCsv(
  entries: PublicTimeEntry[],
  dayLabels: PublicDayLabel[],
  includeUser: boolean,
  usernameById: Map<number, string>,
  sortDescending = true
): string {
  const header = includeUser
    ? ["User", "Date", "Start", "End", "Break (min)", "Total (h:mm)", "Note", "Tags"]
    : ["Date", "Start", "End", "Break (min)", "Total (h:mm)", "Note", "Tags"];
  const lines = [header.map(csvField).join(",")];

  const entryRows: CsvRow[] = entries.map((e) => {
    const tagNames = e.tags.map((t) => t.name).join("; ");
    return {
      workDate: e.workDate,
      cells: includeUser
        ? [
            usernameById.get(e.userId) ?? String(e.userId),
            e.workDate,
            e.startTime,
            e.endTime ?? "",
            e.breakMinutes,
            formatDuration(e.totalMinutes),
            e.note ?? "",
            tagNames,
          ]
        : [e.workDate, e.startTime, e.endTime ?? "", e.breakMinutes, formatDuration(e.totalMinutes), e.note ?? "", tagNames],
    };
  });

  // Whole-day labels (vacation/sick) have no start/end/break/tags — they get
  // their own row with just the date and a note, so they show up in the
  // export alongside regular time entries instead of being silently dropped.
  const labelRows: CsvRow[] = dayLabels.map((l) => {
    const note = l.note ? `${DAY_STATUS_LABEL[l.status]}: ${l.note}` : DAY_STATUS_LABEL[l.status];
    return {
      workDate: l.workDate,
      cells: includeUser ? ["", l.workDate, "", "", "", "", note, ""] : [l.workDate, "", "", "", "", note, ""],
    };
  });

  const rows = [...entryRows, ...labelRows].sort((a, b) =>
    sortDescending ? b.workDate.localeCompare(a.workDate) : a.workDate.localeCompare(b.workDate)
  );

  for (const row of rows) {
    lines.push(row.cells.map(csvField).join(","));
  }

  return lines.join("\r\n") + "\r\n";
}
