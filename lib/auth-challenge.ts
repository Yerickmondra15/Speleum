import "server-only";

import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";

import {
  getAuthChallengeConfig,
  type AuthDeliveryMode,
} from "@/lib/auth-config";
import { prisma } from "@/lib/prisma";
import { getAuthCodeSecret } from "@/lib/security/secrets";

export const AUTH_CHALLENGE_TYPES = {
  emailVerification: "email_verification",
  login2fa: "login_2fa",
} as const;

export type AuthChallengeType =
  (typeof AUTH_CHALLENGE_TYPES)[keyof typeof AUTH_CHALLENGE_TYPES];

export type PendingAuthResponse = {
  status: "pending_email_verification" | "pending_login_verification";
  challengeId: string;
  email: string;
  deliveryMode: AuthDeliveryMode;
  expiresAt: string;
  expiresInSeconds: number;
  attemptsRemaining: number;
  resendAvailableAt: string;
  message: string;
  demoCode?: string;
};

export type UndeliveredPendingAuthResponse = Omit<
  PendingAuthResponse,
  "deliveryMode" | "demoCode"
>;

type ChallengeRecipient = {
  email: string;
  userId?: string | null;
};

type IssueChallengeInput = {
  recipient: ChallengeRecipient;
  type: AuthChallengeType;
  message: string;
  previousResendCount?: number;
};

type VerifyChallengeInput = {
  challengeId: string;
  email: string;
  code: string;
  type: AuthChallengeType;
};

function now() {
  return new Date();
}

function getCodeSecretPayload(
  challengeId: string,
  type: AuthChallengeType,
  email: string,
  code: string,
) {
  return `${challengeId}:${type}:${email}:${code}`;
}

export function generateVerificationCode() {
  return `${randomInt(100_000, 1_000_000)}`;
}

export function hashVerificationCode({
  challengeId,
  type,
  email,
  code,
}: {
  challengeId: string;
  type: AuthChallengeType;
  email: string;
  code: string;
}) {
  return createHmac("sha256", getAuthCodeSecret())
    .update(getCodeSecretPayload(challengeId, type, email, code))
    .digest("hex");
}

export async function getRequestMetadata() {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  const ipAddress = forwardedFor?.split(",")[0]?.trim() || null;
  const userAgent = requestHeaders.get("user-agent");

  return {
    ipAddress: ipAddress?.slice(0, 64) ?? null,
    userAgent: userAgent?.slice(0, 512) ?? null,
  };
}

export async function cleanupAuthChallenges(referenceDate = now()) {
  const retentionCutoff = new Date(referenceDate.getTime() - 7 * 24 * 60 * 60 * 1_000);

  return prisma.authChallenge.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: retentionCutoff } },
        { consumedAt: { lt: retentionCutoff } },
      ],
    },
  });
}

function toPendingStatus(type: AuthChallengeType): PendingAuthResponse["status"] {
  return type === AUTH_CHALLENGE_TYPES.emailVerification
    ? "pending_email_verification"
    : "pending_login_verification";
}

export function toPendingAuthResponse({
  challengeId,
  email,
  expiresAt,
  lastSentAt,
  type,
  message,
}: {
  challengeId: string;
  email: string;
  expiresAt: Date;
  lastSentAt: Date;
  type: AuthChallengeType;
  message: string;
}): UndeliveredPendingAuthResponse {
  const challengeConfig = getAuthChallengeConfig();
  const referenceTime = lastSentAt.getTime();

  return {
    status: toPendingStatus(type),
    challengeId,
    email,
    expiresAt: expiresAt.toISOString(),
    expiresInSeconds: Math.max(
      0,
      Math.ceil((expiresAt.getTime() - referenceTime) / 1_000),
    ),
    attemptsRemaining: challengeConfig.maxAttempts,
    resendAvailableAt: new Date(
      referenceTime + challengeConfig.resendCooldownSeconds * 1000,
    ).toISOString(),
    message,
  };
}

