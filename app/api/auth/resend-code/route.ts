import { authChallengeErrorResponse } from "@/lib/auth-api";
import { resendAuthChallenge } from "@/lib/auth-challenge";
import { deliverAuthChallenge, prepareAuthDelivery } from "@/lib/auth-delivery";
import { parseJsonBody } from "@/lib/validation/http";
import { resendCodeSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  try {
    const { challengeId, email } = await parseJsonBody(request, resendCodeSchema);
    const deliveryConfig = prepareAuthDelivery();
    const issued = await resendAuthChallenge({
      challengeId,
      email,
    });
    const pending = await deliverAuthChallenge(issued, deliveryConfig);

    return Response.json(pending);
  } catch (error) {
    return authChallengeErrorResponse(error);
  }
}
