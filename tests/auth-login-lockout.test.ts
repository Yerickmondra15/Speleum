import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({
  state: {
    failedLoginAttempts: 0,
    lockedUntil: null as Date | null,
  },
  queryRaw: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: fake.queryRaw,
    user: { findUnique: fake.findUnique },
  },
}));

import {
  getActiveLoginLock,
  getLoginLockDurationSeconds,
  recordFailedLoginAttempt,
} from "@/lib/auth-login-lockout";

function configureAtomicDatabase() {
  fake.queryRaw.mockImplementation(
    async (_parts: TemplateStringsArray, ...values: unknown[]) => {
      const threshold = values[0] as number;
      const referenceDate = values[1] as Date;
      const maxSeconds = values[2] as number;
      const baseSeconds = values[3] as number;

      if (fake.state.lockedUntil && fake.state.lockedUntil > referenceDate) {
        return [];
      }

      fake.state.failedLoginAttempts += 1;
      const exponent = fake.state.failedLoginAttempts - threshold;
      const duration =
        exponent >= 0
          ? Math.min(maxSeconds, baseSeconds * 2 ** exponent)
          : 0;
      fake.state.lockedUntil = duration
        ? new Date(referenceDate.getTime() + duration * 1_000)
        : null;

      return [{ ...fake.state }];
    },
  );
  fake.findUnique.mockImplementation(async () => ({ ...fake.state }));
}

describe("progressive login lockout", () => {
  beforeEach(() => {
    process.env.AUTH_LOGIN_LOCK_THRESHOLD = "5";
    process.env.AUTH_LOGIN_LOCK_BASE_SECONDS = "30";
    process.env.AUTH_LOGIN_LOCK_MAX_MINUTES = "15";
    fake.state.failedLoginAttempts = 0;
    fake.state.lockedUntil = null;
    vi.clearAllMocks();
    configureAtomicDatabase();
  });

  it("increments the counter for an incorrect password", async () => {
    const result = await recordFailedLoginAttempt("user-1");

    expect(result.failedLoginAttempts).toBe(1);
    expect(fake.state.failedLoginAttempts).toBe(1);
  });

  it("keeps allowing attempts before the configured threshold", async () => {
    fake.state.failedLoginAttempts = 3;

    const result = await recordFailedLoginAttempt("user-1");

    expect(result.failedLoginAttempts).toBe(4);
    expect(result.lockedUntil).toBeNull();
  });

  it("sets lockedUntil exactly when the threshold is reached", async () => {
    fake.state.failedLoginAttempts = 4;
    const referenceDate = new Date("2026-08-06T12:00:00.000Z");

    const result = await recordFailedLoginAttempt("user-1", referenceDate);

    expect(result.failedLoginAttempts).toBe(5);
    expect(result.lockedUntil?.toISOString()).toBe("2026-08-06T12:00:30.000Z");
  });

  it("recognizes an active lock and exposes safe retry metadata", () => {
    const referenceDate = new Date("2026-08-06T12:00:00.000Z");
    const lock = getActiveLoginLock(
      {
        failedLoginAttempts: 5,
        lockedUntil: new Date("2026-08-06T12:00:30.000Z"),
      },
      referenceDate,
    );

    expect(lock).toEqual({
      retryAfterSeconds: 30,
      retryAt: "2026-08-06T12:00:30.000Z",
    });
  });

  it("allows processing another attempt after a lock expires", async () => {
    fake.state.failedLoginAttempts = 5;
    fake.state.lockedUntil = new Date("2026-08-06T11:59:59.000Z");

    const result = await recordFailedLoginAttempt(
      "user-1",
      new Date("2026-08-06T12:00:00.000Z"),
    );

    expect(result.failedLoginAttempts).toBe(6);
    expect(result.lockedUntil?.toISOString()).toBe("2026-08-06T12:01:00.000Z");
  });

  it("does not let simultaneous attempts bypass the threshold", async () => {
    fake.state.failedLoginAttempts = 3;

    await Promise.all([
      recordFailedLoginAttempt("user-1"),
      recordFailedLoginAttempt("user-1"),
    ]);

    expect(fake.state.failedLoginAttempts).toBe(5);
    expect(fake.state.lockedUntil).toBeInstanceOf(Date);
  });

  it("never exceeds the configured maximum duration", () => {
    expect(
      getLoginLockDurationSeconds(50, {
        threshold: 5,
        baseSeconds: 30,
        maxSeconds: 15 * 60,
      }),
    ).toBe(15 * 60);
  });
});
