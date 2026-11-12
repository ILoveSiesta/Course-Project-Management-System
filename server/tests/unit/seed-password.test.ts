import { describe, it, expect } from "vitest";
import { demoPasswordFrom } from "../../prisma/seed.js";

// Lab 5 (#18): demo-account passwords come only from the environment, never from code.

describe("demoPasswordFrom", () => {
  it("returns SEED_DEMO_PASSWORD when it is set", () => {
    expect(demoPasswordFrom({ SEED_DEMO_PASSWORD: "from-env-123" })).toBe("from-env-123");
  });

  it.each([
    ["missing", {}],
    ["empty", { SEED_DEMO_PASSWORD: "" }],
    ["blank", { SEED_DEMO_PASSWORD: "   " }],
  ])("refuses to seed when SEED_DEMO_PASSWORD is %s", (_label, env) => {
    expect(() => demoPasswordFrom(env)).toThrow(/SEED_DEMO_PASSWORD/);
  });
});
