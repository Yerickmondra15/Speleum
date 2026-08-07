import { authChallengeErrorResponse, jsonError } from "@/lib/auth-api";
import { AUTH_CHALLENGE_TYPES, verifyAuthChallenge } from "@/lib/auth-challenge";
import { createUserSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { toSessionUser } from "@/lib/auth";
import { parseJsonBody } from "@/lib/validation/http";
import { verifyCodeSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  try {
    const { challengeId, email, code } = await parseJsonBody(request, verifyCodeSchema);
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
        lockedUntil: null,
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
