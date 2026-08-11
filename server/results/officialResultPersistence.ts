import { Prisma } from "@prisma/client";

import type { VerifiedMatchResult } from "../../lib/matches/result-contract";
import {
  isTransientResultPersistenceError,
  ResultConflictError,
  ResultPersistenceInputError,
  type MatchResultPersistenceInput,
  type PersistedMatchResult,
} from "../../lib/matches/result-persistence";
import { calculateCompetitiveScore } from "../game/scoring";
import type { ServerContext, ServerRoomState } from "../types";

export type OfficialResultPersister = (
  input: readonly MatchResultPersistenceInput[],
) => Promise<PersistedMatchResult[]>;

export type ResultPersistenceState = {
  status: "idle" | "pending" | "persisted" | "failed";
  attempts: number;
  lastError: string | null;
};

type RetryTaggedError = Error & { retryable?: boolean };

export function shouldRetryOfficialResultPersistence(error: unknown) {
  if (
    error instanceof ResultConflictError ||
    error instanceof ResultPersistenceInputError
  ) {
    return false;
  }

  if (error instanceof Error && "retryable" in error) {
    return (error as RetryTaggedError).retryable !== false;
  }

  if (isTransientResultPersistenceError(error)) {
    return true;
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientValidationError
  ) {
    return false;
  }

  // Adapters can surface driver/network failures that are not Prisma errors.
  // Unknown errors are retried only inside the bounded loop below.
  return true;
}

function wait(delayMs: number) {
  if (delayMs <= 0) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => setTimeout(resolve, delayMs));
}

export async function persistOfficialResultsWithRetry({
  input,
  persist,
  retryDelaysMs,
  onAttempt,
}: {
  input: readonly MatchResultPersistenceInput[];
  persist: OfficialResultPersister;
  retryDelaysMs: readonly number[];
  onAttempt?: (attempt: number) => void;
}) {
  const maxAttempts = retryDelaysMs.length + 1;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    onAttempt?.(attempt);

    try {
      return {
        attempts: attempt,
        results: await persist(input),
      };
    } catch (error) {
      lastError = error;

      if (
        attempt >= maxAttempts ||
        !shouldRetryOfficialResultPersistence(error)
      ) {
        throw error;
      }

      await wait(retryDelaysMs[attempt - 1] ?? 0);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("No se pudieron persistir los resultados oficiales.");
}

export function buildOfficialResultBatch(
  room: ServerRoomState,
): MatchResultPersistenceInput[] {
  if (room.status !== "finished" || room.finishedAt === null) {
    throw new ResultPersistenceInputError(
      "La partida debe estar terminada antes de persistir resultados oficiales.",
    );
  }

  const winnerUserId = room.winnerId
    ? room.players.get(room.winnerId)?.userId ?? null
    : null;
  const startedAt = new Date(room.startedAt ?? room.createdAt);
  const endedAt = new Date(room.finishedAt);
  const placements = new Map(
    room.results.map((result) => [result.playerId, result.placement]),
  );

  return [...room.players.values()].map((player) => {
    const won = player.id === room.winnerId;
    const result: VerifiedMatchResult = {
      matchId: room.matchId,
      mode: "multiplayer",
      status: "finished",
      winnerId: winnerUserId,
      participantCount: room.players.size,
      startedAt,
      endedAt,
      creature: player.characterId,
      result: won ? "win" : "loss",
      scoreEarned: calculateCompetitiveScore({
        won,
        kills: player.combat.kills,
        placement: placements.get(player.id) ?? room.players.size,
      }),
      verificationLevel: "server_verified",
      competitive: true,
    };

    return { userId: player.userId, result };
  });
}

function persistenceErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error de persistencia desconocido.";
}

export function scheduleOfficialResultPersistence(
  room: ServerRoomState,
  context: ServerContext,
  input: readonly MatchResultPersistenceInput[] = buildOfficialResultBatch(room),
) {
  if (room.resultPersistence.status !== "idle") {
    return false;
  }

  room.resultPersistence = {
    status: "pending",
    attempts: 0,
    lastError: null,
  };

  const task = persistOfficialResultsWithRetry({
    input,
    persist: context.persistOfficialResults,
    retryDelaysMs: context.resultPersistenceRetryDelaysMs,
    onAttempt(attempt) {
      room.resultPersistence.attempts = attempt;
    },
  })
    .then(({ attempts }) => {
      room.resultPersistence = {
        status: "persisted",
        attempts,
        lastError: null,
      };
    })
    .catch((error: unknown) => {
      room.resultPersistence = {
        status: "failed",
        attempts: room.resultPersistence.attempts,
        lastError: persistenceErrorMessage(error),
      };
      console.error(
        `[Speleum] No se persistieron los resultados oficiales de ${room.matchId}.`,
        error,
      );
    })
    .finally(() => {
      context.pendingResultPersistences.delete(task);
    });

  context.pendingResultPersistences.add(task);
  return true;
}
