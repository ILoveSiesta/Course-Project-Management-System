import bcrypt from "bcryptjs";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import * as prismaModule from "../../src/prisma.js";
import { AuthError, loginService } from "../../src/services/auth.service.js";
import { signToken } from "../../src/utils/jwt.js";

describe("Defect #92 auth error forwarding and timing parity (unit)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("TEST-01-15u: authenticate returns 500 INTERNAL_ERROR and logs when DB fails, while keeping invalid tokens 401", async () => {
    const app = createApp();
    const validToken = signToken({ id: 1, role: "STUDENT" });
    const expiredToken = signToken({ id: 1, role: "STUDENT" }, { expiresIn: "-1s" });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Simulate unreachable DB on revokedToken lookup.
    const fakePrismaOutage = {
      revokedToken: {
        findUnique: vi.fn().mockRejectedValue(new Error("Can't reach database server at localhost:5432")),
      },
      user: {
        findUnique: vi.fn(),
      },
    };
    const prismaSpy = vi.spyOn(prismaModule, "getPrisma").mockReturnValue(fakePrismaOutage as any);

    const meOutage = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${validToken}`);
    expect(meOutage.status).toBe(500);
    expect(meOutage.body).toEqual({
      error: { code: "INTERNAL_ERROR", message: "Unexpected server error" },
    });

    const teamsOutage = await request(app)
      .get("/api/teams")
      .set("Authorization", `Bearer ${validToken}`);
    expect(teamsOutage.status).toBe(500);
    expect(teamsOutage.body).toEqual({
      error: { code: "INTERNAL_ERROR", message: "Unexpected server error" },
    });

    const logoutOutage = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${validToken}`);
    expect(logoutOutage.status).toBe(500);
    expect(logoutOutage.body).toEqual({
      error: { code: "INTERNAL_ERROR", message: "Unexpected server error" },
    });

    expect(errorSpy).toHaveBeenCalledTimes(3);

    // Controls during outage: missing, malformed, and expired tokens still return 401 before DB lookup.
    expect((await request(app).get("/api/auth/me")).status).toBe(401);
    expect((await request(app).get("/api/auth/me").set("Authorization", "Bearer bad-token")).status).toBe(401);
    expect((await request(app).get("/api/auth/me").set("Authorization", `Bearer ${expiredToken}`)).status).toBe(401);

    // Simulate dropped pooled connection on user lookup, followed by recovery on the next request.
    fakePrismaOutage.revokedToken.findUnique.mockResolvedValue(null);
    fakePrismaOutage.user.findUnique
      .mockRejectedValueOnce(new Error("P1017: Server has closed the connection"))
      .mockResolvedValueOnce({
        id: 1,
        name: "Student One",
        email: "student1@cpms.test",
        role: "STUDENT",
      });

    const staleConn = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${validToken}`);
    expect(staleConn.status).toBe(500);
    expect(staleConn.body.error.code).toBe("INTERNAL_ERROR");

    const recovered = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${validToken}`);
    expect(recovered.status).toBe(200);
    expect(recovered.body.user.email).toBe("student1@cpms.test");

    // Revoked token control still returns 401 when DB succeeds.
    fakePrismaOutage.revokedToken.findUnique.mockResolvedValue({ jti: "revoked", expiresAt: new Date() });
    const revokedRes = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${validToken}`);
    expect(revokedRes.status).toBe(401);
    expect(revokedRes.body.error.code).toBe("UNAUTHENTICATED");

    expect(prismaSpy).toHaveBeenCalled();
  });

  it("TEST-01-17u: loginService executes a cost-10 bcrypt comparison for unknown emails and never logs in without a user", async () => {
    const fakePrisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };
    vi.spyOn(prismaModule, "getPrisma").mockReturnValue(fakePrisma as any);
    const compareSpy = vi.spyOn(bcrypt, "compare");

    await expect(loginService("nonexistent@cpms.test", "wrong-password")).rejects.toMatchObject({
      status: 401,
      code: "INVALID_CREDENTIALS",
      message: "Invalid email or password",
    } satisfies Partial<AuthError>);

    expect(compareSpy).toHaveBeenCalledTimes(1);
    const comparedHash = compareSpy.mock.calls[0]?.[1];
    expect(typeof comparedHash).toBe("string");
    expect(bcrypt.getRounds(comparedHash as string)).toBeGreaterThanOrEqual(10);

    // Security guard: even if bcrypt.compare resolves true (e.g. matches dummy preimage), unknown user still rejects 401.
    compareSpy.mockResolvedValueOnce(true as never);
    await expect(loginService("nonexistent@cpms.test", "dummy-preimage")).rejects.toMatchObject({
      status: 401,
      code: "INVALID_CREDENTIALS",
    });
  });
});
