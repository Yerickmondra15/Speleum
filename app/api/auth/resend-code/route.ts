import { authChallengeErrorResponse, jsonError } from "@/lib/auth-api";
import { sendAuthCodeEmail } from "@/lib/auth-email";
import {
  isDemoAuthCodesEnabled,
  resendAuthChallenge,
  type AuthChallengeType,
} from "@/lib/auth-challenge";
import { parseJsonBody } from "@/lib/validation/http";
import { resendCodeSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  try {
    const { challengeId, email } = await parseJsonBody(request, resendCodeSchema);
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
