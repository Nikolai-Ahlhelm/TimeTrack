# TimeTrack — Project Plan & Reference

This document describes what TimeTrack is, how it's built, and how to extend
it. It's meant to be the single reference for anyone (human or agent) picking
up work on this project.

## 1. Purpose

A self-hosted, multi-user time-tracking web app. Each user clocks in/out of
their working day, sees a table of past days with computed total hours, can
edit/filter/sort/search that table, and export it to CSV. An admin manages
user accounts and application settings. First launch walks the operator
through creating the admin account.

## 2. Architecture

| Layer      | Choice                                                          |
|------------|------------------------------------------------------------------|
| Backend    | Node.js 20 + TypeScript + Express                                |
| Database   | SQLite (`better-sqlite3`), file-based, single volume              |
| Auth       | JWT in an httpOnly cookie, `bcryptjs` password hashing            |
| Frontend   | React + Vite + TypeScript + Tailwind CSS + React Router           |
| Deployment | Single Docker image — Express serves the built React app and the `/api` routes on one port |

**Why a single deployable?** No reverse proxy, no CORS in production, one
container to run and one volume to back up. In development, Vite's dev
server runs separately (for hot reload) and proxies `/api` to the Express
backend.

```
TimeTrack/
├── server/            Express + TypeScript API, SQLite access
│   └── src/
│       ├── db/         schema.sql, migration runner (+ incremental ALTER
│       │                TABLE migrations), db connection
│       ├── middleware/ auth (JWT verification), admin guard
│       ├── routes/     setup, auth, entries, users, settings, profile
│       ├── lib/        csv export, shared helpers
│       ├── seed/       dev admin seeding (dev mode only)
│       └── index.ts    app bootstrap; serves client/dist in production
├── client/            React + Vite + Tailwind frontend
│   └── src/
│       ├── pages/       Setup, Login, Dashboard, Admin, Settings
│       ├── components/  ClockButton, TimeTable, EditableCell, FilterBar,
│       │                ExportButton, UserManager, Nav, ThemeToggle
│       ├── api/         typed fetch client
│       ├── auth/        AuthContext (current user, setup status)
│       ├── theme/       ThemeContext (light/dark, persisted in localStorage)
│       ├── lib/time.ts  timestamp <-> local date/time helpers
│       └── index.css    shared design tokens (see below)
├── data/              SQLite database file (gitignored, Docker volume)
├── dev.ps1            Start in development mode (seeds dev/dev admin)
├── start-prod.ps1     Build and start in production mode
├── Dockerfile         Multi-stage build → single runtime image
├── docker-compose.yml Local convenience run with a persistent volume
└── .github/workflows/docker-publish.yml   Build & push image to GHCR on push to main
```

