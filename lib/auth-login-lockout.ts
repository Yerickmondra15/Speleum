import "server-only";

import { prisma } from "@/lib/prisma";
import {
  getLoginLockoutConfig,
  type LoginLockoutConfig,
} from "@/lib/auth-config";

export type LoginLockState = {
  failedLoginAttempts: number;
  lockedUntil: Date | null;
};

export function getLoginLockDurationSeconds(
  failedLoginAttempts: number,
  config: LoginLockoutConfig,
) {
  if (failedLoginAttempts < config.threshold) {
    return 0;
  }

  const exponent = failedLoginAttempts - config.threshold;
  return Math.min(config.maxSeconds, config.baseSeconds * 2 ** exponent);
}

export function getActiveLoginLock(state: LoginLockState, referenceDate = new Date()) {
  if (!state.lockedUntil || state.lockedUntil <= referenceDate) {
    return null;
  }

  return {
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((state.lockedUntil.getTime() - referenceDate.getTime()) / 1_000),
    ),
    retryAt: state.lockedUntil.toISOString(),
  };
}

export async function recordFailedLoginAttempt(
  userId: string,
  referenceDate = new Date(),
) {
  const config = getLoginLockoutConfig();
  const rows = await prisma.$queryRaw<LoginLockState[]>`
    UPDATE "User"
    SET
      "failedLoginAttempts" = "failedLoginAttempts" + 1,
      "lockedUntil" = CASE
        WHEN "failedLoginAttempts" + 1 >= ${config.threshold}
        THEN ${referenceDate} + make_interval(
          secs => LEAST(
            ${config.maxSeconds}::double precision,
            ${config.baseSeconds}::double precision * POWER(
              2,
              ("failedLoginAttempts" + 1 - ${config.threshold})::double precision
            )
          )::integer
        )
        ELSE NULL
      END
    WHERE
      "id" = ${userId}
      AND ("lockedUntil" IS NULL OR "lockedUntil" <= ${referenceDate})
    RETURNING "failedLoginAttempts", "lockedUntil"
  `;

  if (rows[0]) {
    return rows[0];
  }

  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: { failedLoginAttempts: true, lockedUntil: true },
  });

  if (!current) {
    throw new Error("LOGIN_USER_NOT_FOUND");
  }

  return current;
}
