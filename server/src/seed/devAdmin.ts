import bcrypt from "bcryptjs";
import { db } from "../db/db.js";

/**
 * Seeds a "dev"/"dev" admin account for local development, and marks setup
 * complete so the dev script never shows the first-launch wizard. Only runs
 * when DEV_SEED_ADMIN=true (set by dev.ps1) — never in production.
 */
export function seedDevAdmin() {
  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get("dev");
  if (existing) return;

  const passwordHash = bcrypt.hashSync("dev", 10);
  db.prepare(
    "INSERT INTO users (username, password_hash, display_name, role, daily_target_minutes, default_break_minutes, is_active) VALUES ('dev', ?, 'Dev Admin', 'admin', 480, 30, 1)"
  ).run(passwordHash);

  db.prepare(
    "INSERT INTO settings (key, value) VALUES ('setup_complete', 'true') ON CONFLICT(key) DO UPDATE SET value = 'true'"
  ).run();

  console.log("[dev] Seeded admin user 'dev' / 'dev'");
}
