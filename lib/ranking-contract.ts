import { z } from "zod";

import { creatureIdSchema } from "@/lib/validation/schemas";
import {
  serializeRankingFilters,
  type RankingFilters,
} from "@/lib/ranking-query";

export const rankingEntrySchema = z.object({
  rank: z.number().int().positive(),
  userId: z.string().min(1),
  username: z.string().min(1),
  activeCreature: creatureIdSchema,
  matchesPlayed: z.number().int().positive(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  score: z.number().int().nonnegative(),
  bestScore: z.number().int().nonnegative(),
  winRate: z.number().min(0).max(100),
  lastMatchAt: z.string().datetime({ offset: true }).nullable(),
});

export const rankingResponseSchema = z.object({
  entries: z.array(rankingEntrySchema),
  pagination: z.object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().positive(),
  }),
});

export type RankingEntry = z.infer<typeof rankingEntrySchema>;
export type RankingResponse = z.infer<typeof rankingResponseSchema>;

export class RankingLoadError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "RankingLoadError";
  }
}

export async function fetchRankingPage({
  page,
  filters,
  signal,
  fetchImpl = fetch,
}: {
  page: number;
  filters?: Omit<RankingFilters, "page" | "limit">;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}) {
  const params = serializeRankingFilters({
    page,
    limit: 20,
    q: filters?.q ?? "",
    minScore: filters?.minScore,
    maxScore: filters?.maxScore,
    minWins: filters?.minWins,
    minMatches: filters?.minMatches,
    creature: filters?.creature,
    sort: filters?.sort ?? "score",
    direction: filters?.direction ?? "desc",
  });
  const response = await fetchImpl(`/api/ranking?${params.toString()}`, {
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
        : "No se pudo cargar el ranking competitivo.";
    throw new RankingLoadError(message, response.status);
  }

  const parsed = rankingResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new RankingLoadError("La respuesta del ranking no es valida.", response.status);
  }

  return parsed.data;
}

export function compareCompetitiveRankingEntries(
  left: Omit<RankingEntry, "rank">,
  right: Omit<RankingEntry, "rank">,
) {
  return (
    right.score - left.score ||
    right.wins - left.wins ||
    left.matchesPlayed - right.matchesPlayed ||
    left.username.localeCompare(right.username) ||
    left.userId.localeCompare(right.userId)
  );
}
