import { describe, expect, it, vi } from "vitest";

import {
  fetchProfile,
  isCompetitiveHistoryEntry,
  ProfileLoadError,
} from "@/lib/profile-contract";
import {
  compareCompetitiveRankingEntries,
  fetchRankingPage,
  RankingLoadError,
  type RankingEntry,
} from "@/lib/ranking-contract";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const rankingEntry = (
  overrides: Partial<RankingEntry> = {},
): RankingEntry => ({
  rank: 1,
  userId: "user-a",
  username: "Alpha",
  activeCreature: "cave-axolotl",
  matchesPlayed: 2,
  wins: 1,
  losses: 1,
  score: 100,
  bestScore: 70,
  winRate: 50,
  lastMatchAt: "2026-08-10T12:05:00.000Z",
  ...overrides,
});

describe("contrato del ranking competitivo", () => {
  it("un HTTP 500 produce error y no se interpreta como ranking vacio", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ error: "database unavailable" }, 500),
    ) as unknown as typeof fetch;

    await expect(fetchRankingPage({ page: 1, fetchImpl })).rejects.toBeInstanceOf(
      RankingLoadError,
    );
  });

  it("una respuesta 200 vacia se distingue de un error", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        entries: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      }),
    ) as unknown as typeof fetch;

    await expect(fetchRankingPage({ page: 1, fetchImpl })).resolves.toMatchObject({
      entries: [],
    });
  });

  it("rechaza una respuesta 200 malformada", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ entries: "invalid" })) as unknown as typeof fetch;

    await expect(fetchRankingPage({ page: 1, fetchImpl })).rejects.toBeInstanceOf(
      RankingLoadError,
    );
  });

  it("ordena por score, wins, menos partidas, username e id", () => {
    const entries = [
      rankingEntry({ userId: "z", username: "Beta", score: 100, wins: 2 }),
      rankingEntry({ userId: "a", username: "Alpha", score: 200, wins: 1 }),
      rankingEntry({ userId: "c", username: "Alpha", score: 100, wins: 2 }),
      rankingEntry({ userId: "b", username: "Alpha", score: 100, wins: 2 }),
      rankingEntry({ userId: "few", username: "Zeta", score: 100, wins: 2, matchesPlayed: 1 }),
    ];

    entries.sort(compareCompetitiveRankingEntries);

    expect(entries.map(({ userId }) => userId)).toEqual([
      "a",
      "few",
      "b",
      "c",
      "z",
    ]);
  });
});

describe("contrato de Profile", () => {
  it("un HTTP 500 produce un error controlado", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ error: "database unavailable" }, 500),
    ) as unknown as typeof fetch;

    await expect(fetchProfile({ fetchImpl })).rejects.toBeInstanceOf(ProfileLoadError);
  });

  it("una respuesta malformada no se acepta como ProfileData", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: "unexpected" })) as unknown as typeof fetch;

    await expect(fetchProfile({ fetchImpl })).rejects.toBeInstanceOf(ProfileLoadError);
  });

  it("un resultado local_unverified puede estar en historial pero no es competitivo", async () => {
    const payload = {
      username: "Alpha",
      email: "alpha@example.com",
      activeCreature: "cave-axolotl",
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      score: 0,
      bestScore: 0,
      lastMatchAt: null,
      history: [
        {
          id: "result-local",
          matchId: "local:user:match",
          mode: "local",
          verificationLevel: "local_unverified",
          competitive: false,
          creature: "cave-axolotl",
          result: "win",
          scoreEarned: 0,
          date: "2026-08-10T12:05:00.000Z",
          durationMs: 300_000,
        },
      ],
    };
    const fetchImpl = vi.fn(async () => jsonResponse(payload)) as unknown as typeof fetch;

    const profile = await fetchProfile({ fetchImpl });

    expect(profile.history[0]).toMatchObject({
      result: "win",
      competitive: false,
      verificationLevel: "local_unverified",
    });
    expect(isCompetitiveHistoryEntry("local", "local_unverified")).toBe(false);
    expect(
      isCompetitiveHistoryEntry("multiplayer", "server_verified"),
    ).toBe(true);
  });
});
