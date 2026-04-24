import { createServer } from "node:http";
import { Server } from "socket.io";
import type { PlayerPosition } from "../app/play/gameConfig";
import {
  ATTACK_COOLDOWN,
  ATTACK_RADIUS,
  CAVE_ATTACK_DAMAGE,
  DARKNESS_SANITY_DRAIN,
  DEFEND_COOLDOWN,
  MAX_HEALTH,
  MAX_ROOM_PLAYERS,
  MAX_SANITY,
  MIN_ROOM_PLAYERS,
  PLAYER_ATTACK_DAMAGE,
  PLAYER_SPEED,
  VISION_RADIUS,
  caveZones,
  characterOptions,
  hazardAreas,
  multiplayerSpawnPositions,
  stalkerConfig,
} from "../app/play/gameConfig";
import {
  applyDamage,
  createEnemyState,
  distanceBetween,
  getZoneForPosition,
  hitHazard,
  isWithinVision,
  moveTowardPosition,
  moveWithCollisions,
  sanityHealthPenalty,
  updateEnemyState,
  updateSanity,
} from "../app/play/gameLogic";
import type { EnemyState } from "../app/play/gameLogic";
import type {
  MatchResultEntry,
  MultiplayerPlayerState,
  MultiplayerRoomStatus,
  MultiplayerStatePayload,
  RadarSignal,
} from "../app/play/types";

type ServerPlayerState = MultiplayerPlayerState & {
  socketId: string;
  connectedAt: number;
  lastAttackAt: number;
  defendingUntil: number;
};

type ServerEnemyState = EnemyState & {
  lastAttackAt: number;
};

type ServerRoomState = {
  code: string;
  status: MultiplayerRoomStatus;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  enemy: ServerEnemyState;
  players: Map<string, ServerPlayerState>;
  signals: RadarSignal[];
  winnerId: string | null;
  message: string | null;
  results: MatchResultEntry[];
};

const PORT = Number(process.env.SOCKET_PORT ?? 4001);
const MOVE_INTERVAL_MS = 80;
const ATTACK_SIGNAL_DURATION = 1800;
const DEFEND_SIGNAL_DURATION = 1000;
const PLAYER_ATTACK_RANGE = ATTACK_RADIUS * 0.72;
const ENEMY_ATTACK_RANGE = stalkerConfig.touchRange + 16;
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

function getAlivePlayers(room: ServerRoomState) {
  return [...room.players.values()].filter(
    (player) => player.connected && player.status === "playing" && player.combat.health > 0,
  );
}

function cleanupSignals(room: ServerRoomState) {
  const now = Date.now();
  room.signals = room.signals.filter(
    (signal) => now - signal.createdAt < signal.duration,
  );
}

function createInitialCombatState() {
  return {
    health: MAX_HEALTH,
    maxHealth: MAX_HEALTH,
    sanity: MAX_SANITY,
    maxSanity: MAX_SANITY,
    isDefending: false,
    kills: 0,
    damageDealt: 0,
    eliminatedAt: null,
  };
}

function toPublicPlayer(player: ServerPlayerState): MultiplayerPlayerState {
  return {
    id: player.id,
    name: player.name,
    characterId: player.characterId,
    position: player.position,
    status: player.status,
    isReady: player.isReady,
    connected: player.connected,
    lastAction: player.lastAction,
    combat: {
      ...player.combat,
    },
  };
}

