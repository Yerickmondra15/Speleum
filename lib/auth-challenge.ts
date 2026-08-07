import "server-only";

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";

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
  expiresAt: string;
  resendAvailableAt: string;
  message: string;
  demoCode?: string;
};

type ChallengeRecipient = {
  email: string;
  userId?: string | null;
};

type IssueChallengeInput = {
  recipient: ChallengeRecipient;
  type: AuthChallengeType;
  ttlMinutes: number;
  message: string;
  previousResendCount?: number;
};

type VerifyChallengeInput = {
  challengeId: string;
  email: string;
  code: string;
  type: AuthChallengeType;
};

function readBoundedInteger(name: string, fallback: number, minimum: number, maximum: number) {
  const parsed = Number.parseInt(process.env[name] ?? `${fallback}`, 10);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

const AUTH_RESEND_COOLDOWN_SECONDS = readBoundedInteger(
  "AUTH_RESEND_COOLDOWN_SECONDS",
  60,
  10,
  3_600,
);
const AUTH_MAX_VERIFY_ATTEMPTS = readBoundedInteger("AUTH_MAX_VERIFY_ATTEMPTS", 5, 3, 10);
const AUTH_MAX_RESENDS = readBoundedInteger("AUTH_MAX_RESENDS", 5, 1, 10);
const AUTH_RATE_LIMIT_WINDOW_MINUTES = readBoundedInteger(
  "AUTH_RATE_LIMIT_WINDOW_MINUTES",
  60,
  1,
  1_440,
);
const AUTH_RATE_LIMIT_PER_EMAIL = readBoundedInteger("AUTH_RATE_LIMIT_PER_EMAIL", 6, 1, 100);
const AUTH_RATE_LIMIT_PER_IP = readBoundedInteger("AUTH_RATE_LIMIT_PER_IP", 12, 1, 200);
const DEMO_AUTH_CODES = process.env.DEMO_AUTH_CODES === "true";
const DEMO_AUTH_CODES_PUBLIC = process.env.DEMO_AUTH_CODES_PUBLIC === "true";

function now() {
  return new Date();
}

function getCodeSecretPayload(type: AuthChallengeType, email: string, code: string) {
  return `${type}:${email}:${code}`;
}

export function generateVerificationCode() {
  return `${randomInt(100_000, 1_000_000)}`;
}

export function hashVerificationCode({
  type,
  email,
  code,
}: {
  type: AuthChallengeType;
  email: string;
  code: string;
}) {
  return createHmac("sha256", getAuthCodeSecret())
    .update(getCodeSecretPayload(type, email, code))
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
  demoCode,
}: {
  challengeId: string;
  email: string;
  expiresAt: Date;
  lastSentAt: Date;
  type: AuthChallengeType;
  message: string;
  demoCode?: string;
}): PendingAuthResponse {
  return {
    status: toPendingStatus(type),
    challengeId,
    email,
    expiresAt: expiresAt.toISOString(),
    resendAvailableAt: new Date(
      lastSentAt.getTime() + AUTH_RESEND_COOLDOWN_SECONDS * 1000,
    ).toISOString(),
    message,
    ...(demoCode ? { demoCode } : {}),
  };
}

export function isDemoAuthCodesEnabled() {
  return DEMO_AUTH_CODES;
}

export function isDemoAuthCodesPublicEnabled() {
  return DEMO_AUTH_CODES_PUBLIC;
}

async function enforceChallengeRateLimit({
  email,
  ipAddress,
}: {
  email: string;
  ipAddress?: string | null;
}) {
  const windowStart = new Date(
    now().getTime() - AUTH_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
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

  if (perEmail >= AUTH_RATE_LIMIT_PER_EMAIL || perIp >= AUTH_RATE_LIMIT_PER_IP) {
    throw new Error("RATE_LIMITED");
  }
}

export async function issueAuthChallenge(input: IssueChallengeInput) {
  const issuedAt = now();
  const expiresAt = new Date(issuedAt.getTime() + input.ttlMinutes * 60 * 1000);
  const code = generateVerificationCode();
  const codeHash = hashVerificationCode({
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
        userId: input.recipient.userId ?? null,
        email: input.recipient.email,
        type: input.type,
        codeHash,
        expiresAt,
        maxAttempts: AUTH_MAX_VERIFY_ATTEMPTS,
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
      demoCode: DEMO_AUTH_CODES && DEMO_AUTH_CODES_PUBLIC ? code : undefined,
    }),
  };
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

    throw new Error("CHALLENGE_INVALID_CODE");
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
    challenge.lastSentAt.getTime() + AUTH_RESEND_COOLDOWN_SECONDS * 1000,
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

  if (challenge.resendCount >= AUTH_MAX_RESENDS) {
    throw new Error("CHALLENGE_RESEND_LIMIT");
  }

  return issueAuthChallenge({
    recipient: {
      email: challenge.email,
      userId: challenge.userId,
    },
    type: challenge.type as AuthChallengeType,
    ttlMinutes:
      challenge.type === AUTH_CHALLENGE_TYPES.emailVerification ? 15 : 10,
    message:
      challenge.type === AUTH_CHALLENGE_TYPES.emailVerification
        ? "Te enviamos un nuevo codigo para verificar tu correo."
        : "Te enviamos un nuevo codigo para completar tu inicio de sesion.",
    previousResendCount: challenge.resendCount + 1,
  });
}
