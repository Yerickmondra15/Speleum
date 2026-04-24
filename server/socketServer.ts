import { createServer } from "node:http";
import { Server } from "socket.io";
import type { PlayerPosition } from "../app/play/gameConfig";
import {
  PLAYER_SPEED,
  VISION_RADIUS,
  characterOptions,
  goalArea,
  hazardAreas,
  multiplayerSpawnPositions,
  stalkerConfig,
} from "../app/play/gameConfig";
import {
  createEnemyState,
  hitHazard,
  isWithinVision,
  moveTowardPosition,
  moveWithCollisions,
  reachedGoal,
  updateEnemyState,
} from "../app/play/gameLogic";
import type { EnemyState } from "../app/play/gameLogic";
import type {
  MultiplayerPlayerState,
  MultiplayerRoomStatus,
  MultiplayerStatePayload,
  RadarSignal,
} from "../app/play/types";

type ServerPlayerState = MultiplayerPlayerState & {
  socketId: string;
};

type ServerRoomState = {
  code: string;
  status: MultiplayerRoomStatus;
  createdAt: number;
  enemy: EnemyState;
  players: Map<string, ServerPlayerState>;
  signals: RadarSignal[];
  winnerId: string | null;
  message: string | null;
};

const PORT = Number(process.env.SOCKET_PORT ?? 4001);
const REQUIRED_PLAYERS = 2;
const MOVE_INTERVAL_MS = 80;
const ATTACK_SIGNAL_DURATION = 1800;
const rooms = new Map<string, ServerRoomState>();

function generateRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  while (code.length < 6) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return rooms.has(code) ? generateRoomCode() : code;
}

function sanitizeName(name: string | undefined, fallback: string) {
  const trimmed = name?.trim();

  if (!trimmed) {
    return fallback;
  }

  return trimmed.slice(0, 18);
}

function getMoveSpeed(characterId: string) {
  const character = characterOptions.find((option) => option.id === characterId);
  const multiplier = character?.moveCooldownMultiplier ?? 1;

  return PLAYER_SPEED / multiplier;
}

function getPlayerBySocket(socketId: string) {
  for (const room of rooms.values()) {
    for (const player of room.players.values()) {
      if (player.socketId === socketId) {
        return { room, player };
      }
    }
  }

  return null;
}

function getActivePlayers(room: ServerRoomState) {
  return [...room.players.values()].filter(
    (player) => player.connected && player.status === "playing",
  );
}

function cleanupSignals(room: ServerRoomState) {
  const now = Date.now();
  room.signals = room.signals.filter(
    (signal) => now - signal.createdAt < signal.duration,
  );
}

function emitState(room: ServerRoomState, io: Server) {
  cleanupSignals(room);

  for (const player of room.players.values()) {
    if (!player.connected) {
      continue;
    }

    const payload: MultiplayerStatePayload = {
      roomCode: room.code,
      status: room.status,
      self: {
        id: player.id,
        name: player.name,
        characterId: player.characterId,
        position: player.position,
        status: player.status,
        isReady: player.isReady,
        connected: player.connected,
        lastAction: player.lastAction,
      },
      otherPlayers: [...room.players.values()]
        .filter(
          (other) =>
            other.id !== player.id &&
            other.connected &&
            isWithinVision(player.position, other.position, VISION_RADIUS),
        )
        .map((other) => ({
          id: other.id,
          name: other.name,
          characterId: other.characterId,
          position: other.position,
          status: other.status,
          isReady: other.isReady,
          connected: other.connected,
          lastAction: other.lastAction,
        })),
      enemy: isWithinVision(
        player.position,
        { x: room.enemy.x, y: room.enemy.y },
        VISION_RADIUS,
      )
        ? room.enemy
        : null,
      signals: room.signals.filter((signal) =>
        isWithinVision(player.position, { x: signal.x, y: signal.y }, VISION_RADIUS),
      ),
      winnerId: room.winnerId,
      playerCount: [...room.players.values()].filter((entry) => entry.connected).length,
      requiredPlayers: REQUIRED_PLAYERS,
      message: room.message,
    };

    io.to(player.socketId).emit("game-state", payload);
  }
}

