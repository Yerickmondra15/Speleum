import { Prisma } from "@prisma/client";

import type { VerifiedMatchResult } from "@/lib/matches/result-contract";
import { prisma } from "@/lib/prisma";
import {
  applyCompetitiveContribution,
  createEmptyCompetitiveStats,
  evaluateCompetitiveMatch,
} from "@/lib/stats/competitive-stats";
import { MAX_COMPETITIVE_SCORE_PER_MATCH } from "@/server/game/scoring";

type CanonicalMatchResult = VerifiedMatchResult & {
  userId: string;
};

export type MatchResultPersistenceInput = {
  userId: string;
  result: VerifiedMatchResult;
};

export type ResultPersistenceDatabase = {
  $transaction<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
    options: {
      isolationLevel: Prisma.TransactionIsolationLevel;
      maxWait?: number;
      timeout?: number;
    },
  ): Promise<T>;
};

export type PersistedMatchResult = {
  userId: string;
  id: string;
  created: boolean;
};

export class ResultConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResultConflictError";
  }
}

export class ResultPersistenceInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResultPersistenceInputError";
  }
}

function sameDate(left: Date | null, right: Date) {
  return left?.getTime() === right.getTime();
}

function sameMatch(
  existing: {
    mode: string;
    status: string;
    winnerId: string | null;
    startedAt: Date;
    endedAt: Date | null;
    verificationLevel: string;
    participantCount: number | null;
  },
  incoming: CanonicalMatchResult,
) {
  return (
    existing.mode === incoming.mode &&
    existing.status === incoming.status &&
    existing.winnerId === incoming.winnerId &&
    existing.startedAt.getTime() === incoming.startedAt.getTime() &&
    sameDate(existing.endedAt, incoming.endedAt) &&
    existing.verificationLevel === incoming.verificationLevel &&
    existing.participantCount === incoming.participantCount
  );
}

function sameResult(
  existing: {
    creature: string;
    result: string;
    scoreEarned: number;
  },
  incoming: CanonicalMatchResult,
) {
  return (
    existing.creature === incoming.creature &&
    existing.result === incoming.result &&
    existing.scoreEarned === incoming.scoreEarned
  );
}

function sameMatchMetadata(
  left: CanonicalMatchResult,
  right: CanonicalMatchResult,
) {
  return (
    left.matchId === right.matchId &&
    left.mode === right.mode &&
    left.status === right.status &&
    left.winnerId === right.winnerId &&
    left.startedAt.getTime() === right.startedAt.getTime() &&
    left.endedAt.getTime() === right.endedAt.getTime() &&
    left.verificationLevel === right.verificationLevel &&
    left.competitive === right.competitive &&
    left.participantCount === right.participantCount
  );
}

function validateResult(result: CanonicalMatchResult) {
  if (!result.userId) {
    throw new ResultPersistenceInputError("El resultado no identifica al usuario.");
  }

  if (
    !Number.isFinite(result.startedAt.getTime()) ||
    !Number.isFinite(result.endedAt.getTime()) ||
    result.endedAt.getTime() < result.startedAt.getTime()
  ) {
    throw new ResultPersistenceInputError("Las fechas del resultado no son validas.");
  }

  const isVerifiedMultiplayer =
    result.mode === "multiplayer" &&
    result.verificationLevel === "server_verified" &&
    result.competitive &&
    (result.participantCount === null ||
      (Number.isInteger(result.participantCount) &&
        result.participantCount >= 2 &&
        result.participantCount <= 6)) &&
    Number.isInteger(result.scoreEarned) &&
    result.scoreEarned >= 0 &&
    result.scoreEarned <= MAX_COMPETITIVE_SCORE_PER_MATCH;
  const isUnverifiedLocal =
    result.mode === "local" &&
    result.verificationLevel === "local_unverified" &&
    !result.competitive &&
    result.winnerId === null &&
    result.scoreEarned === 0 &&
    result.participantCount === 1 &&
    result.matchId.startsWith(`local:${result.userId}:`);

  if (!isVerifiedMultiplayer && !isUnverifiedLocal) {
    throw new ResultPersistenceInputError(
      "La politica competitiva del resultado no es coherente con su modo.",
    );
  }

  if (
    result.mode === "multiplayer" &&
    ((result.result === "win" && result.winnerId !== result.userId) ||
      (result.winnerId === result.userId && result.result !== "win"))
  ) {
    throw new ResultPersistenceInputError(
      "El ganador multijugador no coincide con el resultado del participante.",
    );
  }
}

function validateBatch(results: readonly CanonicalMatchResult[]) {
  const first = results[0];

  if (!first) {
    throw new ResultPersistenceInputError("No hay resultados para guardar.");
  }

  const userIds = new Set<string>();

  for (const result of results) {
    validateResult(result);

    if (!sameMatchMetadata(first, result)) {
      throw new ResultPersistenceInputError(
        "El lote contiene resultados de partidas o metadatos diferentes.",
      );
    }

    if (userIds.has(result.userId)) {
      throw new ResultPersistenceInputError(
        "El lote contiene mas de un resultado para el mismo usuario.",
      );
    }

    userIds.add(result.userId);
  }

  return first;
}

