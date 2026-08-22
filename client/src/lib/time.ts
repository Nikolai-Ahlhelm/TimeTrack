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
