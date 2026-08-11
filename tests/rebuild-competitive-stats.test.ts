import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  rebuildCompetitiveUserStats,
  type CompetitiveStatsRebuildDatabase,
} from "@/lib/stats/rebuild-competitive-stats";
import type { CompetitiveMatchRecord } from "@/lib/stats/competitive-stats";

type MatchRow = CompetitiveMatchRecord & { competitiveStatsApplied: boolean };
type StatsRow = {
  userId: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  score: number;
  bestScore: number;
  lastMatchAt: Date | null;
};

function createRebuildDatabase() {
  const users = new Map([
    ["winner", "Alpha"],
    ["loser", "Beta"],
    ["historical", "Gamma"],
  ]);
  const matches: MatchRow[] = [
    {
      id: "verified-match",
      mode: "multiplayer",
      status: "finished",
      winnerId: "winner",
      participantCount: 2,
      startedAt: new Date("2026-08-10T12:00:00.000Z"),
      endedAt: new Date("2026-08-10T12:05:00.000Z"),
      verificationLevel: "server_verified",
      competitiveStatsApplied: false,
      results: [
        {
          userId: "winner",
          result: "win",
          scoreEarned: 100,
          creature: "cave-axolotl",
        },
        {
          userId: "loser",
          result: "loss",
          scoreEarned: 25,
          creature: "cave-spider",
        },
      ],
    },
    {
      id: "historical-local",
      mode: "local",
      status: "finished",
      winnerId: null,
      participantCount: null,
      startedAt: new Date("2026-08-09T12:00:00.000Z"),
      endedAt: new Date("2026-08-09T12:05:00.000Z"),
      verificationLevel: "local_unverified",
      competitiveStatsApplied: false,
      results: [
        {
          userId: "historical",
          result: "win",
          scoreEarned: 999,
          creature: "cave-axolotl",
        },
      ],
    },
  ];
  const stats = new Map<string, StatsRow>([
    [
      "historical",
      {
        userId: "historical",
        matchesPlayed: 50,
        wins: 50,
        losses: 0,
        score: 50_000,
        bestScore: 999,
        lastMatchAt: new Date("2026-08-09T12:05:00.000Z"),
      },
    ],
  ]);
  const state = { users, matches, stats };

  const database: CompetitiveStatsRebuildDatabase = {
    async $transaction<T>(
      operation: (tx: Prisma.TransactionClient) => Promise<T>,
    ) {
      const tx = {
        user: {
          count: async () => users.size,
          findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
            where.id.in
              .filter((id) => users.has(id))
              .map((id) => ({ id, username: users.get(id) as string })),
        },
        match: {
          findMany: async () =>
            [...matches].sort((left, right) => left.id.localeCompare(right.id)),
          updateMany: async ({
            where,
            data,
          }: {
            where?: { id: { in: string[] } };
            data: { competitiveStatsApplied: boolean };
          }) => {
            let count = 0;
            for (const match of matches) {
              if (!where || where.id.in.includes(match.id)) {
                match.competitiveStatsApplied = data.competitiveStatsApplied;
                count += 1;
              }
            }
            return { count };
          },
        },
        userStats: {
          findMany: async () =>
            [...stats.values()]
              .sort((left, right) => left.userId.localeCompare(right.userId))
              .map((entry) => ({
                ...entry,
                user: { username: users.get(entry.userId) as string },
              })),
          deleteMany: async ({
            where,
          }: {
            where?: { userId: { notIn: string[] } };
          }) => {
            const keep = new Set(where?.userId.notIn ?? []);
            let count = 0;
            for (const userId of [...stats.keys()]) {
              if (!keep.has(userId)) {
                stats.delete(userId);
                count += 1;
              }
            }
            return { count };
          },
          upsert: async ({
            where,
            update,
            create,
          }: {
            where: { userId: string };
            update: Omit<StatsRow, "userId">;
            create: StatsRow;
          }) => {
            const next = stats.has(where.userId)
              ? { userId: where.userId, ...update }
              : create;
            stats.set(where.userId, next);
            return next;
          },
        },
      };

      return operation(tx as unknown as Prisma.TransactionClient);
    },
  };

  return { database, state };
}

describe("reconstruccion de UserStats", () => {
  it("el dry-run reporta cambios sin modificar agregados ni historial", async () => {
    const { database, state } = createRebuildDatabase();

    const report = await rebuildCompetitiveUserStats({ dryRun: true, database });

    expect(report.changes.createUsers).toEqual(["loser", "winner"]);
    expect(report.changes.deleteUsers).toEqual(["historical"]);
    expect(state.stats.has("historical")).toBe(true);
    expect(state.matches).toHaveLength(2);
    expect(state.matches.flatMap((match) => match.results)).toHaveLength(3);
  });

  it("aplicar dos veces es idempotente y conserva Match/MatchResult historicos", async () => {
    const { database, state } = createRebuildDatabase();
    const originalMatchIds = state.matches.map(({ id }) => id);
    const originalResultCount = state.matches.flatMap(({ results }) => results).length;

    await rebuildCompetitiveUserStats({ dryRun: false, database });
    const second = await rebuildCompetitiveUserStats({ dryRun: false, database });

    expect(second.changes).toEqual({
      createUsers: [],
      updateUsers: [],
      deleteUsers: [],
      unchangedUsers: ["loser", "winner"],
    });
    expect(state.stats.get("winner")).toMatchObject({
      matchesPlayed: 1,
      wins: 1,
      score: 100,
      bestScore: 100,
    });
    expect(state.stats.get("loser")).toMatchObject({
      matchesPlayed: 1,
      losses: 1,
      score: 25,
      bestScore: 25,
    });
    expect(state.stats.has("historical")).toBe(false);
    expect(state.matches.map(({ id }) => id)).toEqual(originalMatchIds);
    expect(state.matches.flatMap(({ results }) => results)).toHaveLength(
      originalResultCount,
    );
    expect(
      state.matches.find(({ id }) => id === "verified-match")
        ?.competitiveStatsApplied,
    ).toBe(true);
    expect(
      state.matches.find(({ id }) => id === "historical-local")
        ?.competitiveStatsApplied,
    ).toBe(false);
  });
});
