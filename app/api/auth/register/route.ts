import { Prisma } from "@prisma/client";
import { hash } from "bcryptjs";

import { jsonError, authChallengeErrorResponse } from "@/lib/auth-api";
import {
  AUTH_CHALLENGE_TYPES,
  isDemoAuthCodesEnabled,
  issueAuthChallenge,
} from "@/lib/auth-challenge";
import { sendAuthCodeEmail } from "@/lib/auth-email";
import { prisma } from "@/lib/prisma";
import { parseJsonBody } from "@/lib/validation/http";
import { registerSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  try {
    const { username, email, password } = await parseJsonBody(request, registerSchema);
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ username: { equals: username, mode: "insensitive" } }, { email }],
      },
    });

    if (existingUser) {
      return jsonError(
        existingUser.email === email
          ? "Ese correo ya existe. Si la cuenta no esta verificada, inicia sesion para reenviar el codigo."
          : "Ese nombre de usuario ya existe.",
        409,
      );
    }

    const passwordHash = await hash(password, 12);
    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        stats: { create: {} },
      },
    });
    const { pending, code } = await issueAuthChallenge({
      recipient: { email: user.email, userId: user.id },
      type: AUTH_CHALLENGE_TYPES.emailVerification,
      ttlMinutes: 15,
      message: "Te enviamos un codigo para verificar tu correo.",
    });
    const delivery = await sendAuthCodeEmail({
      email: user.email,
      code,
      type: AUTH_CHALLENGE_TYPES.emailVerification,
    });

    if (!delivery.ok && !isDemoAuthCodesEnabled()) {
      return jsonError(
        "La cuenta se creo, pero el correo no pudo enviarse. Inicia sesion para solicitar un codigo nuevo.",
        502,
      );
    }

    return Response.json(pending, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return jsonError("El correo o nombre de usuario ya existe.", 409);
    }

    return authChallengeErrorResponse(error);
  }
}