function buildResults(room: ServerRoomState): MatchResultEntry[] {
  const now = room.finishedAt ?? Date.now();
  const sorted = [...room.players.values()].sort((a, b) => {
    const aAlive = a.status === "won" || a.status === "playing";
    const bAlive = b.status === "won" || b.status === "playing";

    if (aAlive !== bAlive) {
      return aAlive ? -1 : 1;
    }

    const aTime = a.combat.eliminatedAt ?? now;
    const bTime = b.combat.eliminatedAt ?? now;

    return bTime - aTime;
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

function emitState(room: ServerRoomState, io: Server) {
  cleanupSignals(room);
  room.results = buildResults(room);
  const alivePlayers = getAlivePlayers(room);

  for (const player of room.players.values()) {
    if (!player.connected) {
      continue;
    }

    const payload: MultiplayerStatePayload = {
      roomCode: room.code,
      status: room.status,
      self: toPublicPlayer(player),
      otherPlayers: [...room.players.values()]
        .filter(
          (other) =>
            other.id !== player.id &&
            other.connected &&
            isWithinVision(player.position, other.position, VISION_RADIUS),
        )
        .map(toPublicPlayer),
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
      aliveCount: alivePlayers.length,
      minPlayers: MIN_ROOM_PLAYERS,
      maxPlayers: MAX_ROOM_PLAYERS,
      requiredPlayers: MIN_ROOM_PLAYERS,
      results: room.results,
      message: room.message,
    };

    io.to(player.socketId).emit("game-state", payload);
  }
}

function addSignal(
  room: ServerRoomState,
  type: RadarSignal["type"],
  position: PlayerPosition,
  ownerId?: string,
) {
  room.signals.push({
    id: Date.now() + room.signals.length,
    type,
    x: position.x,
    y: position.y,
    createdAt: Date.now(),
    duration: type === "defend" ? DEFEND_SIGNAL_DURATION : ATTACK_SIGNAL_DURATION,
    ownerId,
  });
}

function eliminatePlayer(
  room: ServerRoomState,
  player: ServerPlayerState,
  reason: string,
  attacker?: ServerPlayerState | null,
) {
  if (player.status === "lost" || player.status === "left" || player.status === "won") {
    return;
  }

  player.status = "lost";
  player.combat.health = 0;
  player.combat.eliminatedAt = Date.now();
  player.combat.isDefending = false;
  player.defendingUntil = 0;
  room.message = reason;

  if (attacker && attacker.id !== player.id) {
    attacker.combat.kills += 1;
  }
}

function finishRoom(room: ServerRoomState, io: Server, winnerId: string | null, message: string) {
  room.status = "finished";
  room.finishedAt = Date.now();
  room.winnerId = winnerId;
  room.message = message;

  for (const player of room.players.values()) {
    if (winnerId && player.id === winnerId) {
      player.status = "won";
    } else if (player.status === "playing") {
      player.status = "lost";
      player.combat.eliminatedAt = room.finishedAt;
    }
  }

  room.results = buildResults(room);

  io.to(room.code).emit("game-over", {
    winnerId,
    message,
    results: room.results,
  });
  emitState(room, io);
}

function evaluateRoom(room: ServerRoomState, io: Server) {
  if (room.status !== "playing") {
    return;
  }

  const now = Date.now();

  for (const player of room.players.values()) {
    player.combat.isDefending = player.defendingUntil > now;
  }

  const alivePlayers = getAlivePlayers(room);

  if (alivePlayers.length <= 1) {
    const winner = alivePlayers[0] ?? null;
    finishRoom(
      room,
      io,
      winner?.id ?? null,
      winner
        ? `${winner.name} domina la cadena de la vida.`
        : "La cueva consumio a todas las criaturas.",
    );
    return;
  }

  for (const player of alivePlayers) {
    if (hitHazard(player.position, hazardAreas)) {
      eliminatePlayer(room, player, `${player.name} fue tragado por la cueva.`);
      continue;
    }

    const zone = getZoneForPosition(player.position, caveZones);
    player.combat.sanity = updateSanity(
      player.combat.sanity,
      MOVE_INTERVAL_MS / 1000,
      zone.tone === "safe",
      DARKNESS_SANITY_DRAIN,
    );

    const sanityDamage = sanityHealthPenalty(
      player.combat.sanity,
      MOVE_INTERVAL_MS / 1000,
    );

    if (sanityDamage > 0) {
      player.combat.health = applyDamage(
        player.combat.health,
        sanityDamage,
        player.combat.isDefending,
      );

      if (player.combat.health <= 0) {
        eliminatePlayer(
          room,
          player,
          `${player.name} perdio la cordura y la oscuridad lo devoro.`,
        );
      }
    }
  }

  const survivors = getAlivePlayers(room);

  if (survivors.length <= 1) {
    const winner = survivors[0] ?? null;
    finishRoom(
      room,
      io,
      winner?.id ?? null,
      winner
        ? `${winner.name} resiste como la ultima criatura viva.`
        : "La cueva consumio a todas las criaturas.",
    );
    return;
  }

  const enemyTarget = survivors.reduce((closest, candidate) => {
    const closestDistance =
      (room.enemy.x - closest.position.x) ** 2 + (room.enemy.y - closest.position.y) ** 2;
    const candidateDistance =
      (room.enemy.x - candidate.position.x) ** 2 +
      (room.enemy.y - candidate.position.y) ** 2;

    return candidateDistance < closestDistance ? candidate : closest;
  });

  room.enemy = {
    ...updateEnemyState(
      room.enemy,
      enemyTarget.position,
      stalkerConfig,
      MOVE_INTERVAL_MS / 1000,
      "playing",
    ),
    lastAttackAt: room.enemy.lastAttackAt,
  };

  if (
    now - room.enemy.lastAttackAt >= ATTACK_COOLDOWN &&
    distanceBetween(room.enemy, enemyTarget.position) <= ENEMY_ATTACK_RANGE
  ) {
    room.enemy.lastAttackAt = now;
    enemyTarget.combat.health = applyDamage(
      enemyTarget.combat.health,
      CAVE_ATTACK_DAMAGE,
      enemyTarget.combat.isDefending,
    );
    addSignal(room, "attack", enemyTarget.position, "cave");

    if (enemyTarget.combat.health <= 0) {
      eliminatePlayer(
        room,
        enemyTarget,
        `${enemyTarget.name} fue cazado por la cueva.`,
      );
    } else {
      room.message = `La cueva golpeo a ${enemyTarget.name}.`;
    }
  }

  const finalSurvivors = getAlivePlayers(room);

  if (finalSurvivors.length <= 1) {
    const winner = finalSurvivors[0] ?? null;
    finishRoom(
      room,
      io,
      winner?.id ?? null,
      winner
        ? `${winner.name} resistio hasta el final.`
        : "Ninguna criatura sobrevivio al colapso.",
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
      startedAt: null,
      finishedAt: null,
      enemy: {
        ...createEnemyState(stalkerConfig),
        lastAttackAt: 0,
      },
      players: new Map(),
      signals: [],
      winnerId: null,
      message: "Sala creada. Reune al menos dos criaturas para iniciar.",
      results: [],
    };

    const player: ServerPlayerState = {
      id: playerId,
      socketId: socket.id,
      name: sanitizeName(name, `Criatura-${roomCode.slice(0, 3)}`),
      characterId: characterId ?? "cave-axolotl",
      position: multiplayerSpawnPositions[0],
      status: "waiting",
      isReady: false,
      connected: true,
      lastAction: "move",
      combat: createInitialCombatState(),
      connectedAt: Date.now(),
      lastAttackAt: 0,
      defendingUntil: 0,
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

      if (room.players.size >= MAX_ROOM_PLAYERS) {
        socket.emit("error-message", "La sala ya esta completa.");
        return;
      }

      const spawnIndex = Math.min(room.players.size, multiplayerSpawnPositions.length - 1);
      const code = normalizedCode ?? "";
      const player: ServerPlayerState = {
        id: crypto.randomUUID(),
        socketId: socket.id,
        name: sanitizeName(name, `Criatura-${code.slice(0, 3)}`),
        characterId: characterId ?? "cave-axolotl",
        position: multiplayerSpawnPositions[spawnIndex] ?? multiplayerSpawnPositions[0],
        status: "waiting",
        isReady: false,
        connected: true,
        lastAction: "move",
        combat: createInitialCombatState(),
        connectedAt: Date.now(),
        lastAttackAt: 0,
        defendingUntil: 0,
      };

      room.players.set(player.id, player);
      room.message =
        room.players.size >= MIN_ROOM_PLAYERS
          ? "La sala puede iniciar. Todas las criaturas deben marcarse como listas."
          : "Esperando mas criaturas para abrir la caceria.";
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
    room.message = `${player.name} esta listo para la caceria.`;

    const connectedPlayers = [...room.players.values()].filter((entry) => entry.connected);
    const everyoneReady =
      connectedPlayers.length >= MIN_ROOM_PLAYERS &&
      connectedPlayers.every((entry) => entry.isReady);

    if (everyoneReady) {
      room.status = "playing";
      room.startedAt = Date.now();
      room.finishedAt = null;
      room.winnerId = null;
      room.message = "La cueva se cierra. Sobrevive la ultima criatura.";

      for (const entry of room.players.values()) {
        entry.status = entry.connected ? "playing" : "left";
        entry.position =
          multiplayerSpawnPositions[
            Math.min(
              [...room.players.values()].findIndex((playerItem) => playerItem.id === entry.id),
              multiplayerSpawnPositions.length - 1,
            )
          ] ?? multiplayerSpawnPositions[0];
        entry.combat = createInitialCombatState();
        entry.lastAction = "move";
        entry.lastAttackAt = 0;
        entry.defendingUntil = 0;
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
      addSignal(room, "move", player.position, player.id);
      emitState(room, io);
    },
  );

  socket.on("player-attack", ({ roomCode }: { roomCode?: string }) => {
    const room = roomCode ? rooms.get(roomCode) : null;
    const match = getPlayerBySocket(socket.id);

    if (!room || !match || match.room.code !== room.code || room.status !== "playing") {
      return;
    }

    const attacker = match.player;

    if (attacker.status !== "playing") {
      return;
    }

    const now = Date.now();

    if (now - attacker.lastAttackAt < ATTACK_COOLDOWN) {
      socket.emit("error-message", "Tu criatura aun esta recuperandose.");
      return;
    }

    attacker.lastAttackAt = now;
    attacker.lastAction = "attack";
    addSignal(room, "attack", attacker.position, attacker.id);

    let inflictedDamage = 0;

    for (const target of getAlivePlayers(room)) {
      if (target.id === attacker.id) {
        continue;
      }

      if (distanceBetween(attacker.position, target.position) > PLAYER_ATTACK_RANGE) {
        continue;
      }

      const previousHealth = target.combat.health;
      target.combat.health = applyDamage(
        target.combat.health,
        PLAYER_ATTACK_DAMAGE,
        target.combat.isDefending,
      );
      inflictedDamage += previousHealth - target.combat.health;

      if (target.combat.health <= 0) {
        eliminatePlayer(
          room,
          target,
          `${attacker.name} depredo a ${target.name}.`,
          attacker,
        );
      }
    }

    if (distanceBetween(attacker.position, room.enemy) <= PLAYER_ATTACK_RANGE) {
      room.message =
        inflictedDamage > 0
          ? `${attacker.name} agito la cueva con un ataque.`
          : `${attacker.name} ataco, pero no encontro presa.`;
    }

    attacker.combat.damageDealt += inflictedDamage;

    if (inflictedDamage === 0 && !room.message) {
      room.message = `${attacker.name} ataco, pero no encontro presa.`;
    }

    emitState(room, io);
  });

  socket.on("player-defend", ({ roomCode }: { roomCode?: string }) => {
    const room = roomCode ? rooms.get(roomCode) : null;
    const match = getPlayerBySocket(socket.id);

    if (!room || !match || match.room.code !== room.code || room.status !== "playing") {
      return;
    }

    const player = match.player;

    if (player.status !== "playing") {
      return;
    }

    player.lastAction = "defend";
    player.defendingUntil = Date.now() + DEFEND_COOLDOWN;
    player.combat.isDefending = true;
    addSignal(room, "defend", player.position, player.id);
    room.message = `${player.name} endurece su caparazon por un instante.`;
    emitState(room, io);
  });

  socket.on("leave-room", ({ roomCode }: { roomCode?: string }) => {
    const room = roomCode ? rooms.get(roomCode) : null;
    const match = getPlayerBySocket(socket.id);

    if (!room || !match || match.room.code !== room.code) {
      return;
    }

    const player = match.player;

    if (room.status === "playing" && player.status === "playing") {
      eliminatePlayer(room, player, `${player.name} abandono la cueva.`);
    }

    player.connected = false;
    player.status = player.status === "waiting" ? "left" : player.status;
    socket.leave(room.code);

    if (![...room.players.values()].some((entry) => entry.connected)) {
      rooms.delete(room.code);
      return;
    }

    room.message = `${player.name} abandono la sala.`;
    io.to(room.code).emit("player-left", {
      roomCode: room.code,
      playerId: player.id,
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
    player.connected = false;

    if (room.status === "playing" && player.status === "playing") {
      eliminatePlayer(room, player, `${player.name} desaparecio en la oscuridad.`);
    } else if (player.status === "waiting") {
      player.status = "left";
    }

    if (![...room.players.values()].some((entry) => entry.connected)) {
      rooms.delete(room.code);
      return;
    }

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
