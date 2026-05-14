import { NextResponse } from "next/server";

export function jsonError(error: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json(
    {
      error,
      ...extra,
    },
    { status },
  );
}

export function authChallengeErrorResponse(error: unknown) {
  const retryAfterSeconds =
    typeof error === "object" &&
    error !== null &&
    "retryAfterSeconds" in error &&
    typeof error.retryAfterSeconds === "number"
      ? error.retryAfterSeconds
      : undefined;

  const code = error instanceof Error ? error.message : "UNKNOWN_AUTH_ERROR";

  switch (code) {
    case "CHALLENGE_INVALID_CODE":
      return jsonError("El codigo es invalido.", 400);
    case "CHALLENGE_EXPIRED":
      return jsonError("El codigo expiro. Solicita uno nuevo.", 410);
    case "CHALLENGE_ATTEMPTS_EXCEEDED":
      return jsonError("Superaste el numero maximo de intentos.", 429);
    case "CHALLENGE_ALREADY_USED":
      return jsonError("Este codigo ya fue utilizado.", 409);
    case "CHALLENGE_NOT_FOUND":
      return jsonError("No encontramos un desafio activo para este correo.", 404);
    case "CHALLENGE_RESEND_COOLDOWN":
      return jsonError("Debes esperar antes de reenviar otro codigo.", 429, {
        retryAfterSeconds,
      });
    case "CHALLENGE_RESEND_LIMIT":
      return jsonError("Ya alcanzaste el limite de reenvios para este codigo.", 429);
    case "RATE_LIMITED":
      return jsonError("Demasiadas solicitudes. Intentalo de nuevo en unos minutos.", 429);
    case "EMAIL_PROVIDER_NOT_CONFIGURED":
      return jsonError("El servicio de correo no esta configurado.", 500);
    case "EMAIL_DELIVERY_FAILED":
      return jsonError("No pudimos enviar el correo de verificacion.", 502);
    default:
      return jsonError("No se pudo completar la verificacion.", 500);
  }
}
