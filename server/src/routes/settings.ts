import { Router } from "express";
import { db } from "../db/db.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

export const settingsRouter = Router();
settingsRouter.use(requireAuth, requireAdmin);

// Keys that are internal/system-managed and should not be edited via this API.
const PROTECTED_KEYS = new Set(["setup_complete"]);

settingsRouter.get("/", (_req, res) => {
  const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const settings = Object.fromEntries(rows.filter((r) => !PROTECTED_KEYS.has(r.key)).map((r) => [r.key, r.value]));
  res.json({ settings });
});

settingsRouter.patch("/", (req, res) => {
  const updates = req.body ?? {};
  const upsert = db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  );

  const tx = db.transaction((entries: [string, unknown][]) => {
    for (const [key, value] of entries) {
      if (PROTECTED_KEYS.has(key)) continue;
      upsert.run(key, String(value));
    }
  });
  tx(Object.entries(updates));

  const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const settings = Object.fromEntries(rows.filter((r) => !PROTECTED_KEYS.has(r.key)).map((r) => [r.key, r.value]));
  res.json({ settings });
});
