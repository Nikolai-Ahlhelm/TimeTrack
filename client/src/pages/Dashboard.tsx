import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { TimeEntry } from "../api/types";
import Nav from "../components/Nav";
import ClockButton from "../components/ClockButton";
import FilterBar, { type Filters } from "../components/FilterBar";
import TimeTable from "../components/TimeTable";
import ExportButton from "../components/ExportButton";
import { formatDuration, formatSignedDuration } from "../lib/time";
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

  async function loadFiltered() {
    const { entries } = await api.entries.list({
      from: filters.from || undefined,
      to: filters.to || undefined,
      q: filters.q || undefined,
      sort: filters.sort,
    });
    setEntries(entries);
  }

  async function loadStats() {
    const { entries } = await api.entries.list({ sort: "date_desc" });
    setAllEntries(entries);
  }

  async function loadOpen() {
    const { entry } = await api.entries.todayOpen();
    setOpenEntry(entry);
  }

  useEffect(() => {
    loadOpen();
    loadStats();
  }, []);

  useEffect(() => {
    loadFiltered();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const weekStart = startOfWeek(new Date());

  const todayMinutes = useMemo(
    () => allEntries.filter((e) => e.workDate === todayStr).reduce((sum, e) => sum + (e.totalMinutes ?? 0), 0),
    [allEntries, todayStr]
  );
  const weekEntries = useMemo(
    () => allEntries.filter((e) => new Date(e.workDate) >= weekStart),
    [allEntries, weekStart]
  );
  const weekMinutes = useMemo(
    () => weekEntries.reduce((sum, e) => sum + (e.totalMinutes ?? 0), 0),
    [weekEntries]
  );

  // Overtime is only meaningful once the user has set a daily target. Weekly
  // expected time is the target multiplied by the number of distinct days
  // actually worked that week, so days off don't count against the user.
  const dailyTarget = user?.dailyTargetMinutes ?? null;
  const todayOvertime = dailyTarget !== null ? todayMinutes - dailyTarget : null;
  const daysWorkedThisWeek = useMemo(() => new Set(weekEntries.map((e) => e.workDate)).size, [weekEntries]);
  const weekOvertime = dailyTarget !== null ? weekMinutes - dailyTarget * daysWorkedThisWeek : null;

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
    data: Partial<Pick<TimeEntry, "workDate" | "startTime" | "endTime" | "breakMinutes" | "note">>
  ) {
    await api.entries.update(id, data);
    await Promise.all([loadFiltered(), loadStats(), loadOpen()]);
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this time entry?")) return;
    await api.entries.remove(id);
    await Promise.all([loadFiltered(), loadStats(), loadOpen()]);
  }

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <ClockButton openEntry={openEntry} busy={busy} onStart={handleStart} onStop={handleStop} />
          </div>
          <div className="panel p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Today</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
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
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">This week</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
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

        {dailyTarget === null && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Set your daily work-time target in{" "}
            <Link to="/settings" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
              Settings
            </Link>{" "}
            to see overtime.
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterBar filters={filters} onChange={setFilters} />
          <ExportButton filters={filters} />
        </div>

        <TimeTable entries={entries} onUpdate={handleUpdate} onDelete={handleDelete} />
      </main>
    </div>
  );
}
