import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { seed } from "../../prisma/seed.js";

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || "demo-password";
const DAY = 24 * 60 * 60 * 1000;

const tokens: Record<string, string> = {};
const teamIds: Record<string, number> = {};

async function login(email: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password: DEMO_PASSWORD });
  expect(res.status).toBe(200);
  return res.body.token;
}

function inDays(days: number): string {
  return new Date(Date.now() + days * DAY).toISOString();
}

async function milestoneCount(teamId: number): Promise<number> {
  return getPrisma().milestone.count({ where: { teamId } });
}

describe("F-02 Team view and milestone creation API", () => {
  beforeAll(async () => {
    await seed();
    for (const name of ["student1", "student3", "supervisor1", "supervisor2"]) {
      tokens[name] = await login(`${name}@cpms.test`);
    }
    for (const team of await getPrisma().team.findMany()) {
      teamIds[team.name] = team.id;
    }
  });

  describe("GET /api/teams", () => {
    it("TEST-02-01: a student sees only their own team with members and supervisors", async () => {
      const res = await request(app).get("/api/teams").set("Authorization", `Bearer ${tokens.student1}`);

      expect(res.status).toBe(200);
      expect(res.body.teams).toHaveLength(1);
      const [team] = res.body.teams;
      expect(team.name).toBe("Team Alpha");
      expect(team.members.map((m: { email: string }) => m.email)).toEqual(["student1@cpms.test", "student2@cpms.test"]);
      expect(team.supervisors.map((s: { email: string }) => s.email)).toEqual(["supervisor1@cpms.test"]);
      expect(team.members[0]).not.toHaveProperty("passwordHash");
    });

    it("TEST-02-02: a supervisor sees only assigned teams", async () => {
      const res = await request(app).get("/api/teams").set("Authorization", `Bearer ${tokens.supervisor1}`);

      expect(res.status).toBe(200);
      expect(res.body.teams.map((t: { name: string }) => t.name)).toEqual(["Team Alpha", "Team Beta"]);
    });
  });

  describe("GET /api/teams/:teamId", () => {
    it("TEST-02-03: out-of-scope users get 404 without team data; in-scope users get the team", async () => {
      const path = `/api/teams/${teamIds["Team Alpha"]}`;

      for (const outsider of ["student3", "supervisor2"]) {
        const res = await request(app).get(path).set("Authorization", `Bearer ${tokens[outsider]}`);
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: { code: "NOT_FOUND", message: "Resource not found" } });
      }

      const ok = await request(app).get(path).set("Authorization", `Bearer ${tokens.student1}`);
      expect(ok.status).toBe(200);
      expect(ok.body.team.name).toBe("Team Alpha");
    });
  });

  describe("Authentication on F-02 endpoints", () => {
    it("TEST-02-04: every F-02 endpoint rejects requests without a token", async () => {
      const alpha = teamIds["Team Alpha"];
      const calls = [
        request(app).get("/api/teams"),
        request(app).get(`/api/teams/${alpha}`),
        request(app).get(`/api/teams/${alpha}/milestones`),
        request(app).post(`/api/teams/${alpha}/milestones`).send({ title: "x", deadline: inDays(1) }),
        request(app).get("/api/milestones/1"),
      ];

      for (const res of await Promise.all(calls)) {
        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe("UNAUTHENTICATED");
      }
    });
  });

  describe("POST /api/teams/:teamId/milestones", () => {
    it("TEST-02-05: an assigned supervisor creates a milestone that is persisted", async () => {
      const alpha = teamIds["Team Alpha"];
      const deadline = inDays(7);

      const res = await request(app)
        .post(`/api/teams/${alpha}/milestones`)
        .set("Authorization", `Bearer ${tokens.supervisor1}`)
        .send({ title: "  SRS draft  ", description: "First version of the SRS", deadline });

      expect(res.status).toBe(201);
      expect(res.body.milestone).toMatchObject({
        teamId: alpha,
        title: "SRS draft",
        description: "First version of the SRS",
        deadline,
        createdBy: { name: "Supervisor One" },
      });

      const stored = await getPrisma().milestone.findUnique({ where: { id: res.body.milestone.id } });
      const supervisor1 = await getPrisma().user.findUnique({ where: { email: "supervisor1@cpms.test" } });
      expect(stored).not.toBeNull();
      expect(stored!.teamId).toBe(alpha);
      expect(stored!.createdById).toBe(supervisor1!.id);
      expect(stored!.deadline.toISOString()).toBe(deadline);
    });

    it("TEST-02-06: an unassigned supervisor gets 404 and nothing is stored", async () => {
      const alpha = teamIds["Team Alpha"];
      const before = await milestoneCount(alpha);

      const res = await request(app)
        .post(`/api/teams/${alpha}/milestones`)
        .set("Authorization", `Bearer ${tokens.supervisor2}`)
        .send({ title: "Not my team", deadline: inDays(3) });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
      expect(await milestoneCount(alpha)).toBe(before);
    });

    it("TEST-02-07: a student gets 403 and nothing is stored", async () => {
      const alpha = teamIds["Team Alpha"];
      const before = await milestoneCount(alpha);

      const res = await request(app)
        .post(`/api/teams/${alpha}/milestones`)
        .set("Authorization", `Bearer ${tokens.student1}`)
        .send({ title: "Student milestone", deadline: inDays(3) });

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: { code: "FORBIDDEN", message: "Forbidden" } });
      expect(await milestoneCount(alpha)).toBe(before);
    });

    it("TEST-02-08: invalid input is rejected with per-field details and nothing is stored", async () => {
      const alpha = teamIds["Team Alpha"];
      const before = await milestoneCount(alpha);
      const cases: Array<[Record<string, unknown>, Record<string, string>]> = [
        [{ deadline: inDays(1) }, { title: "REQUIRED" }],
        [{ title: "   ", deadline: inDays(1) }, { title: "REQUIRED" }],
        [{ title: "a".repeat(121), deadline: inDays(1) }, { title: "TOO_LONG" }],
        [{ title: "ok", description: "d".repeat(2001), deadline: inDays(1) }, { description: "TOO_LONG" }],
        [{ title: "ok" }, { deadline: "REQUIRED" }],
        [{ title: "ok", deadline: "not-a-date" }, { deadline: "INVALID_DATE" }],
        [{ title: "ok", deadline: inDays(-1) }, { deadline: "MUST_BE_FUTURE" }],
        [{ title: 42, deadline: inDays(1) }, { title: "INVALID_TYPE" }],
      ];

      for (const [body, details] of cases) {
        const res = await request(app)
          .post(`/api/teams/${alpha}/milestones`)
          .set("Authorization", `Bearer ${tokens.supervisor1}`)
          .send(body);

        expect(res.status, JSON.stringify(body).slice(0, 60)).toBe(400);
        expect(res.body.error.code).toBe("VALIDATION_ERROR");
        expect(res.body.error.details).toEqual(details);
      }
      expect(await milestoneCount(alpha)).toBe(before);
    });
  });

  describe("GET /api/teams/:teamId/milestones", () => {
    it("TEST-02-09: milestones are listed by deadline ascending; out-of-scope users get 404", async () => {
      const beta = teamIds["Team Beta"];
      for (const [title, days] of [["Third", 3], ["First", 1], ["Second", 2]] as const) {
        const res = await request(app)
          .post(`/api/teams/${beta}/milestones`)
          .set("Authorization", `Bearer ${tokens.supervisor2}`)
          .send({ title, deadline: inDays(days) });
        expect(res.status).toBe(201);
      }

      const res = await request(app)
        .get(`/api/teams/${beta}/milestones`)
        .set("Authorization", `Bearer ${tokens.student3}`);
      expect(res.status).toBe(200);
      expect(res.body.milestones.map((m: { title: string }) => m.title)).toEqual(["First", "Second", "Third"]);

      const outsider = await request(app)
        .get(`/api/teams/${beta}/milestones`)
        .set("Authorization", `Bearer ${tokens.student1}`);
      expect(outsider.status).toBe(404);
    });
  });

  describe("GET /api/milestones/:milestoneId", () => {
    it("TEST-02-10: in-scope users get the milestone; others, unknown and non-numeric IDs get 404", async () => {
      const created = await request(app)
        .post(`/api/teams/${teamIds["Team Alpha"]}/milestones`)
        .set("Authorization", `Bearer ${tokens.supervisor1}`)
        .send({ title: "Design review", deadline: inDays(5) });
      const id = created.body.milestone.id;

      const ok = await request(app).get(`/api/milestones/${id}`).set("Authorization", `Bearer ${tokens.student1}`);
      expect(ok.status).toBe(200);
      expect(ok.body.milestone).toMatchObject({ id, title: "Design review" });

      for (const [path, who] of [
        [`/api/milestones/${id}`, "supervisor2"],
        ["/api/milestones/999999", "student1"],
        ["/api/milestones/abc", "student1"],
      ]) {
        const res = await request(app).get(path).set("Authorization", `Bearer ${tokens[who]}`);
        expect(res.status, `${who} ${path}`).toBe(404);
        expect(res.body.error.code).toBe("NOT_FOUND");
      }
    });
  });
});
