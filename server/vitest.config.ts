import { defineConfig } from "vitest/config";
import { resolveTestDatabaseUrl } from "./tests/support/test-db.js";

// Resolve first: it may load server/.env, which can also provide SEED_DEMO_PASSWORD.
const testDatabaseUrl = resolveTestDatabaseUrl();

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: testDatabaseUrl,
      // The seed refuses to run without a demo password (Lab 5 #18). The test DB is
      // reset on every run, so a throwaway value is used when none is configured.
      SEED_DEMO_PASSWORD: process.env.SEED_DEMO_PASSWORD || "test-only-demo-password",
    },
    globalSetup: ["./tests/support/global-setup.ts"],
    // Test files share one database, so run them one at a time.
    fileParallelism: false,
  },
});
