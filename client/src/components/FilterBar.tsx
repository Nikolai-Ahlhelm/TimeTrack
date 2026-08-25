import type { DayStatus, SortOption, Tag } from "../api/types";
import TagBadge from "./TagBadge";
import DayStatusBadge from "./DayStatusBadge";

export interface Filters {
  from: string;
  to: string;
  q: string;
  sort: SortOption;
  tagId?: number;
  dayStatus?: DayStatus;
}

const DAY_STATUS_OPTIONS: DayStatus[] = ["sick", "vacation"];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "date_desc", label: "Newest first" },
  { value: "date_asc", label: "Oldest first" },
  { value: "hours_desc", label: "Most hours first" },
  { value: "hours_asc", label: "Fewest hours first" },
];

const QUICK_RANGES = [7, 14, 30];

function toDateStr(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function lastNDays(n: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (n - 1));
  return { from: toDateStr(from), to: toDateStr(to) };
}

function monthRange(monthStr: string): { from: string; to: string } {
  const [year, month] = monthStr.split("-").map(Number);
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0);
  return { from: toDateStr(from), to: toDateStr(to) };
}

interface Props {
  filters: Filters;
  onChange: (filters: Filters) => void;
  tags: Tag[];
}

export default function FilterBar({ filters, onChange, tags }: Props) {
  const activeQuickDays = QUICK_RANGES.find((n) => {
    const { from, to } = lastNDays(n);
    return filters.from === from && filters.to === to;
  });
  const currentMonth = filters.from && filters.to && filters.from === monthRange(filters.from.slice(0, 7)).from
    ? filters.from.slice(0, 7)
    : "";

  const hasActiveFilters =
    filters.from || filters.to || filters.q || filters.tagId !== undefined || filters.dayStatus !== undefined;

  return (
    <div className="panel space-y-4 p-4">
      {/* Date range controls: quick-pick buttons plus the three date inputs,
          each sized to its own column instead of stretching full-width. */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div>
          <label className="field-label">Quick select</label>
          <div className="mt-1 flex gap-1">
            {QUICK_RANGES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onChange({ ...filters, ...lastNDays(n) })}
                className={`btn-ghost px-2 py-1 text-xs ${activeQuickDays === n ? "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300" : ""}`}
              >
                {n}d
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="field-label">Month</label>
            <input
              type="month"
              value={currentMonth}
              onChange={(e) => onChange({ ...filters, ...monthRange(e.target.value) })}
              className="field-sm mt-1 w-full sm:w-36"
            />
          </div>
          <div>
            <label className="field-label">From</label>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => onChange({ ...filters, from: e.target.value })}
              className="field-sm mt-1 w-full sm:w-32"
            />
          </div>
          <div>
            <label className="field-label">To</label>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => onChange({ ...filters, to: e.target.value })}
              className="field-sm mt-1 w-full sm:w-32"
            />
          </div>
        </div>
      </div>

      {/* Search + sort share a row; search grows to fill the space. */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[10rem] flex-1">
          <label className="field-label">Search</label>
          <input
            type="text"
            placeholder="Search notes or date"
            value={filters.q}
            onChange={(e) => onChange({ ...filters, q: e.target.value })}
            className="field-sm mt-1 w-full"
          />
        </div>
        <div>
          <label className="field-label">Sort by</label>
          <select
            value={filters.sort}
            onChange={(e) => onChange({ ...filters, sort: e.target.value as SortOption })}
            className="field-sm mt-1"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Badge filters + clear, grouped together on one row. */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        {tags.length > 0 && (
          <div>
            <label className="field-label">Tag</label>
            <div className="mt-1 flex flex-wrap gap-1">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => onChange({ ...filters, tagId: filters.tagId === tag.id ? undefined : tag.id })}
                  className={filters.tagId === tag.id ? "" : "opacity-50 hover:opacity-100"}
                >
                  <TagBadge tag={tag} />
                </button>
              ))}
            </div>
          </div>
        )}
        <div>
          <label className="field-label">Day status</label>
          <div className="mt-1 flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => onChange({ ...filters, dayStatus: undefined })}
              className={`btn-ghost px-2 py-1 text-xs ${filters.dayStatus === undefined ? "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300" : ""}`}
            >
              All
            </button>
            {DAY_STATUS_OPTIONS.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => onChange({ ...filters, dayStatus: filters.dayStatus === status ? undefined : status })}
                className={filters.dayStatus === status ? "" : "opacity-50 hover:opacity-100"}
              >
                <DayStatusBadge status={status} />
              </button>
            ))}
          </div>
        </div>
        {hasActiveFilters && (
          <button
            onClick={() => onChange({ from: "", to: "", q: "", sort: filters.sort, tagId: undefined, dayStatus: undefined })}
            className="btn-ghost"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
