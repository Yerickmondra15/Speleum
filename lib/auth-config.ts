export type AuthDeliveryMode = "demo" | "email";

type Environment = Record<string, string | undefined>;

export type AuthDeliveryConfig =
  | { mode: "demo" }
  | { mode: "email"; apiKey: string; from: string };

export type AuthChallengeConfig = {
  expirationMinutes: number;
  maxAttempts: number;
  maxResends: number;
  resendCooldownSeconds: number;
  rateLimitWindowMinutes: number;
  rateLimitPerEmail: number;
  rateLimitPerIp: number;
};

export type LoginLockoutConfig = {
  threshold: number;
  baseSeconds: number;
  maxSeconds: number;
};

export function readBoundedInteger(
  environment: Environment,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const parsed = Number.parseInt(environment[name] ?? `${fallback}`, 10);
  return Number.isFinite(parsed)
    ? Math.min(maximum, Math.max(minimum, parsed))
    : fallback;
}

function readRequiredValue(environment: Environment, name: string) {
  const value = environment[name]?.trim();

  if (!value) {
    throw new Error(`${name}_REQUIRED`);
  }

  return value;
}

export function getAuthDeliveryConfig(
  environment: Environment = process.env,
): AuthDeliveryConfig {
  const configuredMode = readRequiredValue(environment, "AUTH_DELIVERY_MODE");

  if (configuredMode !== "demo" && configuredMode !== "email") {
    throw new Error("AUTH_DELIVERY_MODE_INVALID");
  }

  if (
    configuredMode === "demo" &&
    environment.NODE_ENV === "production" &&
    environment.ALLOW_PUBLIC_DEMO_AUTH !== "true"
  ) {
    throw new Error("PUBLIC_DEMO_AUTH_NOT_ALLOWED");
  }

  if (configuredMode === "demo") {
    return { mode: "demo" };
  }

  const from = readRequiredValue(environment, "AUTH_EMAIL_FROM");
  const senderAddress = from.match(/<([^<>]+)>$/)?.[1] ?? from;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderAddress)) {
    throw new Error("AUTH_EMAIL_FROM_INVALID");
  }

  return {
    mode: "email",
    apiKey: readRequiredValue(environment, "RESEND_API_KEY"),
    from,
  };
}

export function getAuthChallengeConfig(
  environment: Environment = process.env,
): AuthChallengeConfig {
  return {
    expirationMinutes: readBoundedInteger(
      environment,
      "AUTH_CODE_EXPIRATION_MINUTES",
      10,
      1,
      60,
    ),
    maxAttempts: readBoundedInteger(
      environment,
      "AUTH_CODE_MAX_ATTEMPTS",
      readBoundedInteger(environment, "AUTH_MAX_VERIFY_ATTEMPTS", 5, 3, 10),
      3,
      10,
    ),
    maxResends: readBoundedInteger(environment, "AUTH_MAX_RESENDS", 5, 1, 10),
    resendCooldownSeconds: readBoundedInteger(
      environment,
      "AUTH_RESEND_COOLDOWN_SECONDS",
      60,
      10,
      3_600,
    ),
    rateLimitWindowMinutes: readBoundedInteger(
      environment,
      "AUTH_RATE_LIMIT_WINDOW_MINUTES",
      60,
      1,
      1_440,
    ),
    rateLimitPerEmail: readBoundedInteger(
      environment,
      "AUTH_RATE_LIMIT_PER_EMAIL",
      6,
      1,
      100,
    ),
    rateLimitPerIp: readBoundedInteger(
      environment,
      "AUTH_RATE_LIMIT_PER_IP",
      12,
      1,
      200,
    ),
  };
}

export function getLoginLockoutConfig(
  environment: Environment = process.env,
): LoginLockoutConfig {
  return {
    threshold: readBoundedInteger(
      environment,
      "AUTH_LOGIN_LOCK_THRESHOLD",
      5,
      3,
      20,
    ),
    baseSeconds: readBoundedInteger(
      environment,
      "AUTH_LOGIN_LOCK_BASE_SECONDS",
      30,
      5,
      3_600,
    ),
    maxSeconds:
      readBoundedInteger(
        environment,
        "AUTH_LOGIN_LOCK_MAX_MINUTES",
        15,
        1,
        24 * 60,
      ) * 60,
  };
}
