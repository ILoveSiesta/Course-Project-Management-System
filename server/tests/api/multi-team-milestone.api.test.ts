import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { seed } from "../../prisma/seed.js";

// F-06 Milestone for several teams (contract docs/sprints/sprint-2/F-06-multi-team-milestone.md).

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || "demo-password";
const DAY = 24 * 60 * 60 * 1000;
const PREFIX = "F06-";

const tokens: Record<string, string> = {};
const teamIds: Record<string, number> = {};
let supervisor1Id: number;

async function login(email: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password: DEMO_PASSWORD });
  expect(res.status).toBe(200);
  return res.body.token;
}

function inDays(days: number): string {
  return new Date(Date.now() + days * DAY).toISOString();
}

function createForTeams(token: string | undefined, body: unknown) {
  const req = request(app).post("/api/milestones");
  if (token) req.set("Authorization", `Bearer ${token}`);
  return req.send(body as object);
}

const rowsWithTitle = (title: string) => getPrisma().milestone.findMany({ where: { title }, orderBy: { id: "asc" } });

describe("F-06 Milestone for several teams API", () => {
  beforeAll(async () => {
    await seed();
    for (const name of ["student1", "student3", "supervisor1"]) {
      tokens[name] = await login(`${name}@cpms.test`);
    }
    for (const team of await getPrisma().team.findMany()) {
      teamIds[team.name] = team.id;
    }
    supervisor1Id = (await getPrisma().user.findUniqueOrThrow({ where: { email: "supervisor1@cpms.test" } })).id;
  });

  afterAll(async () => {
    await getPrisma().submission.deleteMany({ where: { milestone: { title: { startsWith: PREFIX } } } });
    await getPrisma().milestone.deleteMany({ where: { title: { startsWith: PREFIX } } });
  });

  it("TEST-06-01: creates one milestone per assigned team in request order with the same fields", async () => {
    const title = `${PREFIX}Design review`;
    const deadline = inDays(7);
    const res = await createForTeams(tokens.supervisor1, {
      teamIds: [teamIds["Team Alpha"], teamIds["Team Beta"]],
      title,
      description: "Bring the SDS",
      deadline,
    });

    expect(res.status).toBe(201);
    expect(res.body.milestones).toHaveLength(2);
    expect(res.body.milestones.map((m: { teamId: number }) => m.teamId)).toEqual([
      teamIds["Team Alpha"],
      teamIds["Team Beta"],
    ]);
    for (const m of res.body.milestones) {
      expect(m).toMatchObject({ title, description: "Bring the SDS", deadline, createdBy: { id: supervisor1Id } });
    }
    expect(res.body.milestones[0].id).not.toBe(res.body.milestones[1].id);

    const rows = await rowsWithTitle(title);
    expect(rows.map((r) => r.teamId)).toEqual([teamIds["Team Alpha"], teamIds["Team Beta"]]);
  });

  it("TEST-06-02: each team sees only its own copy of the milestone", async () => {
    const title = `${PREFIX}Per team`;
    const res = await createForTeams(tokens.supervisor1, {
      teamIds: [teamIds["Team Alpha"], teamIds["Team Beta"]],
      title,
      deadline: inDays(5),
    });
    expect(res.status).toBe(201);
    const [alphaCopy, betaCopy] = res.body.milestones;

    const alphaList = await request(app)
      .get(`/api/teams/${teamIds["Team Alpha"]}/milestones`)
      .set("Authorization", `Bearer ${tokens.student1}`);
    expect(alphaList.status).toBe(200);
    const alphaIds = alphaList.body.milestones.filter((m: { title: string }) => m.title === title).map((m: { id: number }) => m.id);
    expect(alphaIds).toEqual([alphaCopy.id]);

    const betaList = await request(app)
      .get(`/api/teams/${teamIds["Team Beta"]}/milestones`)
      .set("Authorization", `Bearer ${tokens.student3}`);
    expect(betaList.status).toBe(200);
    const betaIds = betaList.body.milestones.filter((m: { title: string }) => m.title === title).map((m: { id: number }) => m.id);
    expect(betaIds).toEqual([betaCopy.id]);

    const crossTeam = await request(app)
      .get(`/api/milestones/${betaCopy.id}`)
      .set("Authorization", `Bearer ${tokens.student1}`);
    expect(crossTeam.status).toBe(404);
    expect(crossTeam.body.error.code).toBe("NOT_FOUND");
  });

  it("TEST-06-03: one unassigned or unknown team rejects the whole request with nothing stored", async () => {
    const withGamma = `${PREFIX}With Gamma`;
    const gamma = await createForTeams(tokens.supervisor1, {
      teamIds: [teamIds["Team Alpha"], teamIds["Team Gamma"]],
      title: withGamma,
      deadline: inDays(5),
    });
    expect(gamma.status).toBe(404);
    expect(gamma.body.error.code).toBe("NOT_FOUND");
    expect(gamma.body.milestones).toBeUndefined();
    expect(await rowsWithTitle(withGamma)).toHaveLength(0);

    const withUnknown = `${PREFIX}With unknown`;
    const unknown = await createForTeams(tokens.supervisor1, {
      teamIds: [teamIds["Team Alpha"], 999999],
      title: withUnknown,
      deadline: inDays(5),
    });
    expect(unknown.status).toBe(404);
    expect(await rowsWithTitle(withUnknown)).toHaveLength(0);

    // Positive control: the same request with only assigned teams succeeds.
    const control = `${PREFIX}Assigned only`;
    const ok = await createForTeams(tokens.supervisor1, {
      teamIds: [teamIds["Team Alpha"]],
      title: control,
      deadline: inDays(5),
    });
    expect(ok.status).toBe(201);
    expect(await rowsWithTitle(control)).toHaveLength(1);
  });

  it("TEST-06-04: a student gets 403 and a request without a token gets 401; nothing is stored", async () => {
    const title = `${PREFIX}Access`;
    const body = { teamIds: [teamIds["Team Alpha"]], title, deadline: inDays(5) };

    const asStudent = await createForTeams(tokens.student1, body);
    expect(asStudent.status).toBe(403);
    expect(asStudent.body.error.code).toBe("FORBIDDEN");

    const noToken = await createForTeams(undefined, body);
    expect(noToken.status).toBe(401);
    expect(noToken.body.error.code).toBe("UNAUTHENTICATED");

    expect(await rowsWithTitle(title)).toHaveLength(0);

    // Positive control: the assigned supervisor can send the same request.
    const ok = await createForTeams(tokens.supervisor1, body);
    expect(ok.status).toBe(201);
  });

  it("TEST-06-05: invalid team lists and invalid fields return 400 with details and store nothing", async () => {
    const title = `${PREFIX}Invalid`;
    const alpha = teamIds["Team Alpha"];
    const cases: Array<[unknown, string]> = [
      [undefined, "REQUIRED"],
      [[], "REQUIRED"],
      [String(alpha), "INVALID_TYPE"],
      [[0], "INVALID_TYPE"],
      [[-1], "INVALID_TYPE"],
      [[1.5], "INVALID_TYPE"],
      [[String(alpha)], "INVALID_TYPE"],
      [[alpha, alpha], "DUPLICATE"],
      [Array.from({ length: 21 }, (_, i) => i + 1), "TOO_MANY"],
    ];
    for (const [ids, code] of cases) {
      const res = await createForTeams(tokens.supervisor1, { teamIds: ids, title, deadline: inDays(5) });
      expect(res.status, JSON.stringify(ids)).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.details).toEqual({ teamIds: code });
    }

    const fields = await createForTeams(tokens.supervisor1, {
      teamIds: [alpha, teamIds["Team Beta"]],
      title: "   ",
      deadline: new Date(Date.now() - DAY).toISOString(),
    });
    expect(fields.status).toBe(400);
    expect(fields.body.error.details).toEqual({ title: "REQUIRED", deadline: "MUST_BE_FUTURE" });

    expect(await rowsWithTitle(title)).toHaveLength(0);

    // Positive control: a valid request with the same team list succeeds.
    const ok = await createForTeams(tokens.supervisor1, { teamIds: [alpha], title: `${PREFIX}Valid`, deadline: inDays(5) });
    expect(ok.status).toBe(201);
  });

  it("TEST-06-10: a team ID above the INT4 maximum is an unknown team (404), and nothing is stored (#89)", async () => {
    const alpha = teamIds["Team Alpha"];
    const max = 2_147_483_647;
    const over = max + 1;
    const deadline = inDays(5);

    // Controls: the largest INT4 value is an unknown team, and an assigned team is accepted.
    const atMax = await createForTeams(tokens.supervisor1, { teamIds: [max], title: `${PREFIX}INT4 max`, deadline });
    expect(atMax.status).toBe(404);
    const ok = await createForTeams(tokens.supervisor1, { teamIds: [alpha], title: `${PREFIX}INT4 control`, deadline });
    expect(ok.status).toBe(201);

    // Soft assertions, so that one run reports every failing input.
    const title = `${PREFIX}INT4 over`;
    for (const ids of [[over], [alpha, over], [over, alpha], [1e20], [Number.MAX_VALUE]]) {
      const res = await createForTeams(tokens.supervisor1, { teamIds: ids, title, deadline });
      expect.soft(res.status, JSON.stringify(ids)).toBe(404);
      expect.soft(res.body).toEqual({ error: { code: "NOT_FOUND", message: "Resource not found" } });
    }

    // The check order is unchanged: 401, 403, teamIds format (400), scope (404), fields (400).
    const blankTitle = await createForTeams(tokens.supervisor1, { teamIds: [over], title: "   ", deadline });
    expect.soft(blankTitle.status, "too-large ID with a blank title").toBe(404);

    const twice = await createForTeams(tokens.supervisor1, { teamIds: [over, over], title, deadline });
    expect.soft(twice.status).toBe(400);
    expect.soft(twice.body.error.details).toEqual({ teamIds: "DUPLICATE" });

    const tooMany = Array.from({ length: 21 }, (_, i) => over + i);
    const many = await createForTeams(tokens.supervisor1, { teamIds: tooMany, title, deadline });
    expect.soft(many.status).toBe(400);
    expect.soft(many.body.error.details).toEqual({ teamIds: "TOO_MANY" });

    const asStudent = await createForTeams(tokens.student1, { teamIds: [over], title, deadline });
    expect.soft(asStudent.status).toBe(403);
    const noToken = await createForTeams(undefined, { teamIds: [over], title, deadline });
    expect.soft(noToken.status).toBe(401);

    expect(await rowsWithTitle(title)).toHaveLength(0);
  });

  it("TEST-06-11: team, milestone and submission route IDs above the INT4 maximum return 404 (#89)", async () => {
    const alpha = teamIds["Team Alpha"];
    const get = (path: string) => request(app).get(path).set("Authorization", `Bearer ${tokens.supervisor1}`);

    // Positive controls: the same three routes answer 200 for records in scope.
    const created = await createForTeams(tokens.supervisor1, { teamIds: [alpha], title: `${PREFIX}Route IDs`, deadline: inDays(5) });
    expect(created.status).toBe(201);
    const milestoneId = created.body.milestones[0].id;
    const submitted = await request(app)
      .post(`/api/milestones/${milestoneId}/submissions`)
      .set("Authorization", `Bearer ${tokens.student1}`)
      .send({ title: "Route ID control", link: "https://example.com/route-id" });
    expect(submitted.status).toBe(201);

    const records = { teams: alpha, milestones: milestoneId, submissions: submitted.body.submission.id };
    for (const [resource, id] of Object.entries(records)) {
      expect((await get(`/api/${resource}/${id}`)).status, resource).toBe(200);
      const res = await get(`/api/${resource}/2147483648`);
      expect(res.status, resource).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    }
  });
});
