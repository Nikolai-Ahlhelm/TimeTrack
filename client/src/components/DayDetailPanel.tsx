import { useState } from "react";
import type { DateFormat, DayLabel, DayStatus, TimeEntry } from "../api/types";
import { ApiError } from "../api/client";
import { formatDuration, formatWorkDate, isoToLocalTime, localDateTimeToIso } from "../lib/time";
import TagBadge from "./TagBadge";
import DayStatusBadge from "./DayStatusBadge";

interface Props {
  workDate: string;
  dateFormat: DateFormat;
  entries: TimeEntry[];
  label: DayLabel | null;
  busy: boolean;
  error: string | null;
  defaultBreakMinutes: number;
  showAddForm: boolean;
  onToggleAddForm: () => void;
  onAddEntry: (data: { workDate: string; startTime: string; endTime: string; breakMinutes?: number; note?: string }) => Promise<void>;
  onSetLabel: (status: DayStatus) => void;
  onRemoveLabel: () => void;
  onClose: () => void;
}

function AddEntryForm({
  workDate,
  defaultBreakMinutes,
  onSave,
  onClose,
}: {
  workDate: string;
  defaultBreakMinutes: number;
  onSave: (data: { workDate: string; startTime: string; endTime: string; breakMinutes?: number; note?: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [breakMinutes, setBreakMinutes] = useState(String(defaultBreakMinutes));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    setBusy(true);
    try {
      await onSave({
        workDate,
        startTime: localDateTimeToIso(workDate, startTime),
        endTime: localDateTimeToIso(workDate, endTime),
        breakMinutes: Math.max(0, Number(breakMinutes) || 0),
        note: note || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-slate-200 p-3 dark:border-neutral-700">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="field-sm"
          aria-label="Start time"
        />
        <span className="text-slate-400 dark:text-neutral-500">–</span>
        <input
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          className="field-sm"
          aria-label="End time"
        />
        <input
          type="number"
          min={0}
          value={breakMinutes}
          onChange={(e) => setBreakMinutes(e.target.value)}
          className="field-sm w-20"
          aria-label="Break minutes"
          title="Break minutes"
        />
      </div>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)"
        className="field-sm w-full"
      />
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={handleSave} className="btn-secondary">
          {busy ? "Saving..." : "Save entry"}
        </button>
        <button type="button" disabled={busy} onClick={onClose} className="btn-ghost">
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function DayDetailPanel({
  workDate,
  dateFormat,
  entries,
  label,
  busy,
  error,
  defaultBreakMinutes,
  showAddForm,
  onToggleAddForm,
  onAddEntry,
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

      {label ? (
        <div className="space-y-3">
          <DayStatusBadge status={label.status} />
          <button onClick={onRemoveLabel} disabled={busy} className="btn-secondary">
            {busy ? "Removing..." : "Remove label"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
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
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-neutral-400">No time entries on this day yet.</p>
          )}

          {showAddForm ? (
            <AddEntryForm
              workDate={workDate}
              defaultBreakMinutes={defaultBreakMinutes}
              onSave={onAddEntry}
              onClose={onToggleAddForm}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              <button onClick={onToggleAddForm} className="btn-secondary">
                Add entry
              </button>
              {!hasEntries && (
                <>
                  <button onClick={() => onSetLabel("sick")} disabled={busy} className="btn-secondary">
                    Mark Sick
                  </button>
                  <button onClick={() => onSetLabel("vacation")} disabled={busy} className="btn-secondary">
                    Mark Vacation
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
