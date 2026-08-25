import { useState } from "react";

interface Props {
  value: string;
  /** Text shown while not editing, if it should differ from the raw value (e.g. a reformatted date). */
  displayValue?: string;
  type?: "text" | "date" | "time" | "number";
  onSave: (value: string) => Promise<void> | void;
  placeholder?: string;
}

export default function EditableCell({ value, displayValue, type = "text", onSave, placeholder }: Props) {
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
        className="w-full min-w-0 rounded border border-brand-400 bg-white px-1.5 py-1 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-brand-500 dark:bg-neutral-950 dark:text-neutral-100"
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
      className="w-full rounded border border-transparent px-1.5 py-1 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
    >
      {value ? (displayValue ?? value) : <span className="text-slate-400 dark:text-neutral-500">{placeholder ?? "—"}</span>}
    </button>
  );
}
