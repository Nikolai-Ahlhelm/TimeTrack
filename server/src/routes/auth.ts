import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db/db.js";
import { clearAuthCookie, requireAuth, setAuthCookie, signToken, type AuthedRequest } from "../middleware/auth.js";
import { toPublicUser, type UserRow } from "../types.js";

export const authRouter = Router();

authRouter.post("/login", (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    return res.status(400).json({ error: "username and password are required" });
  }

  const row = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as UserRow | undefined;
  if (!row || row.is_active !== 1 || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  const token = signToken(row.id);
  setAuthCookie(res, token);
  res.json({ user: toPublicUser(row) });
});

authRouter.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, (req: AuthedRequest, res) => {
  res.json({ user: req.user });
});
