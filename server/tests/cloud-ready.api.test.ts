import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import fs from "fs";
import os from "os";
import path from "path";
import { app, createApp } from "../src/app.js";

// Lab 5 (#18): what Cloud Run and the smoke test need from the app.

describe("GET /api/ready", () => {
  it("returns 200 with db connected when PostgreSQL answers", async () => {
    const res = await request(app).get("/api/ready");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ready", db: "connected" });
  });

  it("returns 503 without internal details when the database cannot be reached", async () => {
    const failing = createApp({
      checkDatabase: () => Promise.reject(new Error("connect ECONNREFUSED 10.0.0.1:5432 password=secret")),
    });
    const res = await request(failing).get("/api/ready");
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: "not_ready", db: "unreachable" });
    expect(JSON.stringify(res.body)).not.toContain("ECONNREFUSED");
  });
});

describe("serving the built client (one container for UI and API)", () => {
  let dir: string;

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "cpms-client-dist-"));
    fs.writeFileSync(path.join(dir, "index.html"), "<!doctype html><html><body><div id=\"root\"></div></body></html>");
    fs.mkdirSync(path.join(dir, "assets"));
    fs.writeFileSync(path.join(dir, "assets", "app.js"), "console.log('cpms');");
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("serves index.html at /", async () => {
    const res = await request(createApp({ clientDistDir: dir })).get("/");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/html/);
    expect(res.text).toContain('<div id="root">');
  });

  it("serves static assets from the build", async () => {
    const res = await request(createApp({ clientDistDir: dir })).get("/assets/app.js");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/javascript/);
  });

  it("falls back to index.html for client-side routes", async () => {
    const res = await request(createApp({ clientDistDir: dir })).get("/supervisor/teams/1");
    expect(res.status).toBe(200);
    expect(res.text).toContain('<div id="root">');
  });

  it("keeps API routes as JSON, including unknown ones", async () => {
    const withClient = createApp({ clientDistDir: dir });
    const health = await request(withClient).get("/api/health");
    expect(health.status).toBe(200);
    expect(health.body).toEqual({ status: "ok", service: "CPMS API" });

    const unknown = await request(withClient).get("/api/does-not-exist");
    expect(unknown.status).toBe(404);
    expect(unknown.body).toEqual({ error: { code: "NOT_FOUND", message: "Resource not found" } });
  });

  it("does not serve a page when no client build is configured", async () => {
    // Positive control: the same request succeeds when the build is configured.
    expect((await request(createApp({ clientDistDir: dir })).get("/")).status).toBe(200);
    const res = await request(createApp({})).get("/");
    expect(res.status).toBe(404);
  });
});
