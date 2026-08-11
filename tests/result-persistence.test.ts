import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  createLocalMatchId,
  type VerifiedMatchResult,
} from "@/lib/matches/result-contract";
import {
  persistMatchResults,
  ResultConflictError,
  ResultPersistenceInputError,
  type MatchResultPersistenceInput,
  type ResultPersistenceDatabase,
} from "@/lib/matches/result-persistence";
import { deriveCompetitiveStatsFromMatches } from "@/lib/stats/competitive-stats";

type MatchRow = {
  id: string;
  mode: string;
  status: string;
  winnerId: string | null;
  startedAt: Date;
  endedAt: Date | null;
  verificationLevel: string;
  participantCount: number | null;
  competitiveStatsApplied: boolean;
};

type ResultRow = {
  id: string;
  matchId: string;
  userId: string;
  creature: string;
  result: string;
  scoreEarned: number;
  createdAt: Date;
};

type StatsRow = {
  matchesPlayed: number;
  wins: number;
  losses: number;
  score: number;
  bestScore: number;
  lastMatchAt: Date | null;
};

function createMemoryDatabase() {
  const state = {
    matches: new Map<string, MatchRow>(),
    results: new Map<string, ResultRow>(),
    stats: new Map<string, StatsRow>(),
    resultSequence: 0,
    transactionCalls: 0,
    isolationLevels: [] as Prisma.TransactionIsolationLevel[],
  };

  const database: ResultPersistenceDatabase = {
    async $transaction<T>(
      operation: (tx: Prisma.TransactionClient) => Promise<T>,
      options: { isolationLevel: Prisma.TransactionIsolationLevel },
    ) {
      state.transactionCalls += 1;
      state.isolationLevels.push(options.isolationLevel);

      const working = {
        matches: new Map(state.matches),
        results: new Map(state.results),
        stats: new Map(state.stats),
        resultSequence: state.resultSequence,
      };
      const tx = {
        match: {
          findUnique: async ({ where }: { where: { id: string } }) =>
            working.matches.get(where.id) ?? null,
          create: async ({ data }: { data: MatchRow }) => {
            working.matches.set(data.id, data);
            return data;
          },
          update: async ({
            where,
            data,
          }: {
            where: { id: string };
            data: Partial<MatchRow>;
          }) => {
            const current = working.matches.get(where.id);
            if (!current) throw new Error("match not found");
            const updated = { ...current, ...data };
            working.matches.set(where.id, updated);
            return updated;
          },
        },
        matchResult: {
          findMany: async ({
            where,
          }: {
            where: { matchId: string; userId?: { in: string[] } };
          }) =>
            [...working.results.values()].filter(
              (result) =>
                result.matchId === where.matchId &&
                (!where.userId || where.userId.in.includes(result.userId)),
            ),
          create: async ({ data }: { data: Omit<ResultRow, "id"> }) => {
            working.resultSequence += 1;
            const created = { ...data, id: `result-${working.resultSequence}` };
            working.results.set(`${data.matchId}:${data.userId}`, created);
            return created;
          },
        },
        userStats: {
          findUnique: async ({ where }: { where: { userId: string } }) =>
            working.stats.get(where.userId) ?? null,
          upsert: async ({
            where,
            update,
            create,
          }: {
            where: { userId: string };
            update: StatsRow;
            create: StatsRow & { userId: string };
          }) => {
            const next: StatsRow = working.stats.has(where.userId)
              ? { ...update }
              : {
                  matchesPlayed: create.matchesPlayed,
                  wins: create.wins,
                  losses: create.losses,
                  score: create.score,
                  bestScore: create.bestScore,
                  lastMatchAt: create.lastMatchAt,
                };
            working.stats.set(where.userId, next);
            return next;
          },
        },
      };

      const value = await operation(tx as unknown as Prisma.TransactionClient);
      state.matches = working.matches;
      state.results = working.results;
      state.stats = working.stats;
      state.resultSequence = working.resultSequence;
      return value;
    },
  };

  return { database, state };
}

