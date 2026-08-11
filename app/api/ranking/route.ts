import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createRankingOrderBy,
  createRankingPagination,
  createRankingWhere,
  parseRankingSearchParams,
} from "@/lib/ranking-query";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = parseRankingSearchParams(url.searchParams);

  if (!parsed.success) {
    return NextResponse.json({ error: "La paginacion no es valida." }, { status: 400 });
  }

  const { page, limit } = parsed.data;
  const where = createRankingWhere(parsed.data);
  const pagination = createRankingPagination(parsed.data);

  try {
    const [total, ranking] = await prisma.$transaction([
      prisma.userStats.count({ where }),
      prisma.userStats.findMany({
        where,
        orderBy: createRankingOrderBy(parsed.data),
        ...pagination,
        select: {
          matchesPlayed: true,
          wins: true,
          losses: true,
          score: true,
          bestScore: true,
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
        bestScore: entry.bestScore,
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
