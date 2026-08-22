import type { TimeEntry } from "../api/types";
import EditableCell from "./EditableCell";
import { formatDuration, isoToLocalTime, localDateTimeToIso } from "../lib/time";

interface Props {
  entries: TimeEntry[];
  onUpdate: (
    id: number,
    data: Partial<Pick<TimeEntry, "workDate" | "startTime" | "endTime" | "breakMinutes" | "note">>
  ) => void;
  onDelete: (id: number) => void;
}

// Column definitions are kept in an array (rather than hardcoded JSX) so new
// columns — e.g. break minutes, overtime flags — can be added later without
// restructuring the table markup.
export default function TimeTable({ entries, onUpdate, onDelete }: Props) {
  if (entries.length === 0) {
    return (
      <div className="panel p-8 text-center text-sm text-slate-500 dark:text-slate-400">
        No entries match the current filters.
      </div>
    );
  }

  return (
    <div className="panel overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
        <thead className="bg-slate-50 dark:bg-slate-800/50">
          <tr>
            <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">Date</th>
            <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">Start</th>
            <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">End</th>
            <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">Break (min)</th>
            <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">Total</th>
            <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">Note</th>
            <th className="px-3 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {entries.map((entry) => (
            <tr key={entry.id} className={entry.endTime ? "" : "bg-brand-50/50 dark:bg-brand-900/20"}>
              <td className="px-1 py-1">
                <EditableCell
                  value={entry.workDate}
                  type="date"
                  onSave={(v) => onUpdate(entry.id, { workDate: v })}
                />
              </td>
              <td className="px-1 py-1">
                <EditableCell
                  value={isoToLocalTime(entry.startTime)}
                  type="time"
                  onSave={(v) => onUpdate(entry.id, { startTime: localDateTimeToIso(entry.workDate, v) })}
                />
              </td>
              <td className="px-1 py-1">
                <EditableCell
                  value={entry.endTime ? isoToLocalTime(entry.endTime) : ""}
                  type="time"
                  placeholder="In progress"
                  onSave={(v) =>
                    onUpdate(entry.id, {
                      endTime: v ? localDateTimeToIso(entry.workDate, v) : null,
                    })
                  }
                />
              </td>
              <td className="px-1 py-1">
                <EditableCell
                  value={String(entry.breakMinutes)}
                  type="number"
                  onSave={(v) => onUpdate(entry.id, { breakMinutes: Math.max(0, Number(v) || 0) })}
                />
              </td>
              <td className="px-3 py-1 font-medium text-slate-700 dark:text-slate-200">
                {formatDuration(entry.totalMinutes)}
              </td>
              <td className="px-1 py-1">
                <EditableCell value={entry.note ?? ""} onSave={(v) => onUpdate(entry.id, { note: v })} placeholder="Add note" />
              </td>
              <td className="px-3 py-1 text-right">
                <button
                  onClick={() => onDelete(entry.id)}
                  className="text-xs font-medium text-slate-400 hover:text-red-600 dark:text-slate-500 dark:hover:text-red-400"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
