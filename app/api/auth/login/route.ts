import { compare } from "bcryptjs";

import { authChallengeErrorResponse, jsonError } from "@/lib/auth-api";
import {
  AUTH_CHALLENGE_TYPES,
  issueAuthChallenge,
} from "@/lib/auth-challenge";
import { deliverAuthChallenge, prepareAuthDelivery } from "@/lib/auth-delivery";
import {
  getActiveLoginLock,
  recordFailedLoginAttempt,
  type LoginLockState,
} from "@/lib/auth-login-lockout";
import { prisma } from "@/lib/prisma";
import { parseJsonBody } from "@/lib/validation/http";
import { loginSchema } from "@/lib/validation/schemas";

const DUMMY_PASSWORD_HASH =
  "$2b$12$2b2E6Ui.TyYDpSMEtpWIuOhC3VUfMFEuCc3jI9ZB7iBwHMUJCJPTK";

function lockedResponse(state: LoginLockState, referenceDate: Date) {
  const lock = getActiveLoginLock(state, referenceDate);

  if (!lock) {
    return null;
  }

  return jsonError(
    `Demasiados intentos fallidos. Intenta nuevamente en ${lock.retryAfterSeconds} segundos.`,
    429,
    {
      temporaryLock: true,
      retryAfterSeconds: lock.retryAfterSeconds,
      retryAt: lock.retryAt,
    },
    { "Retry-After": `${lock.retryAfterSeconds}` },
  );
}

export async function POST(request: Request) {
  try {
    const { email, password } = await parseJsonBody(request, loginSchema);
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      await compare(password, DUMMY_PASSWORD_HASH);
      return jsonError("Credenciales invalidas.", 401);
    }

    const now = new Date();

    const currentLockResponse = lockedResponse(user, now);

    if (currentLockResponse) {
      return currentLockResponse;
    }

    const passwordMatches = await compare(password, user.passwordHash);

    if (!passwordMatches) {
      const failedState = await recordFailedLoginAttempt(user.id, now);
      const newLockResponse = lockedResponse(failedState, now);

      if (newLockResponse) {
        return newLockResponse;
      }

      return jsonError("Credenciales invalidas.", 401);
    }

    const type = user.emailVerified
      ? AUTH_CHALLENGE_TYPES.login2fa
      : AUTH_CHALLENGE_TYPES.emailVerification;
    const latestLockState = await prisma.user.findUnique({
      where: { id: user.id },
      select: { failedLoginAttempts: true, lockedUntil: true },
    });
    const concurrentLockResponse = latestLockState
      ? lockedResponse(latestLockState, new Date())
      : null;

    if (concurrentLockResponse) {
      return concurrentLockResponse;
    }

    const deliveryConfig = prepareAuthDelivery();
    const issued = await issueAuthChallenge({
      recipient: { email: user.email, userId: user.id },
      type,
      message: user.emailVerified
        ? "Te enviamos un codigo para completar tu inicio de sesion."
        : "Tu correo aun no esta verificado. Te enviamos un nuevo codigo para activarlo.",
    });
    const pending = await deliverAuthChallenge(issued, deliveryConfig);

    return Response.json(pending);
  } catch (error) {
    return authChallengeErrorResponse(error);
  }
}
