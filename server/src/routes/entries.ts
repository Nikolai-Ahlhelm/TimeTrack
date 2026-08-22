import { Router } from "express";
import { db } from "../db/db.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { entriesToCsv } from "../lib/csv.js";
import { toPublicEntry, type TimeEntryRow } from "../types.js";

export const entriesRouter = Router();
entriesRouter.use(requireAuth);

const SORTABLE: Record<string, string> = {
  date_desc: "work_date DESC, start_time DESC",
  date_asc: "work_date ASC, start_time ASC",
  hours_desc: "total_minutes DESC",
  hours_asc: "total_minutes ASC",
};

function buildQuery(userId: number, query: Record<string, unknown>) {
  const { from, to, q, sort } = query;
  const clauses = ["user_id = ?"];
  const params: unknown[] = [userId];

  if (typeof from === "string" && from) {
    clauses.push("work_date >= ?");
    params.push(from);
  }
  if (typeof to === "string" && to) {
    clauses.push("work_date <= ?");
    params.push(to);
  }
  if (typeof q === "string" && q) {
    clauses.push("(note LIKE ? OR work_date LIKE ?)");
    params.push(`%${q}%`, `%${q}%`);
  }

  const orderBy = SORTABLE[typeof sort === "string" ? sort : ""] ?? SORTABLE.date_desc;

  const sql = `
    SELECT *,
      CASE WHEN end_time IS NOT NULL
        THEN MAX(0, CAST((julianday(end_time) - julianday(start_time)) * 24 * 60 AS INTEGER) - break_minutes)
        ELSE NULL
      END AS total_minutes
    FROM time_entries
    WHERE ${clauses.join(" AND ")}
    ORDER BY ${orderBy}
  `;
  return { sql, params };
}

entriesRouter.get("/", (req: AuthedRequest, res) => {
  const { sql, params } = buildQuery(req.user!.id, req.query as Record<string, unknown>);
  const rows = db.prepare(sql).all(...params) as TimeEntryRow[];
  res.json({ entries: rows.map(toPublicEntry) });
});

entriesRouter.get("/export.csv", (req: AuthedRequest, res) => {
  const { sql, params } = buildQuery(req.user!.id, req.query as Record<string, unknown>);
  const rows = db.prepare(sql).all(...params) as TimeEntryRow[];
  const csv = entriesToCsv(rows.map(toPublicEntry), false, new Map());
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="timetrack-export-${Date.now()}.csv"`);
  res.send(csv);
});

entriesRouter.get("/today-open", (req: AuthedRequest, res) => {
  const row = db
    .prepare("SELECT * FROM time_entries WHERE user_id = ? AND end_time IS NULL ORDER BY start_time DESC LIMIT 1")
    .get(req.user!.id) as TimeEntryRow | undefined;
  res.json({ entry: row ? toPublicEntry(row) : null });
});

entriesRouter.post("/start", (req: AuthedRequest, res) => {
  const openEntry = db
    .prepare("SELECT id FROM time_entries WHERE user_id = ? AND end_time IS NULL")
    .get(req.user!.id);
  if (openEntry) {
    return res.status(409).json({ error: "You already have an open time entry" });
  }

  const now = new Date();
  const workDate = now.toISOString().slice(0, 10);
  const startTime = now.toISOString();

  const info = db
    .prepare("INSERT INTO time_entries (user_id, work_date, start_time, break_minutes) VALUES (?, ?, ?, ?)")
    .run(req.user!.id, workDate, startTime, req.user!.defaultBreakMinutes);

  const row = db.prepare("SELECT * FROM time_entries WHERE id = ?").get(info.lastInsertRowid) as TimeEntryRow;
  res.status(201).json({ entry: toPublicEntry(row) });
});

entriesRouter.post("/stop", (req: AuthedRequest, res) => {
  const openEntry = db
    .prepare("SELECT * FROM time_entries WHERE user_id = ? AND end_time IS NULL ORDER BY start_time DESC LIMIT 1")
    .get(req.user!.id) as TimeEntryRow | undefined;
  if (!openEntry) {
    return res.status(409).json({ error: "No open time entry to stop" });
  }

  const endTime = new Date().toISOString();
  db.prepare("UPDATE time_entries SET end_time = ?, updated_at = datetime('now') WHERE id = ?").run(
    endTime,
    openEntry.id
  );

  const row = db.prepare("SELECT * FROM time_entries WHERE id = ?").get(openEntry.id) as TimeEntryRow;
  res.json({ entry: toPublicEntry(row) });
});

entriesRouter.patch("/:id", (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const row = db.prepare("SELECT * FROM time_entries WHERE id = ?").get(id) as TimeEntryRow | undefined;
  if (!row || (row.user_id !== req.user!.id && req.user!.role !== "admin")) {
    return res.status(404).json({ error: "Entry not found" });
  }

  const { workDate, startTime, endTime, breakMinutes, note } = req.body ?? {};
  const nextWorkDate = workDate ?? row.work_date;
  const nextStartTime = startTime ?? row.start_time;
  const nextEndTime = endTime === undefined ? row.end_time : endTime;
  const nextBreakMinutes = breakMinutes === undefined ? row.break_minutes : Number(breakMinutes);
  const nextNote = note === undefined ? row.note : note;

  if (nextEndTime && new Date(nextEndTime).getTime() < new Date(nextStartTime).getTime()) {
    return res.status(400).json({ error: "End time cannot be before start time" });
  }
  if (!Number.isFinite(nextBreakMinutes) || nextBreakMinutes < 0) {
    return res.status(400).json({ error: "Break minutes must be a non-negative number" });
  }
  if (nextEndTime) {
    const grossMinutes = Math.round((new Date(nextEndTime).getTime() - new Date(nextStartTime).getTime()) / 60000);
    if (nextBreakMinutes > grossMinutes) {
      return res.status(400).json({ error: "Break time cannot exceed the worked duration" });
    }
  }

  db.prepare(
    "UPDATE time_entries SET work_date = ?, start_time = ?, end_time = ?, break_minutes = ?, note = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(nextWorkDate, nextStartTime, nextEndTime, nextBreakMinutes, nextNote, id);

  const updated = db.prepare("SELECT * FROM time_entries WHERE id = ?").get(id) as TimeEntryRow;
  res.json({ entry: toPublicEntry(updated) });
});

entriesRouter.delete("/:id", (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const row = db.prepare("SELECT * FROM time_entries WHERE id = ?").get(id) as TimeEntryRow | undefined;
  if (!row || (row.user_id !== req.user!.id && req.user!.role !== "admin")) {
    return res.status(404).json({ error: "Entry not found" });
  }
  db.prepare("DELETE FROM time_entries WHERE id = ?").run(id);
  res.json({ ok: true });
});
