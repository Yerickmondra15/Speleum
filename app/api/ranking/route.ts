import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET() {
  const ranking = await prisma.userStats.findMany({
    orderBy: [
      { score: "desc" },
      { wins: "desc" },
      { matchesPlayed: "asc" },
    ],
    select: {
      matchesPlayed: true,
      wins: true,
      losses: true,
      score: true,
      lastMatchAt: true,
      user: {
        select: {
          id: true,
          username: true,
          activeCreature: true,
        },
      },
    },
  });

  return NextResponse.json(
    ranking.map((entry, index) => ({
      rank: index + 1,
      userId: entry.user.id,
      username: entry.user.username,
      activeCreature: entry.user.activeCreature,
      matchesPlayed: entry.matchesPlayed,
      wins: entry.wins,
      losses: entry.losses,
      score: entry.score,
      lastMatchAt: entry.lastMatchAt?.toISOString() ?? null,
    })),
  );
}