export function completePendingAuthResponse(
  pending: UndeliveredPendingAuthResponse,
  deliveryMode: AuthDeliveryMode,
  demoCode?: string,
): PendingAuthResponse {
  return {
    ...pending,
    deliveryMode,
    ...(deliveryMode === "demo" && demoCode ? { demoCode } : {}),
  };
}

async function enforceChallengeRateLimit({
  email,
  ipAddress,
}: {
  email: string;
  ipAddress?: string | null;
}) {
  const challengeConfig = getAuthChallengeConfig();
  const windowStart = new Date(
    now().getTime() - challengeConfig.rateLimitWindowMinutes * 60 * 1000,
  );

  const [perEmail, perIp] = await Promise.all([
    prisma.authChallenge.count({
      where: {
        email,
        createdAt: {
          gte: windowStart,
        },
      },
    }),
    ipAddress
      ? prisma.authChallenge.count({
          where: {
            ipAddress,
            createdAt: {
              gte: windowStart,
            },
          },
        })
      : Promise.resolve(0),
  ]);

  if (
    perEmail >= challengeConfig.rateLimitPerEmail ||
    perIp >= challengeConfig.rateLimitPerIp
  ) {
    throw new Error("RATE_LIMITED");
  }
}

export async function issueAuthChallenge(input: IssueChallengeInput) {
  const challengeConfig = getAuthChallengeConfig();
  const issuedAt = now();
  const expiresAt = new Date(
    issuedAt.getTime() + challengeConfig.expirationMinutes * 60 * 1000,
  );
  const challengeId = randomUUID();
  const code = generateVerificationCode();
  const codeHash = hashVerificationCode({
    challengeId,
    type: input.type,
    email: input.recipient.email,
    code,
  });
  const metadata = await getRequestMetadata();

  await cleanupAuthChallenges(issuedAt);

  await enforceChallengeRateLimit({
    email: input.recipient.email,
    ipAddress: metadata.ipAddress,
  });

  const challenge = await prisma.$transaction(async (tx) => {
    await tx.authChallenge.updateMany({
      where: {
        email: input.recipient.email,
        type: input.type,
        consumedAt: null,
      },
      data: {
        consumedAt: issuedAt,
      },
    });

    return tx.authChallenge.create({
      data: {
        id: challengeId,
        userId: input.recipient.userId ?? null,
        email: input.recipient.email,
        type: input.type,
        codeHash,
        expiresAt,
        maxAttempts: challengeConfig.maxAttempts,
        resendCount: input.previousResendCount ?? 0,
        lastSentAt: issuedAt,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      },
    });
  });

  return {
    challenge,
    code,
    pending: toPendingAuthResponse({
      challengeId: challenge.id,
      email: challenge.email,
      expiresAt: challenge.expiresAt,
      lastSentAt: challenge.lastSentAt,
      type: input.type,
      message: input.message,
    }),
  };
}

export async function invalidateAuthChallenge(challengeId: string) {
  await prisma.authChallenge.updateMany({
    where: { id: challengeId, consumedAt: null },
    data: { consumedAt: now() },
  });
}

