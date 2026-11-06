import path from "path";
import fs from "fs";

// Load .env automatically if process.loadEnvFile is available (Node.js 20.6+)
if (typeof (process as any).loadEnvFile === "function") {
  // Try current working directory .env, or server/.env
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "server", ".env"),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        (process as any).loadEnvFile(p);
        break;
      } catch {
        // Continue if parse error
      }
    }
  }
}

export function validateRequiredEnv(): void {
  const missing: string[] = [];
  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
  if (!process.env.JWT_SECRET) missing.push("JWT_SECRET");

  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(", ")}`);
  }
}
