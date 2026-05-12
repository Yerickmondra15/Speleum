import { NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Body = {
  activeCreature?: string;
};

export async function PATCH(request: Request) {
  try {
    const currentUser = await requireCurrentUser();
    const body = (await request.json()) as Body;
    const activeCreature = body.activeCreature?.trim();

    if (!activeCreature) {
      return NextResponse.json(
        { error: "La criatura activa es obligatoria." },
        { status: 400 },
      );
    }

    const user = await prisma.user.update({
      where: { id: currentUser.id },
      data: { activeCreature },
    });

    return NextResponse.json({
      id: user.id,
      activeCreature: user.activeCreature,
    });
  } catch {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
}
