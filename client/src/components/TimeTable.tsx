import { cloneElement, useState, type ReactElement, type ReactNode } from "react";
import type { DateFormat, DayLabel, DayStatus, SortOption, Tag, TimeEntry } from "../api/types";
import { ApiError } from "../api/client";
import EditableCell from "./EditableCell";
import TagBadge from "./TagBadge";
import TagPicker from "./TagPicker";
import DayStatusBadge from "./DayStatusBadge";
import { formatDuration, formatOvertime, formatSignedDuration, formatWeekday, formatWorkDate, isoToLocalTime, localDateTimeToIso, toLocalDateStr } from "../lib/time";

interface Props {
  entries: TimeEntry[];
  dayLabels: DayLabel[];
  sort: SortOption;
  dateFormat?: DateFormat;
  dailyTarget?: number | null;
  // When set, every date in [from, to] without entries or a label gets a
  // placeholder row so the list reads as a seamless calendar.
  emptyDaysRange?: { from: string; to: string } | null;
  workDays?: number[];
  sickCountsAsWork?: boolean;
  // Active date-range bounds and whether a search/tag/status filter is on;
  // together they decide how far a week's overtime figure can be trusted.
  filterFrom?: string;
  filterTo?: string;
  contentFiltered?: boolean;
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
  empty?: boolean;
}

// ISO 8601 week number (weeks start Monday; week 1 contains the year's first Thursday).
function isoWeek(workDate: string): { year: number; week: number } {
  const d = new Date(`${workDate}T00:00:00`);
  d.setDate(d.getDate() + 4 - (((d.getDay() + 6) % 7) + 1));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return { year: d.getFullYear(), week: Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7) };
}