function finishRoom(room: ServerRoomState, io: Server, winnerId: string | null, message: string) {
  room.status = "finished";
  room.winnerId = winnerId;
  room.message = message;

  for (const player of room.players.values()) {
    if (winnerId && player.id === winnerId) {
      player.status = "won";
    } else if (player.status !== "left") {
      player.status = "lost";
    }
  }

  io.to(room.code).emit("game-over", {
    winnerId,
    message,
  });
  emitState(room, io);
}

function evaluateRoom(room: ServerRoomState, io: Server) {
  if (room.status !== "playing") {
    return;
  }

  const activePlayers = getActivePlayers(room);

  if (activePlayers.length === 0) {
    finishRoom(room, io, null, "La expedicion termino sin sobrevivientes.");
    return;
  }

  for (const player of activePlayers) {
    if (hitHazard(player.position, hazardAreas)) {
      player.status = "lost";
      room.message = `${player.name} cayo en una zona peligrosa.`;
    }
  }

  const survivors = getActivePlayers(room);

  if (survivors.length === 0) {
    finishRoom(room, io, null, "Ambos exploradores quedaron atrapados.");
    return;
  }

  for (const player of survivors) {
    if (reachedGoal(player.position, goalArea)) {
      finishRoom(room, io, player.id, `${player.name} encontro la salida.`);
      return;
    }
  }

  const enemyTarget = survivors.reduce((closest, candidate) => {
    const closestDistance =
      (room.enemy.x - closest.position.x) ** 2 + (room.enemy.y - closest.position.y) ** 2;
    const candidateDistance =
      (room.enemy.x - candidate.position.x) ** 2 +
      (room.enemy.y - candidate.position.y) ** 2;

    return candidateDistance < closestDistance ? candidate : closest;
  });

  room.enemy = updateEnemyState(
    room.enemy,
    enemyTarget.position,
    stalkerConfig,
    MOVE_INTERVAL_MS / 1000,
    "playing",
  );

  const caughtPlayer = survivors.find((player) => {
    const enemyPosition = { x: room.enemy.x, y: room.enemy.y };

    return (
      Math.hypot(
        player.position.x - enemyPosition.x,
        player.position.y - enemyPosition.y,
      ) <= stalkerConfig.touchRange
    );
  });

  if (caughtPlayer) {
    const winner = survivors.find((player) => player.id !== caughtPlayer.id) ?? null;
    finishRoom(
      room,
      io,
      winner?.id ?? null,
      winner
        ? `${winner.name} sobrevivio al acechante.`
        : "El acechante alcanzo a ambos exploradores.",
    );
    return;
  }

  emitState(room, io);
}

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

setInterval(() => {
  for (const room of rooms.values()) {
    evaluateRoom(room, io);
  }
}, MOVE_INTERVAL_MS);

