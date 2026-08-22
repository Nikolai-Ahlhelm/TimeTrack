import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATA_DIR = process.env.DATA_DIR ?? path.resolve(__dirname, "../../../data");
const DB_PATH = process.env.DB_PATH ?? path.join(DATA_DIR, "timetrack.db");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function columnExists(table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.some((r) => r.name === column);
}

function addColumnIfMissing(table: string, column: string, definition: string) {
  if (!columnExists(table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

/**
 * schema.sql only covers brand-new databases (CREATE TABLE IF NOT EXISTS).
 * Additive column changes for existing databases are applied here so
 * upgrades never require a manual migration step.
 */
function applyIncrementalMigrations() {
  addColumnIfMissing("users", "daily_target_minutes", "INTEGER");
  addColumnIfMissing("users", "default_break_minutes", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing("time_entries", "break_minutes", "INTEGER NOT NULL DEFAULT 0");
}

export function runMigrations() {
  const schemaPath = path.join(__dirname, "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf-8");
  db.exec(schema);
  applyIncrementalMigrations();

  // Ensure a settings row exists to track first-launch setup state.
  const setupRow = db.prepare("SELECT value FROM settings WHERE key = 'setup_complete'").get();
  if (!setupRow) {
    db.prepare("INSERT INTO settings (key, value) VALUES ('setup_complete', 'false')").run();
  }
}
