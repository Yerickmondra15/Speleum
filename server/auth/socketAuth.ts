import { verifySocketTicket } from "../../lib/multiplayer/tickets";
import type { GameServer } from "../types";

export class SocketTicketReplayStore {
  private readonly consumed = new Map<string, number>();

  consume(jti: string, expiresAtSeconds: number, nowMs = Date.now()) {
    this.cleanup(nowMs);

    if (this.consumed.has(jti)) {
      return false;
    }

    this.consumed.set(jti, expiresAtSeconds * 1_000);
    return true;
  }

  cleanup(nowMs = Date.now()) {
    for (const [jti, expiresAt] of this.consumed) {
      if (expiresAt <= nowMs) {
        this.consumed.delete(jti);
      }
    }
  }

  clear() {
    this.consumed.clear();
  }
}

export function installSocketAuthentication(
  io: GameServer,
  secret: string,
  replayStore = new SocketTicketReplayStore(),
) {
  io.use((socket, next) => {
    const candidate = socket.handshake.auth?.ticket;
    const ticket =
      typeof candidate === "string" && candidate.length <= 8_192
        ? verifySocketTicket(candidate, secret)
        : null;

    if (!ticket || !replayStore.consume(ticket.jti, ticket.exp)) {
      next(new Error("AUTH_INVALID_TICKET"));
      return;
    }

    socket.data.userId = ticket.sub;
    socket.data.username = ticket.username;
    socket.data.ticketId = ticket.jti;
    next();
  });

  return replayStore;
}
