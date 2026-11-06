import { execSync } from "child_process";
import { resolveTestDatabaseUrl } from "./test-db.js";

// Recreate the test database from the committed migrations before the run,
// then regenerate the Prisma client so a changed schema.prisma is picked up.
// Test files seed the data they need.
export default function setup() {
  const env = { ...process.env, DATABASE_URL: resolveTestDatabaseUrl() };

  try {
    execSync("npx prisma migrate reset --force --skip-seed --skip-generate", { stdio: "pipe", env });
  } catch (err) {
    const stderr = (err as { stderr?: Buffer }).stderr?.toString().trim();
    throw new Error(`Could not reset the test database. Is PostgreSQL running (npm run db:up)?\n${stderr ?? err}`);
  }

  try {
    execSync("npx prisma generate", { stdio: "pipe", env });
  } catch (err) {
    // Usually the query engine file is locked by a running dev server; the existing client is then used.
    const stderr = (err as { stderr?: Buffer }).stderr?.toString().trim();
    console.warn(`Warning: prisma generate failed; using the existing Prisma client.\n${stderr ?? err}`);
  }
}
