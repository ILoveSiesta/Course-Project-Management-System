import fs from "fs";
import path from "path";

// Server tests run against a separate database (SDS §9) so they never touch development data.
// TEST_DATABASE_URL wins; otherwise the database name in DATABASE_URL is replaced with "cpms_test".
export function resolveTestDatabaseUrl(): string {
  const envFile = path.resolve(process.cwd(), ".env");
  if (!process.env.DATABASE_URL && !process.env.TEST_DATABASE_URL && fs.existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }

  const raw = process.env.TEST_DATABASE_URL ?? deriveFrom(process.env.DATABASE_URL);
  const dbName = new URL(raw).pathname.replace(/^\//, "");
  if (!dbName.endsWith("_test")) {
    throw new Error(`Refusing to run tests against "${dbName}": the test database name must end with "_test".`);
  }
  return raw;
}

function deriveFrom(databaseUrl: string | undefined): string {
  if (!databaseUrl) {
    throw new Error("Set DATABASE_URL (or TEST_DATABASE_URL) to run the server tests.");
  }
  const url = new URL(databaseUrl);
  url.pathname = "/cpms_test";
  return url.toString();
}
