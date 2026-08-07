import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

const rankingQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = rankingQuerySchema.safeParse({
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "La paginacion no es valida." }, { status: 400 });
  }

  const { page, limit } = parsed.data;

  try {
    const [total, ranking] = await prisma.$transaction([
      prisma.userStats.count({ where: { matchesPlayed: { gt: 0 } } }),
      prisma.userStats.findMany({
        where: { matchesPlayed: { gt: 0 } },
        orderBy: [{ score: "desc" }, { wins: "desc" }, { matchesPlayed: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          matchesPlayed: true,
          wins: true,
          losses: true,
          score: true,
          lastMatchAt: true,
          user: { select: { id: true, username: true, activeCreature: true } },
        },
      }),
    ]);

    return NextResponse.json({
      entries: ranking.map((entry, index) => ({
        rank: (page - 1) * limit + index + 1,
        userId: entry.user.id,
        username: entry.user.username,
        activeCreature: entry.user.activeCreature,
        matchesPlayed: entry.matchesPlayed,
        wins: entry.wins,
        losses: entry.losses,
        score: entry.score,
        winRate:
          entry.matchesPlayed > 0
            ? Number(((entry.wins / entry.matchesPlayed) * 100).toFixed(1))
            : 0,
        lastMatchAt: entry.lastMatchAt?.toISOString() ?? null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    console.error("[ranking] No se pudo cargar el ranking.", error);
    return NextResponse.json({ error: "No se pudo cargar el ranking." }, { status: 500 });
  }
}
