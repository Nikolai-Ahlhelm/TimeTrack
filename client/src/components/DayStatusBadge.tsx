import type { DayStatus } from "../api/types";

const STYLES: Record<DayStatus, { label: string; bg: string; text: string; ring: string }> = {
  sick: {
    label: "Sick",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    text: "text-amber-700 dark:text-amber-400",
    ring: "ring-amber-600/20 dark:ring-amber-400/30",
  },
  vacation: {
    label: "Vacation",
    bg: "bg-violet-50 dark:bg-violet-900/20",
    text: "text-violet-700 dark:text-violet-400",
    ring: "ring-violet-600/20 dark:ring-violet-400/30",
  },
};

export default function DayStatusBadge({ status, className = "" }: { status: DayStatus; className?: string }) {
  const s = STYLES[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${s.bg} ${s.text} ${s.ring} ${className}`}
    >
      {s.label}
    </span>
  );
}
