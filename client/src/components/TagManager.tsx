import { useState } from "react";
import type { Tag } from "../api/types";
import { api, ApiError } from "../api/client";
import TagBadge from "./TagBadge";

const PALETTE = [
  "#64748b", // slate
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
];

interface Props {
  tags: Tag[];
  onChange: (tags: Tag[]) => void;
}

// Full tag CRUD used on the Settings page: create custom tags (e.g.
// "Homeoffice", "Trip"), recolor or rename them, and delete ones no longer
// needed. Entries referencing a deleted tag just lose that tag.
export default function TagManager({ tags, onChange }: Props) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(PALETTE[0]);
  const [icon, setIcon] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | "new" | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    setBusyId("new");
    try {
      const { tag } = await api.tags.create({ name: trimmed, color, icon: icon.trim() || undefined });
      onChange([...tags, tag].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
      setIcon("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create tag");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRecolor(tag: Tag, nextColor: string) {
    setBusyId(tag.id);
    try {
      const { tag: updated } = await api.tags.update(tag.id, { color: nextColor });
      onChange(tags.map((t) => (t.id === tag.id ? updated : t)));
    } finally {
      setBusyId(null);
    }
  }

  async function handleReicon(tag: Tag, nextIcon: string) {
    setBusyId(tag.id);
    try {
      const { tag: updated } = await api.tags.update(tag.id, { icon: nextIcon.trim() });
      onChange(tags.map((t) => (t.id === tag.id ? updated : t)));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(tag: Tag) {
    if (!confirm(`Delete the "${tag.name}" tag? It will be removed from any entries using it.`)) return;
    setBusyId(tag.id);
    try {
      await api.tags.remove(tag.id);
      onChange(tags.filter((t) => t.id !== tag.id));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <label className="field-label-lg">Tags</label>
      <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
        Custom labels like "Homeoffice" or "Trip" you can attach to time entries and filter by.
      </p>

      <div className="mt-2 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <div key={tag.id} className="group relative inline-flex items-center gap-1">
            <TagBadge tag={tag} />
            <div className="flex items-center gap-0.5">
              <input
                defaultValue={tag.icon ?? ""}
                onBlur={(e) => e.target.value.trim() !== (tag.icon ?? "") && handleReicon(tag, e.target.value)}
                placeholder="icon"
                title="Emoji shown for this tag on the calendar"
                disabled={busyId === tag.id}
                className="field-sm w-10 px-1 py-0.5 text-center"
              />
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  title={c}
                  disabled={busyId === tag.id}
                  onClick={() => handleRecolor(tag, c)}
                  className={`h-3 w-3 rounded-full ${tag.color === c ? "ring-2 ring-offset-1 ring-slate-400 dark:ring-offset-neutral-900" : ""}`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <button
                type="button"
                disabled={busyId === tag.id}
                onClick={() => handleDelete(tag)}
                className="ml-1 text-xs text-slate-400 hover:text-red-600 disabled:opacity-50 dark:text-neutral-500 dark:hover:text-red-400"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {tags.length === 0 && <p className="text-xs text-slate-400 dark:text-neutral-500">No tags yet.</p>}
      </div>

      <form onSubmit={handleCreate} className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New tag name"
          className="field-sm w-40"
        />
        <input
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          placeholder="icon"
          title="Emoji shown for this tag on the calendar"
          className="field-sm w-14 px-1 text-center"
        />
        <div className="flex items-center gap-1">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              onClick={() => setColor(c)}
              className={`h-5 w-5 rounded-full ${color === c ? "ring-2 ring-offset-1 ring-slate-400 dark:ring-offset-neutral-900" : ""}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <button type="submit" disabled={busyId === "new" || !name.trim()} className="btn-secondary">
          Add tag
        </button>
      </form>
      {error && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
