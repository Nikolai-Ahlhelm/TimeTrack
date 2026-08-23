import { Router } from "express";
import { db } from "../db/db.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { DAY_STATUSES, toPublicDayLabel, type DayLabelRow } from "../types.js";

// Whole-day Sick/Vacation labels. Mutually exclusive with time_entries on the
// same date: you can't label a day that already has entries, and you can't
// clock in/edit an entry onto a day that's already labeled.
export const dayLabelsRouter = Router();
dayLabelsRouter.use(requireAuth);

function hasEntriesOn(userId: number, workDate: string): boolean {
  return !!db.prepare("SELECT 1 FROM time_entries WHERE user_id = ? AND work_date = ? LIMIT 1").get(userId, workDate);
}

dayLabelsRouter.get("/", (req: AuthedRequest, res) => {
  const { from, to } = req.query;
  const clauses = ["user_id = ?"];
  const params: unknown[] = [req.user!.id];
  if (typeof from === "string" && from) {
    clauses.push("work_date >= ?");
    params.push(from);
  }
  if (typeof to === "string" && to) {
    clauses.push("work_date <= ?");
    params.push(to);
  }
  const rows = db
    .prepare(`SELECT * FROM day_labels WHERE ${clauses.join(" AND ")} ORDER BY work_date`)
    .all(...params) as DayLabelRow[];
  res.json({ dayLabels: rows.map(toPublicDayLabel) });
});

dayLabelsRouter.put("/:workDate", (req: AuthedRequest, res) => {
  const { workDate } = req.params;
  const { status, note } = req.body ?? {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
    return res.status(400).json({ error: "Invalid date" });
  }
  if (!DAY_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${DAY_STATUSES.join(", ")}` });
  }
  if (hasEntriesOn(req.user!.id, workDate)) {
    return res.status(409).json({ error: "This day already has time entries — remove them first" });
  }

  db.prepare(
    `INSERT INTO day_labels (user_id, work_date, status, note) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, work_date) DO UPDATE SET status = excluded.status, note = excluded.note, updated_at = datetime('now')`
  ).run(req.user!.id, workDate, status, note ?? null);

  const row = db
    .prepare("SELECT * FROM day_labels WHERE user_id = ? AND work_date = ?")
    .get(req.user!.id, workDate) as DayLabelRow;
  res.json({ dayLabel: toPublicDayLabel(row) });
});

dayLabelsRouter.delete("/:workDate", (req: AuthedRequest, res) => {
  const { workDate } = req.params;
  db.prepare("DELETE FROM day_labels WHERE user_id = ? AND work_date = ?").run(req.user!.id, workDate);
  res.json({ ok: true });
});
