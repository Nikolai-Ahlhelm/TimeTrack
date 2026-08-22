import type { SortOption } from "../api/types";

export interface Filters {
  from: string;
  to: string;
  q: string;
  sort: SortOption;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "date_desc", label: "Newest first" },
  { value: "date_asc", label: "Oldest first" },
  { value: "hours_desc", label: "Most hours first" },
  { value: "hours_asc", label: "Fewest hours first" },
];

interface Props {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

export default function FilterBar({ filters, onChange }: Props) {
  return (
    <div className="panel flex flex-wrap items-end gap-3 p-4">
      <div>
        <label className="field-label">From</label>
        <input
          type="date"
          value={filters.from}
          onChange={(e) => onChange({ ...filters, from: e.target.value })}
          className="field-sm mt-1"
        />
      </div>
      <div>
        <label className="field-label">To</label>
        <input
          type="date"
          value={filters.to}
          onChange={(e) => onChange({ ...filters, to: e.target.value })}
          className="field-sm mt-1"
        />
      </div>
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
      {(filters.from || filters.to || filters.q) && (
        <button onClick={() => onChange({ from: "", to: "", q: "", sort: filters.sort })} className="btn-ghost">
          Clear
        </button>
      )}
    </div>
  );
}
