import type { DateFormat, DayLabel, DayStatus, TimeEntry } from "../api/types";
import { formatDuration, formatWorkDate, isoToLocalTime } from "../lib/time";
import TagBadge from "./TagBadge";
import DayStatusBadge from "./DayStatusBadge";

interface Props {
  workDate: string;
  dateFormat: DateFormat;
  entries: TimeEntry[];
  label: DayLabel | null;
  busy: boolean;
  error: string | null;
  onSetLabel: (status: DayStatus) => void;
  onRemoveLabel: () => void;
  onClose: () => void;
}

export default function DayDetailPanel({
  workDate,
  dateFormat,
  entries,
  label,
  busy,
  error,
  onSetLabel,
  onRemoveLabel,
  onClose,
}: Props) {
  const totalMinutes = entries.reduce((sum, e) => sum + (e.totalMinutes ?? 0), 0);
  const hasEntries = entries.length > 0;

  return (
    <div className="panel space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-neutral-100">
          {formatWorkDate(workDate, dateFormat)}
        </h2>
        <button onClick={onClose} className="text-xs font-medium text-slate-400 hover:text-slate-600 dark:text-neutral-500 dark:hover:text-neutral-300">
          Close
        </button>
      </div>

      {hasEntries ? (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 dark:text-neutral-400">
            {entries.length} {entries.length === 1 ? "entry" : "entries"} · {formatDuration(totalMinutes)} total
          </p>
          <ul className="space-y-1 text-sm">
            {entries.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-2 text-slate-700 dark:text-neutral-200">
                <span className="tabular-nums">
                  {isoToLocalTime(e.startTime)}–{e.endTime ? isoToLocalTime(e.endTime) : "…"}
                </span>
                <span className="text-slate-400 dark:text-neutral-500">{formatDuration(e.totalMinutes)}</span>
                {e.tags.map((t) => (
                  <TagBadge key={t.id} tag={t} />
                ))}
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-500 dark:text-neutral-400">
            This day has time entries, so it can't be labeled Sick/Vacation. Edit or delete the entries from the
            Dashboard first.
          </p>
        </div>
      ) : label ? (
        <div className="space-y-3">
          <DayStatusBadge status={label.status} />
          <button onClick={onRemoveLabel} disabled={busy} className="btn-secondary">
            {busy ? "Removing..." : "Remove label"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-500 dark:text-neutral-400">No time entries on this day yet.</p>
          <div className="flex gap-2">
            <button onClick={() => onSetLabel("sick")} disabled={busy} className="btn-secondary">
              Mark Sick
            </button>
            <button onClick={() => onSetLabel("vacation")} disabled={busy} className="btn-secondary">
              Mark Vacation
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
