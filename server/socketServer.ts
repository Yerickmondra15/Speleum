import { createServer } from "node:http";
import { Server, type Socket } from "socket.io";
import type { PlayerPosition } from "../app/play/gameConfig";
import {
  ATTACK_COOLDOWN,
  ATTACK_RADIUS,
  CAVE_ATTACK_DAMAGE,
  DARKNESS_SANITY_DRAIN,
  DEFEND_ACTIVE_DURATION,
  DEFEND_COOLDOWN,
  MAX_HEALTH,
  MAX_ROOM_PLAYERS,
  MAX_SANITY,
  MIN_ROOM_PLAYERS,
  MOVE_BURST_IDLE_MS,
  PLAYER_ATTACK_DAMAGE,
  PLAYER_SPEED,
  RADAR_SIGNAL_PROFILES,
  THREAT_DEATH_MS,
  VISION_RADIUS,
  characterOptions,
} from "../app/play/gameConfig";
import {
  applyDamage,
  calculateMoveCooldown,
  createEnemyState,
  distanceBetween,
  getThreatLevel,
  getZoneForPosition,
  hitHazard,
  isWithinVision,
  moveTowardPosition,
  moveWithCollisions,
  sanityHealthPenalty,
  shouldFinalizeMoveBurst,
  updateEnemyState,
  updateSanity,
} from "../app/play/gameLogic";
import type { EnemyState, ThreatLevel } from "../app/play/gameLogic";
import type {
  MatchResultEntry,
  MultiplayerPlayerState,
  MultiplayerRoomStatus,
  MultiplayerStatePayload,
  NoiseEvent,
  RadarSignal,
} from "../app/play/types";
import { buildTileMap, createTileLookup } from "../app/play/tileMap";
import { createCaveLayout, type CaveLayout } from "../app/play/proceduralCave";

type ServerPlayerState = MultiplayerPlayerState & {
  socketId: string;
  connectedAt: number;
  lastAttackAt: number;
  lastMoveAt: number;
  lastDefendAt: number;
  moveCooldownUntil: number;
  movementBurstDistance: number;
  defendingUntil: number;
};

type ServerEnemyState = EnemyState & {
  lastAttackAt: number;
};

type ServerRoomState = {
  matchId: string;
  code: string;
  cave: CaveLayout;
  tileLookup: ReturnType<typeof createTileLookup>;
  status: MultiplayerRoomStatus;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  enemies: ServerEnemyState[];
  players: Map<string, ServerPlayerState>;
  signals: RadarSignal[];
  noises: NoiseEvent[];
  winnerId: string | null;
  message: string | null;
  results: MatchResultEntry[];
};

const PORT = Number(process.env.SOCKET_PORT ?? 4001);
const MOVE_INTERVAL_MS = 80;
const PLAYER_ATTACK_RANGE = ATTACK_RADIUS * 0.72;
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
  room.noises = room.noises.filter((noise) => now - noise.createdAt < 3200);
}