export function isTransientResultPersistenceError(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  return [
    "P1001",
    "P1002",
    "P1008",
    "P1017",
    "P2002",
    "P2024",
    "P2034",
  ].includes(error.code);
}

export async function persistMatchResults(
  input: readonly MatchResultPersistenceInput[],
  database: ResultPersistenceDatabase = prisma as ResultPersistenceDatabase,
): Promise<PersistedMatchResult[]> {
  const results = input.map(({ userId, result }) => ({ ...result, userId }));
  const match = validateBatch(results);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await database.$transaction(
        async (tx) => {
          const existingMatch = await tx.match.findUnique({
            where: { id: match.matchId },
          });

          if (existingMatch && !sameMatch(existingMatch, match)) {
            throw new ResultConflictError(
              "La partida ya existe con datos diferentes.",
            );
          }

          if (!existingMatch) {
            await tx.match.create({
              data: {
                id: match.matchId,
                mode: match.mode,
                status: match.status,
                winnerId: match.winnerId,
                startedAt: match.startedAt,
                endedAt: match.endedAt,
                verificationLevel: match.verificationLevel,
                participantCount: match.participantCount,
                competitiveStatsApplied: false,
              },
            });
          }

          const existingResults = await tx.matchResult.findMany({
            where: {
              matchId: match.matchId,
              userId: { in: results.map((result) => result.userId) },
            },
          });
          const existingByUserId = new Map(
            existingResults.map((result) => [result.userId, result]),
          );

          for (const result of results) {
            const existing = existingByUserId.get(result.userId);

            if (existing && !sameResult(existing, result)) {
              throw new ResultConflictError(
                "El resultado guardado no coincide con la solicitud.",
              );
            }
          }

          if (
            existingMatch?.competitiveStatsApplied &&
            results.some((result) => !existingByUserId.has(result.userId))
          ) {
            throw new ResultConflictError(
              "La partida ya fue agregada pero le faltan resultados solicitados.",
            );
          }

          const persisted: PersistedMatchResult[] = [];

          for (const result of results) {
            const existing = existingByUserId.get(result.userId);

            if (existing) {
              persisted.push({
                userId: result.userId,
                id: existing.id,
                created: false,
              });
              continue;
            }

            const created = await tx.matchResult.create({
              data: {
                matchId: result.matchId,
                userId: result.userId,
                creature: result.creature,
                result: result.result,
                scoreEarned: result.scoreEarned,
                createdAt: result.endedAt,
              },
            });

            persisted.push({
              userId: result.userId,
              id: created.id,
              created: true,
            });
          }

          if (
            match.competitive &&
            match.participantCount !== null &&
            !existingMatch?.competitiveStatsApplied
          ) {
            const completeResults = await tx.matchResult.findMany({
              where: { matchId: match.matchId },
            });

            if (completeResults.length > match.participantCount) {
              throw new ResultConflictError(
                "La partida contiene mas resultados que participantes.",
              );
            }

            if (completeResults.length === match.participantCount) {
              const evaluation = evaluateCompetitiveMatch({
                id: match.matchId,
                mode: match.mode,
                status: match.status,
                winnerId: match.winnerId,
                startedAt: match.startedAt,
                endedAt: match.endedAt,
                verificationLevel: match.verificationLevel,
                participantCount: match.participantCount,
                results: completeResults,
              });

              if (!evaluation.eligible) {
                throw new ResultPersistenceInputError(
                  `La partida completa no es competitivamente valida: ${evaluation.issues.join(", ")}.`,
                );
              }

              for (const contribution of evaluation.contributions) {
                const existingStats = await tx.userStats.findUnique({
                  where: { userId: contribution.userId },
                });
                const nextStats = applyCompetitiveContribution(
                  existingStats
                    ? {
                        matchesPlayed: existingStats.matchesPlayed,
                        wins: existingStats.wins,
                        losses: existingStats.losses,
                        score: existingStats.score,
                        bestScore: existingStats.bestScore,
                        lastMatchAt: existingStats.lastMatchAt,
                      }
                    : createEmptyCompetitiveStats(),
                  contribution,
                );

                await tx.userStats.upsert({
                  where: { userId: contribution.userId },
                  update: nextStats,
                  create: { userId: contribution.userId, ...nextStats },
                });
              }

              await tx.match.update({
                where: { id: match.matchId },
                data: { competitiveStatsApplied: true },
              });
            }
          }

          return persisted;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 2_000,
          timeout: 5_000,
        },
      );
    } catch (error) {
      if (isTransientResultPersistenceError(error) && attempt < 2) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("No se pudo completar la transaccion de resultados.");
}
