import { authChallengeErrorResponse, jsonError } from "@/lib/auth-api";
import { sendAuthCodeEmail } from "@/lib/auth-email";
import {
  isDemoAuthCodesEnabled,
  resendAuthChallenge,
  type AuthChallengeType,
} from "@/lib/auth-challenge";

type ResendCodeBody = {
  challengeId?: string;
  email?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as ResendCodeBody;
  const challengeId = body.challengeId?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";

  if (!challengeId || !email) {
    return jsonError("No encontramos un desafio activo para reenviar.", 400);
  }

  try {
    const { code, challenge, pending } = await resendAuthChallenge({
      challengeId,
      email,
    });

    const delivery = await sendAuthCodeEmail({
      email: challenge.email,
      code,
      type: challenge.type as AuthChallengeType,
    });

    if (!delivery.ok && !isDemoAuthCodesEnabled()) {
      return jsonError(delivery.error, 502);
    }

    return Response.json(pending);
  } catch (error) {
    return authChallengeErrorResponse(error);
  }
}
