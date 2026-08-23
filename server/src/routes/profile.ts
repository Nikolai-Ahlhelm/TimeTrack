import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db/db.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { DATE_FORMATS, toPublicUser, type UserRow } from "../types.js";
import { serializeBreakRules, validateBreakRules } from "../lib/breakRules.js";

// Self-service settings: a user can update their own display name, daily
// work-time target (for overtime calculation), default break/lunch time,
// tiered break rules, scheduled work days, preferred date display format,
// and password — but not their username, role, or active status.
export const profileRouter = Router();
profileRouter.use(requireAuth);

profileRouter.patch("/", (req: AuthedRequest, res) => {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user!.id) as UserRow;

  const { displayName, dailyTargetMinutes, defaultBreakMinutes, breakRules, workDays, dateFormat, password } =
    req.body ?? {};

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
  let nextBreakRulesJson = row.break_rules;
  if (breakRules !== undefined) {
    try {
      nextBreakRulesJson = serializeBreakRules(validateBreakRules(breakRules));
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : "Invalid break rules" });
    }
  }
  let nextWorkDaysStr = row.work_days;
  if (workDays !== undefined) {
    if (
      !Array.isArray(workDays) ||
      workDays.some((d: unknown) => !Number.isInteger(d) || (d as number) < 1 || (d as number) > 7)
    ) {
      return res.status(400).json({ error: "Work days must be an array of weekdays (1=Monday..7=Sunday)" });
    }
    nextWorkDaysStr = [...new Set(workDays as number[])].sort((a, b) => a - b).join(",");
  }
  if (dateFormat !== undefined && !(DATE_FORMATS as readonly string[]).includes(dateFormat)) {
    return res.status(400).json({ error: `Date format must be one of: ${DATE_FORMATS.join(", ")}` });
  }
  if (password !== undefined && String(password).length < 4) {
    return res.status(400).json({ error: "Password must be at least 4 characters" });
  }

  const nextDisplayName = displayName ?? row.display_name;
  const nextDailyTarget = dailyTargetMinutes === undefined ? row.daily_target_minutes : dailyTargetMinutes;
  const nextDefaultBreak = defaultBreakMinutes === undefined ? row.default_break_minutes : Number(defaultBreakMinutes);
  const nextDateFormat = dateFormat === undefined ? row.date_format : dateFormat;
  const nextPasswordHash = password ? bcrypt.hashSync(password, 10) : row.password_hash;

  db.prepare(
    "UPDATE users SET display_name = ?, daily_target_minutes = ?, default_break_minutes = ?, break_rules = ?, work_days = ?, date_format = ?, password_hash = ? WHERE id = ?"
  ).run(
    nextDisplayName,
    nextDailyTarget,
    nextDefaultBreak,
    nextBreakRulesJson,
    nextWorkDaysStr,
    nextDateFormat,
    nextPasswordHash,
    req.user!.id
  );

  const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user!.id) as UserRow;
  res.json({ user: toPublicUser(updated) });
});
