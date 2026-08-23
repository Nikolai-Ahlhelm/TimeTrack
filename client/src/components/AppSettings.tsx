import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";

// App-wide policy toggles (stored in the settings key/value table), editable
// by admins only. Currently just the Sick-day work-time policy.
export default function AppSettings() {
  const [sickCountsAsWork, setSickCountsAsWork] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.settings
      .get()
      .then(({ settings }) => setSickCountsAsWork(settings.sick_counts_as_work !== "false"))
      .finally(() => setLoading(false));
  }, []);

  async function toggle() {
    const next = !sickCountsAsWork;
    setSaving(true);
    setError(null);
    try {
      await api.settings.update({ sick_counts_as_work: String(next) });
      setSickCountsAsWork(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;

  return (
    <div className="panel space-y-3 p-6">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-neutral-100">App settings</h2>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-700 dark:text-neutral-200">Sick days count as work time</p>
          <p className="text-xs text-slate-500 dark:text-neutral-400">
            When enabled, a day marked Sick is credited with the user's daily target toward worked time and
            overtime. Vacation days always count. Applies to all users.
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={saving}
          aria-pressed={sickCountsAsWork}
          className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${
            sickCountsAsWork ? "bg-brand-600" : "bg-slate-300 dark:bg-neutral-700"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition ${
              sickCountsAsWork ? "left-5" : "left-0.5"
            }`}
          />
        </button>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
