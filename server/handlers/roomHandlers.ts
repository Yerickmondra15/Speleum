import { randomUUID } from "node:crypto";

import { createEnemyState, pickSeparatedSpawns } from "../../app/play/gameLogic";
import { createCaveLayout } from "../../app/play/proceduralCave";
import { buildTileMap, createTileLookup } from "../../app/play/tileMap";
import type { ServerContext, ServerPlayerState, ServerRoomState, GameSocket } from "../types";
import {
  createInitialCombatState,
  createLobbyMessage,
  eliminatePlayer,
  markRoomActivity,
  roomHasCapacity,
  syncLobbyState,
} from "../rooms/roomLifecycle";
import { emitState } from "../rooms/roomSerialization";
import {
  createRoomSchema,
  joinRoomSchema,
  parseSocketPayload,
  resumeRoomSchema,
  roomActionSchema,
} from "../validation/socketSchemas";

function displayName(socket: GameSocket, requestedName?: string) {
  return (requestedName ?? socket.data.username).trim().slice(0, 18);
}

function createPlayer({
  socket,
  room,
  name,
  characterId,
}: {
  socket: GameSocket;
  room: ServerRoomState;
  name?: string;
  characterId: string;
}): ServerPlayerState {
  const spawns = pickSeparatedSpawns(room.cave, room.tileLookup, room.players.size + 1);
  return {
    id: randomUUID(),
    userId: socket.data.userId,
    socketId: socket.id,
    name: displayName(socket, name),
    characterId,
    position: spawns[room.players.size] ?? room.cave.startPosition,
    status: "waiting",
    isReady: false,
    connected: true,
    lastAction: "move",
    combat: createInitialCombatState(characterId),
    connectedAt: Date.now(),
    disconnectedAt: null,
    reconnectDeadline: null,
    intentionalLeave: false,
    lastAttackAt: 0,
    lastMoveAt: Date.now(),
    lastParryAt: 0,
    moveCooldownUntil: 0,
    movementPath: [],
    parryUntil: 0,
    stunnedUntil: 0,
    resultReceipt: null,
  };
}

