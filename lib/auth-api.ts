import { NextResponse } from "next/server";

import { HttpBodyError } from "@/lib/validation/http";

export function jsonError(
  error: string,
  status: number,
  extra?: Record<string, unknown>,
  headers?: HeadersInit,
) {
  return NextResponse.json(
    {
      error,
      ...extra,
    },
    { status, headers },
  );
}

export function authChallengeErrorResponse(error: unknown) {
  if (error instanceof HttpBodyError) {
    return jsonError(error.message, 400, { issues: error.issues });
  }

  const retryAfterSeconds =
    typeof error === "object" &&
    error !== null &&
    "retryAfterSeconds" in error &&
    typeof error.retryAfterSeconds === "number"
      ? error.retryAfterSeconds
      : undefined;
  const remainingAttempts =
    typeof error === "object" &&
    error !== null &&
    "remainingAttempts" in error &&
    typeof error.remainingAttempts === "number"
      ? error.remainingAttempts
      : undefined;

  const code = error instanceof Error ? error.message : "UNKNOWN_AUTH_ERROR";

  switch (code) {
    case "CHALLENGE_INVALID_CODE":
      return jsonError("El codigo es invalido.", 400, { remainingAttempts });
    case "CHALLENGE_EXPIRED":
      return jsonError("El codigo expiro. Solicita uno nuevo.", 410);
    case "CHALLENGE_ATTEMPTS_EXCEEDED":
      return jsonError("Superaste el numero maximo de intentos.", 429, {
        remainingAttempts: 0,
      });
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
      return jsonError(
        "No fue posible enviar el codigo de verificacion. Intenta nuevamente o utiliza el modo de demostracion configurado por el administrador.",
        502,
      );
    case "AUTH_DELIVERY_MODE_REQUIRED":
      return jsonError("El modo de entrega de autenticacion no esta configurado.", 500);
    case "AUTH_DELIVERY_MODE_INVALID":
      return jsonError("El modo de entrega de autenticacion no es valido.", 500);
    case "PUBLIC_DEMO_AUTH_NOT_ALLOWED":
      return jsonError(
        "El modo demo en produccion requiere ALLOW_PUBLIC_DEMO_AUTH=true.",
        500,
      );
    case "RESEND_API_KEY_REQUIRED":
    case "AUTH_EMAIL_FROM_REQUIRED":
    case "AUTH_EMAIL_FROM_INVALID":
      return jsonError("La entrega de correo de autenticacion no esta configurada.", 500);
    default:
      return jsonError("No se pudo completar la verificacion.", 500);
  }
}