io.on("connection", (socket) => {
  socket.on("create-room", ({ name, characterId }: { name?: string; characterId?: string }) => {
    const roomCode = generateRoomCode();
    const playerId = crypto.randomUUID();
    const room: ServerRoomState = {
      code: roomCode,
      status: "waiting",
      createdAt: Date.now(),
      enemy: createEnemyState(stalkerConfig),
      players: new Map(),
      signals: [],
      winnerId: null,
      message: "Esperando a un segundo explorador.",
    };

    const player: ServerPlayerState = {
      id: playerId,
      socketId: socket.id,
      name: sanitizeName(name, `Explorador-${roomCode.slice(0, 3)}`),
      characterId: characterId ?? "cave-axolotl",
      position: multiplayerSpawnPositions[0],
      status: "waiting",
      isReady: false,
      connected: true,
      lastAction: "move",
    };

    room.players.set(player.id, player);
    rooms.set(roomCode, room);
    socket.join(roomCode);
    emitState(room, io);
  });

  socket.on(
    "join-room",
    ({ roomCode, name, characterId }: { roomCode?: string; name?: string; characterId?: string }) => {
      const normalizedCode = roomCode?.trim().toUpperCase();
      const room = normalizedCode ? rooms.get(normalizedCode) : null;

      if (!room) {
        socket.emit("error-message", "La sala no existe.");
        return;
      }

      if (room.status !== "waiting") {
        socket.emit("error-message", "La sala ya comenzo o termino.");
        return;
      }

      if (room.players.size >= REQUIRED_PLAYERS) {
        socket.emit("error-message", "La sala ya esta completa.");
        return;
      }

      const code = normalizedCode ?? "";

      const player: ServerPlayerState = {
        id: crypto.randomUUID(),
        socketId: socket.id,
        name: sanitizeName(name, `Explorador-${code.slice(0, 3)}`),
        characterId: characterId ?? "cave-axolotl",
        position: multiplayerSpawnPositions[1] ?? multiplayerSpawnPositions[0],
        status: "waiting",
        isReady: false,
        connected: true,
        lastAction: "move",
      };

      room.players.set(player.id, player);
      room.message = "Sala completa. Ambos jugadores deben marcarse como listos.";
      socket.join(code);
      emitState(room, io);
    },
  );

  socket.on("player-ready", ({ roomCode }: { roomCode?: string }) => {
    const room = roomCode ? rooms.get(roomCode) : null;
    const match = getPlayerBySocket(socket.id);

    if (!room || !match || match.room.code !== room.code) {
      return;
    }

    const player = match.player;
    player.isReady = true;
    room.message = `${player.name} esta listo.`;

    const everyoneReady =
      room.players.size === REQUIRED_PLAYERS &&
      [...room.players.values()].every((entry) => entry.isReady && entry.connected);

    if (everyoneReady) {
      room.status = "playing";
      room.message = "Partida iniciada.";

      for (const entry of room.players.values()) {
        entry.status = "playing";
      }
    }

    emitState(room, io);
  });

  socket.on(
    "player-move",
    ({
      roomCode,
      target,
      direction,
    }: {
      roomCode?: string;
      target?: PlayerPosition;
      direction?: PlayerPosition;
    }) => {
      const room = roomCode ? rooms.get(roomCode) : null;
      const match = getPlayerBySocket(socket.id);

      if (!room || !match || match.room.code !== room.code || room.status !== "playing") {
        return;
      }

      const player = match.player;

      if (player.status !== "playing") {
        return;
      }

      const maxDistance = getMoveSpeed(player.characterId) * (MOVE_INTERVAL_MS / 1000);
      let nextPosition = player.position;

      if (target) {
        nextPosition = moveTowardPosition(player.position, target, maxDistance);
      } else if (direction) {
        const magnitude = Math.hypot(direction.x, direction.y) || 1;
        nextPosition = moveWithCollisions(player.position, {
          x: (direction.x / magnitude) * maxDistance,
          y: (direction.y / magnitude) * maxDistance,
        });
      }

      player.position = nextPosition;
      player.lastAction = "move";
      emitState(room, io);
    },
  );

  socket.on("player-attack", ({ roomCode }: { roomCode?: string }) => {
    const room = roomCode ? rooms.get(roomCode) : null;
    const match = getPlayerBySocket(socket.id);

    if (!room || !match || match.room.code !== room.code || room.status !== "playing") {
      return;
    }

    const player = match.player;

    if (player.status !== "playing") {
      return;
    }

    player.lastAction = "attack";
    room.signals.push({
      id: Date.now(),
      type: "attack",
      x: player.position.x,
      y: player.position.y,
      createdAt: Date.now(),
      duration: ATTACK_SIGNAL_DURATION,
      ownerId: player.id,
    });
    room.message = `${player.name} genero una resonancia en la cueva.`;
    emitState(room, io);
  });

  socket.on("leave-room", ({ roomCode }: { roomCode?: string }) => {
    const room = roomCode ? rooms.get(roomCode) : null;
    const match = getPlayerBySocket(socket.id);

    if (!room || !match || match.room.code !== room.code) {
      return;
    }

    room.players.delete(match.player.id);
    socket.leave(room.code);

    if (room.players.size === 0) {
      rooms.delete(room.code);
      return;
    }

    room.status = "waiting";
    room.message = `${match.player.name} abandono la sala.`;
    io.to(room.code).emit("player-left", {
      roomCode: room.code,
      playerId: match.player.id,
      message: room.message,
    });
    emitState(room, io);
  });

  socket.on("disconnect", () => {
    const match = getPlayerBySocket(socket.id);

    if (!match) {
      return;
    }

    const { room, player } = match;
    room.players.delete(player.id);

    if (room.players.size === 0) {
      rooms.delete(room.code);
      return;
    }

    room.status = "waiting";
    room.message = `${player.name} se desconecto.`;
    io.to(room.code).emit("player-left", {
      roomCode: room.code,
      playerId: player.id,
      message: room.message,
    });
    emitState(room, io);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Socket server running on http://localhost:${PORT}`);
});
