import { describe, expect, it } from "vitest";

import {
  deriveCompetitiveStatsFromMatches,
  evaluateCompetitiveMatch,
  type CompetitiveMatchRecord,
} from "@/lib/stats/competitive-stats";

function competitiveMatch(
  overrides: Partial<CompetitiveMatchRecord> = {},
): CompetitiveMatchRecord {
  return {
    id: "match-1",
    mode: "multiplayer",
    status: "finished",
    winnerId: "winner",
    participantCount: 2,
    startedAt: new Date("2026-08-10T12:00:00.000Z"),
    endedAt: new Date("2026-08-10T12:05:00.000Z"),
    verificationLevel: "server_verified",
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
    ...overrides,
  };
}

describe("estadisticas competitivas derivadas", () => {
  it("excluye por completo los resultados local_unverified", () => {
    const local = competitiveMatch({
      id: "local-1",
      mode: "local",
      verificationLevel: "local_unverified",
      participantCount: 1,
    });

    const derived = deriveCompetitiveStatsFromMatches([local]);

    expect(derived.statsByUser.size).toBe(0);
    expect(derived.validMatchIds).toEqual([]);
  });

  it("una partida server_verified genera una victoria y una derrota exactas", () => {
    const derived = deriveCompetitiveStatsFromMatches([competitiveMatch()]);

    expect(derived.statsByUser.get("winner")).toMatchObject({
      matchesPlayed: 1,
      wins: 1,
      losses: 0,
      score: 100,
      bestScore: 100,
    });
    expect(derived.statsByUser.get("loser")).toMatchObject({
      matchesPlayed: 1,
      wins: 0,
      losses: 1,
      score: 25,
      bestScore: 25,
    });
  });

  it("dos partidas acumulan exactamente dos contribuciones por usuario", () => {
    const second = competitiveMatch({
      id: "match-2",
      startedAt: new Date("2026-08-10T13:00:00.000Z"),
      endedAt: new Date("2026-08-10T13:04:00.000Z"),
      results: [
        {
          userId: "winner",
          result: "win",
          scoreEarned: 80,
          creature: "cave-axolotl",
        },
        {
          userId: "loser",
          result: "loss",
          scoreEarned: 40,
          creature: "cave-spider",
        },
      ],
    });

    const derived = deriveCompetitiveStatsFromMatches([competitiveMatch(), second]);

    expect(derived.statsByUser.get("winner")).toMatchObject({
      matchesPlayed: 2,
      wins: 2,
      losses: 0,
      score: 180,
      bestScore: 100,
    });
    expect(derived.statsByUser.get("loser")).toMatchObject({
      matchesPlayed: 2,
      wins: 0,
      losses: 2,
      score: 65,
      bestScore: 40,
    });
  });

  it("un usuario sin partidas verificadas queda sin fila derivada", () => {
    const derived = deriveCompetitiveStatsFromMatches([]);
    expect(derived.statsByUser.has("user-without-matches")).toBe(false);
  });

  it("conserva el registro historico como entrada pero no lo agrega", () => {
    const historical = competitiveMatch({ verificationLevel: "local_unverified" });
    const matches = [historical];

    const derived = deriveCompetitiveStatsFromMatches(matches);

    expect(matches).toHaveLength(1);
    expect(derived.statsByUser.size).toBe(0);
  });

  it("rechaza una partida verificada incompleta", () => {
    const match = competitiveMatch({
      results: [competitiveMatch().results[0]],
    });

    const evaluation = evaluateCompetitiveMatch(match);

    expect(evaluation.eligible).toBe(false);
    expect(evaluation.issues).toContain("incomplete_results");
    expect(evaluation.contributions).toEqual([]);
  });

  it("una partida de seis jugadores genera seis contribuciones correctas", () => {
    const results = Array.from({ length: 6 }, (_, index) => ({
      userId: index === 0 ? "winner" : `loser-${index}`,
      result: index === 0 ? "win" : "loss",
      scoreEarned: 60 - index * 10,
      creature: "cave-axolotl",
    }));
    const evaluation = evaluateCompetitiveMatch(
      competitiveMatch({ participantCount: 6, results }),
    );

    expect(evaluation.eligible).toBe(true);
    expect(evaluation.contributions).toHaveLength(6);
    expect(evaluation.contributions.filter(({ result }) => result === "win")).toHaveLength(1);
    expect(evaluation.contributions.filter(({ result }) => result === "loss")).toHaveLength(5);
  });

  it("un ganador suma wins exactamente una vez y un perdedor solo losses", () => {
    const derived = deriveCompetitiveStatsFromMatches([competitiveMatch()]);

    expect(derived.statsByUser.get("winner")?.wins).toBe(1);
    expect(derived.statsByUser.get("winner")?.losses).toBe(0);
    expect(derived.statsByUser.get("loser")?.wins).toBe(0);
    expect(derived.statsByUser.get("loser")?.losses).toBe(1);
  });

  it("reconstruye bestScore como el maximo y no como el ultimo score", () => {
    const laterLowerScore = competitiveMatch({
      id: "match-2",
      startedAt: new Date("2026-08-10T13:00:00.000Z"),
      endedAt: new Date("2026-08-10T13:05:00.000Z"),
      results: [
        {
          userId: "winner",
          result: "win",
          scoreEarned: 15,
          creature: "cave-axolotl",
        },
        {
          userId: "loser",
          result: "loss",
          scoreEarned: 5,
          creature: "cave-spider",
        },
      ],
    });

    const derived = deriveCompetitiveStatsFromMatches([
      competitiveMatch(),
      laterLowerScore,
    ]);

    expect(derived.statsByUser.get("winner")?.bestScore).toBe(100);
    expect(derived.statsByUser.get("winner")?.lastMatchAt).toEqual(
      laterLowerScore.endedAt,
    );
  });

  it("rechaza mas de un ganador y scores imposibles", () => {
    const evaluation = evaluateCompetitiveMatch(
      competitiveMatch({
        results: [
          competitiveMatch().results[0],
          {
            userId: "loser",
            result: "win",
            scoreEarned: 301,
            creature: "cave-spider",
          },
        ],
      }),
    );

    expect(evaluation.eligible).toBe(false);
    expect(evaluation.issues).toEqual(
      expect.arrayContaining(["invalid_result", "winner_mismatch"]),
    );
  });
});
