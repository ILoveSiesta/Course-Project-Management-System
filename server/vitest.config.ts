import { defineConfig } from "vitest/config";
import { resolveTestDatabaseUrl } from "./tests/support/test-db.js";

export default defineConfig({
  test: {
    env: { DATABASE_URL: resolveTestDatabaseUrl() },
    globalSetup: ["./tests/support/global-setup.ts"],
    // Test files share one database, so run them one at a time.
    fileParallelism: false,
  },
});
