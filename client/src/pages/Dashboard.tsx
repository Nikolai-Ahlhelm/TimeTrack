import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { DayLabel, DayStatus, Tag, TimeEntry } from "../api/types";
import Nav from "../components/Nav";
import ClockButton from "../components/ClockButton";
import FilterBar, { type Filters } from "../components/FilterBar";
import TimeTable from "../components/TimeTable";
import ExportButton from "../components/ExportButton";
import { formatDuration, formatSignedDuration, toLocalDateStr } from "../lib/time";
import { useAuth } from "../auth/AuthContext";

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [openEntry, setOpenEntry] = useState<TimeEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [filters, setFilters] = useState<Filters>({ from: "", to: "", q: "", sort: "date_desc" });
  const [allEntries, setAllEntries] = useState<TimeEntry[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [weekLabels, setWeekLabels] = useState<DayLabel[]>([]);
  const [filteredDayLabels, setFilteredDayLabels] = useState<DayLabel[]>([]);
  const [labelBusy, setLabelBusy] = useState(false);

  async function loadFiltered() {
    // A day-status filter only ever matches labeled days, which never have
    // entries — skip the entries request entirely rather than fetch and discard.
    if (filters.dayStatus) {
      setEntries([]);
      return;
    }
    const { entries } = await api.entries.list({
      from: filters.from || undefined,
      to: filters.to || undefined,
      q: filters.q || undefined,
      sort: filters.sort,
      tagId: filters.tagId,
    });
    setEntries(entries);
  }

  async function loadFilteredLabels() {
    const { dayLabels } = await api.dayLabels.list({ from: filters.from || undefined, to: filters.to || undefined });
    setFilteredDayLabels(filters.dayStatus ? dayLabels.filter((l) => l.status === filters.dayStatus) : dayLabels);
  }

  async function loadStats() {
    const { entries } = await api.entries.list({ sort: "date_desc" });
    setAllEntries(entries);
  }

  async function loadOpen() {
    const { entry } = await api.entries.todayOpen();
    setOpenEntry(entry);
  }

  async function loadTags() {
    const { tags } = await api.tags.list();
    setTags(tags);
  }

  async function handleCreateTag(name: string): Promise<Tag> {
    const { tag } = await api.tags.create({ name });
    setTags((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)));
    return tag;
  }

  // Covers the current week (Mon..Sun) so both today's label and any other
  // labeled day this week can be credited toward the week's worked time.
  async function loadWeekLabels() {
    const weekStart = startOfWeek(new Date());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const from = toLocalDateStr(weekStart);
    const to = toLocalDateStr(weekEnd);
    const { dayLabels } = await api.dayLabels.list({ from, to });
    setWeekLabels(dayLabels);
  }

  useEffect(() => {
    loadOpen();
    loadStats();
    loadTags();
    loadWeekLabels();
  }, []);

  useEffect(() => {
    loadFiltered();
    loadFilteredLabels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const todayStr = toLocalDateStr(new Date());
  const weekStart = startOfWeek(new Date());
  const dailyTarget = user?.dailyTargetMinutes ?? null;
  const sickCountsAsWork = user?.sickCountsAsWork ?? true;

  const hasEntriesToday = useMemo(() => allEntries.some((e) => e.workDate === todayStr), [allEntries, todayStr]);
  const todayLabel = useMemo(() => weekLabels.find((l) => l.workDate === todayStr) ?? null, [weekLabels, todayStr]);

  // A Sick/Vacation day with no time entries is credited with the daily
  // target (if set), per the Sick-counts-as-work setting; Vacation always counts.
  function creditedMinutesForLabel(status: DayStatus): number {
    if (dailyTarget === null) return 0;
    if (status === "vacation") return dailyTarget;
    return sickCountsAsWork ? dailyTarget : 0;
  }

  const todayMinutes = useMemo(() => {
    const worked = allEntries.filter((e) => e.workDate === todayStr).reduce((sum, e) => sum + (e.totalMinutes ?? 0), 0);
    return worked + (todayLabel ? creditedMinutesForLabel(todayLabel.status) : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allEntries, todayStr, todayLabel, dailyTarget, sickCountsAsWork]);
  const weekEntries = useMemo(
    () => allEntries.filter((e) => new Date(e.workDate) >= weekStart),
    [allEntries, weekStart]
  );
  const weekMinutes = useMemo(() => {
    const worked = weekEntries.reduce((sum, e) => sum + (e.totalMinutes ?? 0), 0);
    const credited = weekLabels.reduce((sum, l) => sum + creditedMinutesForLabel(l.status), 0);
    return worked + credited;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekEntries, weekLabels, dailyTarget, sickCountsAsWork]);

  // Overtime is only meaningful once the user has set a daily target. Weekly
  // expected time is the target multiplied by the number of scheduled work
  // days (from Settings) that have occurred so far this week, so non-working
  // days don't count against the user.
  const todayOvertime = dailyTarget !== null ? todayMinutes - dailyTarget : null;
  const workDays = user?.workDays ?? [1, 2, 3, 4, 5];
  const scheduledDaysThisWeek = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let count = 0;
    for (let d = new Date(weekStart); d <= today; d.setDate(d.getDate() + 1)) {
      const isoWeekday = ((d.getDay() + 6) % 7) + 1; // Monday = 1 .. Sunday = 7
      if (workDays.includes(isoWeekday)) count++;
    }
    return count;
  }, [weekStart, workDays]);
  const weekOvertime = dailyTarget !== null ? weekMinutes - dailyTarget * scheduledDaysThisWeek : null;

  async function handleStart() {
    setBusy(true);
    try {
      const { entry } = await api.entries.start();
      setOpenEntry(entry);
      await Promise.all([loadFiltered(), loadStats()]);
    } finally {
      setBusy(false);
    }
  }

  async function handleStop() {
    setBusy(true);
    try {
      await api.entries.stop();
      setOpenEntry(null);
      await Promise.all([loadFiltered(), loadStats()]);
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdate(
    id: number,
    data: Partial<Pick<TimeEntry, "workDate" | "startTime" | "endTime" | "breakMinutes" | "note">> & {
      tagIds?: number[];
    }
  ) {
    await api.entries.update(id, data);
    await Promise.all([loadFiltered(), loadStats(), loadOpen()]);
  }

  async function handleCreateEntry(data: { workDate: string; startTime: string; endTime: string; breakMinutes?: number }) {
    await api.entries.create(data);
    await Promise.all([loadFiltered(), loadStats()]);
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this time entry?")) return;
    await api.entries.remove(id);
    await Promise.all([loadFiltered(), loadStats(), loadOpen()]);
  }

  // Applies a day-label change to every bit of state that could contain that
  // date, so the ClockButton, the stat tiles, and the table all stay in sync
  // no matter where the change came from.
  function applyDayLabel(dayLabel: DayLabel) {
    setWeekLabels((prev) => [...prev.filter((l) => l.workDate !== dayLabel.workDate), dayLabel]);
    setFilteredDayLabels((prev) => {
      const rest = prev.filter((l) => l.workDate !== dayLabel.workDate);
      if (filters.dayStatus && filters.dayStatus !== dayLabel.status) return rest;
      return [...rest, dayLabel];
    });
  }

  function clearDayLabel(workDate: string) {
    setWeekLabels((prev) => prev.filter((l) => l.workDate !== workDate));
    setFilteredDayLabels((prev) => prev.filter((l) => l.workDate !== workDate));
  }

  async function handleSetTodayLabel(status: DayStatus) {
    setLabelBusy(true);
    try {
      const { dayLabel } = await api.dayLabels.set(toLocalDateStr(new Date()), status);
      applyDayLabel(dayLabel);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setLabelBusy(false);
    }
  }

  async function handleRemoveTodayLabel() {
    setLabelBusy(true);
    try {
      const todayStr = toLocalDateStr(new Date());
      await api.dayLabels.remove(todayStr);
      clearDayLabel(todayStr);
    } finally {
      setLabelBusy(false);
    }
  }

  async function handleSetDayLabel(workDate: string, status: DayStatus) {
    const { dayLabel } = await api.dayLabels.set(workDate, status);
    applyDayLabel(dayLabel);
  }

  async function handleRemoveDayLabel(workDate: string) {
    await api.dayLabels.remove(workDate);
    clearDayLabel(workDate);
  }

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-1 h-full">
            <ClockButton
              openEntry={openEntry}
              busy={busy}
              onStart={handleStart}
              onStop={handleStop}
              todayLabel={todayLabel}
              hasEntriesToday={hasEntriesToday}
              labelBusy={labelBusy}
              onSetTodayLabel={handleSetTodayLabel}
              onRemoveTodayLabel={handleRemoveTodayLabel}
            />
          </div>
          {/* Today/This-week sit side by side even on mobile; sm:contents
              drops this wrapper from the grid so they fall back to being
              direct children of the 3-col grid above the sm breakpoint. */}
          <div className="grid grid-cols-2 gap-4 sm:contents">
            <div className="panel p-5">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-neutral-500">Today</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-neutral-100">
                {formatDuration(todayMinutes)}
              </div>
              {todayOvertime !== null && (
                <div
                  className={`mt-0.5 text-xs font-medium ${
                    todayOvertime < 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {formatSignedDuration(todayOvertime)} vs. target
                </div>
              )}
            </div>
            <div className="panel p-5">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-neutral-500">This week</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-neutral-100">
                {formatDuration(weekMinutes)}
              </div>
              {weekOvertime !== null && (
                <div
                  className={`mt-0.5 text-xs font-medium ${
                    weekOvertime < 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {formatSignedDuration(weekOvertime)} vs. target
                </div>
              )}
            </div>
          </div>
        </div>

        {dailyTarget === null && (
          <p className="text-sm text-slate-500 dark:text-neutral-400">
            Set your daily work-time target in{" "}
            <Link to="/settings" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
              Settings
            </Link>{" "}
            to see overtime.
          </p>
        )}

        <FilterBar filters={filters} onChange={setFilters} tags={tags} />

        <TimeTable
          entries={entries}
          dayLabels={filteredDayLabels}
          sort={filters.sort}
          dateFormat={user?.dateFormat}
          allTags={tags}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onCreateTag={handleCreateTag}
          onSetLabel={handleSetDayLabel}
          onRemoveLabel={handleRemoveDayLabel}
          onCreateEntry={handleCreateEntry}
          actions={<ExportButton filters={filters} />}
        />
      </main>
    </div>
  );
}
