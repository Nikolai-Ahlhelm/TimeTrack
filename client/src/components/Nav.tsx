import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import ThemeToggle from "./ThemeToggle";

export default function Nav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link to="/" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          TimeTrack
        </Link>
        <div className="flex items-center gap-4 text-sm">
          {user?.role === "admin" && (
            <Link to="/admin" className="font-medium text-slate-600 hover:text-brand-600 dark:text-slate-300 dark:hover:text-brand-400">
              Admin
            </Link>
          )}
          <Link to="/settings" className="font-medium text-slate-600 hover:text-brand-600 dark:text-slate-300 dark:hover:text-brand-400">
            Settings
          </Link>
          <span className="text-slate-500 dark:text-slate-400">{user?.displayName}</span>
          <ThemeToggle />
          <button
            onClick={async () => {
              await logout();
              navigate("/login", { replace: true });
            }}
            className="btn-ghost"
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
}
