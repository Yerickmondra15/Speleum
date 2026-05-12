import { NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type MatchResultBody = {
  matchId?: string;
  mode?: string;
  status?: string;
  winnerId?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  creature?: string;
  result?: "win" | "loss";
  scoreEarned?: number;
};

export async function POST(request: Request) {
  try {
    const currentUser = await requireCurrentUser();
    const body = (await request.json()) as MatchResultBody;

    if (!body.matchId || !body.mode || !body.status || !body.creature || !body.result) {
      return NextResponse.json(
        { error: "Faltan datos para guardar la partida." },
        { status: 400 },
      );
    }

    const matchId = body.matchId;
    const mode = body.mode;
    const status = body.status;
    const creature = body.creature;
    const result = body.result;
    const scoreEarned = Number.isFinite(body.scoreEarned) ? Number(body.scoreEarned) : 0;
    const startedAt = body.startedAt ? new Date(body.startedAt) : new Date();
    const endedAt = body.endedAt ? new Date(body.endedAt) : new Date();

    const resultRecord = await prisma.$transaction(async (tx) => {
      const existingResult = await tx.matchResult.findUnique({
        where: {
          matchId_userId: {
            matchId,
            userId: currentUser.id,
          },
        },
      });

      if (existingResult) {
        return existingResult;
      }

      await tx.match.upsert({
        where: { id: body.matchId },
        update: {
          mode,
          status,
          winnerId: body.winnerId ?? null,
          startedAt,
          endedAt,
        },
        create: {
          id: matchId,
          mode,
          status,
          winnerId: body.winnerId ?? null,
          startedAt,
          endedAt,
        },
      });

      const createdResult = await tx.matchResult.create({
        data: {
          matchId,
          userId: currentUser.id,
          creature,
          result,
          scoreEarned,
          createdAt: endedAt,
        },
      });

      await tx.userStats.upsert({
        where: { userId: currentUser.id },
        update: {
          matchesPlayed: { increment: 1 },
          wins: result === "win" ? { increment: 1 } : undefined,
          losses: result === "loss" ? { increment: 1 } : undefined,
          score: { increment: scoreEarned },
          lastMatchAt: endedAt,
        },
        create: {
          userId: currentUser.id,
          matchesPlayed: 1,
          wins: result === "win" ? 1 : 0,
          losses: result === "loss" ? 1 : 0,
          score: scoreEarned,
          lastMatchAt: endedAt,
        },
      });

      return createdResult;
    });

    return NextResponse.json({ id: resultRecord.id }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    return NextResponse.json(
      { error: "No se pudo guardar el resultado." },
      { status: 500 },
    );
  }
}
