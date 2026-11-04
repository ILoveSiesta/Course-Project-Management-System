import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.routes.js";
import { authenticate, requireRole } from "./middleware/auth.js";

export const app = express();

app.use(cors());
app.use(express.json());

// API Health Check
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "CPMS API" });
});

// Auth Routes (F-01)
app.use("/api/auth", authRouter);

// Stub for supervisor-guarded route (F-02 endpoint testing role guard)
app.post(
  "/api/teams/:teamId/milestones",
  authenticate,
  requireRole("SUPERVISOR"),
  (_req: Request, res: Response) => {
    res.status(201).json({ message: "Milestone created" });
  }
);

// Unknown API routes
app.use("/api", (_req: Request, res: Response) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Resource not found" } });
});

// Safe error handler: never leak stack traces or internal details to clients.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Unexpected server error" } });
});
