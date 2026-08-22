-- TimeTrack initial schema
-- Kept deliberately simple/extendable: new columns can be added later via
-- new migration files without touching this one.

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')) DEFAULT 'user',
  daily_target_minutes INTEGER,           -- expected work time per day, used for overtime calc; NULL = no target
  default_break_minutes INTEGER NOT NULL DEFAULT 0,  -- applied to new entries automatically
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS time_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_date TEXT NOT NULL,           -- YYYY-MM-DD
  start_time TEXT NOT NULL,          -- ISO 8601 timestamp
  end_time TEXT,                     -- ISO 8601 timestamp, NULL while clocked in
  break_minutes INTEGER NOT NULL DEFAULT 0,  -- subtracted from start-end when computing total
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_time_entries_user_date ON time_entries(user_id, work_date);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
