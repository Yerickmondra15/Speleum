import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth";
import {
  MatchResultPolicyError,
  matchResultRequestSchema,
  verifyMatchResultRequest,
  type VerifiedMatchResult,
} from "@/lib/matches/result-contract";
import { prisma } from "@/lib/prisma";
import { getMultiplayerResultSecret } from "@/lib/security/secrets";
import { HttpBodyError, parseJsonBody } from "@/lib/validation/http";

class ResultConflictError extends Error {}

function sameResult(
  existing: { creature: string; result: string; scoreEarned: number },
  incoming: VerifiedMatchResult,
) {
  return (
    existing.creature === incoming.creature &&
    existing.result === incoming.result &&
    existing.scoreEarned === incoming.scoreEarned
  );
}

async function saveResult(userId: string, result: VerifiedMatchResult) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const existingResult = await tx.matchResult.findUnique({
            where: { matchId_userId: { matchId: result.matchId, userId } },
          });

          if (existingResult) {
            if (!sameResult(existingResult, result)) {
              throw new ResultConflictError("El resultado guardado no coincide con la solicitud.");
            }

            return { id: existingResult.id, created: false };
          }

          const existingMatch = await tx.match.findUnique({ where: { id: result.matchId } });

          if (
            existingMatch &&
            (existingMatch.mode !== result.mode ||
              existingMatch.status !== result.status ||
              existingMatch.winnerId !== result.winnerId ||
              existingMatch.verificationLevel !== result.verificationLevel)
          ) {
            throw new ResultConflictError("La partida ya existe con datos diferentes.");
          }

          if (!existingMatch) {
            await tx.match.create({
              data: {
                id: result.matchId,
                mode: result.mode,
                status: result.status,
                winnerId: result.winnerId,
                startedAt: result.startedAt,
                endedAt: result.endedAt,
                verificationLevel: result.verificationLevel,
              },
            });
          }

          const created = await tx.matchResult.create({
            data: {
              matchId: result.matchId,
              userId,
              creature: result.creature,
              result: result.result,
              scoreEarned: result.scoreEarned,
              createdAt: result.endedAt,
            },
          });

          if (result.competitive) {
            await tx.userStats.upsert({
              where: { userId },
              update: {
                matchesPlayed: { increment: 1 },
                wins: result.result === "win" ? { increment: 1 } : undefined,
                losses: result.result === "loss" ? { increment: 1 } : undefined,
                score: { increment: result.scoreEarned },
                lastMatchAt: result.endedAt,
              },
              create: {
                userId,
                matchesPlayed: 1,
                wins: result.result === "win" ? 1 : 0,
                losses: result.result === "loss" ? 1 : 0,
                score: result.scoreEarned,
                lastMatchAt: result.endedAt,
              },
            });
          }

          return { id: created.id, created: true };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2034" || error.code === "P2002");

      if (retryable && attempt < 2) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("No se pudo completar la transaccion.");
}

export async function POST(request: Request) {
  try {
    const currentUser = await requireCurrentUser();
    const body = await parseJsonBody(request, matchResultRequestSchema);
    const verified = verifyMatchResultRequest({
      request: body,
      currentUserId: currentUser.id,
      resultSecret: getMultiplayerResultSecret(),
    });
    const saved = await saveResult(currentUser.id, verified);

    return NextResponse.json(
      {
        id: saved.id,
        idempotent: !saved.created,
        competitive: verified.competitive,
        scoreEarned: verified.scoreEarned,
      },
      { status: saved.created ? 201 : 200 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    if (error instanceof HttpBodyError) {
      return NextResponse.json(
        { error: error.message, issues: error.issues },
        { status: 400 },
      );
    }

    if (error instanceof MatchResultPolicyError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.code === "INVALID_DURATION" ? 400 : 403 },
      );
    }

    if (error instanceof ResultConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    console.error("[matches/results] No se pudo guardar el resultado.", error);
    return NextResponse.json(
      { error: "No se pudo guardar el resultado." },
      { status: 500 },
    );
  }
}
