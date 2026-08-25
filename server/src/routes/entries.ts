import { Router } from "express";
import { db } from "../db/db.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { entriesToCsv } from "../lib/csv.js";
import { parseBreakRules, requiredBreakMinutes } from "../lib/breakRules.js";
import {
  toPublicDayLabel,
  toPublicEntry,
  toPublicTag,
  type DayLabelRow,
  type PublicTag,
  type TagRow,
  type TimeEntryRow,
} from "../types.js";

export const entriesRouter = Router();
entriesRouter.use(requireAuth);

function dayLabelOn(userId: number, workDate: string): { status: string } | undefined {
  return db.prepare("SELECT status FROM day_labels WHERE user_id = ? AND work_date = ?").get(userId, workDate) as
    | { status: string }
    | undefined;
}

const SORTABLE: Record<string, string> = {
  date_desc: "work_date DESC, start_time DESC",
  date_asc: "work_date ASC, start_time ASC",
  hours_desc: "total_minutes DESC",
  hours_asc: "total_minutes ASC",
};

function buildQuery(userId: number, query: Record<string, unknown>) {
  const { from, to, q, sort, tagId } = query;
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
  if (typeof tagId === "string" && tagId) {
    clauses.push("EXISTS (SELECT 1 FROM entry_tags et WHERE et.entry_id = time_entries.id AND et.tag_id = ?)");
    params.push(Number(tagId));
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

// Batch-loads tags for a set of entries in one query, keyed by entry id, so
// listing entries doesn't issue an extra query per row.
function tagsForEntries(entryIds: number[]): Map<number, PublicTag[]> {
  const map = new Map<number, PublicTag[]>();
  if (entryIds.length === 0) return map;
  const placeholders = entryIds.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT et.entry_id AS entry_id, t.* FROM entry_tags et
       JOIN tags t ON t.id = et.tag_id
       WHERE et.entry_id IN (${placeholders})
       ORDER BY t.name COLLATE NOCASE`
    )
    .all(...entryIds) as (TagRow & { entry_id: number })[];
  for (const { entry_id, ...tagRow } of rows) {
    const list = map.get(entry_id) ?? [];
    list.push(toPublicTag(tagRow));
    map.set(entry_id, list);
  }
  return map;
}

function toPublicEntries(rows: TimeEntryRow[]) {
  const tagsByEntry = tagsForEntries(rows.map((r) => r.id));
  return rows.map((row) => toPublicEntry(row, tagsByEntry.get(row.id) ?? []));
}

// Replaces the full set of tags on an entry. Silently ignores tag ids that
// don't belong to the requesting user, rather than erroring, since the
// client always sends its own known tag list.
function setEntryTags(entryId: number, tagIds: number[], userId: number) {
  const uniqueIds = [...new Set(tagIds)];
  db.prepare("DELETE FROM entry_tags WHERE entry_id = ?").run(entryId);
  if (uniqueIds.length === 0) return;
  const placeholders = uniqueIds.map(() => "?").join(",");
  const owned = db
    .prepare(`SELECT id FROM tags WHERE user_id = ? AND id IN (${placeholders})`)
    .all(userId, ...uniqueIds) as { id: number }[];
  const insert = db.prepare("INSERT OR IGNORE INTO entry_tags (entry_id, tag_id) VALUES (?, ?)");
  for (const { id } of owned) insert.run(entryId, id);
}

entriesRouter.get("/", (req: AuthedRequest, res) => {
  const { sql, params } = buildQuery(req.user!.id, req.query as Record<string, unknown>);
  const rows = db.prepare(sql).all(...params) as TimeEntryRow[];
  res.json({ entries: toPublicEntries(rows) });
});

entriesRouter.get("/export.csv", (req: AuthedRequest, res) => {
  const { sql, params } = buildQuery(req.user!.id, req.query as Record<string, unknown>);
  const rows = db.prepare(sql).all(...params) as TimeEntryRow[];

  // Whole-day labels (vacation/sick) live in a separate table from time
  // entries, so they need their own query — otherwise they're silently
  // absent from the export even though they cover real days off.
  const { from, to, sort } = req.query as Record<string, unknown>;
  const labelClauses = ["user_id = ?"];
  const labelParams: unknown[] = [req.user!.id];
  if (typeof from === "string" && from) {
    labelClauses.push("work_date >= ?");
    labelParams.push(from);
  }
  if (typeof to === "string" && to) {
    labelClauses.push("work_date <= ?");
    labelParams.push(to);
  }
  const labelRows = db
    .prepare(`SELECT * FROM day_labels WHERE ${labelClauses.join(" AND ")}`)
    .all(...labelParams) as DayLabelRow[];

  const sortDescending = sort !== "date_asc";
  const csv = entriesToCsv(toPublicEntries(rows), labelRows.map(toPublicDayLabel), false, new Map(), sortDescending);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="timetrack-export-${Date.now()}.csv"`);
  res.send(csv);
});

