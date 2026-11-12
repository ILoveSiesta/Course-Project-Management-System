import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { authRouter } from "./routes/auth.routes.js";
import { teamsRouter, milestonesRouter, submissionsRouter } from "./routes/teams.routes.js";
import { HttpError } from "./utils/httpError.js";
import { getPrisma } from "./prisma.js";

export interface AppOptions {
  // Folder with the built React app (client/dist). When set, the API also serves the UI,
  // so one container runs both (Lab 5, Cloud Run). Unset in local development.
  clientDistDir?: string;
  // Readiness probe; the default runs a trivial query against PostgreSQL.
  checkDatabase?: () => Promise<unknown>;
}

const defaultCheckDatabase = () => getPrisma().$queryRaw`SELECT 1`;

export function createApp(options: AppOptions = {}): Express {
  const app = express();
  const checkDatabase = options.checkDatabase ?? defaultCheckDatabase;

  app.use(cors());
  app.use(express.json());

  // API Health Check (process is up; does not touch the database)
  app.get("/api/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok", service: "CPMS API" });
  });

  // Readiness: the API can reach the database. Used by the smoke test after each deploy.
  app.get("/api/ready", async (_req: Request, res: Response) => {
    try {
      await checkDatabase();
      res.status(200).json({ status: "ready", db: "connected" });
    } catch {
      res.status(503).json({ status: "not_ready", db: "unreachable" });
    }
  });

  // Auth Routes (F-01)
  app.use("/api/auth", authRouter);

  // Teams, milestones and submissions (F-02, F-03)
  app.use("/api/teams", teamsRouter);
  app.use("/api/milestones", milestonesRouter);
  app.use("/api/submissions", submissionsRouter);

  // Unknown API routes
  app.use("/api", (_req: Request, res: Response) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Resource not found" } });
  });

  // Built client: static files, then index.html for client-side routes (never for /api).
  if (options.clientDistDir) {
    const dir = path.resolve(options.clientDistDir);
    const indexHtml = path.join(dir, "index.html");
    app.use(express.static(dir, { index: "index.html" }));
    app.get("*", (_req: Request, res: Response, next: NextFunction) => {
      if (!fs.existsSync(indexHtml)) return next();
      res.sendFile(indexHtml);
    });
  }

  // Safe error handler: never leak stack traces or internal details to clients.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({
        error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
      });
      return;
    }
    console.error(err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Unexpected server error" } });
  });

  return app;
}

export const app = createApp({ clientDistDir: process.env.CLIENT_DIST_DIR || undefined });
