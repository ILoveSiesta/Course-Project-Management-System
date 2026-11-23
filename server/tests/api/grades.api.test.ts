import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { seed } from "../../prisma/seed.js";

// F-08 Grades and grade release (contract docs/sprints/sprint-2/F-08-grades.md).
// Grade rows are read with SQL so that this file does not depend on the generated Prisma types.

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || "demo-password";
const DAY = 24 * 60 * 60 * 1000;
const PREFIX = "F08-";

const tokens: Record<string, string> = {};
const teamIds: Record<string, number> = {};
const userIds: Record<string, number> = {};
const createdMilestoneIds: number[] = [];

type GradeRow = { score: number; submissionId: number; gradedById: number; updatedAt: Date };

async function login(email: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password: DEMO_PASSWORD });
  expect(res.status).toBe(200);
  return res.body.token;
}

// A milestone with `versions` submissions, made through the API by a student of the team.
async function milestoneWithVersions(teamName: string, studentName: string, versions: number, title: string) {
  const m = await getPrisma().milestone.create({
    data: {
      teamId: teamIds[teamName],
      title: `${PREFIX}${title}`,
      deadline: new Date(Date.now() + 7 * DAY),
      createdById: userIds.supervisor1,
    },
  });
  createdMilestoneIds.push(m.id);
  for (let v = 1; v <= versions; v++) {
    const res = await request(app)
      .post(`/api/milestones/${m.id}/submissions`)
      .set("Authorization", `Bearer ${tokens[studentName]}`)
      .send({ title: `Version ${v} work`, link: `https://example.com/f08-${m.id}-${v}` });
    expect(res.status).toBe(201);
  }
  return m;
}

function withToken(req: request.Test, token: string | undefined) {
  return token ? req.set("Authorization", `Bearer ${token}`) : req;
}
const getGrade = (id: number, token?: string) => withToken(request(app).get(`/api/milestones/${id}/grade`), token);
const putGrade = (id: number, token: string | undefined, body: unknown) =>
  withToken(request(app).put(`/api/milestones/${id}/grade`), token).send(body as object);
// Contract 0.9 (#100): the release body is the grade the page shows. `undefined` sends no body.
const release = (id: number, token: string | undefined, shown: unknown) => {
  const req = withToken(request(app).post(`/api/milestones/${id}/grade/release`), token);
  return shown === undefined ? req : req.send(shown as object);
};

const gradeRows = (milestoneId: number) =>
  getPrisma().$queryRaw<GradeRow[]>`
    SELECT "score", "submissionId", "gradedById", "updatedAt" FROM "Grade" WHERE "milestoneId" = ${milestoneId}
  `;

async function releasedAt(milestoneId: number): Promise<Date | null> {
  const [row] = await getPrisma().$queryRaw<Array<{ gradesReleasedAt: Date | null }>>`
    SELECT "gradesReleasedAt" FROM "Milestone" WHERE id = ${milestoneId}
  `;
  return row.gradesReleasedAt;
}

async function submissionIdOf(milestoneId: number, version: number) {
  const s = await getPrisma().submission.findFirstOrThrow({ where: { milestoneId, version } });
  return s.id;
}

