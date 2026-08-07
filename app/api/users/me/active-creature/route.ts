import { NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HttpBodyError, parseJsonBody } from "@/lib/validation/http";
import { activeCreatureSchema } from "@/lib/validation/schemas";

export async function PATCH(request: Request) {
  try {
    const currentUser = await requireCurrentUser();
    const { activeCreature } = await parseJsonBody(request, activeCreatureSchema);
    const user = await prisma.user.update({
      where: { id: currentUser.id },
      data: { activeCreature },
    });

    return NextResponse.json({ id: user.id, activeCreature: user.activeCreature });
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

    console.error("[users/me/active-creature] No se pudo actualizar la criatura.", error);
    return NextResponse.json({ error: "No se pudo actualizar la criatura." }, { status: 500 });
  }
}
