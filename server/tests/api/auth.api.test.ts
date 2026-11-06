import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import express from "express";
import { app } from "../../src/app.js";
import { authRouter } from "../../src/routes/auth.routes.js";
import { getPrisma } from "../../src/prisma.js";
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
});
