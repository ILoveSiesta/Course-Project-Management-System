import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import express from "express";
import { app } from "../../src/app.js";
import { authRouter } from "../../src/routes/auth.routes.js";
import { getPrisma } from "../../src/prisma.js";
import * as prismaModule from "../../src/prisma.js";
import { seed } from "../../prisma/seed.js";
import { signToken } from "../../src/utils/jwt.js";
import { authenticate, requireRole } from "../../src/middleware/auth.js";
import bcrypt from "bcryptjs";

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || "demo-password";

// Test-only app to verify authenticate and requireRole middleware independently of domain routes
const testApp = express();
testApp.use(express.json());
testApp.use("/api/auth", authRouter);
testApp.get(
  "/test/supervisor-only",
  authenticate,
  requireRole("SUPERVISOR"),
  (_req, res) => res.status(200).json({ status: "ok" })
);

describe("F-01 Authentication and Team Data API", () => {
  beforeAll(async () => {
    // Ensure database has seeded records regardless of initial DB state
    await seed();
  });

  describe("POST /api/auth/login", () => {
    it("TEST-01-01: logs in with valid student credentials and returns a token and user profile", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "student1@cpms.test", password: DEMO_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("token");
      expect(res.body.user).toMatchObject({
        email: "student1@cpms.test",
        role: "STUDENT",
      });
    });

    it("TEST-01-02: logs in with valid supervisor credentials and returns role SUPERVISOR", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "supervisor1@cpms.test", password: DEMO_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("token");
      expect(res.body.user).toMatchObject({
        email: "supervisor1@cpms.test",
        role: "SUPERVISOR",
      });
    });

    it("TEST-01-03: rejects incorrect password with 401 INVALID_CREDENTIALS", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "student1@cpms.test", password: "wrong-password" });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" },
      });
    });

    it("TEST-01-04: rejects non-existent email with identical 401 INVALID_CREDENTIALS", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "unknown@cpms.test", password: "any-password" });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" },
      });
    });

    it("TEST-01-05: rejects missing email or password with 400 VALIDATION_ERROR", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "student1@cpms.test" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("GET /api/auth/me", () => {
    it("TEST-01-06: returns current user profile when given a valid token", async () => {
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: "student1@cpms.test", password: DEMO_PASSWORD });

      const token = loginRes.body.token;

      const meRes = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.user).toMatchObject({
        email: "student1@cpms.test",
        role: "STUDENT",
      });
    });

    it("TEST-01-07: rejects unauthenticated request with 401 UNAUTHENTICATED", async () => {
      const res = await request(app).get("/api/auth/me");

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: { code: "UNAUTHENTICATED", message: "Authentication required" },
      });
    });

    it("TEST-01-08: rejects invalid or malformed token with 401 UNAUTHENTICATED", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer invalid-garbage-token");

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHENTICATED");
    });

    it("TEST-01-08b: rejects expired token with 401 UNAUTHENTICATED", async () => {
      const expiredToken = signToken({ id: 1, role: "STUDENT" }, { expiresIn: "-1s" });

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHENTICATED");
    });
  });

  describe("POST /api/auth/logout", () => {
    it("TEST-01-09: revokes the token so subsequent requests fail with 401 UNAUTHENTICATED", async () => {
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: "student1@cpms.test", password: DEMO_PASSWORD });

      const token = loginRes.body.token;

      const logoutRes = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${token}`);

      expect(logoutRes.status).toBe(204);

      const meRes = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(meRes.status).toBe(401);
      expect(meRes.body.error.code).toBe("UNAUTHENTICATED");
    });
  });

  describe("Role authorization and guards", () => {
    it("TEST-01-10: rejects a student accessing a supervisor-only endpoint with 403 FORBIDDEN", async () => {
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: "student1@cpms.test", password: DEMO_PASSWORD });

      const studentToken = loginRes.body.token;

      const res = await request(testApp)
        .get("/test/supervisor-only")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
      expect(res.body).toEqual({
        error: { code: "FORBIDDEN", message: "Forbidden" },
      });
    });

    it("TEST-01-10b: allows a supervisor accessing the supervisor-only endpoint", async () => {
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: "supervisor1@cpms.test", password: DEMO_PASSWORD });

      const supervisorToken = loginRes.body.token;

      const res = await request(testApp)
        .get("/test/supervisor-only")
        .set("Authorization", `Bearer ${supervisorToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: "ok" });
    });
  });

  describe("Data security and constraints (NFR-01, BR-10)", () => {
    it("TEST-01-11: stored user passwords are always bcrypt hashes with cost factor >= 10", async () => {
      const prisma = getPrisma();
      const users = await prisma.user.findMany();
      expect(users.length).toBeGreaterThan(0);

      for (const u of users) {
        expect(u.passwordHash).toMatch(/^\$2[aby]\$\d{2}\$/);
        const rounds = bcrypt.getRounds(u.passwordHash);
        expect(rounds).toBeGreaterThanOrEqual(10);
      }
    });

    it("TEST-01-12: unique constraints prevent duplicate email, duplicate team name, duplicate student membership, and duplicate supervisor assignment", async () => {
      const prisma = getPrisma();

      // 1. Duplicate user email
      await expect(
        prisma.user.create({
          data: {
            email: "student1@cpms.test",
            name: "Duplicate Student",
            role: "STUDENT",
            passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz123456",
          },
        })
      ).rejects.toThrow();

      // 2. Duplicate team name
      await expect(
        prisma.team.create({
          data: {
            name: "Team Alpha",
          },
        })
      ).rejects.toThrow();

      // 3. Duplicate student in team membership
      const student1 = await prisma.user.findUnique({ where: { email: "student1@cpms.test" } });
      const teamBeta = await prisma.team.findUnique({ where: { name: "Team Beta" } });

      await expect(
        prisma.teamMembership.create({
          data: {
            teamId: teamBeta!.id,
            studentId: student1!.id,
          },
        })
      ).rejects.toThrow();

      // 4. Duplicate supervisor assignment on the same team
      const supervisor1 = await prisma.user.findUnique({ where: { email: "supervisor1@cpms.test" } });
      const teamAlpha = await prisma.team.findUnique({ where: { name: "Team Alpha" } });

      await expect(
        prisma.supervisorAssignment.create({
          data: {
            teamId: teamAlpha!.id,
            supervisorId: supervisor1!.id,
          },
        })
      ).rejects.toThrow();
    });
  });

  describe("Seed idempotency (AC-01-10)", () => {
    it("TEST-01-14: running seed twice produces identical teams, users, memberships and assignments with no duplicates", async () => {
      const prisma = getPrisma();

      async function snapshotSeedState() {
        const [users, teams, memberships, assignments] = await Promise.all([
          prisma.user.findMany({
            orderBy: { email: "asc" },
            select: { id: true, email: true, name: true, role: true },
          }),
          prisma.team.findMany({
            orderBy: { name: "asc" },
            select: { id: true, name: true },
          }),
          prisma.teamMembership.findMany({
            orderBy: [{ teamId: "asc" }, { studentId: "asc" }],
            select: { id: true, teamId: true, studentId: true },
          }),
          prisma.supervisorAssignment.findMany({
            orderBy: [{ teamId: "asc" }, { supervisorId: "asc" }],
            select: { id: true, teamId: true, supervisorId: true },
          }),
        ]);
        return { users, teams, memberships, assignments };
      }

      await seed();
      const firstRun = await snapshotSeedState();

      expect(firstRun.users).toHaveLength(8);
      expect(firstRun.teams.map((t) => t.name)).toEqual([
        "Team Alpha",
        "Team Beta",
        "Team Gamma",
      ]);
      expect(firstRun.memberships).toHaveLength(6);
      expect(firstRun.assignments).toHaveLength(4);

      await expect(seed()).resolves.toBeUndefined();
      const secondRun = await snapshotSeedState();

      expect(secondRun).toEqual(firstRun);

      const loginAfterReseed = await request(app)
        .post("/api/auth/login")
        .send({ email: "student1@cpms.test", password: DEMO_PASSWORD });
      expect(loginAfterReseed.status).toBe(200);
    });
  });

  describe("Defect #92 (DEF-SERVER-ERR): auth resilience, concurrent logout, timing parity and log safety", () => {
    function median(values: number[]): number {
      const sorted = [...values].sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)];
    }

    it("TEST-01-15: DB failure in authenticate returns logged 500 INTERNAL_ERROR without revoking tokens, while 401 controls stay 401", async () => {
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: "student1@cpms.test", password: DEMO_PASSWORD });
      expect(loginRes.status).toBe(200);
      const token = loginRes.body.token as string;
      const expiredToken = signToken({ id: 1, role: "STUDENT" }, { expiresIn: "-1s" });

      const prismaSpy = vi.spyOn(prismaModule, "getPrisma");
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      try {
        prismaSpy.mockReturnValue({
          revokedToken: {
            findUnique: vi.fn().mockRejectedValue(new Error("Can't reach database server")),
          },
          user: { findUnique: vi.fn() },
        } as any);

        const meOutage = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
        expect(meOutage.status).toBe(500);
        expect(meOutage.body).toEqual({
          error: { code: "INTERNAL_ERROR", message: "Unexpected server error" },
        });

        const teamsOutage = await request(app).get("/api/teams").set("Authorization", `Bearer ${token}`);
        expect(teamsOutage.status).toBe(500);
        expect(teamsOutage.body.error.code).toBe("INTERNAL_ERROR");

        // Logout under DB outage returns 500 and must not revoke the token.
        const logoutOutage = await request(app)
          .post("/api/auth/logout")
          .set("Authorization", `Bearer ${token}`);
        expect(logoutOutage.status).toBe(500);
        expect(logoutOutage.body.error.code).toBe("INTERNAL_ERROR");

        // Dropped connection on user lookup returns 500, then recovers on real DB.
        prismaSpy.mockReturnValue({
          revokedToken: { findUnique: vi.fn().mockResolvedValue(null) },
          user: {
            findUnique: vi.fn().mockRejectedValueOnce(new Error("P1017: Server has closed the connection")),
          },
        } as any);
        const staleConn = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
        expect(staleConn.status).toBe(500);
        expect(staleConn.body.error.code).toBe("INTERNAL_ERROR");

        expect(errorSpy).toHaveBeenCalledTimes(4);

        prismaSpy.mockRestore();

        const afterRecovery = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
        expect(afterRecovery.status).toBe(200);
        expect(afterRecovery.body.user.email).toBe("student1@cpms.test");

        // 401 controls remain 401: missing, malformed, expired, and revoked.
        expect((await request(app).get("/api/auth/me")).status).toBe(401);
        expect((await request(app).get("/api/auth/me").set("Authorization", "Bearer bad-token")).status).toBe(401);
        expect((await request(app).get("/api/auth/me").set("Authorization", `Bearer ${expiredToken}`)).status).toBe(401);

        expect((await request(app).post("/api/auth/logout").set("Authorization", `Bearer ${token}`)).status).toBe(204);
        const afterRevoke = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
        expect(afterRevoke.status).toBe(401);
        expect(afterRevoke.body.error.code).toBe("UNAUTHENTICATED");
      } finally {
        prismaSpy.mockRestore();
        errorSpy.mockRestore();
      }
    });

    it("TEST-01-16: parallel POST /api/auth/logout calls for the same token all return 204 and revoke it", async () => {
      for (let round = 0; round < 5; round++) {
        const loginRes = await request(app)
          .post("/api/auth/login")
          .send({ email: "student1@cpms.test", password: DEMO_PASSWORD });
        expect(loginRes.status).toBe(200);
        const token = loginRes.body.token as string;

        const responses = await Promise.all(
          Array.from({ length: 5 }, () =>
            request(app).post("/api/auth/logout").set("Authorization", `Bearer ${token}`)
          )
        );
        expect(
          responses.map((r) => r.status),
          `round ${round + 1} parallel logout statuses`
        ).toEqual([204, 204, 204, 204, 204]);

        const meAfter = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
        expect(meAfter.status).toBe(401);
        expect(meAfter.body.error.code).toBe("UNAUTHENTICATED");
      }
    });

    it("TEST-01-17: login response latency for an unknown email stays comparable to an existing email with wrong password", async () => {
      // Warmup request to eliminate one-time connection/JIT variance.
      await request(app)
        .post("/api/auth/login")
        .send({ email: "student1@cpms.test", password: "wrong-password" });

      const existingDurations: number[] = [];
      const unknownDurations: number[] = [];

      for (let i = 0; i < 5; i++) {
        const t1 = performance.now();
        const existingRes = await request(app)
          .post("/api/auth/login")
          .send({ email: "student1@cpms.test", password: "wrong-password" });
        existingDurations.push(performance.now() - t1);
        expect(existingRes.status).toBe(401);
        expect(existingRes.body).toEqual({
          error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" },
        });

        const t2 = performance.now();
        const unknownRes = await request(app)
          .post("/api/auth/login")
          .send({ email: `unknown-${i}@cpms.test`, password: "wrong-password" });
        unknownDurations.push(performance.now() - t2);
        expect(unknownRes.status).toBe(401);
        expect(unknownRes.body).toEqual({
          error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" },
        });
      }

      const existingMed = median(existingDurations);
      const unknownMed = median(unknownDurations);
      expect(unknownMed).toBeGreaterThanOrEqual(existingMed * 0.4);
    });

    it("TEST-01-18: malformed login JSON containing a password returns 400 BAD_REQUEST and never writes the body to logs", async () => {
      const secretMarker = "SYNTHETIC-PASSWORD-SECRET-92";
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      try {
        const res = await request(app)
          .post("/api/auth/login")
          .set("Content-Type", "application/json")
          .send(`{"email":"student1@cpms.test","password":"${secretMarker}",`);

        expect(res.status).toBe(400);
        expect(res.body).toEqual({
          error: { code: "BAD_REQUEST", message: "Malformed JSON request body" },
        });

        const allLogged = [...errorSpy.mock.calls, ...warnSpy.mock.calls, ...logSpy.mock.calls]
          .flat()
          .map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg) ?? String(arg)))
          .join("\n");
        expect(allLogged).not.toContain(secretMarker);
      } finally {
        logSpy.mockRestore();
        warnSpy.mockRestore();
        errorSpy.mockRestore();
      }
    });
  });
});