function createInitialCombatState() {
  return {
    health: MAX_HEALTH,
    maxHealth: MAX_HEALTH,
    sanity: MAX_SANITY,
    maxSanity: MAX_SANITY,
    isDefending: false,
    threatLevel: "calm" as ThreatLevel,
    idleMs: 0,
    moveCooldownRemaining: 0,
    attackCooldownRemaining: 0,
    defenseCooldownRemaining: 0,
    defenseDurationRemaining: 0,
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
  const aliveEnemies = room.enemies.filter((enemy) => enemy.alive && enemy.state !== "dead");

  for (const player of room.players.values()) {
    if (!player.connected) {
      continue;
    }

    const visibleEnemies = aliveEnemies.filter((enemy) =>
      isWithinVision(player.position, enemy, VISION_RADIUS),
    );

    const payload: MultiplayerStatePayload = {
      matchId: room.matchId,
      roomCode: room.code,
      status: room.status,
      cave: room.cave,
      self: toPublicPlayer(player),
      otherPlayers: [...room.players.values()]
        .filter(
          (other) =>
            other.id !== player.id &&
            other.connected &&
            isWithinVision(player.position, other.position, VISION_RADIUS),
        )
        .map(toPublicPlayer),
      enemy: visibleEnemies[0] ?? null,
      enemies: visibleEnemies,
      signals: room.signals.filter((signal) =>
        isWithinVision(player.position, { x: signal.x, y: signal.y }, VISION_RADIUS),
      ),
      noises: room.noises.filter((noise) =>
        isWithinVision(player.position, noise.position, VISION_RADIUS * 1.25),
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
  const profile = RADAR_SIGNAL_PROFILES[type];

  room.signals.push({
    id: Date.now() + room.signals.length,
    type,
    strength: profile.strength,
    x: position.x,
    y: position.y,
    createdAt: Date.now(),
    duration: profile.duration,
    radarJitter: profile.radarJitter,
    ownerId,
  });
}

function addNoise(
  room: ServerRoomState,
  type: NoiseEvent["type"],
  position: PlayerPosition,
  radiusTiles: number,
  intensity: number,
  sourceId: string,
) {
  room.noises.push({
    id: `${sourceId}-${Date.now()}-${room.noises.length}`,
    type,
    sourceId,
    position,
    radiusTiles,
    intensity,
    createdAt: Date.now(),
  });
}

function roomSpawnAt(room: ServerRoomState, index: number) {
  return (
    room.cave.multiplayerSpawnPositions[
      Math.min(index, room.cave.multiplayerSpawnPositions.length - 1)
    ] ?? room.cave.startPosition
  );
}

function roomEnemyConfigs(room: ServerRoomState) {
  return room.cave.enemyConfigs;
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
    player.combat.moveCooldownRemaining = Math.max(0, player.moveCooldownUntil - now);
    player.combat.attackCooldownRemaining = Math.max(0, player.lastAttackAt + ATTACK_COOLDOWN - now);
    player.combat.defenseCooldownRemaining = Math.max(0, player.lastDefendAt + DEFEND_COOLDOWN - now);
    player.combat.defenseDurationRemaining = Math.max(0, player.defendingUntil - now);
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
    if (
      player.movementBurstDistance > 0 &&
      shouldFinalizeMoveBurst(player.lastMoveAt, now) &&
      now >= player.moveCooldownUntil
    ) {
      player.moveCooldownUntil =
        now +
        calculateMoveCooldown(
          player.movementBurstDistance,
          characterOptions.find((option) => option.id === player.characterId)
            ?.moveCooldownMultiplier ?? 1,
        );
      player.movementBurstDistance = 0;
      player.combat.moveCooldownRemaining = Math.max(0, player.moveCooldownUntil - now);
    }

    player.combat.idleMs = now - player.lastMoveAt;
    const previousThreat = player.combat.threatLevel;
    player.combat.threatLevel = getThreatLevel(player.combat.idleMs);

    if (player.combat.threatLevel !== previousThreat && player.combat.threatLevel !== "calm") {
      addSignal(room, "danger", player.position, player.id);
    }

    if (player.combat.idleMs >= THREAT_DEATH_MS) {
      eliminatePlayer(
        room,
        player,
        `${player.name} se quedo quieto demasiado tiempo y la cueva lo encontro.`,
      );
      continue;
    }

    if (hitHazard(player.position, room.cave.hazardAreas)) {
      eliminatePlayer(room, player, `${player.name} fue tragado por la cueva.`);
      continue;
    }

    const zone = getZoneForPosition(player.position, room.cave.zones);
    const dominantEnemyState =
      room.enemies.find(
        (enemy) =>
          enemy.state === "chasing" ||
          enemy.state === "investigating" ||
          enemy.state === "attacking",
      )?.state ?? "idle";
    player.combat.sanity = updateSanity(
      player.combat.sanity,
      MOVE_INTERVAL_MS / 1000,
      zone,
      now - player.lastMoveAt < MOVE_BURST_IDLE_MS,
      player.combat.threatLevel,
      dominantEnemyState,
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

  room.enemies = room.enemies.map((enemy) => {
    if (!enemy.alive || enemy.state === "dead") {
      return enemy;
    }

    const config = roomEnemyConfigs(room).find((entry) => entry.id === enemy.id);

    if (!config) {
      return enemy;
    }

    const updatedEnemy = updateEnemyState(
      enemy,
      survivors.map((player) => ({
        id: player.id,
        position: player.position,
        alive: player.status === "playing",
      })),
      config,
      MOVE_INTERVAL_MS / 1000,
      "playing",
      room.noises,
      now,
      room.tileLookup,
    );
    const enemyMoved = distanceBetween(enemy, updatedEnemy) >= 24;
    const stateChanged = enemy.state !== updatedEnemy.state;

    const closestTarget =
      survivors
        .filter((player) => player.status === "playing")
        .sort(
          (left, right) =>
            distanceBetween(updatedEnemy, left.position) -
            distanceBetween(updatedEnemy, right.position),
        )[0] ?? null;

    if (
      closestTarget &&
      updatedEnemy.state === "attacking" &&
      now - enemy.lastAttackAt >= ATTACK_COOLDOWN &&
      distanceBetween(updatedEnemy, closestTarget.position) <= config.touchRange + 20
    ) {
      closestTarget.combat.health = applyDamage(
        closestTarget.combat.health,
        CAVE_ATTACK_DAMAGE,
        closestTarget.combat.isDefending,
      );
      addSignal(room, "attack", updatedEnemy, enemy.id);
      addNoise(room, "attack", updatedEnemy, 8, 1.1, enemy.id);

      if (closestTarget.combat.health <= 0) {
        eliminatePlayer(room, closestTarget, `${closestTarget.name} fue cazado por la cueva.`);
      } else {
        room.message = `${updatedEnemy.name} golpeo a ${closestTarget.name}.`;
      }

      return {
        ...updatedEnemy,
        lastAttackAt: now,
      };
    }

    if (enemyMoved) {
      addSignal(room, "move", updatedEnemy, enemy.id);
    }

    if (
      stateChanged &&
      (updatedEnemy.state === "chasing" || updatedEnemy.state === "investigating")
    ) {
      addSignal(room, "danger", updatedEnemy, enemy.id);
    }

    return {
      ...updatedEnemy,
      lastAttackAt: enemy.lastAttackAt,
    };
  });

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

io.on("connection", (socket: Socket) => {
  socket.on("create-room", ({ name, characterId }: { name?: string; characterId?: string }) => {
    const roomCode = generateRoomCode();
    const playerId = crypto.randomUUID();
    const cave = createCaveLayout(`room:${roomCode}`);
    const room: ServerRoomState = {
      matchId: crypto.randomUUID(),
      code: roomCode,
      cave,
      tileLookup: createTileLookup(buildTileMap(cave)),
      status: "waiting",
      createdAt: Date.now(),
      startedAt: null,
      finishedAt: null,
      enemies: cave.enemyConfigs.map((config) => ({
        ...createEnemyState(config),
        lastAttackAt: 0,
      })),
      players: new Map(),
      signals: [],
      noises: [],
      winnerId: null,
      message: "Sala creada. Reune al menos dos criaturas para iniciar.",
      results: [],
    };

    const player: ServerPlayerState = {
      id: playerId,
      socketId: socket.id,
      name: sanitizeName(name, `Criatura-${roomCode.slice(0, 3)}`),
      characterId: characterId ?? "cave-axolotl",
      position: cave.multiplayerSpawnPositions[0] ?? cave.startPosition,
      status: "waiting",
      isReady: false,
      connected: true,
      lastAction: "move",
      combat: createInitialCombatState(),
      connectedAt: Date.now(),
      lastAttackAt: 0,
      lastMoveAt: Date.now(),
      lastDefendAt: 0,
      moveCooldownUntil: 0,
      movementBurstDistance: 0,
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

      const code = normalizedCode ?? "";
      const player: ServerPlayerState = {
        id: crypto.randomUUID(),
        socketId: socket.id,
        name: sanitizeName(name, `Criatura-${code.slice(0, 3)}`),
        characterId: characterId ?? "cave-axolotl",
        position: roomSpawnAt(room, room.players.size),
        status: "waiting",
        isReady: false,
        connected: true,
        lastAction: "move",
        combat: createInitialCombatState(),
        connectedAt: Date.now(),
        lastAttackAt: 0,
        lastMoveAt: Date.now(),
        lastDefendAt: 0,
        moveCooldownUntil: 0,
        movementBurstDistance: 0,
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
        entry.position = roomSpawnAt(
          room,
          [...room.players.values()].findIndex((playerItem) => playerItem.id === entry.id),
        );
        entry.combat = createInitialCombatState();
        entry.lastAction = "move";
        entry.lastAttackAt = 0;
        entry.lastMoveAt = room.startedAt ?? Date.now();
        entry.lastDefendAt = 0;
        entry.moveCooldownUntil = 0;
        entry.movementBurstDistance = 0;
        entry.defendingUntil = 0;
      }

      room.noises = [];
      room.signals = [];
      room.enemies = room.cave.enemyConfigs.map((config) => ({
        ...createEnemyState(config),
        lastAttackAt: 0,
      }));
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

      const now = Date.now();

      if (now < player.moveCooldownUntil) {
        socket.emit("error-message", "Tu criatura aun recupera el impulso.");
        return;
      }

      const maxDistance = getMoveSpeed(player.characterId) * (MOVE_INTERVAL_MS / 1000);
      let nextPosition = player.position;

      if (target) {
        nextPosition = moveTowardPosition(
          player.position,
          target,
          maxDistance,
          undefined,
          room.cave.walls,
          room.tileLookup,
        );
      } else if (direction) {
        const magnitude = Math.hypot(direction.x, direction.y) || 1;
        nextPosition = moveWithCollisions(
          player.position,
          {
            x: (direction.x / magnitude) * maxDistance,
            y: (direction.y / magnitude) * maxDistance,
          },
          undefined,
          room.cave.walls,
          room.tileLookup,
        );
      }

      const movedDistance = distanceBetween(player.position, nextPosition);
      player.position = nextPosition;
      player.lastAction = "move";
      if (movedDistance > 0.1) {
        player.lastMoveAt = now;
        player.movementBurstDistance += movedDistance;
        player.combat.idleMs = 0;
        player.combat.threatLevel = "calm";
        addSignal(room, "move", player.position, player.id);
        const moveMultiplier =
          characterOptions.find((option) => option.id === player.characterId)?.moveSignalMultiplier ?? 1;
        addNoise(room, "move", player.position, 4 + Math.round(moveMultiplier * 2), 0.45 * moveMultiplier, player.id);
      }
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

    if (now < attacker.moveCooldownUntil) {
      socket.emit("error-message", "Tu criatura aun recupera el impulso.");
      return;
    }

    attacker.lastAttackAt = now;
    attacker.lastAction = "attack";
    attacker.combat.attackCooldownRemaining = ATTACK_COOLDOWN;
    addSignal(room, "attack", attacker.position, attacker.id);
    addNoise(room, "attack", attacker.position, 9, 1.2, attacker.id);

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

    for (const enemy of room.enemies) {
      if (!enemy.alive || enemy.state === "dead") {
        continue;
      }

      if (distanceBetween(attacker.position, enemy) > PLAYER_ATTACK_RANGE) {
        continue;
      }

      const previousHp = enemy.hp;
      enemy.hp = Math.max(0, enemy.hp - PLAYER_ATTACK_DAMAGE);
      inflictedDamage += previousHp - enemy.hp;

      if (enemy.hp <= 0) {
        enemy.alive = false;
        enemy.state = "dead";
        attacker.combat.kills += 1;
        room.message = `${attacker.name} derribo a ${enemy.name}.`;
      } else {
        enemy.state = "chasing";
      }
    }

    attacker.combat.damageDealt += inflictedDamage;

    if (inflictedDamage > 0 && !room.message) {
      room.message = `${attacker.name} agito la cueva con un ataque.`;
    }

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

    const now = Date.now();

    if (now - player.lastDefendAt < DEFEND_COOLDOWN) {
      socket.emit("error-message", "Tu criatura aun no puede defenderse otra vez.");
      return;
    }

    if (now < player.moveCooldownUntil) {
      socket.emit("error-message", "Tu criatura aun recupera el impulso.");
      return;
    }

    player.lastAction = "defend";
    player.lastDefendAt = now;
    player.defendingUntil = now + DEFEND_ACTIVE_DURATION;
    player.combat.isDefending = true;
    player.combat.defenseCooldownRemaining = DEFEND_COOLDOWN;
    player.combat.defenseDurationRemaining = DEFEND_ACTIVE_DURATION;
    addSignal(room, "defend", player.position, player.id);
    addNoise(room, "defend", player.position, 6, 0.65, player.id);
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
