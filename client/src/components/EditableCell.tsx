import { useState } from "react";

interface Props {
  value: string;
  type?: "text" | "date" | "time" | "number";
  onSave: (value: string) => Promise<void> | void;
  placeholder?: string;
}

export default function EditableCell({ value, type = "text", onSave, placeholder }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  async function commit() {
    if (draft === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <input
        autoFocus
        type={type}
        value={draft}
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className="w-full rounded border border-brand-400 bg-white px-1.5 py-1 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-brand-500 dark:bg-slate-950 dark:text-slate-100"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className="w-full rounded px-1.5 py-1 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      {value || <span className="text-slate-400 dark:text-slate-500">{placeholder ?? "—"}</span>}
    </button>
  );
}
