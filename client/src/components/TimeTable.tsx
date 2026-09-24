import { useState, type ReactNode } from "react";
import type { DateFormat, DayLabel, DayStatus, SortOption, Tag, TimeEntry } from "../api/types";
import { ApiError } from "../api/client";
import EditableCell from "./EditableCell";
import TagBadge from "./TagBadge";
import TagPicker from "./TagPicker";
import DayStatusBadge from "./DayStatusBadge";
import { formatDuration, formatWorkDate, isoToLocalTime, localDateTimeToIso, toLocalDateStr } from "../lib/time";

interface Props {
  entries: TimeEntry[];
  dayLabels: DayLabel[];
  sort: SortOption;
  dateFormat?: DateFormat;
  allTags: Tag[];
  onUpdate: (
    id: number,
    data: Partial<Pick<TimeEntry, "workDate" | "startTime" | "endTime" | "breakMinutes" | "note">> & {
      tagIds?: number[];
    }
  ) => void;
  onDelete: (id: number) => void;
  onCreateTag: (name: string) => Promise<Tag>;
  onSetLabel: (workDate: string, status: DayStatus) => Promise<void>;
  onRemoveLabel: (workDate: string) => void;
  onCreateEntry: (data: { workDate: string; startTime: string; endTime: string; breakMinutes?: number }) => Promise<void>;
  actions?: ReactNode;
}

interface DayGroup {
  workDate: string;
  entries: TimeEntry[];
  label?: DayLabel;
}

// Entries sharing a work date (e.g. a morning shift and an evening shift on
// the same day) are grouped together, regardless of where sorting places
// other dates in between — the group key is the date, not adjacency.
function groupByDate(entries: TimeEntry[]): DayGroup[] {
  const groups: DayGroup[] = [];
  const index = new Map<string, DayGroup>();
  for (const entry of entries) {
    let group = index.get(entry.workDate);
    if (!group) {
      group = { workDate: entry.workDate, entries: [] };
      index.set(entry.workDate, group);
      groups.push(group);
    }
    group.entries.push(entry);
  }
  return groups;
}

// A Sick/Vacation day never has entries (the two are mutually exclusive), so
// labels always form their own single-row groups. They're merged in after
// grouping entries by date, then the combined list is ordered to match the
// current sort: by date for date_* sorts, or appended (by date) for hours_*
// sorts, since a label has no hours to compare.
function mergeDayLabels(entryGroups: DayGroup[], dayLabels: DayLabel[], sort: SortOption): DayGroup[] {
  const labelGroups: DayGroup[] = dayLabels
    .slice()
    .sort((a, b) => b.workDate.localeCompare(a.workDate))
    .map((label) => ({ workDate: label.workDate, entries: [], label }));

  if (sort === "date_asc" || sort === "date_desc") {
    const combined = [...entryGroups, ...labelGroups];
    combined.sort((a, b) => (sort === "date_asc" ? a.workDate.localeCompare(b.workDate) : b.workDate.localeCompare(a.workDate)));
    return combined;
  }
  return [...entryGroups, ...labelGroups];
}

