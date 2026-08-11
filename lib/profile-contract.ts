import { z } from "zod";

import { creatureIdSchema } from "@/lib/validation/schemas";

export const profileDataSchema = z.object({
  username: z.string().min(1),
  email: z.string().email(),
  activeCreature: creatureIdSchema,
  matchesPlayed: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  winRate: z.number().min(0).max(100),
  score: z.number().int().nonnegative(),
  bestScore: z.number().int().nonnegative(),
  lastMatchAt: z.string().datetime({ offset: true }).nullable(),
  history: z.array(
    z.object({
      id: z.string().min(1),
      matchId: z.string().min(1),
      mode: z.string().min(1),
      verificationLevel: z.string().min(1),
      competitive: z.boolean(),
      creature: z.string().min(1),
      result: z.string().min(1),
      scoreEarned: z.number().int(),
      date: z.string().datetime({ offset: true }),
      durationMs: z.number().nonnegative().nullable(),
    }),
  ),
});

export type ProfileData = z.infer<typeof profileDataSchema>;

export class ProfileLoadError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "ProfileLoadError";
  }
}

export function isCompetitiveHistoryEntry(
  mode: string,
  verificationLevel: string,
) {
  return mode === "multiplayer" && verificationLevel === "server_verified";
}

export async function fetchProfile({
  signal,
  fetchImpl = fetch,
}: {
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
} = {}) {
  const response = await fetchImpl("/api/profile", {
    cache: "no-store",
    signal,
  });
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      body &&
      typeof body === "object" &&
      "error" in body &&
      typeof body.error === "string"
        ? body.error
        : "No se pudo cargar el perfil.";
    throw new ProfileLoadError(message, response.status);
  }

  const parsed = profileDataSchema.safeParse(body);
  if (!parsed.success) {
    throw new ProfileLoadError("La respuesta del perfil no es valida.", response.status);
  }

  return parsed.data;
}
