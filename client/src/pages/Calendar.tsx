import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../api/client";
import type { DayLabel, DayStatus, TimeEntry } from "../api/types";
import Nav from "../components/Nav";
import DayStatusBadge from "../components/DayStatusBadge";
import DayDetailPanel from "../components/DayDetailPanel";
import TagIconCircle from "../components/TagIconCircle";
import { formatDuration } from "../lib/time";
import { useAuth } from "../auth/AuthContext";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// Monday-first weekday index (0=Mon..6=Sun) for the 1st of the month, so the
// grid lines up with the rest of the app's Monday-start week convention.
function leadingBlanks(year: number, month: number): number {
  const jsDay = new Date(year, month, 1).getDay(); // 0=Sun..6=Sat
  return (jsDay + 6) % 7;
}

interface DayCellData {
  day: number;
  workDate: string;
  isToday: boolean;
  entries: TimeEntry[];
  label: DayLabel | null;
}

export default function CalendarPage() {
  const { user } = useAuth();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-11
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [dayLabels, setDayLabels] = useState<DayLabel[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const dateFormat = user?.dateFormat ?? "YYYY-MM-DD";
  const dailyTargetMinutes = user?.dailyTargetMinutes ?? null;
  const sickCountsAsWork = user?.sickCountsAsWork ?? true;

  const from = toDateStr(year, month, 1);
  const to = toDateStr(year, month, daysInMonth(year, month));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([api.entries.list({ from, to }), api.dayLabels.list({ from, to })])
      .then(([entriesRes, labelsRes]) => {
        if (cancelled) return;
        setEntries(entriesRes.entries);
        setDayLabels(labelsRes.dayLabels);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  useEffect(() => {
    setSelectedDate(null);
    setShowAddForm(false);
    setError(null);
  }, [year, month]);

  function selectDate(workDate: string, openAddForm = false) {
    setSelectedDate(workDate);
    setShowAddForm(openAddForm);
    setError(null);
  }

  const entriesByDate = useMemo(() => {
    const map = new Map<string, TimeEntry[]>();
    for (const e of entries) {
      const list = map.get(e.workDate) ?? [];
      list.push(e);
      map.set(e.workDate, list);
    }
    return map;
  }, [entries]);

  const labelsByDate = useMemo(() => {
    const map = new Map<string, DayLabel>();
    for (const l of dayLabels) map.set(l.workDate, l);
    return map;
  }, [dayLabels]);

  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  const cells: (DayCellData | null)[] = useMemo(() => {
    const blanks = leadingBlanks(year, month);
    const total = daysInMonth(year, month);
    const list: (DayCellData | null)[] = Array(blanks).fill(null);
    for (let day = 1; day <= total; day++) {
      const workDate = toDateStr(year, month, day);
      list.push({
        day,
        workDate,
        isToday: workDate === todayStr,
        entries: entriesByDate.get(workDate) ?? [],
        label: labelsByDate.get(workDate) ?? null,
      });
    }
    while (list.length % 7 !== 0) list.push(null);
    return list;
  }, [year, month, entriesByDate, labelsByDate, todayStr]);

  function creditedMinutes(status: DayStatus): number | null {
    if (dailyTargetMinutes === null) return null;
    if (status === "vacation") return dailyTargetMinutes;
    return sickCountsAsWork ? dailyTargetMinutes : null;
  }

  const monthWorkedMinutes = entries.reduce((sum, e) => sum + (e.totalMinutes ?? 0), 0);
  const sickDays = dayLabels.filter((l) => l.status === "sick").length;
  const vacationDays = dayLabels.filter((l) => l.status === "vacation").length;
  const creditedLabelMinutes = dayLabels.reduce((sum, l) => sum + (creditedMinutes(l.status) ?? 0), 0);

  function goToMonth(nextYear: number, nextMonth: number) {
    if (nextMonth < 0) {
      nextMonth = 11;
      nextYear -= 1;
    } else if (nextMonth > 11) {
      nextMonth = 0;
      nextYear += 1;
    }
    setYear(nextYear);
    setMonth(nextMonth);
  }

  async function handleSetLabel(status: DayStatus) {
    if (!selectedDate) return;
    setBusy(true);
    setError(null);
    try {
      const { dayLabel } = await api.dayLabels.set(selectedDate, status);
      setDayLabels((prev) => [...prev.filter((l) => l.workDate !== selectedDate), dayLabel]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateEntry(data: { workDate: string; startTime: string; endTime: string; breakMinutes?: number; note?: string }) {
    await api.entries.create(data);
    const [entriesRes, labelsRes] = await Promise.all([
      api.entries.list({ from, to }),
      api.dayLabels.list({ from, to }),
    ]);
    setEntries(entriesRes.entries);
    setDayLabels(labelsRes.dayLabels);
  }

  async function handleRemoveLabel() {
    if (!selectedDate) return;
    setBusy(true);
    setError(null);
    try {
      await api.dayLabels.remove(selectedDate);
      setDayLabels((prev) => prev.filter((l) => l.workDate !== selectedDate));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const yearOptions = useMemo(() => {
    const base = today.getFullYear();
    const years: number[] = [];
    for (let y = base - 5; y <= base + 3; y++) years.push(y);
    return years;
  }, [today]);

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-neutral-100">Calendar</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => goToMonth(year, month - 1)}
              className="btn-ghost"
              aria-label="Previous month"
            >
              ←
            </button>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="field-sm"
              aria-label="Month"
            >
              {MONTH_NAMES.map((name, i) => (
                <option key={name} value={i}>
                  {name}
                </option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="field-sm"
              aria-label="Year"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <button
              onClick={() => goToMonth(year, month + 1)}
              className="btn-ghost"
              aria-label="Next month"
            >
              →
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="panel p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-neutral-500">
              Worked this month
            </div>
            <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-neutral-100">
              {formatDuration(monthWorkedMinutes + creditedLabelMinutes)}
            </div>
            {creditedLabelMinutes > 0 && (
              <div className="mt-0.5 text-xs text-slate-500 dark:text-neutral-400">
                incl. {formatDuration(creditedLabelMinutes)} credited Sick/Vacation
              </div>
            )}
          </div>
          <div className="panel p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-neutral-500">Sick days</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-neutral-100">{sickDays}</div>
          </div>
          <div className="panel p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-neutral-500">Vacation days</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-neutral-100">{vacationDays}</div>
          </div>
        </div>

        <div className="panel overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-200 text-center text-xs font-medium text-slate-500 dark:border-neutral-800 dark:text-neutral-400">
            {WEEKDAY_LABELS.map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className={`grid grid-cols-7 ${loading ? "opacity-50" : ""}`}>
            {cells.map((cell, i) => {
              if (!cell) return <div key={`blank-${i}`} className="min-h-24 border-b border-r border-slate-100 last:border-r-0 dark:border-neutral-800" />;
              const totalMinutes = cell.entries.reduce((sum, e) => sum + (e.totalMinutes ?? 0), 0);
              const uniqueTags = new Map<number, TimeEntry["tags"][number]>();
              for (const e of cell.entries) for (const t of e.tags) uniqueTags.set(t.id, t);
              const selected = selectedDate === cell.workDate;
              return (
                <button
                  key={cell.workDate}
                  onClick={() => selectDate(cell.workDate)}
                  onDoubleClick={() => selectDate(cell.workDate, true)}
                  title="Double-click to add an entry"
                  className={`relative min-h-24 border-b border-r border-slate-100 p-1.5 pt-7 text-left last:border-r-0 dark:border-neutral-800 ${
                    selected ? "bg-brand-50 dark:bg-brand-900/20" : "hover:bg-slate-50 dark:hover:bg-neutral-800/40"
                  }`}
                >
                  <span
                    className={`absolute left-1.5 top-1.5 text-xs font-medium ${
                      cell.isToday
                        ? "flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white"
                        : "text-slate-500 dark:text-neutral-400"
                    }`}
                  >
                    {cell.day}
                  </span>
                  <div className="space-y-1">
                    {cell.label && <DayStatusBadge status={cell.label.status} />}
                    {totalMinutes > 0 && (
                      <div className="inline-block rounded-md bg-slate-100 px-1.5 py-0.5 text-sm font-semibold text-slate-700 dark:bg-neutral-800 dark:text-neutral-200">
                        {formatDuration(totalMinutes)}
                      </div>
                    )}
                    {uniqueTags.size > 0 && (
                      <div className="flex flex-wrap items-center gap-0.5">
                        {[...uniqueTags.values()].slice(0, 4).map((tag) => (
                          <TagIconCircle key={tag.id} tag={tag} />
                        ))}
                        {uniqueTags.size > 4 && (
                          <span className="text-[10px] font-medium text-slate-400 dark:text-neutral-500">
                            +{uniqueTags.size - 4}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {selectedDate && (
          <DayDetailPanel
            workDate={selectedDate}
            dateFormat={dateFormat}
            entries={entriesByDate.get(selectedDate) ?? []}
            label={labelsByDate.get(selectedDate) ?? null}
            busy={busy}
            error={error}
            defaultBreakMinutes={user?.defaultBreakMinutes ?? 0}
            showAddForm={showAddForm}
            onToggleAddForm={() => setShowAddForm((v) => !v)}
            onAddEntry={handleCreateEntry}
            onSetLabel={handleSetLabel}
            onRemoveLabel={handleRemoveLabel}
            onClose={() => setSelectedDate(null)}
          />
        )}
      </main>
    </div>
  );
}
