import { useState } from "react";
import Nav from "../components/Nav";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";

export default function Settings() {
  const { user, setUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [targetHours, setTargetHours] = useState(
    user?.dailyTargetMinutes != null ? String(user.dailyTargetMinutes / 60) : ""
  );
  const [breakMinutes, setBreakMinutes] = useState(String(user?.defaultBreakMinutes ?? 0));
  const [newPassword, setNewPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus(null);
    setSaving(true);
    try {
      const { user: updated } = await api.profile.update({
        displayName,
        dailyTargetMinutes: targetHours === "" ? null : Math.round(Number(targetHours) * 60),
        defaultBreakMinutes: Math.max(0, Number(breakMinutes) || 0),
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
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">My settings</h1>
        <form onSubmit={handleSubmit} className="panel space-y-4 p-6">
          <div>
            <label className="field-label-lg">Display name</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="field mt-1" />
          </div>
          <div>
            <label className="field-label-lg">Daily work-time target (hours)</label>
            <input
              type="number"
              min="0"
              step="0.25"
              placeholder="e.g. 8"
              value={targetHours}
              onChange={(e) => setTargetHours(e.target.value)}
              className="field mt-1"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Used to calculate your daily and weekly overtime. Leave empty to disable overtime tracking.
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
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Automatically applied to new time entries and subtracted from the total. You can still adjust it per
              entry in the table.
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
      </main>
    </div>
  );
}
