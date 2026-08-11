import { creatureIdSchema } from "@/lib/validation/schemas";
import { MAX_COMPETITIVE_SCORE_PER_MATCH } from "@/server/game/scoring";

export type CompetitiveStats = {
  matchesPlayed: number;
  wins: number;
  losses: number;
  score: number;
  bestScore: number;
  lastMatchAt: Date | null;
};

export type CompetitiveResultRecord = {
  userId: string;
  result: string;
  scoreEarned: number;
  creature: string;
};

export type CompetitiveMatchRecord = {
  id: string;
  mode: string;
  status: string;
  winnerId: string | null;
  startedAt: Date;
  endedAt: Date | null;
  verificationLevel: string;
  participantCount: number | null;
  results: readonly CompetitiveResultRecord[];
};

export type CompetitiveStatsContribution = {
  userId: string;
  result: "win" | "loss";
  scoreEarned: number;
  playedAt: Date;
};

export type CompetitiveMatchEvaluation = {
  eligible: boolean;
  issues: string[];
  contributions: CompetitiveStatsContribution[];
};

export function createEmptyCompetitiveStats(): CompetitiveStats {
  return {
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    score: 0,
    bestScore: 0,
    lastMatchAt: null,
  };
}

export function applyCompetitiveContribution(
  current: CompetitiveStats,
  contribution: CompetitiveStatsContribution,
): CompetitiveStats {
  return {
    matchesPlayed: current.matchesPlayed + 1,
    wins: current.wins + (contribution.result === "win" ? 1 : 0),
    losses: current.losses + (contribution.result === "loss" ? 1 : 0),
    score: current.score + contribution.scoreEarned,
    bestScore: Math.max(current.bestScore, contribution.scoreEarned),
    lastMatchAt:
      !current.lastMatchAt || contribution.playedAt > current.lastMatchAt
        ? contribution.playedAt
        : current.lastMatchAt,
  };
}

export function evaluateCompetitiveMatch(
  match: CompetitiveMatchRecord,
): CompetitiveMatchEvaluation {
  if (match.verificationLevel !== "server_verified") {
    return { eligible: false, issues: [], contributions: [] };
  }

  const issues: string[] = [];
  const participantCount = match.participantCount;
  const winners = match.results.filter((result) => result.result === "win");

  if (match.mode !== "multiplayer") issues.push("invalid_mode");
  if (match.status !== "finished") issues.push("not_finished");
  if (!match.endedAt || match.endedAt < match.startedAt) {
    issues.push("invalid_duration");
  }
  if (
    participantCount === null ||
    !Number.isInteger(participantCount) ||
    participantCount < 2 ||
    participantCount > 6
  ) {
    issues.push("invalid_participant_count");
  } else if (match.results.length !== participantCount) {
    issues.push("incomplete_results");
  }
  if (new Set(match.results.map((result) => result.userId)).size !== match.results.length) {
    issues.push("duplicate_participant");
  }
  if (
    match.results.some(
      (result) =>
        !result.userId ||
        !["win", "loss"].includes(result.result) ||
        !Number.isInteger(result.scoreEarned) ||
        result.scoreEarned < 0 ||
        result.scoreEarned > MAX_COMPETITIVE_SCORE_PER_MATCH ||
        !creatureIdSchema.safeParse(result.creature).success,
    )
  ) {
    issues.push("invalid_result");
  }
  if (match.winnerId) {
    if (
      winners.length !== 1 ||
      winners[0]?.userId !== match.winnerId ||
      !match.results.some((result) => result.userId === match.winnerId)
    ) {
      issues.push("winner_mismatch");
    }
  } else if (winners.length > 0) {
    issues.push("winner_mismatch");
  }

  if (issues.length > 0 || !match.endedAt) {
    return { eligible: false, issues: [...new Set(issues)], contributions: [] };
  }

  return {
    eligible: true,
    issues: [],
    contributions: match.results.map((result) => ({
      userId: result.userId,
      result: result.result as "win" | "loss",
      scoreEarned: result.scoreEarned,
      playedAt: match.endedAt as Date,
    })),
  };
}

export function deriveCompetitiveStatsFromMatches(
  matches: readonly CompetitiveMatchRecord[],
) {
  const statsByUser = new Map<string, CompetitiveStats>();
  const validMatchIds: string[] = [];
  const invalidMatches: Array<{ matchId: string; issues: string[] }> = [];

  for (const match of matches) {
    const evaluation = evaluateCompetitiveMatch(match);

    if (!evaluation.eligible) {
      if (match.verificationLevel === "server_verified" && evaluation.issues.length > 0) {
        invalidMatches.push({ matchId: match.id, issues: evaluation.issues });
      }
      continue;
    }

    validMatchIds.push(match.id);
    for (const contribution of evaluation.contributions) {
      statsByUser.set(
        contribution.userId,
        applyCompetitiveContribution(
          statsByUser.get(contribution.userId) ?? createEmptyCompetitiveStats(),
          contribution,
        ),
      );
    }
  }

  return { statsByUser, validMatchIds, invalidMatches };
}
