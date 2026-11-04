import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import bcrypt from "bcryptjs";

describe("F-01 Authentication and Team Data API", () => {
  describe("POST /api/auth/login", () => {
    it("TEST-01-01: logs in with valid student credentials and returns a token and user profile", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "student1@cpms.test", password: "demo-password" });

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
        .send({ email: "supervisor1@cpms.test", password: "demo-password" });

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
        .send({ email: "student1@cpms.test", password: "demo-password" });

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
  });

  describe("POST /api/auth/logout", () => {
    it("TEST-01-09: revokes the token so subsequent requests fail with 401 UNAUTHENTICATED", async () => {
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: "student1@cpms.test", password: "demo-password" });

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
        .send({ email: "student1@cpms.test", password: "demo-password" });

      const token = loginRes.body.token;

      const res = await request(app)
        .post("/api/teams/1/milestones")
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "Forbidden Milestone", deadline: new Date(Date.now() + 86400000).toISOString() });

      expect(res.status).toBe(403);
      expect(res.body).toEqual({
        error: { code: "FORBIDDEN", message: "Forbidden" },
      });
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

    it("TEST-01-12: unique constraints prevent duplicate email and duplicate student team membership", async () => {
      const prisma = getPrisma();

      // Duplicate user email should fail
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

      // Duplicate student in team membership should fail
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
    });
  });
});