entriesRouter.get("/today-open", (req: AuthedRequest, res) => {
  const row = db
    .prepare("SELECT * FROM time_entries WHERE user_id = ? AND end_time IS NULL ORDER BY start_time DESC LIMIT 1")
    .get(req.user!.id) as TimeEntryRow | undefined;
  res.json({ entry: row ? toPublicEntries([row])[0] : null });
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

  const label = dayLabelOn(req.user!.id, workDate);
  if (label) {
    return res.status(409).json({ error: `Today is marked as ${label.status} — remove that label first` });
  }

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

  // If the user has tiered break rules configured (e.g. German legal minimums),
  // auto-fill the break for this shift's duration now that it's known, replacing
  // the flat default that was applied when the entry was started.
  let breakMinutes = openEntry.break_minutes;
  if (req.user!.breakRules) {
    const grossMinutes = Math.round((new Date(endTime).getTime() - new Date(openEntry.start_time).getTime()) / 60000);
    breakMinutes = requiredBreakMinutes(grossMinutes, req.user!.breakRules);
  }

  db.prepare("UPDATE time_entries SET end_time = ?, break_minutes = ?, updated_at = datetime('now') WHERE id = ?").run(
    endTime,
    breakMinutes,
    openEntry.id
  );

  const row = db.prepare("SELECT * FROM time_entries WHERE id = ?").get(openEntry.id) as TimeEntryRow;
  res.json({ entry: toPublicEntries([row])[0] });
});

entriesRouter.patch("/:id", (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const row = db.prepare("SELECT * FROM time_entries WHERE id = ?").get(id) as TimeEntryRow | undefined;
  if (!row || (row.user_id !== req.user!.id && req.user!.role !== "admin")) {
    return res.status(404).json({ error: "Entry not found" });
  }

  const { workDate, startTime, endTime, breakMinutes, note, tagIds } = req.body ?? {};
  const nextWorkDate = workDate ?? row.work_date;
  const nextStartTime = startTime ?? row.start_time;
  const nextEndTime = endTime === undefined ? row.end_time : endTime;
  const nextNote = note === undefined ? row.note : note;

  let nextBreakMinutes: number;
  if (breakMinutes !== undefined) {
    // Explicit override in this request always wins.
    nextBreakMinutes = Number(breakMinutes);
  } else if (nextEndTime) {
    // No explicit break given: auto-fill from the entry owner's tiered break
    // rules (if configured) whenever a duration is known, so edits that
    // change the start/end time keep the break in sync with the new duration.
    const ownerBreakRules =
      row.user_id === req.user!.id
        ? req.user!.breakRules
        : parseBreakRules(
            (db.prepare("SELECT break_rules FROM users WHERE id = ?").get(row.user_id) as { break_rules: string | null }).break_rules
          );
    nextBreakMinutes = ownerBreakRules
      ? requiredBreakMinutes(
          Math.round((new Date(nextEndTime).getTime() - new Date(nextStartTime).getTime()) / 60000),
          ownerBreakRules
        )
      : row.break_minutes;
  } else {
    nextBreakMinutes = row.break_minutes;
  }

  if (nextWorkDate !== row.work_date) {
    const label = dayLabelOn(row.user_id, nextWorkDate);
    if (label) {
      return res.status(409).json({ error: `That day is marked as ${label.status} — remove that label first` });
    }
  }
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
  if (tagIds !== undefined && (!Array.isArray(tagIds) || tagIds.some((t: unknown) => !Number.isInteger(t)))) {
    return res.status(400).json({ error: "tagIds must be an array of tag ids" });
  }

  db.prepare(
    "UPDATE time_entries SET work_date = ?, start_time = ?, end_time = ?, break_minutes = ?, note = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(nextWorkDate, nextStartTime, nextEndTime, nextBreakMinutes, nextNote, id);
  if (tagIds !== undefined) {
    setEntryTags(id, tagIds as number[], row.user_id);
  }

  const updated = db.prepare("SELECT * FROM time_entries WHERE id = ?").get(id) as TimeEntryRow;
  res.json({ entry: toPublicEntries([updated])[0] });
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
