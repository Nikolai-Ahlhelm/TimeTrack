import { useEffect, useRef, useState } from "react";
import type { Tag } from "../api/types";
import TagBadge from "./TagBadge";

interface Props {
  allTags: Tag[];
  selected: Tag[];
  onChange: (tagIds: number[]) => void;
  onCreateTag: (name: string) => Promise<Tag>;
}

// Inline multi-select used in the time entry table: shows the entry's
// current tags as pills plus an "+" button that opens a small dropdown to
// toggle existing tags or create a new one on the fly.
export default function TagPicker({ allTags, selected, onChange, onCreateTag }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const selectedIds = new Set(selected.map((t) => t.id));
  const filtered = allTags.filter((t) => t.name.toLowerCase().includes(query.trim().toLowerCase()));
  const exactMatch = allTags.some((t) => t.name.toLowerCase() === query.trim().toLowerCase());

  function toggleTag(tag: Tag) {
    const next = selectedIds.has(tag.id) ? selected.filter((t) => t.id !== tag.id) : [...selected, tag];
    onChange(next.map((t) => t.id));
  }

  async function handleCreate() {
    const name = query.trim();
    if (!name) return;
    setBusy(true);
    try {
      const tag = await onCreateTag(name);
      onChange([...selected.map((t) => t.id), tag.id]);
      setQuery("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={containerRef} className="relative flex flex-wrap items-center gap-1">
      {selected.map((tag) => (
        <TagBadge key={tag.id} tag={tag} onRemove={() => toggleTag(tag)} />
      ))}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full px-1.5 py-0.5 text-xs font-medium text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
        aria-label="Edit tags"
      >
        + tag
      </button>
      {open && (
        <div className="absolute left-0 top-full z-10 mt-1 w-56 rounded-md border border-slate-200 bg-white p-2 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && query.trim() && !exactMatch) handleCreate();
            }}
            placeholder="Find or create tag"
            className="field-sm w-full"
          />
          <div className="mt-2 max-h-40 space-y-0.5 overflow-y-auto">
            {filtered.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag)}
                className="flex w-full items-center justify-between rounded px-1.5 py-1 text-left text-sm hover:bg-slate-100 dark:hover:bg-neutral-800"
              >
                <TagBadge tag={tag} />
                {selectedIds.has(tag.id) && <span className="text-brand-600 dark:text-brand-400">✓</span>}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-1.5 py-1 text-xs text-slate-400 dark:text-neutral-500">No matching tags</p>
            )}
            {query.trim() && !exactMatch && (
              <button
                type="button"
                disabled={busy}
                onClick={handleCreate}
                className="w-full rounded px-1.5 py-1 text-left text-sm font-medium text-brand-600 hover:bg-brand-50 disabled:opacity-50 dark:text-brand-400 dark:hover:bg-brand-900/20"
              >
                Create "{query.trim()}"
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
