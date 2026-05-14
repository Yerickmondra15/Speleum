import { compare } from "bcryptjs";

import { authChallengeErrorResponse, jsonError } from "@/lib/auth-api";
import {
  AUTH_CHALLENGE_TYPES,
  isDemoAuthCodesEnabled,
  issueAuthChallenge,
} from "@/lib/auth-challenge";
import { sendAuthCodeEmail } from "@/lib/auth-email";
import { prisma } from "@/lib/prisma";

type LoginBody = {
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as LoginBody;
  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";

  if (!email || !password) {
    return jsonError("Completa correo y contrasena.", 400);
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return jsonError("Credenciales invalidas.", 401);
  }

  const passwordMatches = await compare(password, user.passwordHash);

  if (!passwordMatches) {
    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        failedLoginAttempts: {
          increment: 1,
        },
      },
    });

    return jsonError("Credenciales invalidas.", 401);
  }

  try {
    if (!user.emailVerified) {
      const { pending, code } = await issueAuthChallenge({
        recipient: {
          email: user.email,
          userId: user.id,
        },
        type: AUTH_CHALLENGE_TYPES.emailVerification,
        ttlMinutes: 15,
        message:
          "Tu correo aun no esta verificado. Te enviamos un nuevo codigo para activarlo.",
      });

      const delivery = await sendAuthCodeEmail({
        email: user.email,
        code,
        type: AUTH_CHALLENGE_TYPES.emailVerification,
      });

      if (!delivery.ok && !isDemoAuthCodesEnabled()) {
        return jsonError(delivery.error, 502);
      }

      return Response.json(pending);
    }

    const { pending, code } = await issueAuthChallenge({
      recipient: {
        email: user.email,
        userId: user.id,
      },
      type: AUTH_CHALLENGE_TYPES.login2fa,
      ttlMinutes: 10,
      message: "Te enviamos un codigo para completar tu inicio de sesion.",
    });

    const delivery = await sendAuthCodeEmail({
      email: user.email,
      code,
      type: AUTH_CHALLENGE_TYPES.login2fa,
    });

    if (!delivery.ok && !isDemoAuthCodesEnabled()) {
      return jsonError(delivery.error, 502);
    }

    return Response.json(pending);
  } catch (error) {
    return authChallengeErrorResponse(error);
  }
}
