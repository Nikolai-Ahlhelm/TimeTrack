import { useEffect, useState } from "react";
import type { DayLabel, DayStatus, TimeEntry } from "../api/types";
import DayStatusBadge from "./DayStatusBadge";

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

interface Props {
  openEntry: TimeEntry | null;
  busy: boolean;
  onStart: () => void;
  onStop: () => void;
  todayLabel: DayLabel | null;
  hasEntriesToday: boolean;
  labelBusy: boolean;
  onSetTodayLabel: (status: DayStatus) => void;
  onRemoveTodayLabel: () => void;
}

export default function ClockButton({
  openEntry,
  busy,
  onStart,
  onStop,
  todayLabel,
  hasEntriesToday,
  labelBusy,
  onSetTodayLabel,
  onRemoveTodayLabel,
}: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!openEntry) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [openEntry]);

  const elapsedMs = openEntry ? now - new Date(openEntry.startTime).getTime() : 0;

  if (todayLabel) {
    return (
      <div className="panel flex h-full flex-col justify-center gap-2 p-5">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-neutral-500">Today</div>
        <DayStatusBadge status={todayLabel.status} className="w-fit" />
        <button onClick={onRemoveTodayLabel} disabled={labelBusy} className="w-fit text-xs font-medium text-slate-400 hover:text-slate-600 disabled:opacity-50 dark:text-neutral-500 dark:hover:text-neutral-300">
          {labelBusy ? "Removing..." : "Remove label & clock in normally"}
        </button>
      </div>
    );
  }

  return (
    <div className="panel flex h-full items-center gap-4 p-5">
      <button
        onClick={openEntry ? onStop : onStart}
        disabled={busy}
        className={`rounded-full px-6 py-3 text-sm font-semibold text-white shadow transition disabled:opacity-50 ${
          openEntry ? "bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600" : "bg-brand-600 hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-400"
        }`}
      >
        {openEntry ? "Stop work" : "Start work"}
      </button>
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-neutral-500">
          {openEntry ? "Currently working" : "Not clocked in"}
        </div>
        <div className="font-mono text-2xl font-semibold text-slate-900 dark:text-neutral-100">
          {openEntry ? formatElapsed(elapsedMs) : "00:00:00"}
        </div>
        {!openEntry && !hasEntriesToday && (
          <div className="mt-1.5 flex gap-2">
            <button onClick={() => onSetTodayLabel("sick")} disabled={labelBusy} className="link-muted disabled:opacity-50">
              Mark Sick today
            </button>
            <button onClick={() => onSetTodayLabel("vacation")} disabled={labelBusy} className="link-muted disabled:opacity-50">
              Mark Vacation today
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
