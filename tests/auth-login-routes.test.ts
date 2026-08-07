import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  compare: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  recordFailedLoginAttempt: vi.fn(),
  issueAuthChallenge: vi.fn(),
  verifyAuthChallenge: vi.fn(),
  deliverAuthChallenge: vi.fn(),
  prepareAuthDelivery: vi.fn(),
  createUserSession: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("bcryptjs", () => ({ compare: mocks.compare }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique,
      update: mocks.userUpdate,
    },
  },
}));
vi.mock("@/lib/auth-login-lockout", () => ({
  getActiveLoginLock: (
    state: { lockedUntil: Date | null },
    referenceDate: Date,
  ) =>
    state.lockedUntil && state.lockedUntil > referenceDate
      ? {
          retryAfterSeconds: Math.ceil(
            (state.lockedUntil.getTime() - referenceDate.getTime()) / 1_000,
          ),
          retryAt: state.lockedUntil.toISOString(),
        }
      : null,
  recordFailedLoginAttempt: mocks.recordFailedLoginAttempt,
}));
vi.mock("@/lib/auth-challenge", () => ({
  AUTH_CHALLENGE_TYPES: {
    emailVerification: "email_verification",
    login2fa: "login_2fa",
  },
  issueAuthChallenge: mocks.issueAuthChallenge,
  verifyAuthChallenge: mocks.verifyAuthChallenge,
}));
vi.mock("@/lib/auth-delivery", () => ({
  deliverAuthChallenge: mocks.deliverAuthChallenge,
  prepareAuthDelivery: mocks.prepareAuthDelivery,
}));
vi.mock("@/lib/auth-session", () => ({
  createUserSession: mocks.createUserSession,
}));

import { POST as login } from "@/app/api/auth/login/route";
import { POST as verifyLoginCode } from "@/app/api/auth/verify-login-code/route";

const baseUser = {
  id: "user-1",
  email: "explorer@example.com",
  username: "explorer",
  passwordHash: "stored-hash",
  emailVerified: true,
  failedLoginAttempts: 0,
  lockedUntil: null as Date | null,
};

function loginRequest(email = baseUser.email) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "wrong-password" }),
  });
}

describe("login routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.compare.mockResolvedValue(false);
    mocks.recordFailedLoginAttempt.mockResolvedValue({
      failedLoginAttempts: 1,
      lockedUntil: null,
    });
  });

  it("returns 429 with retry metadata and skips password comparison while locked", async () => {
    mocks.userFindUnique.mockResolvedValue({
      ...baseUser,
      failedLoginAttempts: 5,
      lockedUntil: new Date(Date.now() + 30_000),
    });

    const response = await login(loginRequest());
    const payload = await response.json();

    expect(response.status).toBe(429);
    expect(payload.temporaryLock).toBe(true);
    expect(payload.retryAfterSeconds).toBeGreaterThan(0);
    expect(payload.retryAt).toMatch(/Z$/);
    expect(response.headers.get("Retry-After")).toBeTruthy();
    expect(mocks.compare).not.toHaveBeenCalled();
  });

  it("uses the same invalid-credentials response for known and unknown emails", async () => {
    mocks.userFindUnique
      .mockResolvedValueOnce(baseUser)
      .mockResolvedValueOnce(null);

    const knownResponse = await login(loginRequest());
    const unknownResponse = await login(loginRequest("unknown@example.com"));

    expect(knownResponse.status).toBe(401);
    expect(unknownResponse.status).toBe(401);
    expect(await knownResponse.json()).toEqual(await unknownResponse.json());
  });

  it("clears failed attempts and lockedUntil after successful login verification", async () => {
    mocks.verifyAuthChallenge.mockResolvedValue({ userId: baseUser.id });
    mocks.userUpdate.mockResolvedValue({
      ...baseUser,
      activeCreature: "olm",
      createdAt: new Date(),
    });

    const response = await verifyLoginCode(
      new Request("http://localhost/api/auth/verify-login-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: "challenge-12345",
          email: baseUser.email,
          code: "482731",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          failedLoginAttempts: 0,
          lockedUntil: null,
        }),
      }),
    );
  });
});
