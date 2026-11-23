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

  // Safe error handler: map known Express/body-parser request errors and exposed static-file 4xx errors
  // without leaking internals. ORM/database and unknown errors still fall through to safe 500 INTERNAL_ERROR.
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({
        error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
      });
      return;
    }
    const parsedErr = mapRequestParseError(err);
    if (parsedErr) {
      res.status(parsedErr.status).json({
        error: { code: parsedErr.code, message: parsedErr.message },
      });
      return;
    }
    if (options.clientDistDir && !isApiPath(req.path)) {
      const staticErr = mapStaticClientError(err);
      if (staticErr) {
        if (staticErr.headers) {
          for (const [key, value] of Object.entries(staticErr.headers)) {
            res.setHeader(key, value);
          }
        }
        res.status(staticErr.status).type("text/plain").send(staticErr.message);
        return;
      }
    }
    console.error(err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Unexpected server error" } });
  });

  return app;
}

function mapRequestParseError(err: unknown): HttpError | null {
  if (typeof err !== "object" || err === null) return null;
  const candidate = err as { status?: unknown; statusCode?: unknown; type?: unknown; code?: unknown };
  const status = typeof candidate.status === "number" ? candidate.status : candidate.statusCode;
  const type = typeof candidate.type === "string" ? candidate.type : "";
  const code = typeof candidate.code === "string" ? candidate.code : "";

  if (status === 413 && type === "entity.too.large") {
    return new HttpError(413, "PAYLOAD_TOO_LARGE", "Request body is too large");
  }
  if (status === 415 && (type === "charset.unsupported" || type === "encoding.unsupported")) {
    return new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Unsupported charset or content encoding");
  }

  const isJsonParseError = err instanceof SyntaxError || type === "entity.parse.failed";
  const isZlibStreamError = code === "Z_DATA_ERROR" || code === "Z_BUF_ERROR" || code === "Z_NEED_DICT";
  if (
    status === 400 &&
    (isJsonParseError ||
      err instanceof URIError ||
      type === "request.size.invalid" ||
      type === "request.aborted" ||
      type === "stream.encoding.set" ||
      isZlibStreamError)
  ) {
    const message =
      err instanceof URIError
        ? "Malformed URL parameter"
        : isJsonParseError
          ? "Malformed JSON request body"
          : "Request body could not be read";
    return new HttpError(400, "BAD_REQUEST", message);
  }
  return null;
}

function isApiPath(reqPath: string): boolean {
  return reqPath === "/api" || reqPath.startsWith("/api/");
}

const STATIC_STATUS_MESSAGES: Record<number, string> = {
  400: "Bad Request",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  411: "Length Required",
  412: "Precondition Failed",
  414: "URI Too Long",
  416: "Range Not Satisfiable",
};

function mapStaticClientError(
  err: unknown
): { status: number; message: string; headers?: Record<string, string> } | null {
  if (!(err instanceof Error)) return null;
  const candidate = err as { status?: unknown; statusCode?: unknown; expose?: unknown; headers?: unknown };
  const status = typeof candidate.status === "number" ? candidate.status : candidate.statusCode;
  if (typeof status !== "number" || status < 400 || status >= 500 || candidate.expose !== true) {
    return null;
  }
  const safeHeaders: Record<string, string> = {};
  if (candidate.headers && typeof candidate.headers === "object") {
    const contentRange = (candidate.headers as Record<string, unknown>)["Content-Range"];
    if (typeof contentRange === "string") {
      safeHeaders["Content-Range"] = contentRange;
    }
  }
  return {
    status,
    message: STATIC_STATUS_MESSAGES[status] ?? "Bad Request",
    headers: Object.keys(safeHeaders).length > 0 ? safeHeaders : undefined,
  };
}

export const app = createApp({ clientDistDir: process.env.CLIENT_DIST_DIR || undefined });
