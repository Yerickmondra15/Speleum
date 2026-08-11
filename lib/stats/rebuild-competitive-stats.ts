import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  deriveCompetitiveStatsFromMatches,
  type CompetitiveStats,
} from "@/lib/stats/competitive-stats";

export type CompetitiveStatsSnapshot = CompetitiveStats & {
  userId: string;
  username: string;
};

export type CompetitiveStatsRebuildReport = {
  dryRun: boolean;
  totals: {
    users: number;
    matches: number;
    matchResults: number;
    matchesByVerificationLevel: Record<string, number>;
    matchResultsByVerificationLevel: Record<string, number>;
    unverifiedMatchesPreserved: number;
    unverifiedResultsPreserved: number;
    validCompetitiveMatches: number;
    invalidVerifiedMatches: number;
  };
  changes: {
    createUsers: string[];
    updateUsers: string[];
    deleteUsers: string[];
    unchangedUsers: string[];
  };
  invalidVerifiedMatches: Array<{ matchId: string; issues: string[] }>;
  before: CompetitiveStatsSnapshot[];
  after: CompetitiveStatsSnapshot[];
};

export type CompetitiveStatsRebuildDatabase = {
  $transaction<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
    options: {
      isolationLevel: Prisma.TransactionIsolationLevel;
      maxWait?: number;
      timeout?: number;
    },
  ): Promise<T>;
};

function sameDate(left: Date | null, right: Date | null) {
  return left?.getTime() === right?.getTime();
}

function sameStats(left: CompetitiveStats, right: CompetitiveStats) {
  return (
    left.matchesPlayed === right.matchesPlayed &&
    left.wins === right.wins &&
    left.losses === right.losses &&
    left.score === right.score &&
    left.bestScore === right.bestScore &&
    sameDate(left.lastMatchAt, right.lastMatchAt)
  );
}

function retryableTransactionError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    ["P1001", "P1002", "P1008", "P1017", "P2002", "P2024", "P2034"].includes(
      error.code,
    )
  );
}

