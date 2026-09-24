import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { db } from "../db/db.js";
import { toPublicUser, type PublicUser, type UserRow } from "../types.js";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-insecure-secret-change-me";
const COOKIE_NAME = "timetrack_token";

export interface AuthedRequest extends Request {
  user?: PublicUser;
}

export function signToken(userId: number): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "30d" });
}

export function setAuthCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(COOKIE_NAME);
}

function userFromRow(row: UserRow | undefined): PublicUser | null {
  if (!row || row.is_active !== 1) return null;
  return toPublicUser(row);
}

// Accepts either the browser session cookie (JWT) or a per-user automation
// bearer token (from Settings > Automation), so endpoints like clock in/out
// can be triggered from non-browser clients such as iOS Shortcuts.
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const cookieToken = req.cookies?.[COOKIE_NAME];
  if (cookieToken) {
    try {
      const payload = jwt.verify(cookieToken, JWT_SECRET) as unknown as { sub: number };
      const row = db.prepare("SELECT * FROM users WHERE id = ?").get(payload.sub) as UserRow | undefined;
      const user = userFromRow(row);
      if (user) {
        req.user = user;
        return next();
      }
    } catch {
      // fall through to bearer-token check
    }
  }

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const apiToken = authHeader.slice("Bearer ".length).trim();
    if (apiToken) {
      const row = db.prepare("SELECT * FROM users WHERE api_token = ?").get(apiToken) as UserRow | undefined;
      const user = userFromRow(row);
      if (user) {
        req.user = user;
        return next();
      }
    }
  }

  return res.status(401).json({ error: "Not authenticated" });
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}
