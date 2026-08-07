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

export function resolveAllowedOrigins() {
  const allowed = new Set<string>([
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ]);
  const envCandidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.FRONTEND_URL,
    process.env.ALLOWED_ORIGINS,
  ];

  for (const candidate of envCandidates) {
    for (const origin of candidate?.split(",") ?? []) {
      const normalized = normalizeOrigin(origin);

      if (normalized) {
        allowed.add(normalized);
      }
    }
  }

  return allowed;
}

export const vercelPreviewOrigin = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;
