import { z } from "zod";

import { verifyResultReceipt } from "@/lib/multiplayer/tickets";
import { creatureIdSchema } from "@/lib/validation/schemas";

export const MAX_MATCH_DURATION_MS = 4 * 60 * 60 * 1_000;
export const MIN_MATCH_DURATION_MS = 1_000;

const localResultSchema = z
  .object({
    mode: z.literal("local"),
    matchId: z.string().uuid(),
    status: z.literal("finished"),
    startedAt: z.string().datetime({ offset: true }),
    endedAt: z.string().datetime({ offset: true }),
    creature: creatureIdSchema,
    result: z.enum(["win", "loss"]),
  })
  .strict();

const multiplayerResultSchema = z
  .object({
    mode: z.literal("multiplayer"),
    receipt: z.string().min(40).max(8_192),
  })
  .strict();

export const matchResultRequestSchema = z.discriminatedUnion("mode", [
  localResultSchema,
  multiplayerResultSchema,
]);

export type MatchResultRequest = z.infer<typeof matchResultRequestSchema>;

export type VerifiedMatchResult = {
  matchId: string;
  mode: "local" | "multiplayer";
  status: "finished";
  winnerId: string | null;
  participantCount: number | null;
  startedAt: Date;
  endedAt: Date;
  creature: z.infer<typeof creatureIdSchema>;
  result: "win" | "loss";
  scoreEarned: number;
  verificationLevel: "local_unverified" | "server_verified";
  competitive: boolean;
};

export function createLocalMatchId(userId: string, clientMatchId: string) {
  return `local:${userId}:${clientMatchId}`;
}

export class MatchResultPolicyError extends Error {
  constructor(
    readonly code: "INVALID_DURATION" | "INVALID_RECEIPT" | "WRONG_USER",
    message: string,
  ) {
    super(message);
  }
}

function validateDates(startedAt: Date, endedAt: Date, nowMs: number) {
  const duration = endedAt.getTime() - startedAt.getTime();

  if (
    !Number.isFinite(startedAt.getTime()) ||
    !Number.isFinite(endedAt.getTime()) ||
    duration < MIN_MATCH_DURATION_MS ||
    duration > MAX_MATCH_DURATION_MS ||
    endedAt.getTime() > nowMs + 5 * 60_000
  ) {
    throw new MatchResultPolicyError(
      "INVALID_DURATION",
      "Las fechas o la duracion de la partida no son validas.",
    );
  }
}

export function verifyMatchResultRequest({
  request,
  currentUserId,
  resultSecret,
  nowMs = Date.now(),
}: {
  request: MatchResultRequest;
  currentUserId: string;
  resultSecret: string;
  nowMs?: number;
}): VerifiedMatchResult {
  if (request.mode === "local") {
    const startedAt = new Date(request.startedAt);
    const endedAt = new Date(request.endedAt);
    validateDates(startedAt, endedAt, nowMs);

    return {
      // Local IDs are client-generated. Namespace them on the trusted side so
      // they can never preempt a public authoritative multiplayer match UUID.
      matchId: createLocalMatchId(currentUserId, request.matchId),
      mode: "local",
      status: "finished",
      winnerId: null,
      participantCount: 1,
      startedAt,
      endedAt,
      creature: request.creature,
      result: request.result,
      scoreEarned: 0,
      verificationLevel: "local_unverified",
      competitive: false,
    };
  }

  const receipt = verifyResultReceipt(request.receipt, resultSecret, nowMs);

  if (!receipt) {
    throw new MatchResultPolicyError(
      "INVALID_RECEIPT",
      "El comprobante multijugador es invalido o expiro.",
    );
  }

  if (receipt.userId !== currentUserId) {
    throw new MatchResultPolicyError(
      "WRONG_USER",
      "El comprobante pertenece a otro usuario.",
    );
  }

  const creature = creatureIdSchema.safeParse(receipt.creature);

  if (!creature.success) {
    throw new MatchResultPolicyError("INVALID_RECEIPT", "El comprobante contiene una criatura invalida.");
  }

  const startedAt = new Date(receipt.startedAt);
  const endedAt = new Date(receipt.endedAt);
  validateDates(startedAt, endedAt, nowMs);

  return {
    matchId: receipt.matchId,
    mode: "multiplayer",
    status: "finished",
    winnerId: receipt.winnerUserId,
    participantCount: receipt.participantCount ?? null,
    startedAt,
    endedAt,
    creature: creature.data,
    result: receipt.result,
    scoreEarned: receipt.scoreEarned,
    verificationLevel: "server_verified",
    competitive: true,
  };
}
