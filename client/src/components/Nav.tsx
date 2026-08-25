import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import ThemeToggle from "./ThemeToggle";

function LogoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6 text-brand-600 dark:text-brand-400">
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3.5 2" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <circle cx="12" cy="8" r="4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 17l5-5-5-5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12H9" />
    </svg>
  );
}

const linkClass =
  "flex items-center gap-1.5 font-medium text-slate-600 hover:text-brand-600 dark:text-neutral-300 dark:hover:text-brand-400";

// Bottom tab bar items get an active state (current route highlighted) since
// there's room to spare and it's the primary way to navigate on mobile. The
// active tab gets a soft pill behind the icon, dock-style.
const bottomTabClass = ({ isActive }: { isActive: boolean }) =>
  `flex flex-1 flex-col items-center justify-center py-2.5 ${
    isActive ? "text-brand-600 dark:text-brand-400" : "text-slate-500 dark:text-neutral-400"
  }`;

const bottomTabIconWrapClass = (isActive: boolean) =>
  `flex items-center justify-center rounded-full px-3.5 py-1.5 transition-colors ${
    isActive ? "bg-brand-50 dark:bg-brand-500/10" : ""
  }`;

export default function Nav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <>
      {/* Full nav row — desktop and up. On mobile this is replaced entirely
          by the fixed tab bar at the bottom of the screen below. */}
      <nav className="hidden border-b border-slate-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 sm:block">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" aria-label="TimeTrack home">
            <LogoIcon />
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/calendar" className={linkClass} aria-label="Calendar" title="Calendar">
              <CalendarIcon />
            </Link>
            {user?.role === "admin" && (
              <Link to="/admin" className={linkClass} aria-label="Admin" title="Admin">
                <AdminIcon />
              </Link>
            )}
            <Link to="/settings" className={linkClass} aria-label="Settings" title="Settings">
              <SettingsIcon />
            </Link>
            <ThemeToggle />
            <button onClick={handleSignOut} className="btn-ghost" aria-label="Sign out" title="Sign out">
              <SignOutIcon />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile tab bar — a floating rounded dock inset from the screen
          edges, thumb-reach navigation instead of a top header. index.css
          pads the page body so this never overlaps scrolled content. */}
      <nav
        className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-20 flex items-stretch rounded-2xl border border-slate-200 bg-white/95 shadow-lg shadow-slate-900/10 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95 dark:shadow-black/30 sm:hidden"
        aria-label="Primary"
      >
        <Link to="/" className={bottomTabClass({ isActive: false })} aria-label="TimeTrack home" title="Home">
          <span className={bottomTabIconWrapClass(false)}>
            <LogoIcon />
          </span>
        </Link>
        <NavLink to="/calendar" className={bottomTabClass} aria-label="Calendar" title="Calendar">
          {({ isActive }) => (
            <span className={bottomTabIconWrapClass(isActive)}>
              <CalendarIcon />
            </span>
          )}
        </NavLink>
        {user?.role === "admin" && (
          <NavLink to="/admin" className={bottomTabClass} aria-label="Admin" title="Admin">
            {({ isActive }) => (
              <span className={bottomTabIconWrapClass(isActive)}>
                <AdminIcon />
              </span>
            )}
          </NavLink>
        )}
        <NavLink to="/settings" className={bottomTabClass} aria-label="Settings" title="Settings">
          {({ isActive }) => (
            <span className={bottomTabIconWrapClass(isActive)}>
              <SettingsIcon />
            </span>
          )}
        </NavLink>
        <div className="flex flex-1 flex-col items-center justify-center py-2.5 text-slate-500 dark:text-neutral-400">
          <span className={bottomTabIconWrapClass(false)}>
            <ThemeToggle />
          </span>
        </div>
        <button onClick={handleSignOut} className={bottomTabClass({ isActive: false })} aria-label="Sign out" title="Sign out">
          <span className={bottomTabIconWrapClass(false)}>
            <SignOutIcon />
          </span>
        </button>
      </nav>
    </>
  );
}
