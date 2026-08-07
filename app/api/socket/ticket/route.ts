import { NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth";
import { createSocketTicket, SOCKET_TICKET_TTL_SECONDS } from "@/lib/multiplayer/tickets";
import { getSocketAuthSecret } from "@/lib/security/secrets";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await requireCurrentUser();
    const issuedAt = Date.now();
    const ticket = createSocketTicket(
      { userId: user.id, username: user.username.slice(0, 64) },
      getSocketAuthSecret(),
      issuedAt,
    );

    return NextResponse.json(
      {
        ticket,
        expiresAt: new Date(issuedAt + SOCKET_TICKET_TTL_SECONDS * 1_000).toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, private",
        },
      },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    console.error("[socket/ticket] No se pudo emitir el ticket.", error);
    return NextResponse.json({ error: "No se pudo emitir el ticket de conexion." }, { status: 500 });
  }
}