describe("F-08 Grades and grade release API", () => {
  beforeAll(async () => {
    await seed();
    for (const name of ["student1", "student3", "supervisor1", "supervisor2"]) {
      tokens[name] = await login(`${name}@cpms.test`);
      userIds[name] = (await getPrisma().user.findUniqueOrThrow({ where: { email: `${name}@cpms.test` } })).id;
    }
    for (const team of await getPrisma().team.findMany()) {
      teamIds[team.name] = team.id;
    }
  });

  afterAll(async () => {
    if (createdMilestoneIds.length === 0) return;
    try {
      await getPrisma().$executeRawUnsafe(
        `DELETE FROM "Grade" WHERE "milestoneId" IN (${createdMilestoneIds.join(",")})`
      );
    } catch {
      // The Grade table does not exist before the F-08 migration (RED run).
    }
    await getPrisma().feedback.deleteMany({ where: { submission: { milestoneId: { in: createdMilestoneIds } } } });
    await getPrisma().submission.deleteMany({ where: { milestoneId: { in: createdMilestoneIds } } });
    await getPrisma().milestone.deleteMany({ where: { id: { in: createdMilestoneIds } } });
  });

  it("TEST-08-01: an assigned supervisor records a grade linked to a version of the milestone", async () => {
    const m = await milestoneWithVersions("Team Alpha", "student1", 2, "record");

    const res = await putGrade(m.id, tokens.supervisor1, { score: 85, version: 1 });
    expect(res.status).toBe(200);
    expect(res.body.released).toBe(false);
    expect(res.body.releasedAt).toBeNull();
    expect(res.body.grade).toMatchObject({
      score: 85,
      version: 1,
      submissionId: await submissionIdOf(m.id, 1),
      gradedBy: { id: userIds.supervisor1 },
    });
    expect(typeof res.body.grade.gradedAt).toBe("string");

    const rows = await gradeRows(m.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ score: 85, submissionId: await submissionIdOf(m.id, 1), gradedById: userIds.supervisor1 });
  });

  it("TEST-08-02: the grade can be changed before release, still one row; 0 and 100 are accepted", async () => {
    const m = await milestoneWithVersions("Team Alpha", "student1", 2, "change");

    const first = await putGrade(m.id, tokens.supervisor1, { score: 85, version: 1 });
    expect(first.status).toBe(200);

    const changed = await putGrade(m.id, tokens.supervisor1, { score: 90, version: 2 });
    expect(changed.status).toBe(200);
    expect(changed.body.grade).toMatchObject({ score: 90, version: 2 });
    expect(new Date(changed.body.grade.gradedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(first.body.grade.gradedAt).getTime()
    );

    expect((await putGrade(m.id, tokens.supervisor1, { score: 0, version: 2 })).status).toBe(200);
    const top = await putGrade(m.id, tokens.supervisor1, { score: 100, version: 2 });
    expect(top.status).toBe(200);
    expect(top.body.grade.score).toBe(100);

    const rows = await gradeRows(m.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ score: 100, submissionId: await submissionIdOf(m.id, 2) });
  });

  it("TEST-08-03: release is stored once; a second release and a change after release get 409", async () => {
    const m = await milestoneWithVersions("Team Alpha", "student1", 1, "release");
    expect((await putGrade(m.id, tokens.supervisor1, { score: 85, version: 1 })).status).toBe(200);

    const res = await release(m.id, tokens.supervisor1, { score: 85, version: 1 });
    expect(res.status).toBe(200);
    expect(res.body.released).toBe(true);
    expect(res.body.grade.score).toBe(85);
    const stored = await releasedAt(m.id);
    expect(stored).not.toBeNull();
    expect(new Date(res.body.releasedAt).getTime()).toBe(stored!.getTime());

    const again = await release(m.id, tokens.supervisor1, { score: 85, version: 1 });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("GRADE_RELEASED");
    expect((await releasedAt(m.id))!.getTime()).toBe(stored!.getTime());

    const change = await putGrade(m.id, tokens.supervisor1, { score: 50, version: 1 });
    expect(change.status).toBe(409);
    expect(change.body.error.code).toBe("GRADE_RELEASED");
    expect((await gradeRows(m.id))[0].score).toBe(85);
  });

  it("TEST-08-04: release without a grade and a grade without a submission get 409 and store nothing", async () => {
    const ungraded = await milestoneWithVersions("Team Alpha", "student1", 1, "no grade");
    const noGrade = await release(ungraded.id, tokens.supervisor1, { score: 80, version: 1 });
    expect(noGrade.status).toBe(409);
    expect(noGrade.body.error.code).toBe("NO_GRADE");
    expect(await releasedAt(ungraded.id)).toBeNull();

    const empty = await milestoneWithVersions("Team Alpha", "student1", 0, "nothing submitted");
    const nothing = await putGrade(empty.id, tokens.supervisor1, { score: 70, version: 1 });
    expect(nothing.status).toBe(409);
    expect(nothing.body.error.code).toBe("NOTHING_TO_GRADE");
    expect(await gradeRows(empty.id)).toHaveLength(0);
  });

  it("TEST-08-05: a student receives no score before release and the full grade after release", async () => {
    const m = await milestoneWithVersions("Team Alpha", "student1", 1, "visibility");
    expect((await putGrade(m.id, tokens.supervisor1, { score: 85, version: 1 })).status).toBe(200);

    const hidden = await getGrade(m.id, tokens.student1);
    expect(hidden.status).toBe(200);
    expect(hidden.body).toEqual({ grade: null, released: false, releasedAt: null });
    expect(hidden.text).not.toContain("85");
    expect(hidden.text).not.toContain("score");

    const supervisorView = await getGrade(m.id, tokens.supervisor1);
    expect(supervisorView.status).toBe(200);
    expect(supervisorView.body).toMatchObject({ grade: { score: 85, version: 1 }, released: false });

    expect((await release(m.id, tokens.supervisor1, { score: 85, version: 1 })).status).toBe(200);
    const shown = await getGrade(m.id, tokens.student1);
    expect(shown.status).toBe(200);
    expect(shown.body).toMatchObject({ grade: { score: 85, version: 1 }, released: true });
    expect(typeof shown.body.releasedAt).toBe("string");
  });

  it("TEST-08-06: students get 403, out-of-scope users 404, no token 401; any assigned supervisor may grade", async () => {
    const alpha = await milestoneWithVersions("Team Alpha", "student1", 1, "access alpha");
    const beta = await milestoneWithVersions("Team Beta", "student3", 1, "access beta");
    const body = { score: 75, version: 1 };

    for (const res of [await putGrade(alpha.id, tokens.student1, body), await release(alpha.id, tokens.student1, body)]) {
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    }

    for (const res of [
      await getGrade(alpha.id, tokens.supervisor2),
      await putGrade(alpha.id, tokens.supervisor2, body),
      await release(alpha.id, tokens.supervisor2, body),
      await getGrade(alpha.id, tokens.student3),
    ]) {
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
      expect(res.body.grade).toBeUndefined();
    }

    for (const res of [await getGrade(alpha.id), await putGrade(alpha.id, undefined, body), await release(alpha.id, undefined, body)]) {
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHENTICATED");
    }

    expect(await gradeRows(alpha.id)).toHaveLength(0);
    expect(await releasedAt(alpha.id)).toBeNull();

    // Positive controls: the assigned supervisor of Alpha, and supervisor2 on Beta (two supervisors, D-04).
    expect((await putGrade(alpha.id, tokens.supervisor1, body)).status).toBe(200);
    const betaGrade = await putGrade(beta.id, tokens.supervisor2, { score: 80, version: 1 });
    expect(betaGrade.status).toBe(200);
    expect(betaGrade.body.grade.gradedBy.id).toBe(userIds.supervisor2);
  });

  it("TEST-08-07: invalid scores and versions return 400 with details and store nothing", async () => {
    const m = await milestoneWithVersions("Team Alpha", "student1", 1, "validation");
    await milestoneWithVersions("Team Alpha", "student1", 2, "other milestone with version 2");

    const cases: Array<[unknown, Record<string, string>]> = [
      [{ version: 1 }, { score: "REQUIRED" }],
      [{ score: -1, version: 1 }, { score: "OUT_OF_RANGE" }],
      [{ score: 101, version: 1 }, { score: "OUT_OF_RANGE" }],
      [{ score: 85.5, version: 1 }, { score: "INVALID_TYPE" }],
      [{ score: "85", version: 1 }, { score: "INVALID_TYPE" }],
      [{ score: 50 }, { version: "REQUIRED" }],
      [{ score: 50, version: 0 }, { version: "INVALID_TYPE" }],
      [{ score: 50, version: 1.5 }, { version: "INVALID_TYPE" }],
      [{ score: 50, version: "1" }, { version: "INVALID_TYPE" }],
      [{ score: 50, version: 2 }, { version: "NOT_FOUND" }],
    ];
    for (const [body, details] of cases) {
      const res = await putGrade(m.id, tokens.supervisor1, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.details).toEqual(details);
    }
    expect(await gradeRows(m.id)).toHaveLength(0);

    // Positive control: a valid grade on the same milestone.
    expect((await putGrade(m.id, tokens.supervisor1, { score: 50, version: 1 })).status).toBe(200);
  });

  // Defect #100 (DEF-GRADE-STALE): the release names the grade the page shows (contract 0.9, AC-08-11).
  it("TEST-08-15: a release naming a grade other than the stored one gets 409 GRADE_CHANGED and releases nothing", async () => {
    const m = await milestoneWithVersions("Team Alpha", "student1", 2, "stale release");
    expect((await putGrade(m.id, tokens.supervisor1, { score: 80, version: 2 })).status).toBe(200);

    for (const shown of [
      { score: 60, version: 2 },
      { score: 80, version: 1 },
      { score: 60, version: 1 },
    ]) {
      const res = await release(m.id, tokens.supervisor1, shown);
      expect(res.status, JSON.stringify(shown)).toBe(409);
      expect(res.body).toEqual({ error: { code: "GRADE_CHANGED", message: "The grade was changed after this page was loaded. Check the current grade, then release it again" } });
      expect(await releasedAt(m.id)).toBeNull();
    }

    // Control: the grade that is stored is released.
    const ok = await release(m.id, tokens.supervisor1, { score: 80, version: 2 });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ grade: { score: 80, version: 2 }, released: true });

    // GRADE_RELEASED and NO_GRADE come before GRADE_CHANGED.
    const after = await release(m.id, tokens.supervisor1, { score: 60, version: 1 });
    expect(after.status).toBe(409);
    expect(after.body.error.code).toBe("GRADE_RELEASED");
    const ungraded = await milestoneWithVersions("Team Alpha", "student1", 1, "stale release no grade");
    const noGrade = await release(ungraded.id, tokens.supervisor1, { score: 80, version: 1 });
    expect(noGrade.status).toBe(409);
    expect(noGrade.body.error.code).toBe("NO_GRADE");
  });

  it("TEST-08-16: a release without a valid shown grade gets 400 VALIDATION_ERROR and releases nothing", async () => {
    const m = await milestoneWithVersions("Team Alpha", "student1", 2, "release body");
    expect((await putGrade(m.id, tokens.supervisor1, { score: 80, version: 2 })).status).toBe(200);

    const cases: Array<[unknown, Record<string, string>]> = [
      [undefined, { score: "REQUIRED", version: "REQUIRED" }],
      [{}, { score: "REQUIRED", version: "REQUIRED" }],
      [{ score: "80", version: 2 }, { score: "INVALID_TYPE" }],
      [{ score: 101, version: 2 }, { score: "OUT_OF_RANGE" }],
      [{ score: 80, version: 0 }, { version: "INVALID_TYPE" }],
    ];
    for (const [body, details] of cases) {
      const res = await release(m.id, tokens.supervisor1, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.details).toEqual(details);
      expect(await releasedAt(m.id)).toBeNull();
    }
  });

  it("TEST-08-17: a save racing with a release of the old grade never releases the new grade", async () => {
    const outcomes: string[] = [];
    for (let round = 0; round < 10; round++) {
      const m = await milestoneWithVersions("Team Alpha", "student1", 2, `release race ${round}`);
      expect((await putGrade(m.id, tokens.supervisor1, { score: 80, version: 2 })).status).toBe(200);

      const [saved, released] = await Promise.all([
        putGrade(m.id, tokens.supervisor1, { score: 60, version: 1 }),
        release(m.id, tokens.supervisor1, { score: 80, version: 2 }),
      ]);
      const [row] = await gradeRows(m.id);
      const isReleased = (await releasedAt(m.id)) !== null;
      const outcome = `save ${saved.status} release ${released.status} stored ${row.score} released ${isReleased}`;
      outcomes.push(outcome);

      if (released.status === 200) {
        // Release won the lock: the named grade is published and the save is rejected.
        expect(released.body.grade, outcome).toMatchObject({ score: 80, version: 2 });
        expect(saved.status, outcome).toBe(409);
        expect(saved.body.error.code, outcome).toBe("GRADE_RELEASED");
        expect(row.score, outcome).toBe(80);
      } else {
        // Save won the lock: the release is rejected and nothing is published.
        expect(released.status, outcome).toBe(409);
        expect(released.body.error.code, outcome).toBe("GRADE_CHANGED");
        expect(saved.status, outcome).toBe(200);
        expect(isReleased, outcome).toBe(false);
      }
    }
    console.log(`TEST-08-17 outcomes: ${JSON.stringify(outcomes)}`);
  });
});
