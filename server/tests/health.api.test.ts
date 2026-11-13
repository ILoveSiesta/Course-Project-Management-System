import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("GET /api/health", () => {
  it("returns 200 with status ok and the service name", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    // Deliberately wrong expectation (Lab 5 Episode 6.6, #21): proves the merge gate blocks a red check. Never merge.
    expect(res.body).toEqual({ status: "broken-on-purpose", service: "CPMS API" });
  });
});

describe("unknown API route", () => {
  it("returns a safe 404 JSON error", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: "NOT_FOUND", message: "Resource not found" } });
  });
});
