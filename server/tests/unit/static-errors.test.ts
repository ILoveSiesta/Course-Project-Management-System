import fs from "fs";
import os from "os";
import path from "path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";

describe("Defect #92 static-file error handling (SDS §4, NFR-05)", () => {
  let staticDir: string;

  beforeAll(() => {
    staticDir = fs.mkdtempSync(path.join(os.tmpdir(), "cpms-static-92-"));
    fs.writeFileSync(
      path.join(staticDir, "index.html"),
      "<!doctype html><html><body>CPMS static SPA test payload with enough bytes for range checks</body></html>",
      "utf8"
    );
    fs.mkdirSync(path.join(staticDir, "assets"));
    fs.writeFileSync(
      path.join(staticDir, "assets", "app.js"),
      "console.log('cpms asset payload with enough bytes for range checks');",
      "utf8"
    );
  });

  afterAll(() => {
    fs.rmSync(staticDir, { recursive: true, force: true });
  });

  it("TEST-92-01: preserves static-file 4xx status codes (416, 412) without logging 500 or leaking paths", async () => {
    const app = createApp({ clientDistDir: staticDir });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      // Positive controls: normal GET, valid Range -> 206, SPA fallback -> 200, unknown API -> 404 JSON.
      const normal = await request(app).get("/");
      expect(normal.status).toBe(200);
      expect(normal.text).toContain("CPMS static SPA test payload");

      const validRange = await request(app).get("/").set("Range", "bytes=0-9");
      expect(validRange.status).toBe(206);

      const spaFallback = await request(app).get("/login");
      expect(spaFallback.status).toBe(200);

      const apiNotFound = await request(app).get("/api/does-not-exist");
      expect(apiNotFound.status).toBe(404);
      expect(apiNotFound.body).toEqual({
        error: { code: "NOT_FOUND", message: "Resource not found" },
      });

      // Unsatisfiable range on /, asset, and SPA fallback must return 416 with Content-Range and no internal leak.
      for (const target of ["/", "/assets/app.js", "/login"]) {
        const res = await request(app).get(target).set("Range", "bytes=999999-");
        expect(res.status, `GET ${target} unsatisfiable Range`).toBe(416);
        expect(res.headers["content-range"]).toMatch(/^bytes \*\//);
        expect(res.text).not.toContain(staticDir);
        expect(res.text).not.toContain("RangeNotSatisfiableError");
      }

      // Failed preconditions on / and asset must return 412 without 500 or stack trace leakage.
      const ifMatch = await request(app).get("/").set("If-Match", '"x"');
      expect(ifMatch.status).toBe(412);
      expect(ifMatch.text).not.toContain(staticDir);

      const ifUnmodified = await request(app)
        .get("/")
        .set("If-Unmodified-Since", "Mon, 01 Jan 2001 00:00:00 GMT");
      expect(ifUnmodified.status).toBe(412);
      expect(ifUnmodified.text).not.toContain(staticDir);

      const assetPrecondition = await request(app).get("/assets/app.js").set("If-Match", '"x"');
      expect(assetPrecondition.status).toBe(412);

      // Static 4xx client errors must not trigger console.error as internal server errors.
      expect(errorSpy).not.toHaveBeenCalled();

      // Malformed JSON to / still hits JSON parser 400 BAD_REQUEST, not static error handler.
      const malformedJsonToRoot = await request(app)
        .post("/")
        .set("Content-Type", "application/json")
        .send('{"bad":');
      expect(malformedJsonToRoot.status).toBe(400);
      expect(malformedJsonToRoot.body.error.code).toBe("BAD_REQUEST");
    } finally {
      errorSpy.mockRestore();
    }
  });
});
