import { compare } from "bcryptjs";

import { authChallengeErrorResponse, jsonError } from "@/lib/auth-api";
import {
  AUTH_CHALLENGE_TYPES,
  isDemoAuthCodesEnabled,
  issueAuthChallenge,
} from "@/lib/auth-challenge";
import { sendAuthCodeEmail } from "@/lib/auth-email";
import { prisma } from "@/lib/prisma";
import { parseJsonBody } from "@/lib/validation/http";
import { loginSchema } from "@/lib/validation/schemas";

function readBoundedInteger(name: string, fallback: number, minimum: number, maximum: number) {
  const parsed = Number.parseInt(process.env[name] ?? `${fallback}`, 10);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

const LOCK_THRESHOLD = readBoundedInteger("AUTH_LOGIN_LOCK_THRESHOLD", 5, 3, 20);
const LOCK_BASE_MS =
  readBoundedInteger("AUTH_LOGIN_LOCK_BASE_SECONDS", 30, 5, 3_600) * 1_000;
const MAX_LOCK_MS =
  readBoundedInteger("AUTH_LOGIN_LOCK_MAX_MINUTES", 15, 1, 24 * 60) * 60_000;

function lockDurationMs(failedAttempts: number) {
  if (failedAttempts < LOCK_THRESHOLD) {
    return 0;
  }

  return Math.min(MAX_LOCK_MS, LOCK_BASE_MS * 2 ** (failedAttempts - LOCK_THRESHOLD));
}

export async function POST(request: Request) {
  try {
    const { email, password } = await parseJsonBody(request, loginSchema);
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return jsonError("Credenciales invalidas.", 401);
    }

    const now = new Date();

    if (user.lockedUntil && user.lockedUntil > now) {
      return jsonError("Cuenta temporalmente bloqueada. Intenta mas tarde.", 429, {
        retryAfterSeconds: Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 1_000),
      });
    }

    const passwordMatches = await compare(password, user.passwordHash);

    if (!passwordMatches) {
      const failedAttempts = user.failedLoginAttempts + 1;
      const duration = lockDurationMs(failedAttempts);
      const lockedUntil = duration > 0 ? new Date(now.getTime() + duration) : null;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: { increment: 1 },
          lockedUntil,
        },
      });

      if (lockedUntil) {
        return jsonError("Cuenta temporalmente bloqueada por intentos fallidos.", 429, {
          retryAfterSeconds: Math.ceil(duration / 1_000),
        });
      }

      return jsonError("Credenciales invalidas.", 401);
    }

    const type = user.emailVerified
      ? AUTH_CHALLENGE_TYPES.login2fa
      : AUTH_CHALLENGE_TYPES.emailVerification;
    const { pending, code } = await issueAuthChallenge({
      recipient: { email: user.email, userId: user.id },
      type,
      ttlMinutes: user.emailVerified ? 10 : 15,
      message: user.emailVerified
        ? "Te enviamos un codigo para completar tu inicio de sesion."
        : "Tu correo aun no esta verificado. Te enviamos un nuevo codigo para activarlo.",
    });
    const delivery = await sendAuthCodeEmail({ email: user.email, code, type });

    if (!delivery.ok && !isDemoAuthCodesEnabled()) {
      return jsonError(delivery.error, 502);
    }

    return Response.json(pending);
  } catch (error) {
    return authChallengeErrorResponse(error);
  }
}
