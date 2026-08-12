import {
  MOVEMENT_STEP_INTERVAL_MS,
} from "../app/play/gameConfig";

export type ServerTimings = {
  moveTickMs: number;
  lobbyTickMs: number;
  lifecycleTickMs: number;
  readyWindowMs: number;
  startCountdownMs: number;
  reconnectGraceMs: number;
  lobbyIdleMs: number;
  finishedRetentionMs: number;
};

export const defaultServerTimings: ServerTimings = {
  moveTickMs: MOVEMENT_STEP_INTERVAL_MS,
  lobbyTickMs: 1_000,
  lifecycleTickMs: 1_000,
  readyWindowMs: 30_000,
  startCountdownMs: 5_000,
  reconnectGraceMs: 25_000,
  lobbyIdleMs: 15 * 60_000,
  finishedRetentionMs: 2 * 60_000,
};

export function normalizeOrigin(value: string) {
  return value.trim().replace(/\/$/, "");
}

type Environment = Readonly<Record<string, string | undefined>>;

export type CorsPolicy = {
  allowedOrigins: Set<string>;
  allowVercelPreviews: boolean;
};

export function resolveCorsPolicy(environment: Environment = process.env): CorsPolicy {
  const production = environment.NODE_ENV === "production";
  const allowed = new Set<string>();

  if (!production) {
    allowed.add("http://localhost:3000");
    allowed.add("http://127.0.0.1:3000");
  }

  const envCandidates = [
    environment.NEXT_PUBLIC_APP_URL,
    environment.FRONTEND_URL,
    environment.ALLOWED_ORIGINS,
  ];

  for (const candidate of envCandidates) {
    for (const origin of candidate?.split(",") ?? []) {
      const normalized = normalizeOrigin(origin);

      if (normalized) {
        allowed.add(normalized);
      }
    }
  }

  return {
    allowedOrigins: allowed,
    allowVercelPreviews: environment.ALLOW_VERCEL_PREVIEWS === "true",
  };
}

export const vercelPreviewOrigin = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;

export function isOriginAllowed(origin: string | undefined, policy: CorsPolicy) {
  if (!origin) return true;
  const normalized = normalizeOrigin(origin);
  return (
    policy.allowedOrigins.has(normalized) ||
    (policy.allowVercelPreviews && vercelPreviewOrigin.test(normalized))
  );
}
