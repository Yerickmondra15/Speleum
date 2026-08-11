import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { creatureIdSchema } from "@/lib/validation/schemas";

const optionalBoundedInteger = (maximum: number) =>
  z.preprocess(
    (value) => (value === null || value === "" || value === undefined ? undefined : value),
    z.coerce.number().int().min(0).max(maximum).optional(),
  );

export const rankingSortFields = [
  "score",
  "wins",
  "matchesPlayed",
  "bestScore",
] as const;

export const rankingFiltersSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    q: z.string().trim().max(40).default(""),
    minScore: optionalBoundedInteger(10_000_000),
    maxScore: optionalBoundedInteger(10_000_000),
    minWins: optionalBoundedInteger(1_000_000),
    minMatches: optionalBoundedInteger(1_000_000),
    creature: z.preprocess(
      (value) => (value === null || value === "" || value === undefined ? undefined : value),
      creatureIdSchema.optional(),
    ),
    sort: z.enum(rankingSortFields).default("score"),
    direction: z.enum(["asc", "desc"]).default("desc"),
  })
  .refine(
    ({ minScore, maxScore }) =>
      minScore === undefined || maxScore === undefined || minScore <= maxScore,
    { message: "MIN_SCORE_GREATER_THAN_MAX", path: ["maxScore"] },
  );

export type RankingFilters = z.infer<typeof rankingFiltersSchema>;

export function parseRankingSearchParams(searchParams: URLSearchParams) {
  return rankingFiltersSchema.safeParse(Object.fromEntries(searchParams.entries()));
}

export function createRankingWhere(
  filters: RankingFilters,
): Prisma.UserStatsWhereInput {
  const userFilter: Prisma.UserWhereInput = {};
  if (filters.q) {
    userFilter.username = { contains: filters.q, mode: "insensitive" };
  }
  if (filters.creature) {
    userFilter.activeCreature = filters.creature;
  }

  return {
    matchesPlayed: {
      gt: 0,
      ...(filters.minMatches !== undefined ? { gte: filters.minMatches } : {}),
    },
    ...(filters.minScore !== undefined || filters.maxScore !== undefined
      ? {
          score: {
            ...(filters.minScore !== undefined ? { gte: filters.minScore } : {}),
            ...(filters.maxScore !== undefined ? { lte: filters.maxScore } : {}),
          },
        }
      : {}),
    ...(filters.minWins !== undefined ? { wins: { gte: filters.minWins } } : {}),
    ...(Object.keys(userFilter).length > 0 ? { user: { is: userFilter } } : {}),
  };
}

export function createRankingOrderBy(
  filters: RankingFilters,
): Prisma.UserStatsOrderByWithRelationInput[] {
  const order: Prisma.UserStatsOrderByWithRelationInput[] = [
    { [filters.sort]: filters.direction },
  ];
  const deterministicFallbacks: Array<
    [keyof Pick<Prisma.UserStatsOrderByWithRelationInput, "score" | "wins" | "matchesPlayed">, "asc" | "desc"]
  > = [
    ["score", "desc"],
    ["wins", "desc"],
    ["matchesPlayed", "asc"],
  ];

  for (const [field, direction] of deterministicFallbacks) {
    if (field !== filters.sort) order.push({ [field]: direction });
  }
  order.push({ user: { username: "asc" } }, { userId: "asc" });
  return order;
}

export function createRankingPagination(filters: Pick<RankingFilters, "page" | "limit">) {
  return { skip: (filters.page - 1) * filters.limit, take: filters.limit };
}

export function serializeRankingFilters(
  filters: Omit<RankingFilters, "page" | "limit"> & { page: number; limit?: number },
) {
  const params = new URLSearchParams({
    page: String(filters.page),
    limit: String(filters.limit ?? 20),
  });
  if (filters.q) params.set("q", filters.q);
  if (filters.minScore !== undefined) params.set("minScore", String(filters.minScore));
  if (filters.maxScore !== undefined) params.set("maxScore", String(filters.maxScore));
  if (filters.minWins !== undefined) params.set("minWins", String(filters.minWins));
  if (filters.minMatches !== undefined) params.set("minMatches", String(filters.minMatches));
  if (filters.creature) params.set("creature", filters.creature);
  if (filters.sort !== "score") params.set("sort", filters.sort);
  if (filters.direction !== "desc") params.set("direction", filters.direction);
  return params;
}
