import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import ThemeToggle from "../components/ThemeToggle";

export default function Setup() {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { refresh } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      await api.setup.create({ username, password, displayName });
      await refresh();
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="panel w-full max-w-md p-8">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Welcome to TimeTrack</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          This is the first launch of the application. Create the administrator account to get started.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="field-label-lg">Username</label>
            <input required value={username} onChange={(e) => setUsername(e.target.value)} className="field mt-1" />
          </div>
          <div>
            <label className="field-label-lg">Display name</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={username || "Optional"}
              className="field mt-1"
            />
          </div>
          <div>
            <label className="field-label-lg">Password</label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field mt-1"
            />
          </div>
          <div>
            <label className="field-label-lg">Confirm password</label>
            <input
              required
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="field mt-1"
            />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? "Creating..." : "Create admin account"}
          </button>
        </form>
      </div>
    </div>
  );
}
