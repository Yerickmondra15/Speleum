import { Prisma } from "@prisma/client";
import { hash } from "bcryptjs";

import { jsonError, authChallengeErrorResponse } from "@/lib/auth-api";
import {
  AUTH_CHALLENGE_TYPES,
  issueAuthChallenge,
} from "@/lib/auth-challenge";
import { deliverAuthChallenge, prepareAuthDelivery } from "@/lib/auth-delivery";
import { prisma } from "@/lib/prisma";
import { parseJsonBody } from "@/lib/validation/http";
import { registerSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  try {
    const { username, email, password } = await parseJsonBody(request, registerSchema);
    const deliveryConfig = prepareAuthDelivery();
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
    const issued = await issueAuthChallenge({
      recipient: { email: user.email, userId: user.id },
      type: AUTH_CHALLENGE_TYPES.emailVerification,
      message: "Te enviamos un codigo para verificar tu correo.",
    });
    const pending = await deliverAuthChallenge(issued, deliveryConfig);

    return Response.json(pending, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return jsonError("El correo o nombre de usuario ya existe.", 409);
    }

    return authChallengeErrorResponse(error);
  }
}
