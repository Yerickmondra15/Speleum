import type { GameSocket, ServerContext } from "../types";
import { createLobbyMessage, markRoomActivity, syncLobbyState } from "../rooms/roomLifecycle";
import { emitState } from "../rooms/roomSerialization";
import { registerGameplayHandlers } from "./gameplayHandlers";
import { registerRoomHandlers } from "./roomHandlers";

export function registerConnectionHandlers(socket: GameSocket, context: ServerContext) {
  registerRoomHandlers(socket, context);
  registerGameplayHandlers(socket, context);

  socket.on("disconnect", () => {
    const membership = context.store.getBySocket(socket.id);
    if (!membership) {
      return;
    }

    const { room, player } = membership;
    const now = Date.now();
    context.store.unbindSocket(socket.id);
    player.socketId = null;
    player.connected = false;
    player.disconnectedAt = now;
    player.reconnectDeadline = now + context.timings.reconnectGraceMs;
    player.intentionalLeave = false;
    markRoomActivity(room, context, now);
    syncLobbyState(room, context, now);
    const reconnectMessage = `${player.name} se desconecto temporalmente. Tiene ${Math.ceil(
      context.timings.reconnectGraceMs / 1_000,
    )}s para regresar.`;
    room.message = room.startedAt === null
      ? `${reconnectMessage} ${createLobbyMessage(room)}`
      : reconnectMessage;
    context.io.to(room.code).emit("player-left", {
      roomCode: room.code,
      playerId: player.id,
      message: room.message,
    });
    emitState(room, context);
  });
}
