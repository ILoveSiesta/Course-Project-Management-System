import express, { Request, Response, NextFunction } from "express";
import cors from "cors";

export const app = express();

app.use(cors());
app.use(express.json());

// API Health Check
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "CPMS API" });
});

// Feature routers are mounted here as each Sprint feature is implemented.

// Unknown API routes
app.use("/api", (_req: Request, res: Response) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Resource not found" } });
});

// Safe error handler: never leak stack traces or internal details to clients.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Unexpected server error" } });
});
