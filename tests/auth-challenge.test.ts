import { beforeEach, describe, expect, it, vi } from "vitest";

type ChallengeRecord = {
  id: string;
  userId: string | null;
  email: string;
  type: string;
  codeHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  attemptCount: number;
  maxAttempts: number;
  resendCount: number;
  lastSentAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const fake = vi.hoisted(() => ({
  records: [] as ChallengeRecord[],
  sendAuthCodeEmail: vi.fn(),
  deleteMany: vi.fn(),
  count: vi.fn(),
  updateMany: vi.fn(),
  create: vi.fn(),
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "user-agent": "vitest" }),
}));
vi.mock("@/lib/security/secrets", () => ({
  getAuthCodeSecret: () => "test-auth-code-secret-with-32-characters",
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    authChallenge: {
      deleteMany: fake.deleteMany,
      count: fake.count,
      updateMany: fake.updateMany,
      create: fake.create,
      findFirst: fake.findFirst,
      findUnique: fake.findUnique,
    },
    $transaction: fake.transaction,
  },
}));
vi.mock("@/lib/auth-email", () => ({
  sendAuthCodeEmail: fake.sendAuthCodeEmail,
}));

import { getAuthDeliveryConfig } from "@/lib/auth-config";
import {
  AUTH_CHALLENGE_TYPES,
  type AuthChallengeType,
  completePendingAuthResponse,
  generateVerificationCode,
  hashVerificationCode,
  issueAuthChallenge,
  resendAuthChallenge,
  verifyAuthChallenge,
} from "@/lib/auth-challenge";
import { deliverAuthChallenge } from "@/lib/auth-delivery";

type ChallengeWhere = {
  id?: string;
  email?: string;
  type?: string;
  ipAddress?: string;
  consumedAt?: Date | null;
  createdAt?: { gte?: Date };
  expiresAt?: { gt?: Date; lt?: Date };
  attemptCount?: { lt?: number };
  OR?: ChallengeWhere[];
};

function matches(record: ChallengeRecord, where: ChallengeWhere): boolean {
  if (where.OR && !where.OR.some((clause) => matches(record, clause))) return false;
  if (where.id !== undefined && record.id !== where.id) return false;
  if (where.email !== undefined && record.email !== where.email) return false;
  if (where.type !== undefined && record.type !== where.type) return false;
  if (where.ipAddress !== undefined && record.ipAddress !== where.ipAddress) return false;
  if (where.consumedAt !== undefined && record.consumedAt !== where.consumedAt) {
    return false;
  }
  if (where.createdAt?.gte && record.createdAt < where.createdAt.gte) return false;
  if (where.expiresAt?.gt && record.expiresAt <= where.expiresAt.gt) return false;
  if (where.expiresAt?.lt && record.expiresAt >= where.expiresAt.lt) return false;
  if (
    where.attemptCount?.lt !== undefined &&
    record.attemptCount >= where.attemptCount.lt
  ) {
    return false;
  }
  return true;
}

function configureInMemoryPrisma() {
  fake.deleteMany.mockImplementation(async ({ where }: { where: ChallengeWhere }) => {
    const previousLength = fake.records.length;
    fake.records = fake.records.filter((record) => !matches(record, where));
    return { count: previousLength - fake.records.length };
  });
  fake.count.mockImplementation(async ({ where }: { where: ChallengeWhere }) =>
    fake.records.filter((record) => matches(record, where)).length,
  );
  fake.updateMany.mockImplementation(
    async ({
      where,
      data,
    }: {
      where: ChallengeWhere;
      data: { consumedAt?: Date; attemptCount?: { increment: number } };
    }) => {
      const selected = fake.records.filter((record) => matches(record, where));
      for (const record of selected) {
        if (data.consumedAt) record.consumedAt = data.consumedAt;
        if (data.attemptCount) record.attemptCount += data.attemptCount.increment;
        record.updatedAt = new Date();
      }
      return { count: selected.length };
    },
  );
  fake.create.mockImplementation(
    async ({ data }: { data: Omit<ChallengeRecord, "attemptCount" | "consumedAt" | "createdAt" | "updatedAt"> }) => {
      const createdAt = new Date();
      const record: ChallengeRecord = {
        ...data,
        attemptCount: 0,
        consumedAt: null,
        createdAt,
        updatedAt: createdAt,
      };
      fake.records.push(record);
      return record;
    },
  );
  fake.findFirst.mockImplementation(
    async ({ where }: { where: ChallengeWhere }) =>
      fake.records.find((record) => matches(record, where)) ?? null,
  );
  fake.findUnique.mockImplementation(
    async ({ where }: { where: { id: string } }) =>
      fake.records.find((record) => record.id === where.id) ?? null,
  );
  fake.transaction.mockImplementation(
    async (callback: (client: { authChallenge: Record<string, unknown> }) => unknown) =>
      callback({
        authChallenge: {
          deleteMany: fake.deleteMany,
          count: fake.count,
          updateMany: fake.updateMany,
          create: fake.create,
          findFirst: fake.findFirst,
          findUnique: fake.findUnique,
        },
      }),
  );
}