export async function verifyAuthChallenge(input: VerifyChallengeInput) {
  const challenge = await prisma.authChallenge.findFirst({
    where: {
      id: input.challengeId,
      email: input.email,
      type: input.type,
    },
  });

  if (!challenge) {
    throw new Error("CHALLENGE_NOT_FOUND");
  }

  if (challenge.consumedAt) {
    throw new Error("CHALLENGE_ALREADY_USED");
  }

  if (challenge.expiresAt <= now()) {
    throw new Error("CHALLENGE_EXPIRED");
  }

  if (challenge.attemptCount >= challenge.maxAttempts) {
    throw new Error("CHALLENGE_ATTEMPTS_EXCEEDED");
  }

  const expectedHash = hashVerificationCode({
    challengeId: challenge.id,
    type: input.type,
    email: input.email,
    code: input.code,
  });

  const isMatch =
    expectedHash.length === challenge.codeHash.length &&
    timingSafeEqual(Buffer.from(expectedHash), Buffer.from(challenge.codeHash));

  if (!isMatch) {
    const updatedCount = await prisma.authChallenge.updateMany({
      where: {
        id: challenge.id,
        consumedAt: null,
        expiresAt: { gt: now() },
        attemptCount: { lt: challenge.maxAttempts },
      },
      data: {
        attemptCount: {
          increment: 1,
        },
      },
    });

    if (updatedCount.count === 0) {
      throw new Error("CHALLENGE_ATTEMPTS_EXCEEDED");
    }

    const updated = await prisma.authChallenge.findUnique({ where: { id: challenge.id } });

    if (!updated || updated.attemptCount >= updated.maxAttempts) {
      throw new Error("CHALLENGE_ATTEMPTS_EXCEEDED");
    }

    const error = new Error("CHALLENGE_INVALID_CODE");
    (error as Error & { remainingAttempts?: number }).remainingAttempts =
      updated.maxAttempts - updated.attemptCount;
    throw error;
  }

  const consumedAt = now();

  const consumed = await prisma.$transaction(async (tx) => {
    const result = await tx.authChallenge.updateMany({
      where: {
        id: challenge.id,
        consumedAt: null,
        expiresAt: { gt: consumedAt },
        attemptCount: { lt: challenge.maxAttempts },
      },
      data: { consumedAt },
    });

    if (result.count !== 1) {
      throw new Error("CHALLENGE_ALREADY_USED");
    }

    await tx.authChallenge.updateMany({
      where: {
        email: challenge.email,
        type: challenge.type,
        consumedAt: null,
      },
      data: { consumedAt },
    });

    return challenge;
  });

  return consumed;
}

export async function resendAuthChallenge({
  challengeId,
  email,
}: {
  challengeId: string;
  email: string;
}) {
  const challengeConfig = getAuthChallengeConfig();
  const challenge = await prisma.authChallenge.findFirst({
    where: {
      id: challengeId,
      email,
    },
  });

  if (!challenge) {
    throw new Error("CHALLENGE_NOT_FOUND");
  }

  if (challenge.consumedAt) {
    throw new Error("CHALLENGE_ALREADY_USED");
  }

  if (challenge.expiresAt <= now()) {
    throw new Error("CHALLENGE_EXPIRED");
  }

  const resendAvailableAt = new Date(
    challenge.lastSentAt.getTime() + challengeConfig.resendCooldownSeconds * 1000,
  );

  if (resendAvailableAt > now()) {
    const retryAfterSeconds = Math.ceil(
      (resendAvailableAt.getTime() - now().getTime()) / 1000,
    );
    const error = new Error("CHALLENGE_RESEND_COOLDOWN");
    (error as Error & { retryAfterSeconds?: number }).retryAfterSeconds =
      retryAfterSeconds;
    throw error;
  }

  if (challenge.resendCount >= challengeConfig.maxResends) {
    throw new Error("CHALLENGE_RESEND_LIMIT");
  }

  if (
    challenge.type !== AUTH_CHALLENGE_TYPES.emailVerification &&
    challenge.type !== AUTH_CHALLENGE_TYPES.login2fa
  ) {
    throw new Error("CHALLENGE_NOT_FOUND");
  }

  return issueAuthChallenge({
    recipient: {
      email: challenge.email,
      userId: challenge.userId,
    },
    type: challenge.type,
    message:
      challenge.type === AUTH_CHALLENGE_TYPES.emailVerification
        ? "Te enviamos un nuevo codigo para verificar tu correo."
        : "Te enviamos un nuevo codigo para completar tu inicio de sesion.",
    previousResendCount: challenge.resendCount + 1,
  });
}
