import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { User } from "../api/types";
import { useAuth } from "../auth/AuthContext";

export default function UserManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { user: currentUser } = useAuth();

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [creating, setCreating] = useState(false);

  async function load() {
    const { users } = await api.users.list();
    setUsers(users);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      await api.users.create({ username, password, displayName, role });
      setUsername("");
      setDisplayName("");
      setPassword("");
      setRole("user");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(u: User) {
    await api.users.update(u.id, { isActive: !u.isActive });
    await load();
  }

  async function toggleRole(u: User) {
    await api.users.update(u.id, { role: u.role === "admin" ? "user" : "admin" });
    await load();
  }

  async function resetPassword(u: User) {
    const next = prompt(`New password for ${u.username}:`);
    if (!next) return;
    await api.users.update(u.id, { password: next });
  }

  async function editDailyTarget(u: User) {
    const current = u.dailyTargetMinutes != null ? String(u.dailyTargetMinutes / 60) : "";
    const next = prompt(`Daily work-time target for ${u.username}, in hours (blank = no target):`, current);
    if (next === null) return;
    const dailyTargetMinutes = next.trim() === "" ? null : Math.round(Number(next) * 60);
    if (dailyTargetMinutes !== null && (!Number.isFinite(dailyTargetMinutes) || dailyTargetMinutes < 0)) {
      alert("Enter a non-negative number of hours, or leave blank.");
      return;
    }
    await api.users.update(u.id, { dailyTargetMinutes });
    await load();
  }

  async function editDefaultBreak(u: User) {
    const next = prompt(`Default break/lunch time for ${u.username}, in minutes:`, String(u.defaultBreakMinutes));
    if (next === null) return;
    const defaultBreakMinutes = Math.round(Number(next));
    if (!Number.isFinite(defaultBreakMinutes) || defaultBreakMinutes < 0) {
      alert("Enter a non-negative number of minutes.");
      return;
    }
    await api.users.update(u.id, { defaultBreakMinutes });
    await load();
  }

  async function removeUser(u: User) {
    if (!confirm(`Delete user "${u.username}"? This also deletes their time entries.`)) return;
    await api.users.remove(u.id);
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="panel p-5">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Add user</h2>
        <form onSubmit={handleCreate} className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="field-label">Username</label>
            <input required value={username} onChange={(e) => setUsername(e.target.value)} className="field-sm mt-1" />
          </div>
          <div>
            <label className="field-label">Display name</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="field-sm mt-1" />
          </div>
          <div>
            <label className="field-label">Password</label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field-sm mt-1"
            />
          </div>
          <div>
            <label className="field-label">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "user")}
              className="field-sm mt-1"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button type="submit" disabled={creating} className="btn-primary">
            {creating ? "Adding..." : "Add user"}
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>

      <div className="panel overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">Username</th>
              <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">Display name</th>
              <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">Role</th>
              <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">Status</th>
              <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">Daily target</th>
              <th className="px-3 py-2.5 text-left font-medium text-slate-500 dark:text-slate-400">Break</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100">{u.username}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{u.displayName}</td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => toggleRole(u)}
                    disabled={u.id === currentUser?.id}
                    className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    {u.role}
                  </button>
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => toggleActive(u)}
                    disabled={u.id === currentUser?.id}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium disabled:opacity-50 ${
                      u.isActive
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                        : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {u.isActive ? "Active" : "Disabled"}
                  </button>
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => editDailyTarget(u)}
                    className="text-slate-600 hover:text-brand-600 dark:text-slate-300 dark:hover:text-brand-400"
                  >
                    {u.dailyTargetMinutes != null ? `${u.dailyTargetMinutes / 60}h/day` : "Not set"}
                  </button>
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => editDefaultBreak(u)}
                    className="text-slate-600 hover:text-brand-600 dark:text-slate-300 dark:hover:text-brand-400"
                  >
                    {u.defaultBreakMinutes} min
                  </button>
                </td>
                <td className="space-x-3 px-3 py-2 text-right">
                  <button onClick={() => resetPassword(u)} className="link-muted">
                    Reset password
                  </button>
                  <button
                    onClick={() => removeUser(u)}
                    disabled={u.id === currentUser?.id}
                    className="text-xs font-medium text-slate-400 hover:text-red-600 disabled:opacity-50 dark:text-slate-500 dark:hover:text-red-400"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
