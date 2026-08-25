import { useEffect, useState } from "react";
import Nav from "../components/Nav";
import { api, ApiError } from "../api/client";
import { DATE_FORMATS, type DateFormat, type Tag, type BreakRule } from "../api/types";
import { DATE_FORMAT_LABELS, GERMAN_BREAK_RULES } from "../lib/time";
import { useAuth } from "../auth/AuthContext";
import TagManager from "../components/TagManager";

export default function Settings() {
  const { user, setUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [dateFormat, setDateFormat] = useState<DateFormat>(user?.dateFormat ?? "YYYY-MM-DD");
  const [targetHours, setTargetHours] = useState(
    user?.dailyTargetMinutes != null ? String(Math.floor(user.dailyTargetMinutes / 60)) : ""
  );
  const [targetMinutes, setTargetMinutes] = useState(
    user?.dailyTargetMinutes != null ? String(user.dailyTargetMinutes % 60) : ""
  );
  const [breakMinutes, setBreakMinutes] = useState(String(user?.defaultBreakMinutes ?? 0));
  const [breakRules, setBreakRules] = useState<{ afterHours: string; breakMinutes: string }[]>(
    (user?.breakRules ?? []).map((r) => ({ afterHours: String(r.afterMinutes / 60), breakMinutes: String(r.breakMinutes) }))
  );
  const [workDays, setWorkDays] = useState<number[]>(user?.workDays ?? [1, 2, 3, 4, 5]);
  const [sickCountsAsWork, setSickCountsAsWork] = useState(user?.sickCountsAsWork ?? true);
  const [newPassword, setNewPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    api.tags.list().then(({ tags }) => setTags(tags));
  }, []);

  const WEEKDAYS: { value: number; label: string }[] = [
    { value: 1, label: "Mon" },
    { value: 2, label: "Tue" },
    { value: 3, label: "Wed" },
    { value: 4, label: "Thu" },
    { value: 5, label: "Fri" },
    { value: 6, label: "Sat" },
    { value: 7, label: "Sun" },
  ];

  function addBreakRule() {
    setBreakRules((prev) => [...prev, { afterHours: "", breakMinutes: "" }]);
  }

  function updateBreakRule(index: number, field: "afterHours" | "breakMinutes", value: string) {
    setBreakRules((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  function removeBreakRule(index: number) {
    setBreakRules((prev) => prev.filter((_, i) => i !== index));
  }

  function loadGermanBreakRulesPreset() {
    setBreakRules(GERMAN_BREAK_RULES.map((r) => ({ afterHours: String(r.afterMinutes / 60), breakMinutes: String(r.breakMinutes) })));
  }

  function breakRulesToPayload(): BreakRule[] | null {
    const parsed = breakRules
      .filter((r) => r.afterHours.trim() !== "" && r.breakMinutes.trim() !== "")
      .map((r) => ({
        afterMinutes: Math.round(Number(r.afterHours) * 60),
        breakMinutes: Math.round(Number(r.breakMinutes)),
      }))
      .filter((r) => Number.isFinite(r.afterMinutes) && r.afterMinutes >= 0 && Number.isFinite(r.breakMinutes) && r.breakMinutes >= 0);
    return parsed.length > 0 ? parsed : null;
  }

  function toggleWorkDay(day: number) {
    setWorkDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus(null);
    setSaving(true);
    try {
      const hoursPart = targetHours === "" ? 0 : Math.max(0, Math.floor(Number(targetHours) || 0));
      const minutesPart = targetMinutes === "" ? 0 : Math.max(0, Math.floor(Number(targetMinutes) || 0));
      const { user: updated } = await api.profile.update({
        displayName,
        dailyTargetMinutes:
          targetHours === "" && targetMinutes === "" ? null : hoursPart * 60 + minutesPart,
        defaultBreakMinutes: Math.max(0, Number(breakMinutes) || 0),
        breakRules: breakRulesToPayload(),
        workDays,
        dateFormat,
        sickCountsAsWork,
        ...(newPassword ? { password: newPassword } : {}),
      });
      setUser(updated);
      setNewPassword("");
      setStatus("Saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-lg space-y-6 px-4 py-6">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-neutral-100">My settings</h1>
        <form onSubmit={handleSubmit} className="panel space-y-4 p-6">
          <div>
            <label className="field-label-lg">Display name</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="field mt-1" />
          </div>
          <div>
            <label className="field-label-lg">Daily work-time target</label>
            <div className="mt-1 flex items-center gap-2">
              <div className="flex-1">
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 7"
                  value={targetHours}
                  onChange={(e) => setTargetHours(e.target.value)}
                  className="field"
                  aria-label="Hours"
                />
                <p className="mt-1 text-center text-xs text-slate-500 dark:text-neutral-400">hours</p>
              </div>
              <div className="flex-1">
                <input
                  type="number"
                  min="0"
                  max="59"
                  step="1"
                  placeholder="e.g. 36"
                  value={targetMinutes}
                  onChange={(e) => setTargetMinutes(e.target.value)}
                  className="field"
                  aria-label="Minutes"
                />
                <p className="mt-1 text-center text-xs text-slate-500 dark:text-neutral-400">minutes</p>
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
              Used to calculate your daily and weekly overtime. Leave both empty to disable overtime tracking.
            </p>
          </div>
          <div>
            <label className="field-label-lg">Default break / lunch time (minutes)</label>
            <input
              type="number"
              min="0"
              step="5"
              value={breakMinutes}
              onChange={(e) => setBreakMinutes(e.target.value)}
              className="field mt-1"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
              Applied to new time entries when clocking in. Once an entry has an end time, it's automatically
              replaced by the break rules below (if any are set) based on how long you worked.
            </p>
          </div>
          <div>
            <label className="field-label-lg">Break time rules</label>
            <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
              Tiered legal-minimum breaks, e.g. Germany requires 30min after 6h worked and 45min after 9h. When an
              entry's end time is set, the break is auto-filled from the highest matching tier (still editable
              afterward per entry).
            </p>
            <div className="mt-2 space-y-2">
              {breakRules.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="hours"
                    value={r.afterHours}
                    onChange={(e) => updateBreakRule(i, "afterHours", e.target.value)}
                    className="field w-24"
                    aria-label="After hours worked"
                  />
                  <span className="text-xs text-slate-500 dark:text-neutral-400">h worked →</span>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    placeholder="minutes"
                    value={r.breakMinutes}
                    onChange={(e) => updateBreakRule(i, "breakMinutes", e.target.value)}
                    className="field w-24"
                    aria-label="Break minutes required"
                  />
                  <span className="text-xs text-slate-500 dark:text-neutral-400">min break</span>
                  <button
                    type="button"
                    onClick={() => removeBreakRule(i)}
                    className="ml-auto text-xs font-medium text-slate-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-xs">
              <button type="button" onClick={addBreakRule} className="link-muted">
                + Add rule
              </button>
              <button type="button" onClick={loadGermanBreakRulesPreset} className="link-muted">
                Load German rules (6h → 30min, 9h → 45min)
              </button>
              {breakRules.length > 0 && (
                <button type="button" onClick={() => setBreakRules([])} className="link-muted">
                  Clear rules
                </button>
              )}
            </div>
          </div>
          <div>
            <label className="field-label-lg">Work days</label>
            <div className="mt-1 flex flex-wrap gap-2">
              {WEEKDAYS.map((d) => {
                const active = workDays.includes(d.value);
                return (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleWorkDay(d.value)}
                    aria-pressed={active}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      active
                        ? "bg-brand-600 text-white"
                        : "bg-slate-100 text-slate-500 dark:bg-neutral-800 dark:text-neutral-400"
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
              The days you're scheduled to work. Used to calculate weekly overtime.
            </p>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="field-label-lg">Sick days count as work time</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
                When enabled, a day marked Sick is credited with your daily target toward worked time and overtime.
                Vacation days always count.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSickCountsAsWork((v) => !v)}
              aria-pressed={sickCountsAsWork}
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${
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
          <div>
            <label className="field-label-lg">Date format</label>
            <select
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value as DateFormat)}
              className="field mt-1"
            >
              {DATE_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {DATE_FORMAT_LABELS[f]}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
              How dates are displayed throughout the app.
            </p>
          </div>
          <div>
            <label className="field-label-lg">New password</label>
            <input
              type="password"
              placeholder="Leave blank to keep current password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="field mt-1"
            />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {status && <p className="text-sm text-emerald-600 dark:text-emerald-400">{status}</p>}
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving..." : "Save settings"}
          </button>
        </form>

        <div className="panel p-6">
          <TagManager tags={tags} onChange={setTags} />
        </div>
      </main>
    </div>
  );
}