### Design system & dark mode
`client/src/index.css` defines a small set of shared classes (`@layer
components`) so spacing/radius/color choices stay unified instead of being
re-typed per component:
- `.panel` — the shared card surface (`rounded-xl`, ring, shadow). Padding is
  a deliberate 3-tier scale by content type: `p-5` for compact panels (stat
  cards, filter bar, tables), `p-6` for in-app forms (Settings, Admin "add
  user"), `p-8` for standalone auth cards (Login, Setup).
- `.field` / `.field-sm` — form inputs (standalone forms vs. compact inline
  controls), `.field-label` / `.field-label-lg` — matching label sizes.
- `.btn-primary` / `.btn-secondary` / `.btn-ghost`, `.link-muted`.
- Radius tiers are otherwise plain Tailwind utilities used consistently:
  `rounded-xl` (panels), `rounded-md` (controls/buttons), `rounded-full`
  (pills, the clock button).

Dark mode uses Tailwind's `class` strategy. `ThemeContext`
(`client/src/theme/ThemeContext.tsx`) toggles a `dark` class on `<html>` and
persists the choice in `localStorage` (defaulting to the OS preference); an
inline script in `index.html` applies it before first paint to avoid a
flash. `ThemeToggle` (sun/moon icon) lives in `Nav` for logged-in pages and
top-right on Login/Setup, which have no nav bar.

## 3. Data model

```
users            id, username, password_hash, display_name, role (admin|user),
                 daily_target_minutes (nullable — expected work time per day,
                 used for overtime), default_break_minutes (applied to new
                 entries automatically), is_active, created_at

time_entries     id, user_id, work_date, start_time, end_time (nullable while
                 clocked in), break_minutes (subtracted from the total),
                 note, created_at, updated_at

settings         key/value store (currently: setup_complete)
```

Total hours are **derived at query time** as `(end - start) - break_minutes`
(floored at zero) rather than stored, so the row shape stays simple and
correct by construction. `schema.sql` (`CREATE TABLE IF NOT EXISTS`) covers
brand-new databases; `db/db.ts` also runs `applyIncrementalMigrations()` on
every startup, which adds any missing columns via `ALTER TABLE` so existing
databases upgrade automatically without a manual migration step.

### Overtime & break time
- Each user sets their own **daily work-time target** (in hours) and
  **default break/lunch time** (in minutes) in **Settings** (`/settings`,
  self-service via `PATCH /api/profile`). Admins can also set these for
  other users from the Admin panel.
- The default break is applied automatically when a new entry is started
  and can still be edited per entry in the table (`Break (min)` column).
- Overtime is shown on the dashboard as "+/- vs. target" for **today**
  (`today's total − daily target`) and **this week** (`week's total −
  daily target × distinct days worked that week`, so days off don't count
  against the user). It's hidden entirely if no target is set.

### Designed extension points
- **Weekly/monthly overtime rollups:** the per-day overtime math already
  exists client-side in `client/src/pages/Dashboard.tsx`; a persisted
  rollup (e.g. a `weekly_summaries` table) can be added later if historical
  reporting beyond the current view is needed.
- **Additional per-entry fields:** add nullable columns to `time_entries`;
  the frontend `TimeTable` renders columns from a config-driven list
  (`client/src/components/TimeTable.tsx`), so add a column there and an
  `EditableCell` for it.
- **New settings:** just read/write a new key via `PATCH /api/settings` —
  no migration required since `settings` is a key/value table.
- **Multi-day migrations:** extend `applyIncrementalMigrations()` in
  `server/src/db/db.ts`, or add versioned `.sql` files once schema changes
  get more complex than additive columns.

## 4. API summary

| Method & path                     | Purpose                                   | Auth        |
|-----------------------------------|--------------------------------------------|-------------|
| `GET /api/setup/status`           | Has the admin account been created yet?    | Public      |
| `POST /api/setup`                 | Create the first admin account             | Public (once) |
| `POST /api/auth/login`            | Sign in                                    | Public      |
| `POST /api/auth/logout`           | Sign out                                   | Session     |
| `GET /api/auth/me`                | Current user                               | Session     |
| `GET /api/entries`                | List entries (`from`, `to`, `q`, `sort`)   | Session     |
| `GET /api/entries/today-open`     | The current open (clocked-in) entry        | Session     |
| `POST /api/entries/start`         | Clock in                                   | Session     |
| `POST /api/entries/stop`          | Clock out                                  | Session     |
| `PATCH /api/entries/:id`          | Edit a single entry (inline cell edits)    | Session     |
| `DELETE /api/entries/:id`         | Delete an entry                            | Session     |
| `GET /api/entries/export.csv`     | CSV export of the current filtered view    | Session     |
| `GET/POST/PATCH/DELETE /api/users`| Manage user accounts, incl. daily target & default break for others | Admin |
| `PATCH /api/profile`              | Self-service: display name, own daily target, own default break, password | Session |
| `GET/PATCH /api/settings`         | App-wide settings                          | Admin       |

## 5. Running the app

### Development (Windows / PowerShell)
```powershell
./dev.ps1
```
Installs dependencies if missing, seeds a `dev` / `dev` admin account, and
runs the backend (hot reload, port 4000) and Vite dev server (port 5173,
proxying `/api`) side by side. Open **http://localhost:5173**.

### Production, without Docker (Windows / PowerShell)
```powershell
$env:JWT_SECRET = "<a long random secret>"
./start-prod.ps1
```
Builds the client and server, then serves everything from
**http://localhost:4000**. A fresh database triggers the first-launch admin
setup wizard.

### Production, with Docker
```bash
docker build -t timetrack .
docker run -d -p 4000:4000 -e JWT_SECRET="<a long random secret>" \
  -v timetrack-data:/app/data timetrack
```
or via Compose (reads `JWT_SECRET` from your shell or a `.env` file):
```bash
JWT_SECRET="<a long random secret>" docker compose up -d --build
```

### CI/CD
`.github/workflows/docker-publish.yml` builds the Docker image and pushes it
to GHCR (`ghcr.io/<owner>/<repo>:latest` and `:<short-sha>`) on every push to
`main`. No extra secrets are required — it uses the repo's built-in
`GITHUB_TOKEN`.

## 6. Environment variables

| Variable        | Default (dev)                     | Notes                                   |
|------------------|-----------------------------------|------------------------------------------|
| `PORT`           | `4000`                            | Server port                              |
| `JWT_SECRET`     | insecure dev default              | **Must** be set to a real secret in prod |
| `DATA_DIR`       | `<repo>/data`                     | Where the SQLite file lives              |
| `NODE_ENV`       | `development` / `production`      | Toggles static-file serving, cookie security |
| `DEV_SEED_ADMIN` | `true` (dev only)                 | Seeds the `dev`/`dev` admin              |
| `COOKIE_SECURE`  | `true` in prod                    | Set to `false` to allow non-HTTPS prod testing |
| `CLIENT_ORIGIN`  | `http://localhost:5173`           | Dev-mode CORS origin for the Vite server |

## 7. Not yet implemented (future work)
- Monthly/yearly overtime rollups and historical reporting beyond the
  current dashboard view (daily/weekly overtime is implemented — see §3).
- Bulk entry editing / multi-select delete.
- Per-user CSV export scoped by an admin (currently CSV export is always the
  logged-in user's own entries).
- Password reset via email (currently admin-only manual reset).
