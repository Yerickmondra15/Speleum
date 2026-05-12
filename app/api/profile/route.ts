import { NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const currentUser = await requireCurrentUser();
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
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
    }

    return NextResponse.json({
      username: profile.username,
      email: profile.email,
      activeCreature: profile.activeCreature,
      matchesPlayed: profile.stats?.matchesPlayed ?? 0,
      wins: profile.stats?.wins ?? 0,
      losses: profile.stats?.losses ?? 0,
      score: profile.stats?.score ?? 0,
      lastMatchAt: profile.stats?.lastMatchAt?.toISOString() ?? null,
    });
  } catch {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
}