function addEmptyDays(groups: DayGroup[], range: { from: string; to: string }, sort: SortOption): DayGroup[] {
  const present = new Set(groups.map((g) => g.workDate));
  const empties: DayGroup[] = [];
  const end = new Date(`${range.to}T00:00:00`);
  for (let d = new Date(`${range.from}T00:00:00`); d <= end; d.setDate(d.getDate() + 1)) {
    const workDate = toLocalDateStr(d);
    if (!present.has(workDate)) empties.push({ workDate, entries: [], empty: true });
  }
  const combined = [...groups, ...empties];
  combined.sort((a, b) => (sort === "date_asc" ? a.workDate.localeCompare(b.workDate) : b.workDate.localeCompare(a.workDate)));
  return combined;
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

function OvertimeCell({ minutes, dailyTarget }: { minutes: number | null; dailyTarget: number | null }) {
  if (dailyTarget === null || minutes === null) return <td className="px-3 py-1" />;
  const diff = minutes - dailyTarget;
  if (diff === 0) return <td className="px-3 py-1" />;
  return (
    <td
      className={`px-3 py-1 text-xs font-medium ${
        diff > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
      }`}
    >
      {formatOvertime(diff)}
    </td>
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
  dailyTarget = null,
  emptyDaysRange = null,
  workDays = [1, 2, 3, 4, 5],
  sickCountsAsWork = true,
  filterFrom = "",
  filterTo = "",
  contentFiltered = false,
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
  const [inlineDate, setInlineDate] = useState<string | null>(null);
  const [inlineStart, setInlineStart] = useState("09:00");
  const [inlineEnd, setInlineEnd] = useState("17:00");
  const [inlineBusy, setInlineBusy] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

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
        <td className="px-3 py-1 text-slate-500 dark:text-neutral-400">{grouped ? "" : formatWeekday(entry.workDate)}</td>
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
        {grouped ? <td /> : <OvertimeCell minutes={entry.endTime ? entry.totalMinutes : null} dailyTarget={dailyTarget} />}
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
        <td className="px-3 py-2 text-slate-500 dark:text-neutral-400">{formatWeekday(group.workDate)}</td>
        <td className="px-3 py-2 text-slate-700 dark:text-neutral-200">{formatWorkDate(group.workDate, dateFormat)}</td>
        <td className="px-3 py-2" colSpan={6}>
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

  function renderGroup(group: DayGroup) {
    if (group.empty) return [renderEmptyRow(group)];
    if (group.label) return [renderLabelRow(group)];
    if (group.entries.length === 1) return [renderEntryRow(group.entries[0], false)];
    return [renderGroupSummaryRow(group), ...(expanded.has(group.workDate) ? group.entries.map((e) => renderEntryRow(e, true)) : [])];
  }

  // Alternating accent per week: a colored left bar on every row, so week
  // boundaries read at a glance without recoloring the day rows themselves.
  const WEEK_STYLES = [
    { bar: "!border-l-4 !border-l-brand-500", label: "text-brand-600 dark:text-brand-400" },
    { bar: "!border-l-4 !border-l-emerald-500", label: "text-emerald-600 dark:text-emerald-400" },
  ];

  const todayStr = toLocalDateStr(new Date());
  const TODAY_CLASS = "!bg-brand-500/15 font-semibold";

  // Total worked time plus credited Sick/Vacation days, and the difference to
  // the expected time (target x scheduled workdays so far, within the active
  // date range). Overtime is omitted under content filters, where totals are partial.
  function weekStats(wk: { year: number; week: number }, groupsInWeek: DayGroup[]) {
    let minutes = 0;
    for (const g of groupsInWeek) {
      for (const e of g.entries) minutes += e.totalMinutes ?? 0;
      if (g.label && dailyTarget !== null && (g.label.status === "vacation" || sickCountsAsWork)) minutes += dailyTarget;
    }
    if (dailyTarget === null || contentFiltered) return { minutes, overtime: null };
    const monday = new Date(`${groupsInWeek[0].workDate}T00:00:00`);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    let days = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      const ds = toLocalDateStr(d);
      if (ds > todayStr || (filterFrom && ds < filterFrom) || (filterTo && ds > filterTo)) continue;
      if (workDays.includes(i + 1)) days++;
    }
    return { minutes, overtime: minutes - dailyTarget * days };
  }

  function renderWeekRow(wk: { year: number; week: number }, style: (typeof WEEK_STYLES)[number], stats: { minutes: number; overtime: number | null }) {
    return (
      <tr key={`week-${wk.year}-${wk.week}`} className={style.bar}>
        <td colSpan={10} className="px-3 pb-0.5 pt-2.5 text-xs">
          <div className="flex items-center justify-between gap-3">
            <span className={`font-semibold uppercase tracking-wide ${style.label}`}>
              KW {wk.week}
              {wk.year !== new Date().getFullYear() && <span className="ml-1 font-normal opacity-70">{wk.year}</span>}
            </span>
            <span className="flex items-center gap-3 font-medium text-slate-500 dark:text-neutral-400">
              <span>Total {formatDuration(stats.minutes)}</span>
              {stats.overtime !== null && (
                <span className={stats.overtime < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}>
                  {formatSignedDuration(stats.overtime)}
                </span>
              )}
            </span>
          </div>
        </td>
      </tr>
    );
  }


  async function saveInlineEntry(workDate: string) {
    setInlineError(null);
    setInlineBusy(true);
    try {
      await onCreateEntry({
        workDate,
        startTime: localDateTimeToIso(workDate, inlineStart),
        endTime: localDateTimeToIso(workDate, inlineEnd),
      });
      setInlineDate(null);
    } catch (err) {
      setInlineError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setInlineBusy(false);
    }
  }

  function renderEmptyRow(group: DayGroup) {
    const isoWeekday = ((new Date(`${group.workDate}T00:00:00`).getDay() + 6) % 7) + 1;
    const offDay = !workDays.includes(isoWeekday);
    const editing = inlineDate === group.workDate;
    const rowClass = offDay ? "bg-slate-50/60 dark:bg-neutral-800/20" : "";
    if (!editing) {
      return (
        <tr
          key={`empty-${group.workDate}`}
          onClick={() => {
            setInlineDate(group.workDate);
            setInlineError(null);
          }}
          title="Click to add an entry"
          className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-neutral-800/50 ${rowClass}`}
        >
          <td className="px-3 py-2 text-slate-400 dark:text-neutral-500">{formatWeekday(group.workDate)}</td>
          <td className="px-3 py-2 text-slate-400 dark:text-neutral-500">{formatWorkDate(group.workDate, dateFormat)}</td>
          <td className="px-3 py-2 text-slate-400 dark:text-neutral-500" colSpan={6}>
            {offDay ? "Day off" : "No entries"}
          </td>
          <td className="px-3 py-2" />
          <td className="px-3 py-2" />
        </tr>
      );
    }
    return (
      <tr key={`empty-${group.workDate}`} className={rowClass}>
        <td className="px-3 py-2 text-slate-500 dark:text-neutral-400">{formatWeekday(group.workDate)}</td>
        <td className="px-3 py-2 text-slate-700 dark:text-neutral-200">{formatWorkDate(group.workDate, dateFormat)}</td>
        <td className="px-1 py-1">
          <input type="time" value={inlineStart} onChange={(e) => setInlineStart(e.target.value)} className="field-sm w-full" aria-label="Start time" autoFocus />
        </td>
        <td className="px-1 py-1">
          <input type="time" value={inlineEnd} onChange={(e) => setInlineEnd(e.target.value)} className="field-sm w-full" aria-label="End time" />
        </td>
        <td className="px-3 py-1" colSpan={4}>
          <div className="flex items-center gap-2">
            <button type="button" disabled={inlineBusy} onClick={() => saveInlineEntry(group.workDate)} className="btn-secondary px-2 py-1 text-xs">
              {inlineBusy ? "Saving..." : "Save"}
            </button>
            <button type="button" disabled={inlineBusy} onClick={() => setInlineDate(null)} className="btn-ghost px-2 py-1 text-xs">
              Cancel
            </button>
            {inlineError && <span className="text-xs text-red-600 dark:text-red-400">{inlineError}</span>}
          </div>
        </td>
        <td className="px-3 py-2" />
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
        <td className="px-3 py-2 text-slate-500 dark:text-neutral-400">{formatWeekday(group.workDate)}</td>
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
        <OvertimeCell minutes={hasOpenEntry ? null : totalMinutes} dailyTarget={dailyTarget} />
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

  let groups = mergeDayLabels(groupByDate(entries), dayLabels, sort);
  if (emptyDaysRange && (sort === "date_asc" || sort === "date_desc")) {
    groups = addEmptyDays(groups, emptyDaysRange, sort);
  }

  // Week boundaries only read correctly when rows are in date order.
  const weekSeparators = sort === "date_asc" || sort === "date_desc";

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
            <col className="w-14" />
            <col className="w-32" />
            <col className="w-24" />
            <col className="w-24" />
            <col className="w-24" />
            <col className="w-20" />
            <col className="w-20" />
            <col />
            <col className="w-40" />
            <col className="w-16" />
          </colgroup>
          <thead className="bg-slate-50 dark:bg-neutral-800/50">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-neutral-400">Day</th>
              <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-neutral-400">Date</th>
              <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-neutral-400">Start</th>
              <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-neutral-400">End</th>
              <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-neutral-400">Break (min)</th>
              <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-neutral-400">Total</th>
              <th className="px-3 py-2.5" />
              <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-neutral-400">Note</th>
              <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-neutral-400">Tags</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
            {(() => {
              let weekIndex = -1;
              let prev: { year: number; week: number } | null = null;
              const weekGroups = new Map<string, DayGroup[]>();
              for (const g of groups) {
                const w = isoWeek(g.workDate);
                const key = `${w.year}-${w.week}`;
                weekGroups.set(key, [...(weekGroups.get(key) ?? []), g]);
              }
              return groups.flatMap((group) => {
                const wk = isoWeek(group.workDate);
                const rows = renderGroup(group);
                if (!weekSeparators) return rows;
                const newWeek = !prev || prev.year !== wk.year || prev.week !== wk.week;
                if (newWeek) weekIndex++;
                prev = wk;
                const style = WEEK_STYLES[weekIndex % WEEK_STYLES.length];
                const isToday = group.workDate === todayStr;
                const styled = rows.map((row) => {
                  const cls = (row.props as { className?: string }).className ?? "";
                  return cloneElement(row as ReactElement<{ className?: string }>, {
                    className: `${cls} ${style.bar} ${isToday ? TODAY_CLASS : ""}`.trim(),
                  });
                });
                return newWeek ? [renderWeekRow(wk, style, weekStats(wk, weekGroups.get(`${wk.year}-${wk.week}`)!)), ...styled] : styled;
              });
            })()}
          </tbody>
        </table>
      )}
    </div>
  );
}
