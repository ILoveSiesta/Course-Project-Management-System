import { execSync } from "child_process";
import { resolveTestDatabaseUrl } from "./test-db.js";

// Recreate the test database from the committed migrations before the run.
// Test files seed the data they need.
export default function setup() {
  try {
    execSync("npx prisma migrate reset --force --skip-seed --skip-generate", {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: resolveTestDatabaseUrl() },
    });
  } catch (err) {
    const stderr = (err as { stderr?: Buffer }).stderr?.toString().trim();
    throw new Error(`Could not reset the test database. Is PostgreSQL running (npm run db:up)?\n${stderr ?? err}`);
  }
}