function multiplayerResult(
  overrides: Partial<VerifiedMatchResult> = {},
): VerifiedMatchResult {
  return {
    matchId: randomUUID(),
    mode: "multiplayer",
    status: "finished",
    winnerId: "user-winner",
    participantCount: 2,
    startedAt: new Date("2026-08-10T12:00:00.000Z"),
    endedAt: new Date("2026-08-10T12:05:00.000Z"),
    creature: "cave-axolotl",
    result: "win",
    scoreEarned: 100,
    verificationLevel: "server_verified",
    competitive: true,
    ...overrides,
  };
}

function completeMatch(
  matchId: string = randomUUID(),
): MatchResultPersistenceInput[] {
  const shared = {
    matchId,
    winnerId: "user-winner",
  };

  return [
    {
      userId: "user-winner",
      result: multiplayerResult({
        ...shared,
        creature: "cave-axolotl",
        result: "win",
        scoreEarned: 100,
      }),
    },
    {
      userId: "user-loser",
      result: multiplayerResult({
        ...shared,
        creature: "cave-spider",
        result: "loss",
        scoreEarned: 25,
      }),
    },
  ];
}

describe("persistencia canonica de resultados", () => {
  it("guarda el lote completo en Serializable y es idempotente para resultados y estadisticas", async () => {
    const { database, state } = createMemoryDatabase();
    const input = completeMatch();

    const first = await persistMatchResults(input, database);
    const second = await persistMatchResults(input, database);

    expect(first).toEqual([
      { userId: "user-winner", id: "result-1", created: true },
      { userId: "user-loser", id: "result-2", created: true },
    ]);
    expect(second).toEqual([
      { userId: "user-winner", id: "result-1", created: false },
      { userId: "user-loser", id: "result-2", created: false },
    ]);
    expect(state.matches).toHaveLength(1);
    expect(state.results).toHaveLength(2);
    expect(state.stats.get("user-winner")).toMatchObject({
      matchesPlayed: 1,
      wins: 1,
      losses: 0,
      score: 100,
    });
    expect(state.stats.get("user-loser")).toMatchObject({
      matchesPlayed: 1,
      wins: 0,
      losses: 1,
      score: 25,
    });
    expect(state.isolationLevels).toEqual([
      Prisma.TransactionIsolationLevel.Serializable,
      Prisma.TransactionIsolationLevel.Serializable,
    ]);
  });

  it("completa solo participantes faltantes tras una persistencia parcial", async () => {
    const { database, state } = createMemoryDatabase();
    const input = completeMatch();

    await persistMatchResults([input[0]], database);
    expect(state.stats).toHaveLength(0);
    const completed = await persistMatchResults(input, database);

    expect(completed.map(({ userId, created }) => ({ userId, created }))).toEqual([
      { userId: "user-winner", created: false },
      { userId: "user-loser", created: true },
    ]);
    expect(state.results).toHaveLength(2);
    expect(state.stats.get("user-winner")?.matchesPlayed).toBe(1);
    expect(state.stats.get("user-loser")?.matchesPlayed).toBe(1);
  });

  it("dos partidas incrementales coinciden exactamente con una reconstruccion", async () => {
    const { database, state } = createMemoryDatabase();
    const first = completeMatch(randomUUID());
    const second = completeMatch(randomUUID()).map(({ userId, result }) => ({
      userId,
      result: {
        ...result,
        startedAt: new Date("2026-08-10T13:00:00.000Z"),
        endedAt: new Date("2026-08-10T13:05:00.000Z"),
        scoreEarned: userId === "user-winner" ? 80 : 40,
      },
    }));

    await persistMatchResults(first, database);
    await persistMatchResults(second, database);
    await persistMatchResults(second, database);

    expect(state.stats.get("user-winner")).toMatchObject({
      matchesPlayed: 2,
      wins: 2,
      losses: 0,
      score: 180,
      bestScore: 100,
    });
    expect(state.stats.get("user-loser")).toMatchObject({
      matchesPlayed: 2,
      wins: 0,
      losses: 2,
      score: 65,
      bestScore: 40,
    });

    const reconstructed = deriveCompetitiveStatsFromMatches(
      [...state.matches.values()].map((match) => ({
        ...match,
        results: [...state.results.values()].filter(
          (result) => result.matchId === match.id,
        ),
      })),
    );

    expect(reconstructed.statsByUser.get("user-winner")).toEqual(
      state.stats.get("user-winner"),
    );
    expect(reconstructed.statsByUser.get("user-loser")).toEqual(
      state.stats.get("user-loser"),
    );
  });

  it("rechaza un resultado ya guardado con contenido diferente", async () => {
    const { database, state } = createMemoryDatabase();
    const input = completeMatch();
    await persistMatchResults(input, database);

    const conflicting = completeMatch(input[0].result.matchId);
    conflicting[1] = {
      ...conflicting[1],
      result: { ...conflicting[1].result, scoreEarned: 26 },
    };

    await expect(persistMatchResults(conflicting, database)).rejects.toBeInstanceOf(
      ResultConflictError,
    );
    expect(state.results).toHaveLength(2);
    expect(state.stats.get("user-loser")?.score).toBe(25);
  });

  it("guarda resultados locales como no competitivos sin tocar UserStats", async () => {
    const { database, state } = createMemoryDatabase();
    const result: VerifiedMatchResult = {
      matchId: createLocalMatchId("local-user", randomUUID()),
      mode: "local",
      status: "finished",
      winnerId: null,
      participantCount: 1,
      startedAt: new Date("2026-08-10T12:00:00.000Z"),
      endedAt: new Date("2026-08-10T12:05:00.000Z"),
      creature: "cave-axolotl",
      result: "win",
      scoreEarned: 0,
      verificationLevel: "local_unverified",
      competitive: false,
    };

    await persistMatchResults([{ userId: "local-user", result }], database);

    expect(state.matches.get(result.matchId)?.verificationLevel).toBe(
      "local_unverified",
    );
    expect(state.results).toHaveLength(1);
    expect(state.stats).toHaveLength(0);
  });

  it("un ID local elegido por cliente no puede bloquear el matchId multijugador publico", async () => {
    const { database, state } = createMemoryDatabase();
    const publicMatchId = randomUUID();
    const localResult: VerifiedMatchResult = {
      matchId: createLocalMatchId("attacker", publicMatchId),
      mode: "local",
      status: "finished",
      winnerId: null,
      participantCount: 1,
      startedAt: new Date("2026-08-10T12:00:00.000Z"),
      endedAt: new Date("2026-08-10T12:05:00.000Z"),
      creature: "cave-axolotl",
      result: "loss",
      scoreEarned: 0,
      verificationLevel: "local_unverified",
      competitive: false,
    };

    await persistMatchResults(
      [{ userId: "attacker", result: localResult }],
      database,
    );
    await expect(
      persistMatchResults(completeMatch(publicMatchId), database),
    ).resolves.toHaveLength(2);

    expect(state.matches).toHaveLength(2);
    expect(state.matches.get(publicMatchId)?.verificationLevel).toBe("server_verified");
    expect(state.results).toHaveLength(3);
    expect(state.stats).toHaveLength(2);
  });

  it("rechaza en la capa de persistencia un resultado local sin namespace confiable", async () => {
    const { database } = createMemoryDatabase();
    const result: VerifiedMatchResult = {
      matchId: randomUUID(),
      mode: "local",
      status: "finished",
      winnerId: null,
      participantCount: 1,
      startedAt: new Date("2026-08-10T12:00:00.000Z"),
      endedAt: new Date("2026-08-10T12:05:00.000Z"),
      creature: "cave-axolotl",
      result: "loss",
      scoreEarned: 0,
      verificationLevel: "local_unverified",
      competitive: false,
    };

    await expect(
      persistMatchResults([{ userId: "local-user", result }], database),
    ).rejects.toBeInstanceOf(ResultPersistenceInputError);
  });

  it("reintenta conflictos transaccionales P2034 de forma acotada", async () => {
    const memory = createMemoryDatabase();
    let attempts = 0;
    const database: ResultPersistenceDatabase = {
      async $transaction<T>(
        operation: (tx: Prisma.TransactionClient) => Promise<T>,
        options: { isolationLevel: Prisma.TransactionIsolationLevel },
      ) {
        attempts += 1;

        if (attempts < 3) {
          throw new Prisma.PrismaClientKnownRequestError("write conflict", {
            code: "P2034",
            clientVersion: "test",
          });
        }

        return memory.database.$transaction(operation, options);
      },
    };

    const persisted = await persistMatchResults(completeMatch(), database);

    expect(attempts).toBe(3);
    expect(persisted).toHaveLength(2);
  });
});
