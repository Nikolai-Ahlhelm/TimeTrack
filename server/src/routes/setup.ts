import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db/db.js";
import { setAuthCookie, signToken } from "../middleware/auth.js";

export const setupRouter = Router();

function isSetupComplete(): boolean {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'setup_complete'").get() as
    | { value: string }
    | undefined;
  return row?.value === "true";
}

setupRouter.get("/status", (_req, res) => {
  res.json({ setupComplete: isSetupComplete() });
});

setupRouter.post("/", (req, res) => {
  if (isSetupComplete()) {
    return res.status(409).json({ error: "Setup already complete" });
  }

  const { username, password, displayName } = req.body ?? {};
  if (!username || !password || typeof username !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "username and password are required" });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: "Password must be at least 4 characters" });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare(
      "INSERT INTO users (username, password_hash, display_name, role, is_active) VALUES (?, ?, ?, 'admin', 1)"
    )
    .run(username, passwordHash, displayName || username);

  db.prepare("UPDATE settings SET value = 'true' WHERE key = 'setup_complete'").run();

  const token = signToken(Number(info.lastInsertRowid));
  setAuthCookie(res, token);
  res.status(201).json({ ok: true });
});
