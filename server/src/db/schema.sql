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
  break_rules TEXT,  -- JSON array of {afterMinutes, breakMinutes} tiers; NULL = use default_break_minutes only
  work_days TEXT NOT NULL DEFAULT '1,2,3,4,5',  -- comma-separated ISO weekdays (1=Mon..7=Sun) the user is scheduled to work
  date_format TEXT NOT NULL DEFAULT 'YYYY-MM-DD',  -- preferred display format for dates, e.g. 'DD.MM.YYYY'
  sick_counts_as_work INTEGER NOT NULL DEFAULT 1,  -- whether a Sick day is credited with this user's daily target toward worked time/overtime; Vacation always counts
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

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#64748b',  -- hex color used for the tag pill
  icon TEXT,  -- optional short emoji shown in the tag's colored circle on the calendar
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS entry_tags (
  entry_id INTEGER NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (entry_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_entry_tags_tag ON entry_tags(tag_id);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- A whole-day label (Sick / Vacation) for a user's calendar day. Mutually
-- exclusive with time_entries on the same date — enforced in the routes, not
-- via a DB constraint, since it needs a friendly error message.
CREATE TABLE IF NOT EXISTS day_labels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_date TEXT NOT NULL,           -- YYYY-MM-DD
  status TEXT NOT NULL CHECK (status IN ('sick', 'vacation')),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, work_date)
);