async function issue(
  type: AuthChallengeType = AUTH_CHALLENGE_TYPES.emailVerification,
) {
  return issueAuthChallenge({
    recipient: { email: "explorer@example.com", userId: "user-1" },
    type,
    message: "Codigo emitido.",
  });
}

describe("authentication challenges and demo delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fake.records = [];
    process.env.AUTH_CODE_EXPIRATION_MINUTES = "10";
    process.env.AUTH_CODE_MAX_ATTEMPTS = "5";
    process.env.AUTH_MAX_RESENDS = "5";
    process.env.AUTH_RESEND_COOLDOWN_SECONDS = "10";
    configureInMemoryPrisma();
    fake.sendAuthCodeEmail.mockResolvedValue({ ok: true, mode: "resend" });
  });

  it("generates cryptographic-looking six-digit codes", () => {
    expect(generateVerificationCode()).toMatch(/^\d{6}$/);
  });

  it("generates a fresh code for each challenge", async () => {
    const first = await issue();
    const second = await issue(AUTH_CHALLENGE_TYPES.login2fa);

    expect(first.code).not.toBe(second.code);
  });

  it("stores only a challenge-bound hash", async () => {
    const issued = await issue();

    expect(issued.challenge.codeHash).not.toContain(issued.code);
    expect(issued.challenge.codeHash).toBe(
      hashVerificationCode({
        challengeId: issued.challenge.id,
        type: AUTH_CHALLENGE_TYPES.emailVerification,
        email: issued.challenge.email,
        code: issued.code,
      }),
    );
  });

  it("verifies the correct code", async () => {
    const issued = await issue();

    await expect(
      verifyAuthChallenge({
        challengeId: issued.challenge.id,
        email: issued.challenge.email,
        code: issued.code,
        type: AUTH_CHALLENGE_TYPES.emailVerification,
      }),
    ).resolves.toMatchObject({ id: issued.challenge.id });
  });

  it("allows a code to be consumed only once", async () => {
    const issued = await issue();
    const input = {
      challengeId: issued.challenge.id,
      email: issued.challenge.email,
      code: issued.code,
      type: AUTH_CHALLENGE_TYPES.emailVerification,
    } as const;

    await verifyAuthChallenge(input);
    await expect(verifyAuthChallenge(input)).rejects.toThrow("CHALLENGE_ALREADY_USED");
  });

  it("increments attempts and reports the remaining count for a wrong code", async () => {
    const issued = await issue();

    await expect(
      verifyAuthChallenge({
        challengeId: issued.challenge.id,
        email: issued.challenge.email,
        code: "000000",
        type: AUTH_CHALLENGE_TYPES.emailVerification,
      }),
    ).rejects.toMatchObject({
      message: "CHALLENGE_INVALID_CODE",
      remainingAttempts: 4,
    });
    expect(issued.challenge.attemptCount).toBe(1);
  });

  it("rejects a challenge with no attempts left", async () => {
    const issued = await issue();
    issued.challenge.attemptCount = issued.challenge.maxAttempts;

    await expect(
      verifyAuthChallenge({
        challengeId: issued.challenge.id,
        email: issued.challenge.email,
        code: issued.code,
        type: AUTH_CHALLENGE_TYPES.emailVerification,
      }),
    ).rejects.toThrow("CHALLENGE_ATTEMPTS_EXCEEDED");
  });

  it("rejects expired challenges", async () => {
    const issued = await issue();
    issued.challenge.expiresAt = new Date(Date.now() - 1_000);

    await expect(
      verifyAuthChallenge({
        challengeId: issued.challenge.id,
        email: issued.challenge.email,
        code: issued.code,
        type: AUTH_CHALLENGE_TYPES.emailVerification,
      }),
    ).rejects.toThrow("CHALLENGE_EXPIRED");
  });

  it("invalidates the previous code when resending", async () => {
    const first = await issue();
    first.challenge.lastSentAt = new Date(Date.now() - 11_000);

    const second = await resendAuthChallenge({
      challengeId: first.challenge.id,
      email: first.challenge.email,
    });

    expect(first.challenge.consumedAt).toBeInstanceOf(Date);
    expect(second.challenge.id).not.toBe(first.challenge.id);
    expect(second.code).not.toBe(first.code);
  });

  it("does not allow one challenge code to verify another challengeId", async () => {
    const first = await issue();
    const second = await issue(AUTH_CHALLENGE_TYPES.login2fa);

    await expect(
      verifyAuthChallenge({
        challengeId: second.challenge.id,
        email: second.challenge.email,
        code: first.code,
        type: AUTH_CHALLENGE_TYPES.login2fa,
      }),
    ).rejects.toThrow("CHALLENGE_INVALID_CODE");
  });

  it("rejects a challenge from another flow or an unknown id", async () => {
    const issued = await issue();

    await expect(
      verifyAuthChallenge({
        challengeId: issued.challenge.id,
        email: issued.challenge.email,
        code: issued.code,
        type: AUTH_CHALLENGE_TYPES.login2fa,
      }),
    ).rejects.toThrow("CHALLENGE_NOT_FOUND");
    await expect(
      verifyAuthChallenge({
        challengeId: "unknown-challenge",
        email: issued.challenge.email,
        code: issued.code,
        type: AUTH_CHALLENGE_TYPES.emailVerification,
      }),
    ).rejects.toThrow("CHALLENGE_NOT_FOUND");
  });

  it("never includes demoCode in email-mode responses", async () => {
    const issued = await issue();
    const response = await deliverAuthChallenge(issued, {
      mode: "email",
      apiKey: "re_test",
      from: "Speleum <auth@example.com>",
    });

    expect(response.deliveryMode).toBe("email");
    expect(response).not.toHaveProperty("demoCode");
  });

  it("adds demoCode only when creation or resend delivery completes", async () => {
    const issued = await issue();

    expect(issued.pending).not.toHaveProperty("demoCode");
    const response = await deliverAuthChallenge(issued, { mode: "demo" });
    expect(response).toMatchObject({
      deliveryMode: "demo",
      demoCode: issued.code,
    });
  });

  it("requires explicit public-demo confirmation in production", () => {
    expect(() =>
      getAuthDeliveryConfig({
        NODE_ENV: "production",
        AUTH_DELIVERY_MODE: "demo",
      }),
    ).toThrow("PUBLIC_DEMO_AUTH_NOT_ALLOWED");
    expect(
      getAuthDeliveryConfig({
        NODE_ENV: "production",
        AUTH_DELIVERY_MODE: "demo",
        ALLOW_PUBLIC_DEMO_AUTH: "true",
      }),
    ).toEqual({ mode: "demo" });
  });

  it("rejects missing or invalid delivery configuration clearly", () => {
    expect(() => getAuthDeliveryConfig({ NODE_ENV: "development" })).toThrow(
      "AUTH_DELIVERY_MODE_REQUIRED",
    );
    expect(() =>
      getAuthDeliveryConfig({
        NODE_ENV: "development",
        AUTH_DELIVERY_MODE: "automatic",
      }),
    ).toThrow("AUTH_DELIVERY_MODE_INVALID");
    expect(() =>
      getAuthDeliveryConfig({
        NODE_ENV: "development",
        AUTH_DELIVERY_MODE: "email",
      }),
    ).toThrow("AUTH_EMAIL_FROM_REQUIRED");
  });

  it("does not write the demo code to logs", async () => {
    const issued = await issue();
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await deliverAuthChallenge(issued, { mode: "demo" });

    expect(log).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it("supports demo delivery for registration and login verification flows", async () => {
    const registration = await issue(AUTH_CHALLENGE_TYPES.emailVerification);
    const login = await issue(AUTH_CHALLENGE_TYPES.login2fa);

    const registrationResponse = completePendingAuthResponse(
      registration.pending,
      "demo",
      registration.code,
    );
    const loginResponse = completePendingAuthResponse(
      login.pending,
      "demo",
      login.code,
    );

    expect(registrationResponse.status).toBe("pending_email_verification");
    expect(loginResponse.status).toBe("pending_login_verification");
    expect(registrationResponse.demoCode).toMatch(/^\d{6}$/);
    expect(loginResponse.demoCode).toMatch(/^\d{6}$/);
  });

  it("invalidates a newly issued challenge when email delivery fails", async () => {
    const issued = await issue();
    fake.sendAuthCodeEmail.mockResolvedValueOnce({ ok: false, mode: "failed" });

    await expect(
      deliverAuthChallenge(issued, {
        mode: "email",
        apiKey: "re_test",
        from: "Speleum <auth@example.com>",
      }),
    ).rejects.toThrow("EMAIL_DELIVERY_FAILED");
    expect(issued.challenge.consumedAt).toBeInstanceOf(Date);
  });
});
