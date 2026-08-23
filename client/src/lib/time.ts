import type { BreakRule, DateFormat } from "../api/types";

// German statutory minimum breaks (Arbeitszeitgesetz §4): >6h worked needs a
// 30min break; >9h needs 45min total. Offered as a one-click preset.
export const GERMAN_BREAK_RULES: BreakRule[] = [
  { afterMinutes: 360, breakMinutes: 30 },
  { afterMinutes: 540, breakMinutes: 45 },
];

/** Short human-readable summary of a set of break rules, e.g. "6h → 30m, 9h → 45m". */
export function describeBreakRules(rules: BreakRule[] | null): string {
  if (!rules || rules.length === 0) return "None (flat default only)";
  return rules
    .slice()
    .sort((a, b) => a.afterMinutes - b.afterMinutes)
    .map((r) => `${formatHours(r.afterMinutes)}h → ${r.breakMinutes}m`)
    .join(", ");
}

function formatHours(minutes: number): string {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

export const DATE_FORMAT_LABELS: Record<DateFormat, string> = {
  "YYYY-MM-DD": "2026-08-23 (YYYY-MM-DD)",
  "DD.MM.YYYY": "23.08.2026 (DD.MM.YYYY)",
  "DD/MM/YYYY": "23/08/2026 (DD/MM/YYYY)",
  "MM/DD/YYYY": "08/23/2026 (MM/DD/YYYY)",
};

/** Format a YYYY-MM-DD work date string per the user's preferred display format. */
export function formatWorkDate(workDate: string, format: DateFormat = "YYYY-MM-DD"): string {
  const [y, m, d] = workDate.split("-");
  if (!y || !m || !d) return workDate;
  switch (format) {
    case "DD.MM.YYYY":
      return `${d}.${m}.${y}`;
    case "DD/MM/YYYY":
      return `${d}/${m}/${y}`;
    case "MM/DD/YYYY":
      return `${m}/${d}/${y}`;
    case "YYYY-MM-DD":
    default:
      return `${y}-${m}-${d}`;
  }
}

/** Format an ISO timestamp as a local HH:mm string for <input type="time">. */
export function isoToLocalTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Format an ISO timestamp as a local YYYY-MM-DD string for <input type="date">. */
export function isoToLocalDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Format a Date as a local YYYY-MM-DD string — i.e. the work_date the server
 * would assign "right now" for the caller's local day. NOT the same as
 * `date.toISOString().slice(0, 10)`, which converts to UTC first and can
 * land on the wrong calendar day near midnight in non-UTC timezones.
 */
export function toLocalDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Combine a work date + HH:mm local time into an ISO timestamp string. */
export function localDateTimeToIso(workDate: string, time: string): string {
  const [h, m] = time.split(":").map(Number);
  const [y, mo, d] = workDate.split("-").map(Number);
  const dt = new Date(y, mo - 1, d, h, m, 0, 0);
  return dt.toISOString();
}

export function formatDuration(totalMinutes: number | null): string {
  if (totalMinutes === null) return "—";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/** Format a +/- minute delta (e.g. overtime vs. target) as a signed duration. */
export function formatSignedDuration(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  return `${sign}${formatDuration(Math.abs(minutes))}`;
}