export async function rebuildCompetitiveUserStats({
  dryRun = true,
  database = prisma as CompetitiveStatsRebuildDatabase,
}: {
  dryRun?: boolean;
  database?: CompetitiveStatsRebuildDatabase;
} = {}): Promise<CompetitiveStatsRebuildReport> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await database.$transaction(
        async (tx) => {
          const [userCount, matches, currentStats] = await Promise.all([
            tx.user.count(),
            tx.match.findMany({
              orderBy: [{ endedAt: "asc" }, { id: "asc" }],
              select: {
                id: true,
                mode: true,
                status: true,
                winnerId: true,
                startedAt: true,
                endedAt: true,
                verificationLevel: true,
                participantCount: true,
                results: {
                  orderBy: { userId: "asc" },
                  select: {
                    userId: true,
                    result: true,
                    scoreEarned: true,
                    creature: true,
                  },
                },
              },
            }),
            tx.userStats.findMany({
              orderBy: { userId: "asc" },
              select: {
                userId: true,
                matchesPlayed: true,
                wins: true,
                losses: true,
                score: true,
                bestScore: true,
                lastMatchAt: true,
                user: { select: { username: true } },
              },
            }),
          ]);

          const derived = deriveCompetitiveStatsFromMatches(matches);
          const usernameByUserId = new Map(
            currentStats.map((entry) => [entry.userId, entry.user.username]),
          );

          if (derived.statsByUser.size > usernameByUserId.size) {
            const missingUserIds = [...derived.statsByUser.keys()].filter(
              (userId) => !usernameByUserId.has(userId),
            );
            const missingUsers = await tx.user.findMany({
              where: { id: { in: missingUserIds } },
              select: { id: true, username: true },
            });
            for (const user of missingUsers) {
              usernameByUserId.set(user.id, user.username);
            }
          }

          const before: CompetitiveStatsSnapshot[] = currentStats.map((entry) => ({
            userId: entry.userId,
            username: entry.user.username,
            matchesPlayed: entry.matchesPlayed,
            wins: entry.wins,
            losses: entry.losses,
            score: entry.score,
            bestScore: entry.bestScore,
            lastMatchAt: entry.lastMatchAt,
          }));
          const after: CompetitiveStatsSnapshot[] = [...derived.statsByUser.entries()]
            .map(([userId, stats]) => ({
              userId,
              username: usernameByUserId.get(userId) ?? userId,
              ...stats,
            }))
            .sort((left, right) => left.userId.localeCompare(right.userId));
          const currentByUserId = new Map(before.map((entry) => [entry.userId, entry]));
          const desiredByUserId = new Map(after.map((entry) => [entry.userId, entry]));
          const createUsers = after
            .filter((entry) => !currentByUserId.has(entry.userId))
            .map((entry) => entry.userId);
          const updateUsers = after
            .filter((entry) => {
              const current = currentByUserId.get(entry.userId);
              return current ? !sameStats(current, entry) : false;
            })
            .map((entry) => entry.userId);
          const unchangedUsers = after
            .filter((entry) => {
              const current = currentByUserId.get(entry.userId);
              return current ? sameStats(current, entry) : false;
            })
            .map((entry) => entry.userId);
          const deleteUsers = before
            .filter((entry) => !desiredByUserId.has(entry.userId))
            .map((entry) => entry.userId);

          if (!dryRun) {
            const desiredUserIds = after.map((entry) => entry.userId);
            await tx.userStats.deleteMany({
              where:
                desiredUserIds.length > 0
                  ? { userId: { notIn: desiredUserIds } }
                  : undefined,
            });

            for (const entry of after) {
              const data = {
                matchesPlayed: entry.matchesPlayed,
                wins: entry.wins,
                losses: entry.losses,
                score: entry.score,
                bestScore: entry.bestScore,
                lastMatchAt: entry.lastMatchAt,
              };
              await tx.userStats.upsert({
                where: { userId: entry.userId },
                update: data,
                create: { userId: entry.userId, ...data },
              });
            }

            await tx.match.updateMany({
              data: { competitiveStatsApplied: false },
            });
            if (derived.validMatchIds.length > 0) {
              await tx.match.updateMany({
                where: { id: { in: derived.validMatchIds } },
                data: { competitiveStatsApplied: true },
              });
            }
          }

          const unverifiedMatches = matches.filter(
            (match) => match.verificationLevel !== "server_verified",
          );
          const matchesByVerificationLevel: Record<string, number> = {};
          const matchResultsByVerificationLevel: Record<string, number> = {};
          for (const match of matches) {
            matchesByVerificationLevel[match.verificationLevel] =
              (matchesByVerificationLevel[match.verificationLevel] ?? 0) + 1;
            matchResultsByVerificationLevel[match.verificationLevel] =
              (matchResultsByVerificationLevel[match.verificationLevel] ?? 0) +
              match.results.length;
          }

          return {
            dryRun,
            totals: {
              users: userCount,
              matches: matches.length,
              matchResults: matches.reduce(
                (total, match) => total + match.results.length,
                0,
              ),
              matchesByVerificationLevel,
              matchResultsByVerificationLevel,
              unverifiedMatchesPreserved: unverifiedMatches.length,
              unverifiedResultsPreserved: unverifiedMatches.reduce(
                (total, match) => total + match.results.length,
                0,
              ),
              validCompetitiveMatches: derived.validMatchIds.length,
              invalidVerifiedMatches: derived.invalidMatches.length,
            },
            changes: { createUsers, updateUsers, deleteUsers, unchangedUsers },
            invalidVerifiedMatches: derived.invalidMatches,
            before,
            after,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 2_000,
          timeout: 10_000,
        },
      );
    } catch (error) {
      if (retryableTransactionError(error) && attempt < 2) continue;
      throw error;
    }
  }

  throw new Error("No se pudo reconstruir UserStats.");
}
