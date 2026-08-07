import { NextResponse } from "next/server";
import { z } from "zod";

import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const profileQuerySchema = z.object({
  historyLimit: z.coerce.number().int().min(1).max(25).default(10),
});

export async function GET(request: Request) {
  try {
    const currentUser = await requireCurrentUser();
    const url = new URL(request.url);
    const query = profileQuerySchema.safeParse({
      historyLimit: url.searchParams.get("historyLimit") ?? undefined,
    });

    if (!query.success) {
      return NextResponse.json({ error: "El limite de historial no es valido." }, { status: 400 });
    }

    const profile = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: {
        username: true,
        email: true,
        activeCreature: true,
        stats: {
          select: {
            matchesPlayed: true,
            wins: true,
            losses: true,
            score: true,
            lastMatchAt: true,
          },
        },
        matchResults: {
          orderBy: { createdAt: "desc" },
          take: query.data.historyLimit,
          select: {
            id: true,
            creature: true,
            result: true,
            scoreEarned: true,
            createdAt: true,
            match: {
              select: {
                id: true,
                mode: true,
                verificationLevel: true,
                startedAt: true,
                endedAt: true,
              },
            },
          },
        },
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
    }

    const matchesPlayed = profile.stats?.matchesPlayed ?? 0;
    const wins = profile.stats?.wins ?? 0;

    return NextResponse.json({
      username: profile.username,
      email: profile.email,
      activeCreature: profile.activeCreature,
      matchesPlayed,
      wins,
      losses: profile.stats?.losses ?? 0,
      winRate: matchesPlayed > 0 ? Number(((wins / matchesPlayed) * 100).toFixed(1)) : 0,
      score: profile.stats?.score ?? 0,
      lastMatchAt: profile.stats?.lastMatchAt?.toISOString() ?? null,
      history: profile.matchResults.map((entry) => ({
        id: entry.id,
        matchId: entry.match.id,
        mode: entry.match.mode,
        verificationLevel: entry.match.verificationLevel,
        creature: entry.creature,
        result: entry.result,
        scoreEarned: entry.scoreEarned,
        date: entry.createdAt.toISOString(),
        durationMs: entry.match.endedAt
          ? Math.max(0, entry.match.endedAt.getTime() - entry.match.startedAt.getTime())
          : null,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    console.error("[profile] No se pudo cargar el perfil.", error);
    return NextResponse.json({ error: "No se pudo cargar el perfil." }, { status: 500 });
  }
}
