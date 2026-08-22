import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db/db.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { toPublicUser, type UserRow } from "../types.js";

// Self-service settings: a user can update their own display name, daily
// work-time target (for overtime calculation), default break/lunch time,
// and password — but not their username, role, or active status.
export const profileRouter = Router();
profileRouter.use(requireAuth);

profileRouter.patch("/", (req: AuthedRequest, res) => {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user!.id) as UserRow;

  const { displayName, dailyTargetMinutes, defaultBreakMinutes, password } = req.body ?? {};

  if (dailyTargetMinutes !== undefined && dailyTargetMinutes !== null) {
    if (!Number.isFinite(Number(dailyTargetMinutes)) || Number(dailyTargetMinutes) < 0) {
      return res.status(400).json({ error: "Daily target must be a non-negative number of minutes" });
    }
  }
  if (defaultBreakMinutes !== undefined) {
    if (!Number.isFinite(Number(defaultBreakMinutes)) || Number(defaultBreakMinutes) < 0) {
      return res.status(400).json({ error: "Default break must be a non-negative number of minutes" });
    }
  }
  if (password !== undefined && String(password).length < 4) {
    return res.status(400).json({ error: "Password must be at least 4 characters" });
  }

  const nextDisplayName = displayName ?? row.display_name;
  const nextDailyTarget = dailyTargetMinutes === undefined ? row.daily_target_minutes : dailyTargetMinutes;
  const nextDefaultBreak = defaultBreakMinutes === undefined ? row.default_break_minutes : Number(defaultBreakMinutes);
  const nextPasswordHash = password ? bcrypt.hashSync(password, 10) : row.password_hash;

  db.prepare(
    "UPDATE users SET display_name = ?, daily_target_minutes = ?, default_break_minutes = ?, password_hash = ? WHERE id = ?"
  ).run(nextDisplayName, nextDailyTarget, nextDefaultBreak, nextPasswordHash, req.user!.id);

  const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user!.id) as UserRow;
  res.json({ user: toPublicUser(updated) });
});
