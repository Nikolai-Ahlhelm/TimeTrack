import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db/db.js";
import { requireAdmin, requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { toPublicUser, type UserRow } from "../types.js";

export const usersRouter = Router();
usersRouter.use(requireAuth, requireAdmin);

usersRouter.get("/", (_req, res) => {
  const rows = db.prepare("SELECT * FROM users ORDER BY username ASC").all() as UserRow[];
  res.json({ users: rows.map(toPublicUser) });
});

usersRouter.post("/", (req, res) => {
  const { username, password, displayName, role, dailyTargetMinutes, defaultBreakMinutes } = req.body ?? {};
  if (!username || !password) {
    return res.status(400).json({ error: "username and password are required" });
  }
  if (role && role !== "admin" && role !== "user") {
    return res.status(400).json({ error: "role must be 'admin' or 'user'" });
  }

  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (existing) {
    return res.status(409).json({ error: "Username already taken" });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare(
      "INSERT INTO users (username, password_hash, display_name, role, daily_target_minutes, default_break_minutes, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)"
    )
    .run(
      username,
      passwordHash,
      displayName || username,
      role || "user",
      dailyTargetMinutes ?? null,
      defaultBreakMinutes ?? 0
    );

  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid) as UserRow;
  res.status(201).json({ user: toPublicUser(row) });
});

usersRouter.patch("/:id", (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
  if (!row) return res.status(404).json({ error: "User not found" });

  const { displayName, role, dailyTargetMinutes, defaultBreakMinutes, isActive, password } = req.body ?? {};

  if (row.id === req.user!.id && role && role !== "admin") {
    return res.status(400).json({ error: "You cannot remove your own admin role" });
  }
  if (row.id === req.user!.id && isActive === false) {
    return res.status(400).json({ error: "You cannot deactivate your own account" });
  }

  const nextDisplayName = displayName ?? row.display_name;
  const nextRole = role ?? row.role;
  const nextDailyTarget = dailyTargetMinutes === undefined ? row.daily_target_minutes : dailyTargetMinutes;
  const nextDefaultBreak = defaultBreakMinutes === undefined ? row.default_break_minutes : defaultBreakMinutes;
  const nextIsActive = isActive === undefined ? row.is_active : isActive ? 1 : 0;
  const nextPasswordHash = password ? bcrypt.hashSync(password, 10) : row.password_hash;

  db.prepare(
    "UPDATE users SET display_name = ?, role = ?, daily_target_minutes = ?, default_break_minutes = ?, is_active = ?, password_hash = ? WHERE id = ?"
  ).run(nextDisplayName, nextRole, nextDailyTarget, nextDefaultBreak, nextIsActive, nextPasswordHash, id);

  const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow;
  res.json({ user: toPublicUser(updated) });
});

usersRouter.delete("/:id", (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (id === req.user!.id) {
    return res.status(400).json({ error: "You cannot delete your own account" });
  }
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  if (!row) return res.status(404).json({ error: "User not found" });
  db.prepare("DELETE FROM users WHERE id = ?").run(id);
  res.json({ ok: true });
});
