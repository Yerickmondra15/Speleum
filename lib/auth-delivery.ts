import "server-only";

import {
  getAuthDeliveryConfig,
  type AuthDeliveryConfig,
} from "@/lib/auth-config";
import {
  completePendingAuthResponse,
  invalidateAuthChallenge,
  type AuthChallengeType,
  type UndeliveredPendingAuthResponse,
} from "@/lib/auth-challenge";
import { sendAuthCodeEmail } from "@/lib/auth-email";

type IssuedChallengeForDelivery = {
  challenge: {
    id: string;
    email: string;
    type: string;
  };
  code: string;
  pending: UndeliveredPendingAuthResponse;
};

export function prepareAuthDelivery() {
  return getAuthDeliveryConfig();
}

export async function deliverAuthChallenge(
  issued: IssuedChallengeForDelivery,
  deliveryConfig: AuthDeliveryConfig,
) {
  if (deliveryConfig.mode === "demo") {
    return completePendingAuthResponse(issued.pending, "demo", issued.code);
  }

  const delivery = await sendAuthCodeEmail({
    email: issued.challenge.email,
    code: issued.code,
    type: issued.challenge.type as AuthChallengeType,
    deliveryConfig,
  });

  if (delivery.ok) {
    return completePendingAuthResponse(issued.pending, "email");
  }

  await invalidateAuthChallenge(issued.challenge.id);
  throw new Error("EMAIL_DELIVERY_FAILED");
}