export function registerRoomHandlers(socket: GameSocket, context: ServerContext) {
  socket.on("create-room", (payload) => {
    const input = parseSocketPayload(createRoomSchema, payload);

    if (!input) {
      socket.emit("error-message", "Los datos para crear la sala no son validos.");
      return;
    }

    if (context.store.getBySocket(socket.id)) {
      socket.emit("error-message", "Ya perteneces a una sala.");
      return;
    }

    const now = Date.now();
    const roomCode = context.store.generateRoomCode();
    const cave = createCaveLayout(`room:${roomCode}`);
    const room: ServerRoomState = {
      matchId: randomUUID(),
      code: roomCode,
      cave,
      tileLookup: createTileLookup(buildTileMap(cave)),
      status: "waiting",
      readyDeadline: null,
      startAt: null,
      createdAt: now,
      lastActivityAt: now,
      expiresAt: now + context.timings.lobbyIdleMs,
      startedAt: null,
      finishedAt: null,
      cleanupStatus: "active",
      enemies: cave.enemyConfigs.map((config) => createEnemyState(config)),
      players: new Map(),
      signals: [],
      noises: [],
      winnerId: null,
      message: `Esperando minimo 2 jugadores.`,
      results: [],
    };
    const player = createPlayer({
      socket,
      room,
      name: input.name,
      characterId: input.characterId,
    });

    room.players.set(player.id, player);
    context.store.add(room);
    context.store.bindSocket(room, player, socket.id);
    void socket.join(room.code);
    syncLobbyState(room, context, now);
    emitState(room, context);
  });

  socket.on("join-room", (payload) => {
    const input = parseSocketPayload(joinRoomSchema, payload);

    if (!input) {
      socket.emit("error-message", "El codigo, nombre o criatura no son validos.");
      return;
    }

    if (context.store.getBySocket(socket.id)) {
      socket.emit("error-message", "Ya perteneces a una sala.");
      return;
    }

    const room = context.store.get(input.roomCode);
    if (!room) {
      socket.emit("error-message", "La sala no existe.");
      return;
    }

    if (["starting", "playing", "finished"].includes(room.status)) {
      socket.emit("error-message", "La sala ya comenzo o termino.");
      return;
    }

    const existingIdentity = context.store.findPlayerByUser(room, socket.data.userId);
    if (existingIdentity) {
      socket.emit(
        "error-message",
        existingIdentity.connected
          ? "Este usuario ya esta conectado en la sala."
          : "Existe una sesion desconectada. Usa la reconexion segura.",
      );
      return;
    }

    if (!roomHasCapacity(room)) {
      socket.emit("error-message", "La sala ya esta completa.");
      return;
    }

    const player = createPlayer({
      socket,
      room,
      name: input.name,
      characterId: input.characterId,
    });
    room.players.set(player.id, player);
    context.store.bindSocket(room, player, socket.id);
    void socket.join(room.code);
    markRoomActivity(room, context);
    syncLobbyState(room, context);
    emitState(room, context);
  });

  socket.on("resume-room", (payload) => {
    const input = parseSocketPayload(resumeRoomSchema, payload);

    if (!input) {
      socket.emit("error-message", "El codigo de sala para reconectar no es valido.");
      return;
    }

    const currentMembership = context.store.getBySocket(socket.id);
    if (currentMembership && currentMembership.room.code !== input.roomCode) {
      socket.emit("error-message", "El socket ya esta asociado a otra sala.");
      return;
    }

    const room = context.store.get(input.roomCode);
    const player = room ? context.store.findPlayerByUser(room, socket.data.userId) : null;

    if (!room || !player || player.intentionalLeave) {
      socket.emit("error-message", "No existe una sesion recuperable para este usuario.");
      return;
    }

    if (player.connected && player.socketId !== socket.id) {
      socket.emit("error-message", "Este usuario ya esta conectado en la sala.");
      return;
    }

    const now = Date.now();
    if (
      room.status !== "finished" &&
      player.reconnectDeadline !== null &&
      player.reconnectDeadline < now
    ) {
      socket.emit("error-message", "La ventana de reconexion ya termino.");
      return;
    }

    context.store.bindSocket(room, player, socket.id);
    player.connected = true;
    player.connectedAt = now;
    player.disconnectedAt = null;
    player.reconnectDeadline = null;
    player.intentionalLeave = false;
    void socket.join(room.code);
    markRoomActivity(room, context, now);
    room.message =
      room.status === "finished"
        ? "La partida termino mientras estabas desconectado."
        : `${player.name} recupero su sesion.`;
    syncLobbyState(room, context, now);
    emitState(room, context);
  });

  socket.on("player-ready", (payload) => {
    const input = parseSocketPayload(roomActionSchema, payload);
    const membership = context.store.getBySocket(socket.id);

    if (!input || !membership || membership.room.code !== input.roomCode) {
      socket.emit("error-message", "No perteneces a la sala indicada.");
      return;
    }

    const { room, player } = membership;
    if (["starting", "playing", "finished"].includes(room.status)) {
      socket.emit("error-message", "La sala no acepta confirmaciones en este estado.");
      return;
    }

    player.isReady = true;
    markRoomActivity(room, context);
    syncLobbyState(room, context);
    emitState(room, context);
  });

  socket.on("leave-room", (payload) => {
    const input = parseSocketPayload(roomActionSchema, payload);
    const membership = context.store.getBySocket(socket.id);

    if (!input || !membership || membership.room.code !== input.roomCode) {
      socket.emit("error-message", "No perteneces a la sala indicada.");
      return;
    }

    const { room, player } = membership;
    const now = Date.now();
    player.intentionalLeave = true;
    player.connected = false;
    player.disconnectedAt = now;
    player.reconnectDeadline = null;
    player.socketId = null;
    context.store.unbindSocket(socket.id);
    void socket.leave(room.code);

    if (room.status === "playing" && player.status === "playing") {
      eliminatePlayer(room, player, `${player.name} abandono la cueva.`, null, now);
    } else if (room.status !== "finished") {
      player.status = "left";
      room.players.delete(player.id);
    }

    if (room.players.size === 0) {
      context.store.delete(room.code);
      return;
    }

    markRoomActivity(room, context, now);
    syncLobbyState(room, context, now);
    room.message = `${player.name} abandono la sala. ${createLobbyMessage(room)}`;
    context.io.to(room.code).emit("player-left", {
      roomCode: room.code,
      playerId: player.id,
      message: room.message,
    });
    emitState(room, context);
  });
}
