import { hash } from "bcryptjs";

import { jsonError, authChallengeErrorResponse } from "@/lib/auth-api";
import { isDemoAuthCodesEnabled } from "@/lib/auth-challenge";
import { AUTH_CHALLENGE_TYPES, issueAuthChallenge } from "@/lib/auth-challenge";
import { sendAuthCodeEmail } from "@/lib/auth-email";
import { prisma } from "@/lib/prisma";

type RegisterBody = {
  username?: string;
  email?: string;
  password?: string;
};

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  const body = (await request.json()) as RegisterBody;
  const username = body.username?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";

  if (username.length < 3) {
    return jsonError("El nombre debe tener al menos 3 caracteres.", 400);
  }

  if (!validateEmail(email)) {
    return jsonError("Ingresa un correo valido.", 400);
  }

  if (password.length < 6) {
    return jsonError("La contrasena debe tener al menos 6 caracteres.", 400);
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ username: { equals: username, mode: "insensitive" } }, { email }],
    },
  });

  if (existingUser) {
    return jsonError(
      existingUser.email === email
        ? "Ese correo ya existe."
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
      stats: {
        create: {},
      },
    },
  });

  try {
    const { pending, code } = await issueAuthChallenge({
      recipient: {
        email: user.email,
        userId: user.id,
      },
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
      return jsonError(delivery.error, 502);
    }

    return Response.json(pending, { status: 201 });
  } catch (error) {
    return authChallengeErrorResponse(error);
  }
}