function AddDayLabelForm({
  onSetLabel,
  onCreateEntry,
  actions,
}: {
  onSetLabel: (workDate: string, status: DayStatus) => Promise<void>;
  onCreateEntry: (data: { workDate: string; startTime: string; endTime: string; breakMinutes?: number }) => Promise<void>;
  actions?: ReactNode;
}) {
  const [date, setDate] = useState(() => toLocalDateStr(new Date()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingEntry, setAddingEntry] = useState(false);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");

  async function handleMark(status: DayStatus) {
    setError(null);
    setBusy(true);
    try {
      await onSetLabel(date, status);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleAddEntry() {
    setError(null);
    setBusy(true);
    try {
      await onCreateEntry({
        workDate: date,
        startTime: localDateTimeToIso(date, startTime),
        endTime: localDateTimeToIso(date, endTime),
      });
      setAddingEntry(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-800/30">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-500 dark:text-neutral-400">
          {addingEntry ? "Add entry:" : "Add a past day:"}
        </span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field-sm" />
        {addingEntry ? (
          <>
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
            <button type="button" disabled={busy} onClick={handleAddEntry} className="btn-secondary px-2 py-1 text-xs">
              {busy ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setAddingEntry(false);
                setError(null);
              }}
              className="btn-ghost px-2 py-1 text-xs"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button type="button" disabled={busy} onClick={() => setAddingEntry(true)} className="btn-secondary px-2 py-1 text-xs">
              Add entry
            </button>
            <button type="button" disabled={busy} onClick={() => handleMark("sick")} className="btn-secondary px-2 py-1 text-xs">
              Mark Sick
            </button>
            <button type="button" disabled={busy} onClick={() => handleMark("vacation")} className="btn-secondary px-2 py-1 text-xs">
              Mark Vacation
            </button>
          </>
        )}
        {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
      </div>
      {actions}
    </div>
  );
}

// Column definitions are kept in an array (rather than hardcoded JSX) so new
// columns — e.g. break minutes, overtime flags — can be added later without
// restructuring the table markup.
export default function TimeTable({
  entries,
  dayLabels,
  sort,
  dateFormat = "YYYY-MM-DD",
  allTags,
  onUpdate,
  onDelete,
  onCreateTag,
  onSetLabel,
  onRemoveLabel,
  onCreateEntry,
  actions,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpanded(workDate: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(workDate)) next.delete(workDate);
      else next.add(workDate);
      return next;
    });
  }

  function renderEntryRow(entry: TimeEntry, grouped: boolean) {
    const isOpen = !entry.endTime;
    let rowClassName: string;
    if (grouped) {
      rowClassName = isOpen
        ? "border-l-2 border-brand-300 bg-brand-50/70 dark:border-brand-700 dark:bg-brand-900/30"
        : "border-l-2 border-slate-300 bg-slate-50/70 dark:border-neutral-700 dark:bg-neutral-800/40";
    } else {
      rowClassName = isOpen ? "bg-brand-50/50 dark:bg-brand-900/20" : "";
    }
    return (
      <tr key={entry.id} className={rowClassName}>
        <td className="px-1 py-1">
          {grouped ? (
            <span className="block px-4 py-1 text-xs text-slate-400 dark:text-neutral-500" aria-hidden="true">
              ↳
            </span>
          ) : (
            <EditableCell
              value={entry.workDate}
              displayValue={formatWorkDate(entry.workDate, dateFormat)}
              type="date"
              onSave={(v) => onUpdate(entry.id, { workDate: v })}
            />
          )}
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
        <td className="px-3 py-1 font-medium text-slate-700 dark:text-neutral-200">
          {formatDuration(entry.totalMinutes)}
        </td>
        <td className="px-1 py-1">
          <EditableCell value={entry.note ?? ""} onSave={(v) => onUpdate(entry.id, { note: v })} placeholder="Add note" />
        </td>
        <td className="px-1 py-1">
          <TagPicker
            allTags={allTags}
            selected={entry.tags}
            onChange={(tagIds) => onUpdate(entry.id, { tagIds })}
            onCreateTag={onCreateTag}
          />
        </td>
        <td className="px-3 py-1 text-right">
          <button
            onClick={() => onDelete(entry.id)}
            className="text-xs font-medium text-slate-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
          >
            Delete
          </button>
        </td>
      </tr>
    );
  }

  function renderLabelRow(group: DayGroup) {
    const label = group.label!;
    return (
      <tr key={`label-${group.workDate}`}>
        <td className="px-3 py-2 text-slate-700 dark:text-neutral-200">{formatWorkDate(group.workDate, dateFormat)}</td>
        <td className="px-3 py-2" colSpan={5}>
          <DayStatusBadge status={label.status} />
        </td>
        <td className="px-3 py-2" />
        <td className="px-3 py-1 text-right">
          <button
            onClick={() => onRemoveLabel(group.workDate)}
            className="text-xs font-medium text-slate-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
          >
            Remove
          </button>
        </td>
      </tr>
    );
  }

  function renderGroupSummaryRow(group: DayGroup) {
    const isOpen = expanded.has(group.workDate);
    const totalMinutes = group.entries.reduce((sum, e) => sum + (e.totalMinutes ?? 0), 0);
    const totalBreak = group.entries.reduce((sum, e) => sum + e.breakMinutes, 0);
    const hasOpenEntry = group.entries.some((e) => !e.endTime);
    const noteCount = group.entries.filter((e) => e.note).length;
    const uniqueTags = new Map<number, Tag>();
    for (const entry of group.entries) {
      for (const tag of entry.tags) uniqueTags.set(tag.id, tag);
    }

    return (
      <tr
        key={`group-${group.workDate}`}
        onClick={() => toggleExpanded(group.workDate)}
        className={`cursor-pointer select-none font-medium hover:bg-slate-50 dark:hover:bg-neutral-800/60 ${
          hasOpenEntry ? "bg-brand-50/50 dark:bg-brand-900/20" : "bg-slate-50/70 dark:bg-neutral-800/30"
        }`}
      >
        <td className="px-3 py-2">
          <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-neutral-200">
            <svg
              viewBox="0 0 20 20"
              className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform dark:text-neutral-500 ${isOpen ? "rotate-90" : ""}`}
              fill="currentColor"
            >
              <path d="M7 5l6 5-6 5V5z" />
            </svg>
            {formatWorkDate(group.workDate, dateFormat)}
          </span>
        </td>
        <td className="px-3 py-2 text-slate-500 dark:text-neutral-400" colSpan={2}>
          {group.entries.length} entries
        </td>
        <td className="px-3 py-2 text-slate-500 dark:text-neutral-400">
          {totalBreak > 0 ? `${totalBreak} min` : ""}
        </td>
        <td className="px-3 py-2 text-slate-700 dark:text-neutral-200">{formatDuration(totalMinutes)}</td>
        <td className="px-3 py-2 text-slate-500 dark:text-neutral-400">
          {noteCount > 0 ? `${noteCount} note${noteCount > 1 ? "s" : ""}` : ""}
        </td>
        <td className="px-3 py-2">
          <div className="flex flex-wrap gap-1">
            {[...uniqueTags.values()].map((tag) => (
              <TagBadge key={tag.id} tag={tag} />
            ))}
          </div>
        </td>
        <td className="px-3 py-2" />
      </tr>
    );
  }

  const groups = mergeDayLabels(groupByDate(entries), dayLabels, sort);

  return (
    <div className="panel overflow-x-auto">
      <AddDayLabelForm onSetLabel={onSetLabel} onCreateEntry={onCreateEntry} actions={actions} />
      {groups.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-500 dark:text-neutral-400">
          No entries match the current filters.
        </div>
      ) : (
        <table className="min-w-full table-fixed divide-y divide-slate-200 text-sm dark:divide-neutral-800">
          <colgroup>
            <col className="w-32" />
            <col className="w-24" />
            <col className="w-24" />
            <col className="w-24" />
            <col className="w-20" />
            <col />
            <col className="w-40" />
            <col className="w-16" />
          </colgroup>
          <thead className="bg-slate-50 dark:bg-neutral-800/50">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-neutral-400">Date</th>
              <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-neutral-400">Start</th>
              <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-neutral-400">End</th>
              <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-neutral-400">Break (min)</th>
              <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-neutral-400">Total</th>
              <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-neutral-400">Note</th>
              <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-neutral-400">Tags</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
            {groups.map((group) =>
              group.label
                ? renderLabelRow(group)
                : group.entries.length === 1
                  ? renderEntryRow(group.entries[0], false)
                  : [renderGroupSummaryRow(group), ...(expanded.has(group.workDate) ? group.entries.map((e) => renderEntryRow(e, true)) : [])]
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
