import { TILE_SIZE, VISION_RADIUS } from "../../app/play/gameConfig";
import { isWithinVision } from "../../app/play/gameLogic";
import { getCreatureGameplayModifiers } from "../../lib/creature-gameplay";
import type { MatchResultEntry, MultiplayerPlayerState } from "../../app/play/types";
import type { ServerContext, ServerPlayerState, ServerRoomState } from "../types";

export function getAlivePlayers(room: ServerRoomState) {
  return [...room.players.values()].filter(
    (player) => player.status === "playing" && player.combat.health > 0,
  );
}

export function getConnectedPlayers(room: ServerRoomState) {
  return [...room.players.values()].filter(
    (player) => player.connected && player.status !== "left",
  );
}

export function getReadyConnectedPlayers(room: ServerRoomState) {
  return getConnectedPlayers(room).filter((player) => player.isReady);
}

export function toPublicPlayer(player: ServerPlayerState): MultiplayerPlayerState {
  return {
    id: player.id,
    name: player.name,
    characterId: player.characterId,
    position: player.position,
    status: player.status,
    isReady: player.isReady,
    connected: player.connected,
    lastAction: player.lastAction,
    combat: { ...player.combat },
  };
}

export function buildResults(room: ServerRoomState): MatchResultEntry[] {
  const now = room.finishedAt ?? Date.now();
  const sorted = [...room.players.values()].sort((left, right) => {
    const leftAlive = left.status === "won" || left.status === "playing";
    const rightAlive = right.status === "won" || right.status === "playing";

    if (leftAlive !== rightAlive) {
      return leftAlive ? -1 : 1;
    }

    return (right.combat.eliminatedAt ?? now) - (left.combat.eliminatedAt ?? now);
  });

  return sorted.map((player, index) => ({
    playerId: player.id,
    name: player.name,
    characterId: player.characterId,
    placement: index + 1,
    status: player.status,
    kills: player.combat.kills,
    damageDealt: player.combat.damageDealt,
    survivedMs:
      (player.combat.eliminatedAt ?? room.finishedAt ?? now) -
      (room.startedAt ?? room.createdAt),
  }));
}

export function cleanupTransientEvents(room: ServerRoomState, now = Date.now()) {
  room.signals = room.signals.filter((signal) => now - signal.createdAt < signal.duration);
  room.noises = room.noises.filter((noise) => now - noise.createdAt < 3_200);
}

export function emitState(room: ServerRoomState, context: ServerContext) {
  cleanupTransientEvents(room);
  room.results = buildResults(room);
  const alivePlayers = getAlivePlayers(room);
  const aliveEnemies = room.enemies.filter((enemy) => enemy.alive && enemy.state !== "dead");
  const connectedPlayers = getConnectedPlayers(room);
  const readyPlayers = getReadyConnectedPlayers(room);
  const activePlayers = [...room.players.values()].filter((player) => player.status !== "left");

  for (const player of room.players.values()) {
    if (!player.connected || !player.socketId) {
      continue;
    }

    const visibleEnemies = aliveEnemies.filter((enemy) =>
      isWithinVision(player.position, enemy, VISION_RADIUS),
    );
    const radarRange = getCreatureGameplayModifiers(player.characterId).radarRangeTiles * TILE_SIZE;

    context.io.to(player.socketId).emit("game-state", {
      matchId: room.matchId,
      roomCode: room.code,
      status: room.status,
      readyDeadline: room.readyDeadline,
      startAt: room.startAt,
      cave: room.cave,
      self: toPublicPlayer(player),
      otherPlayers: activePlayers
        .filter(
          (other) =>
            other.id !== player.id &&
            isWithinVision(player.position, other.position, VISION_RADIUS),
        )
        .map(toPublicPlayer),
      enemy: visibleEnemies[0] ?? null,
      enemies: visibleEnemies,
      signals: room.signals.filter((signal) =>
        isWithinVision(player.position, { x: signal.x, y: signal.y }, radarRange),
      ),
      noises: room.noises.filter((noise) =>
        isWithinVision(player.position, noise.position, radarRange),
      ),
      winnerId: room.winnerId,
      playerCount: activePlayers.length,
      connectedCount: connectedPlayers.length,
      aliveCount: alivePlayers.length,
      minPlayers: 2,
      maxPlayers: 6,
      requiredPlayers: 2,
      readyCount: readyPlayers.length,
      results: room.results,
      resultReceipt: player.resultReceipt,
      reconnectGraceMs: context.timings.reconnectGraceMs,
      message: room.message,
    });
  }
}
