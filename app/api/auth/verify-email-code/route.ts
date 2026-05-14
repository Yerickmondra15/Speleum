import { authChallengeErrorResponse, jsonError } from "@/lib/auth-api";
import { AUTH_CHALLENGE_TYPES, verifyAuthChallenge } from "@/lib/auth-challenge";
import { createUserSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { toSessionUser } from "@/lib/auth";

type VerifyEmailCodeBody = {
  challengeId?: string;
  email?: string;
  code?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as VerifyEmailCodeBody;
  const challengeId = body.challengeId?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const code = body.code?.trim() ?? "";

  if (!challengeId || !email || code.length !== 6) {
    return jsonError("Completa el codigo de 6 digitos.", 400);
  }

  try {
    const challenge = await verifyAuthChallenge({
      challengeId,
      email,
      code,
      type: AUTH_CHALLENGE_TYPES.emailVerification,
    });

    if (!challenge.userId) {
      return jsonError("No encontramos un usuario valido para esta verificacion.", 404);
    }

    const user = await prisma.user.update({
      where: {
        id: challenge.userId,
      },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
        failedLoginAttempts: 0,
      },
    });

    await createUserSession(user.id);

    return Response.json({
      status: "authenticated",
      user: toSessionUser(user),
    });
  } catch (error) {
    return authChallengeErrorResponse(error);
  }
}
