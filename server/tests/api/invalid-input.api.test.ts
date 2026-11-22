import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import http from "node:http";
import zlib from "node:zlib";
import request from "supertest";
import { Prisma } from "@prisma/client";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { seed } from "../../prisma/seed.js";

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || "demo-password";
const FUTURE_DEADLINE = new Date(Date.now() + 30 * 86_400_000).toISOString();

const tokens: Record<string, string> = {};
const teamIds: Record<string, number> = {};
const createdMilestoneIds: number[] = [];
const createdSubmissionIds: number[] = [];
const createdFeedbackIds: number[] = [];
const createdTeamIds: number[] = [];

let editableMilestoneId = 0;
let submittableMilestoneId = 0;
let feedbackSubmissionId = 0;

function assertSafeError(body: unknown, expectedCode: string) {
  expect(body).toHaveProperty("error");
  const serialized = JSON.stringify(body);
  expect(serialized).not.toMatch(/syntaxerror|urierror|sql|prisma|stack|select\s|insert\s|22021|unexpected token|at\s+\//i);
  const err = (body as { error: { code: unknown; message: unknown } }).error;
  expect(err.code).toBe(expectedCode);
  expect(typeof err.message).toBe("string");
  expect((err.message as string).length).toBeGreaterThan(0);
}

describe("Defect #90 (DEF-BAD-INPUT): unreadable requests, NUL/unpaired surrogates, and year bounds", () => {
  beforeAll(async () => {
    await seed();

    for (const user of ["student1", "supervisor1"]) {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: `${user}@cpms.test`, password: DEMO_PASSWORD });
      expect(res.status).toBe(200);
      tokens[user] = res.body.token;
    }

    for (const team of await getPrisma().team.findMany()) {
      teamIds[team.name] = team.id;
    }

    const m1 = await request(app)
      .post(`/api/teams/${teamIds["Team Alpha"]}/milestones`)
      .set("Authorization", `Bearer ${tokens.supervisor1}`)
      .send({ title: "DEF-90 Editable Milestone", deadline: FUTURE_DEADLINE });
    expect(m1.status).toBe(201);
    editableMilestoneId = m1.body.milestone.id;
    createdMilestoneIds.push(editableMilestoneId);

    const m2 = await request(app)
      .post(`/api/teams/${teamIds["Team Alpha"]}/milestones`)
      .set("Authorization", `Bearer ${tokens.supervisor1}`)
      .send({ title: "DEF-90 Submission Milestone", deadline: FUTURE_DEADLINE });
    expect(m2.status).toBe(201);
    submittableMilestoneId = m2.body.milestone.id;
    createdMilestoneIds.push(submittableMilestoneId);

    const s1 = await request(app)
      .post(`/api/milestones/${submittableMilestoneId}/submissions`)
      .set("Authorization", `Bearer ${tokens.student1}`)
      .send({ title: "DEF-90 Seed Submission", link: "https://example.com/def90-seed" });
    expect(s1.status).toBe(201);
    feedbackSubmissionId = s1.body.submission.id;
    createdSubmissionIds.push(feedbackSubmissionId);
  });

  afterAll(async () => {
    const prisma = getPrisma();
    if (createdFeedbackIds.length > 0) {
      await prisma.feedback.deleteMany({ where: { id: { in: createdFeedbackIds } } });
    }
    await prisma.feedback.deleteMany({ where: { submissionId: { in: createdSubmissionIds } } });
    await prisma.submission.deleteMany({ where: { milestoneId: { in: createdMilestoneIds } } });
    if (createdSubmissionIds.length > 0) {
      await prisma.submission.deleteMany({ where: { id: { in: createdSubmissionIds } } });
    }
    if (createdMilestoneIds.length > 0) {
      await prisma.milestone.deleteMany({ where: { id: { in: createdMilestoneIds } } });
    }
    if (createdTeamIds.length > 0) {
      await prisma.supervisorAssignment.deleteMany({ where: { teamId: { in: createdTeamIds } } });
      await prisma.team.deleteMany({ where: { id: { in: createdTeamIds } } });
    }
  });

  it("TEST-90-01: positive controls return expected 200/201/400/404", async () => {
    const okLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "student1@cpms.test", password: DEMO_PASSWORD });
    expect(okLogin.status).toBe(200);

    const okMilestone = await request(app)
      .post(`/api/teams/${teamIds["Team Alpha"]}/milestones`)
      .set("Authorization", `Bearer ${tokens.supervisor1}`)
      .send({ title: "DEF-90 Control", deadline: FUTURE_DEADLINE });
    expect(okMilestone.status).toBe(201);
    createdMilestoneIds.push(okMilestone.body.milestone.id);

    const blankTitle = await request(app)
      .post(`/api/teams/${teamIds["Team Alpha"]}/milestones`)
      .set("Authorization", `Bearer ${tokens.supervisor1}`)
      .send({ title: "   ", deadline: FUTURE_DEADLINE });
    expect(blankTitle.status).toBe(400);
    expect(blankTitle.body.error.code).toBe("VALIDATION_ERROR");
    expect(blankTitle.body.error.details).toEqual({ title: "REQUIRED" });

    const missingRoute = await request(app).get("/api/does-not-exist");
    expect(missingRoute.status).toBe(404);
  });

  it("TEST-90-02: Part A malformed JSON returns 400 BAD_REQUEST on login and milestone routes (with or without token) and stores nothing", async () => {
    const beforeCount = await getPrisma().milestone.count();

    const loginMalformed = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send("{bad");
    expect(loginMalformed.status).toBe(400);
    assertSafeError(loginMalformed.body, "BAD_REQUEST");

    const milestoneWithToken = await request(app)
      .post(`/api/teams/${teamIds["Team Alpha"]}/milestones`)
      .set("Authorization", `Bearer ${tokens.supervisor1}`)
      .set("Content-Type", "application/json")
      .send("{bad");
    expect(milestoneWithToken.status).toBe(400);
    assertSafeError(milestoneWithToken.body, "BAD_REQUEST");

    const milestoneWithoutToken = await request(app)
      .post(`/api/teams/${teamIds["Team Alpha"]}/milestones`)
      .set("Content-Type", "application/json")
      .send("{bad");
    expect(milestoneWithoutToken.status).toBe(400);
    assertSafeError(milestoneWithoutToken.body, "BAD_REQUEST");

    expect(await getPrisma().milestone.count()).toBe(beforeCount);
  });

  it("TEST-90-03: Part A primitive JSON body returns 400 BAD_REQUEST and non-JSON login body returns 400 VALIDATION_ERROR", async () => {
    const primitiveLogin = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send('"text"');
    expect(primitiveLogin.status).toBe(400);
    assertSafeError(primitiveLogin.body, "BAD_REQUEST");

    const primitiveMilestone = await request(app)
      .post(`/api/teams/${teamIds["Team Alpha"]}/milestones`)
      .set("Authorization", `Bearer ${tokens.supervisor1}`)
      .set("Content-Type", "application/json")
      .send('"text"');
    expect(primitiveMilestone.status).toBe(400);
    assertSafeError(primitiveMilestone.body, "BAD_REQUEST");

    const nullLogin = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send("null");
    expect(nullLogin.status).toBe(400);
    assertSafeError(nullLogin.body, "BAD_REQUEST");

    const arrayLogin = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send("[]");
    expect(arrayLogin.status).toBe(400);
    assertSafeError(arrayLogin.body, "VALIDATION_ERROR");

    const nonJsonLogin = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "text/plain")
      .send("email=student1@cpms.test");
    expect(nonJsonLogin.status).toBe(400);
    assertSafeError(nonJsonLogin.body, "VALIDATION_ERROR");
  });

  it("TEST-90-04: Part A malformed URL percent-encoding requires auth first (401 without token, 400 BAD_REQUEST with token before role check)", async () => {
    for (const path of ["/api/teams/%zz", "/api/milestones/%zz", "/api/submissions/%zz"]) {
      const noToken = await request(app).get(path);
      expect(noToken.status).toBe(401);
      assertSafeError(noToken.body, "UNAUTHENTICATED");

      const withToken = await request(app)
        .get(path)
        .set("Authorization", `Bearer ${tokens.supervisor1}`);
      expect(withToken.status).toBe(400);
      assertSafeError(withToken.body, "BAD_REQUEST");
    }

    // Param decoding runs before requireRole('SUPERVISOR') once authenticated
    const studentNoToken = await request(app).post("/api/teams/%zz/milestones").send({});
    expect(studentNoToken.status).toBe(401);

    const studentWithToken = await request(app)
      .post("/api/teams/%zz/milestones")
      .set("Authorization", `Bearer ${tokens.student1}`)
      .send({});
    expect(studentWithToken.status).toBe(400);
    assertSafeError(studentWithToken.body, "BAD_REQUEST");
  });

  it("TEST-90-05: Part A body over 100 kB parser limit returns 413 PAYLOAD_TOO_LARGE and stores nothing", async () => {
    const beforeCount = await getPrisma().milestone.count();
    const oversized = JSON.stringify({
      title: "Too large",
      description: "x".repeat(120 * 1024),
      deadline: FUTURE_DEADLINE,
    });

    const res = await request(app)
      .post(`/api/teams/${teamIds["Team Alpha"]}/milestones`)
      .set("Authorization", `Bearer ${tokens.supervisor1}`)
      .set("Content-Type", "application/json")
      .send(oversized);

    expect(res.status).toBe(413);
    assertSafeError(res.body, "PAYLOAD_TOO_LARGE");
    expect(await getPrisma().milestone.count()).toBe(beforeCount);
  });

  it("TEST-90-06: Part A unsupported charset or content encoding returns 415 UNSUPPORTED_MEDIA_TYPE safely", async () => {
    const badCharset = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json; charset=latin1")
      .send(JSON.stringify({ email: "student1@cpms.test", password: DEMO_PASSWORD }));
    expect(badCharset.status).toBe(415);
    assertSafeError(badCharset.body, "UNSUPPORTED_MEDIA_TYPE");

    const badEncoding = await request(app)
      .post(`/api/teams/${teamIds["Team Alpha"]}/milestones`)
      .set("Authorization", `Bearer ${tokens.supervisor1}`)
      .set("Content-Type", "application/json")
      .set("Content-Encoding", "x-unsupported")
      .send("{}");
    expect(badEncoding.status).toBe(415);
    assertSafeError(badEncoding.body, "UNSUPPORTED_MEDIA_TYPE");
  });

  it("TEST-90-07: Part B rejects NUL and unpaired UTF-16 surrogates in F-01 login email/password with 400 VALIDATION_ERROR", async () => {
    const cases: Array<[string, "email" | "password"]> = [
      [`{"email":"student1\\u0000@cpms.test","password":${JSON.stringify(DEMO_PASSWORD)}}`, "email"],
      [`{"email":"student1\\ud800@cpms.test","password":${JSON.stringify(DEMO_PASSWORD)}}`, "email"],
      [`{"email":"student1@cpms.test","password":"pass\\u0000word"}`, "password"],
      [`{"email":"student1@cpms.test","password":"pass\\ud800word"}`, "password"],
    ];

    for (const [raw, field] of cases) {
      const res = await request(app)
        .post("/api/auth/login")
        .set("Content-Type", "application/json")
        .send(raw);
      expect(res.status).toBe(400);
      assertSafeError(res.body, "VALIDATION_ERROR");
      expect(res.body.error.details[field]).toBe("INVALID_CHARACTER");
      expect(res.body.error.message).toBe("Email or password contains an unsupported character");
      expect(res.body.error.message).not.toMatch(/required/i);
    }
  });

  it("TEST-90-08: Part B rejects NUL and unpaired surrogates in F-02, F-05, F-06 milestone text while accepting valid emoji", async () => {
    const beforeCount = await getPrisma().milestone.count();
    const beforeEditable = await getPrisma().milestone.findUniqueOrThrow({ where: { id: editableMilestoneId } });

    for (const escapeSeq of ["\\u0000", "\\ud800"]) {
      const f02Title = await request(app)
        .post(`/api/teams/${teamIds["Team Alpha"]}/milestones`)
        .set("Authorization", `Bearer ${tokens.supervisor1}`)
        .set("Content-Type", "application/json")
        .send(`{"title":"Bad${escapeSeq}Title","deadline":"${FUTURE_DEADLINE}"}`);
      expect(f02Title.status).toBe(400);
      expect(f02Title.body.error.details).toEqual({ title: "INVALID_CHARACTER" });

      const f02Desc = await request(app)
        .post(`/api/teams/${teamIds["Team Alpha"]}/milestones`)
        .set("Authorization", `Bearer ${tokens.supervisor1}`)
        .set("Content-Type", "application/json")
        .send(`{"title":"Valid","description":"Bad${escapeSeq}Desc","deadline":"${FUTURE_DEADLINE}"}`);
      expect(f02Desc.status).toBe(400);
      expect(f02Desc.body.error.details).toEqual({ description: "INVALID_CHARACTER" });

      const f05Edit = await request(app)
        .patch(`/api/milestones/${editableMilestoneId}`)
        .set("Authorization", `Bearer ${tokens.supervisor1}`)
        .set("Content-Type", "application/json")
        .send(`{"title":"Edited${escapeSeq}Title"}`);
      expect(f05Edit.status).toBe(400);
      expect(f05Edit.body.error.details).toEqual({ title: "INVALID_CHARACTER" });

      const f06Multi = await request(app)
        .post("/api/milestones")
        .set("Authorization", `Bearer ${tokens.supervisor1}`)
        .set("Content-Type", "application/json")
        .send(
          `{"teamIds":[${teamIds["Team Alpha"]}],"title":"Multi${escapeSeq}Title","deadline":"${FUTURE_DEADLINE}"}`
        );
      expect(f06Multi.status).toBe(400);
      expect(f06Multi.body.error.details).toEqual({ title: "INVALID_CHARACTER" });
    }

    expect(await getPrisma().milestone.count()).toBe(beforeCount);
    const afterEditable = await getPrisma().milestone.findUniqueOrThrow({ where: { id: editableMilestoneId } });
    expect(afterEditable.title).toBe(beforeEditable.title);

    // Positive control: valid surrogate pair (emoji) succeeds
    const validEmoji = await request(app)
      .post(`/api/teams/${teamIds["Team Alpha"]}/milestones`)
      .set("Authorization", `Bearer ${tokens.supervisor1}`)
      .send({ title: "Milestone 🚀", deadline: FUTURE_DEADLINE });
    expect(validEmoji.status).toBe(201);
    createdMilestoneIds.push(validEmoji.body.milestone.id);
  });

  it("TEST-90-09: Part B rejects NUL and unpaired surrogates in F-03 submission title, description and link", async () => {
    const beforeCount = await getPrisma().submission.count();

    for (const escapeSeq of ["\\u0000", "\\ud800"]) {
      const rTitle = await request(app)
        .post(`/api/milestones/${submittableMilestoneId}/submissions`)
        .set("Authorization", `Bearer ${tokens.student1}`)
        .set("Content-Type", "application/json")
        .send(`{"title":"Sub${escapeSeq}","link":"https://example.com/ok"}`);
      expect(rTitle.status).toBe(400);
      expect(rTitle.body.error.details).toEqual({ title: "INVALID_CHARACTER" });

      const rDesc = await request(app)
        .post(`/api/milestones/${submittableMilestoneId}/submissions`)
        .set("Authorization", `Bearer ${tokens.student1}`)
        .set("Content-Type", "application/json")
        .send(`{"title":"Valid","description":"Desc${escapeSeq}","link":"https://example.com/ok"}`);
      expect(rDesc.status).toBe(400);
      expect(rDesc.body.error.details).toEqual({ description: "INVALID_CHARACTER" });

      const rLink = await request(app)
        .post(`/api/milestones/${submittableMilestoneId}/submissions`)
        .set("Authorization", `Bearer ${tokens.student1}`)
        .set("Content-Type", "application/json")
        .send(`{"title":"Valid","link":"https://example.com/${escapeSeq}"}`);
      expect(rLink.status).toBe(400);
      expect(rLink.body.error.details).toEqual({ link: "INVALID_CHARACTER" });
    }

    expect(await getPrisma().submission.count()).toBe(beforeCount);

    // Positive control
    const okSub = await request(app)
      .post(`/api/milestones/${submittableMilestoneId}/submissions`)
      .set("Authorization", `Bearer ${tokens.student1}`)
      .send({ title: "Sub 🚀", link: "https://example.com/def90-ok" });
    expect(okSub.status).toBe(201);
    createdSubmissionIds.push(okSub.body.submission.id);
  });

  it("TEST-90-10: Part B rejects NUL and unpaired surrogates in F-04 feedback comment", async () => {
    const beforeCount = await getPrisma().feedback.count();

    for (const escapeSeq of ["\\u0000", "\\ud800"]) {
      const res = await request(app)
        .post(`/api/submissions/${feedbackSubmissionId}/feedback`)
        .set("Authorization", `Bearer ${tokens.supervisor1}`)
        .set("Content-Type", "application/json")
        .send(`{"comment":"Feedback${escapeSeq}"}`);
      expect(res.status).toBe(400);
      expect(res.body.error.details).toEqual({ comment: "INVALID_CHARACTER" });
    }

    expect(await getPrisma().feedback.count()).toBe(beforeCount);

    // Positive control
    const okFb = await request(app)
      .post(`/api/submissions/${feedbackSubmissionId}/feedback`)
      .set("Authorization", `Bearer ${tokens.supervisor1}`)
      .send({ comment: "Good work 👍" });
    expect(okFb.status).toBe(201);
    createdFeedbackIds.push(okFb.body.feedback.id);
  });

  it("TEST-90-11: Part B rejects NUL and unpaired surrogates in F-13 team name", async () => {
    const beforeCount = await getPrisma().team.count();

    for (const escapeSeq of ["\\u0000", "\\ud800"]) {
      const res = await request(app)
        .post("/api/teams")
        .set("Authorization", `Bearer ${tokens.supervisor1}`)
        .set("Content-Type", "application/json")
        .send(`{"name":"Team${escapeSeq}"}`);
      expect(res.status).toBe(400);
      expect(res.body.error.details).toEqual({ name: "INVALID_CHARACTER" });
    }

    expect(await getPrisma().team.count()).toBe(beforeCount);

    // Positive control
    const okTeam = await request(app)
      .post("/api/teams")
      .set("Authorization", `Bearer ${tokens.supervisor1}`)
      .send({ name: `DEF-90 Team 🚀 ${Date.now()}` });
    expect(okTeam.status).toBe(201);
    createdTeamIds.push(okTeam.body.team.id);
  });

  it("TEST-90-12: Part B rejects milestone deadline year >= 10000 on F-02, F-06 and F-05 with 400 INVALID_DATE and accepts year 9999", async () => {
    const beforeCount = await getPrisma().milestone.count();
    const beforeEditable = await getPrisma().milestone.findUniqueOrThrow({ where: { id: editableMilestoneId } });
    const year10000 = "+010000-01-01T00:00:00.000Z";
    const year9999 = "9999-12-31T23:59:59.999Z";

    const f02Over = await request(app)
      .post(`/api/teams/${teamIds["Team Alpha"]}/milestones`)
      .set("Authorization", `Bearer ${tokens.supervisor1}`)
      .send({ title: "Year 10000", deadline: year10000 });
    expect(f02Over.status).toBe(400);
    expect(f02Over.body.error.details).toEqual({ deadline: "INVALID_DATE" });

    const f06Over = await request(app)
      .post("/api/milestones")
      .set("Authorization", `Bearer ${tokens.supervisor1}`)
      .send({ teamIds: [teamIds["Team Alpha"]], title: "Multi Year 10000", deadline: year10000 });
    expect(f06Over.status).toBe(400);
    expect(f06Over.body.error.details).toEqual({ deadline: "INVALID_DATE" });

    const f05Over = await request(app)
      .patch(`/api/milestones/${editableMilestoneId}`)
      .set("Authorization", `Bearer ${tokens.supervisor1}`)
      .send({ deadline: year10000 });
    expect(f05Over.status).toBe(400);
    expect(f05Over.body.error.details).toEqual({ deadline: "INVALID_DATE" });

    expect(await getPrisma().milestone.count()).toBe(beforeCount);
    const afterEditable = await getPrisma().milestone.findUniqueOrThrow({ where: { id: editableMilestoneId } });
    expect(afterEditable.deadline.toISOString()).toBe(beforeEditable.deadline.toISOString());

    // Positive boundary controls: year 9999 succeeds
    const f02Max = await request(app)
      .post(`/api/teams/${teamIds["Team Alpha"]}/milestones`)
      .set("Authorization", `Bearer ${tokens.supervisor1}`)
      .send({ title: "Year 9999", deadline: year9999 });
    expect(f02Max.status).toBe(201);
    createdMilestoneIds.push(f02Max.body.milestone.id);

    const f05Max = await request(app)
      .patch(`/api/milestones/${editableMilestoneId}`)
      .set("Authorization", `Bearer ${tokens.supervisor1}`)
      .send({ deadline: year9999 });
    expect(f05Max.status).toBe(200);
  });

  it("TEST-90-13: genuine unexpected errors and unguarded Prisma errors still return safe 500 INTERNAL_ERROR without internals", async () => {
    vi.spyOn(getPrisma().team, "findMany").mockRejectedValueOnce(new Error("secret SQL host password"));
    const genericErr = await request(app)
      .get("/api/teams")
      .set("Authorization", `Bearer ${tokens.supervisor1}`);
    expect(genericErr.status).toBe(500);
    expect(genericErr.body).toEqual({ error: { code: "INTERNAL_ERROR", message: "Unexpected server error" } });

    vi.spyOn(getPrisma().team, "findMany").mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unable to fit integer value '2147483648' into an INT4", {
        code: "P2023",
        clientVersion: "5.22.0",
      })
    );
    const prismaErr = await request(app)
      .get("/api/teams")
      .set("Authorization", `Bearer ${tokens.supervisor1}`);
    expect(prismaErr.status).toBe(500);
    expect(prismaErr.body).toEqual({ error: { code: "INTERNAL_ERROR", message: "Unexpected server error" } });
  });

  it("TEST-90-14: Part A undecodable gzip/deflate compressed bodies return 400 BAD_REQUEST with neutral message while valid gzip passes", async () => {
    const postRawBytes = (
      path: string,
      headers: Record<string, string>,
      payload: Buffer
    ): Promise<{ status: number; body: unknown }> =>
      new Promise((resolve, reject) => {
        const srv = http.createServer(app);
        srv.listen(0, "127.0.0.1", () => {
          const addr = srv.address();
          if (!addr || typeof addr === "string") {
            srv.close();
            reject(new Error("Unexpected server address"));
            return;
          }
          const req = http.request(
            {
              host: "127.0.0.1",
              port: addr.port,
              path,
              method: "POST",
              headers: { ...headers, "Content-Length": String(payload.length) },
            },
            (res) => {
              const chunks: Buffer[] = [];
              res.on("data", (chunk: Buffer) => chunks.push(chunk));
              res.on("end", () => {
                srv.close();
                const text = Buffer.concat(chunks).toString("utf8");
                resolve({ status: res.statusCode ?? 0, body: text ? JSON.parse(text) : null });
              });
            }
          );
          req.on("error", (err) => {
            srv.close();
            reject(err);
          });
          req.end(payload);
        });
      });

    const beforeCount = await getPrisma().milestone.count();

    // Positive control: valid gzipped JSON succeeds
    const validGzipLogin = zlib.gzipSync(
      Buffer.from(JSON.stringify({ email: "student1@cpms.test", password: DEMO_PASSWORD }))
    );
    const okLogin = await postRawBytes(
      "/api/auth/login",
      { "Content-Type": "application/json", "Content-Encoding": "gzip" },
      validGzipLogin
    );
    expect(okLogin.status).toBe(200);

    const validGzipMilestone = zlib.gzipSync(
      Buffer.from(JSON.stringify({ title: "DEF-90 Gzip Control", deadline: FUTURE_DEADLINE }))
    );
    const okMilestone = await postRawBytes(
      `/api/teams/${teamIds["Team Alpha"]}/milestones`,
      {
        Authorization: `Bearer ${tokens.supervisor1}`,
        "Content-Type": "application/json",
        "Content-Encoding": "gzip",
      },
      validGzipMilestone
    );
    expect(okMilestone.status).toBe(201);
    createdMilestoneIds.push((okMilestone.body as { milestone: { id: number } }).milestone.id);

    const countAfterControl = await getPrisma().milestone.count();
    expect(countAfterControl).toBe(beforeCount + 1);

    const invalidCases: Array<[string, Record<string, string>, Buffer]> = [
      [
        "/api/auth/login",
        { "Content-Type": "application/json", "Content-Encoding": "gzip" },
        Buffer.from("not-gzip"),
      ],
      [
        `/api/teams/${teamIds["Team Alpha"]}/milestones`,
        {
          Authorization: `Bearer ${tokens.supervisor1}`,
          "Content-Type": "application/json",
          "Content-Encoding": "gzip",
        },
        Buffer.from("not-gzip"),
      ],
      [
        `/api/teams/${teamIds["Team Alpha"]}/milestones`,
        {
          Authorization: `Bearer ${tokens.supervisor1}`,
          "Content-Type": "application/json",
          "Content-Encoding": "gzip",
        },
        validGzipMilestone.subarray(0, 10),
      ],
      [
        `/api/teams/${teamIds["Team Alpha"]}/milestones`,
        {
          Authorization: `Bearer ${tokens.supervisor1}`,
          "Content-Type": "application/json",
          "Content-Encoding": "deflate",
        },
        Buffer.from("not-deflate"),
      ],
      [
        "/api/auth/login",
        { "Content-Type": "application/json", "Content-Encoding": "deflate" },
        zlib.deflateSync(Buffer.from("{}"), { dictionary: Buffer.from("cpms") }),
      ],
    ];

    for (const [path, headers, payload] of invalidCases) {
      const res = await postRawBytes(path, headers, payload);
      expect(res.status).toBe(400);
      assertSafeError(res.body, "BAD_REQUEST");
      expect((res.body as { error: { message: string } }).error.message).toBe("Request body could not be read");
    }

    expect(await getPrisma().milestone.count()).toBe(countAfterControl);
  });
});
