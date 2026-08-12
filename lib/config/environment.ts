export type Environment = Readonly<Record<string, string | undefined>>;
export type SpeleumService = "next" | "socket";

export const publicClientEnvironmentNames = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SOCKET_URL",
] as const;

export type PublicClientEnvironment = Partial<
  Record<(typeof publicClientEnvironmentNames)[number], string>
>;

export type EnvironmentValidation = {
  ok: boolean;
  missing: string[];
  invalid: string[];
};

const nextProductionRequired = [
  "DATABASE_URL",
  "DIRECT_URL",
  "SESSION_SECRET",
  "AUTH_CODE_SECRET",
  "SOCKET_AUTH_SECRET",
  "MULTIPLAYER_RESULT_SECRET",
  "AUTH_DELIVERY_MODE",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SOCKET_URL",
] as const;

const socketProductionRequired = [
  "DATABASE_URL",
  "DIRECT_URL",
  "SOCKET_AUTH_SECRET",
  "MULTIPLAYER_RESULT_SECRET",
] as const;

const secretNames = [
  "SESSION_SECRET",
  "AUTH_CODE_SECRET",
  "SOCKET_AUTH_SECRET",
  "MULTIPLAYER_RESULT_SECRET",
] as const;

function value(environment: Environment, name: string) {
  return environment[name]?.trim() ?? "";
}

function isHttpUrl(raw: string, production: boolean) {
  try {
    const url = new URL(raw);
    return production
      ? url.protocol === "https:"
      : url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function getPublicClientEnvironment(
  environment: Environment,
): PublicClientEnvironment {
  return Object.fromEntries(
    publicClientEnvironmentNames.flatMap((name) => {
      const configured = value(environment, name);
      return configured ? [[name, configured]] : [];
    }),
  );
}

export function validateEnvironment(
  service: SpeleumService,
  environment: Environment,
  runtime = environment.NODE_ENV ?? "development",
): EnvironmentValidation {
  const production = runtime === "production";
  const required: string[] = production
    ? service === "next"
      ? [...nextProductionRequired]
      : [...socketProductionRequired]
    : runtime === "test"
      ? []
      : service === "next"
        ? ["DATABASE_URL", "DIRECT_URL", "NEXT_PUBLIC_SOCKET_URL"]
        : ["DATABASE_URL", "DIRECT_URL"];

  if (
    production &&
    service === "socket" &&
    !value(environment, "FRONTEND_URL") &&
    !value(environment, "ALLOWED_ORIGINS") &&
    !value(environment, "NEXT_PUBLIC_APP_URL")
  ) {
    required.push("FRONTEND_URL|ALLOWED_ORIGINS");
  }

  const missing = required.filter((name) => {
    if (name === "FRONTEND_URL|ALLOWED_ORIGINS") return true;
    return !value(environment, name);
  });
  const invalid: string[] = [];

  if (production) {
    for (const name of secretNames) {
      const configured = value(environment, name);
      if (configured && configured.length < 32 && required.includes(name)) {
        invalid.push(`${name} (minimo 32 caracteres)`);
      }
    }

    for (const name of ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SOCKET_URL"] as const) {
      const configured = value(environment, name);
      if (configured && !isHttpUrl(configured, true)) invalid.push(`${name} (HTTPS requerido)`);
    }

    if (service === "next") {
      const deliveryMode = value(environment, "AUTH_DELIVERY_MODE");
      if (deliveryMode !== "demo" && deliveryMode !== "email") {
        invalid.push("AUTH_DELIVERY_MODE (demo o email)");
      } else if (deliveryMode === "email") {
        for (const name of ["RESEND_API_KEY", "AUTH_EMAIL_FROM"]) {
          if (!value(environment, name)) missing.push(name);
        }
      } else if (value(environment, "ALLOW_PUBLIC_DEMO_AUTH") !== "true") {
        invalid.push("ALLOW_PUBLIC_DEMO_AUTH (true requerido para demo publico)");
      }
    }
  }

  return {
    ok: missing.length === 0 && invalid.length === 0,
    missing: [...new Set(missing)].sort(),
    invalid: [...new Set(invalid)].sort(),
  };
}

export function assertEnvironment(
  service: SpeleumService,
  environment: Environment,
  runtime = environment.NODE_ENV ?? "development",
) {
  const result = validateEnvironment(service, environment, runtime);
  if (!result.ok) {
    const details = [
      result.missing.length ? `faltan: ${result.missing.join(", ")}` : "",
      result.invalid.length ? `invalidas: ${result.invalid.join(", ")}` : "",
    ].filter(Boolean);
    throw new Error(`Entorno ${service} invalido (${details.join("; ")}).`);
  }
  return result;
}
