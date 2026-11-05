import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.routes.js";
import { teamsRouter, milestonesRouter } from "./routes/teams.routes.js";
import { HttpError } from "./utils/httpError.js";

export const app = express();

app.use(cors());
app.use(express.json());

// API Health Check
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "CPMS API" });
});

// Auth Routes (F-01)
app.use("/api/auth", authRouter);

// Teams and milestones (F-02)
app.use("/api/teams", teamsRouter);
app.use("/api/milestones", milestonesRouter);

// Unknown API routes
app.use("/api", (_req: Request, res: Response) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Resource not found" } });
});

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
