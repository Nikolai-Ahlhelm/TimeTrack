import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { runMigrations } from "./db/db.js";
import { seedDevAdmin } from "./seed/devAdmin.js";
import { setupRouter } from "./routes/setup.js";
import { authRouter } from "./routes/auth.js";
import { entriesRouter } from "./routes/entries.js";
import { usersRouter } from "./routes/users.js";
import { settingsRouter } from "./routes/settings.js";
import { profileRouter } from "./routes/profile.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

runMigrations();

if (process.env.DEV_SEED_ADMIN === "true") {
  seedDevAdmin();
}

const app = express();
const PORT = Number(process.env.PORT ?? 4000);
const isProd = process.env.NODE_ENV === "production";

app.use(express.json());
app.use(cookieParser());

if (!isProd) {
  // In dev, the Vite dev server runs on a different origin and proxies /api here.
  app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173", credentials: true }));
}

app.use("/api/setup", setupRouter);
app.use("/api/auth", authRouter);
app.use("/api/entries", entriesRouter);
app.use("/api/users", usersRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/profile", profileRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

if (isProd) {
  const clientDist = path.resolve(__dirname, "../../client/dist");
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }
}

app.listen(PORT, () => {
  console.log(`TimeTrack server listening on port ${PORT} (${isProd ? "production" : "development"})`);
});
