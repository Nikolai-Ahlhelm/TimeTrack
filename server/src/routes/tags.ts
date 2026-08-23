import { Router } from "express";
import { db } from "../db/db.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { toPublicTag, type TagRow } from "../types.js";

// Tags are per-user labels (e.g. "Homeoffice", "Trip") that can be attached
// to any number of time entries, used to filter/report on where time went.
export const tagsRouter = Router();
tagsRouter.use(requireAuth);

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const MAX_ICON_LENGTH = 4; // enough for a single emoji, incl. multi-codepoint ones (e.g. skin tone modifiers)

function normalizeIcon(icon: unknown, fallback: string | null): string | null {
  if (icon === undefined) return fallback;
  if (typeof icon !== "string") return fallback;
  const trimmed = icon.trim();
  if (!trimmed) return null;
  return [...trimmed].slice(0, MAX_ICON_LENGTH).join("");
}

tagsRouter.get("/", (req: AuthedRequest, res) => {
  const rows = db
    .prepare("SELECT * FROM tags WHERE user_id = ? ORDER BY name COLLATE NOCASE")
    .all(req.user!.id) as TagRow[];
  res.json({ tags: rows.map(toPublicTag) });
});

tagsRouter.post("/", (req: AuthedRequest, res) => {
  const { name, color, icon } = req.body ?? {};
  const trimmedName = typeof name === "string" ? name.trim() : "";
  if (!trimmedName) {
    return res.status(400).json({ error: "Tag name is required" });
  }
  const nextColor = typeof color === "string" && HEX_COLOR.test(color) ? color : "#64748b";
  const nextIcon = normalizeIcon(icon, null);

  const existing = db
    .prepare("SELECT id FROM tags WHERE user_id = ? AND name = ? COLLATE NOCASE")
    .get(req.user!.id, trimmedName);
  if (existing) {
    return res.status(409).json({ error: "A tag with that name already exists" });
  }

  const info = db
    .prepare("INSERT INTO tags (user_id, name, color, icon) VALUES (?, ?, ?, ?)")
    .run(req.user!.id, trimmedName, nextColor, nextIcon);
  const row = db.prepare("SELECT * FROM tags WHERE id = ?").get(info.lastInsertRowid) as TagRow;
  res.status(201).json({ tag: toPublicTag(row) });
});

tagsRouter.patch("/:id", (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const row = db.prepare("SELECT * FROM tags WHERE id = ?").get(id) as TagRow | undefined;
  if (!row || row.user_id !== req.user!.id) {
    return res.status(404).json({ error: "Tag not found" });
  }

  const { name, color, icon } = req.body ?? {};
  let nextName = row.name;
  if (name !== undefined) {
    const trimmedName = typeof name === "string" ? name.trim() : "";
    if (!trimmedName) {
      return res.status(400).json({ error: "Tag name is required" });
    }
    const existing = db
      .prepare("SELECT id FROM tags WHERE user_id = ? AND name = ? COLLATE NOCASE AND id != ?")
      .get(req.user!.id, trimmedName, id);
    if (existing) {
      return res.status(409).json({ error: "A tag with that name already exists" });
    }
    nextName = trimmedName;
  }
  const nextColor = color !== undefined ? (HEX_COLOR.test(color) ? color : row.color) : row.color;
  if (color !== undefined && !HEX_COLOR.test(color)) {
    return res.status(400).json({ error: "Color must be a hex value like #64748b" });
  }
  const nextIcon = normalizeIcon(icon, row.icon);

  db.prepare("UPDATE tags SET name = ?, color = ?, icon = ? WHERE id = ?").run(nextName, nextColor, nextIcon, id);
  const updated = db.prepare("SELECT * FROM tags WHERE id = ?").get(id) as TagRow;
  res.json({ tag: toPublicTag(updated) });
});

tagsRouter.delete("/:id", (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const row = db.prepare("SELECT * FROM tags WHERE id = ?").get(id) as TagRow | undefined;
  if (!row || row.user_id !== req.user!.id) {
    return res.status(404).json({ error: "Tag not found" });
  }
  db.prepare("DELETE FROM tags WHERE id = ?").run(id);
  res.json({ ok: true });
});
