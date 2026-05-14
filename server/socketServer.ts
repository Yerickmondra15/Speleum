import { createServer } from "node:http";
import { Server, type Socket } from "socket.io";
import type { PlayerPosition } from "../app/play/gameConfig";
import {
  ATTACK_COOLDOWN,
  CAVE_ATTACK_DAMAGE,
  MAX_HEALTH,
  MAX_ROOM_PLAYERS,
  MOVEMENT_STEP_INTERVAL_MS,
  MIN_ROOM_PLAYERS,
  PARRY_COOLDOWN_MS,
  PARRY_WINDOW_MS,
  PLAYER_ATTACK_DAMAGE,
  PLAYER_ATTACK_RANGE_TILES,
  PLAYER_MOVE_RANGE_TILES,
  RADAR_SIGNAL_PROFILES,
  VISION_RADIUS,
  characterOptions,
} from "../app/play/gameConfig";
import {
  canTakeTurn,
  createEnemyState,
  distanceBetween,
  hitHazard,
  isAttackReachableByTiles,
  isWithinVision,
  planMovementPath,
  pickSeparatedSpawns,
  resolveCombatHit,
  updateEnemyState,
} from "../app/play/gameLogic";
import type { EnemyState } from "../app/play/gameLogic";
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
  lastParryAt: number;
  moveCooldownUntil: number;
  movementPath: PlayerPosition[];
  parryUntil: number;
  stunnedUntil: number;
};

type ServerEnemyState = EnemyState;

type ServerRoomState = {
  matchId: string;
  code: string;
  cave: CaveLayout;
  tileLookup: ReturnType<typeof createTileLookup>;
  status: MultiplayerRoomStatus;
  readyDeadline: number | null;
  startAt: number | null;
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

const PORT = Number(process.env.PORT) || 4001;
const HOST = "0.0.0.0";
const MOVE_INTERVAL_MS = MOVEMENT_STEP_INTERVAL_MS;
const READY_CONFIRMATION_WINDOW_MS = 30000;
const START_COUNTDOWN_MS = 5000;
const LOBBY_TICK_MS = 1000;
const rooms = new Map<string, ServerRoomState>();

function normalizeOrigin(value: string) {
  return value.trim().replace(/\/$/, "");
}

function resolveAllowedOrigins() {
  const allowed = new Set<string>([
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:4001",
    "http://127.0.0.1:4001",
  ]);
  const envCandidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.FRONTEND_URL,
    process.env.ALLOWED_ORIGINS,
  ];

  for (const candidate of envCandidates) {
    if (!candidate) {
      continue;
    }

    for (const origin of candidate.split(",")) {
      const normalized = normalizeOrigin(origin);

      if (normalized) {
        allowed.add(normalized);
      }
    }
  }

  return allowed;
}

const allowedOrigins = resolveAllowedOrigins();
const vercelPreviewOrigin = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;

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

function getConnectedPlayers(room: ServerRoomState) {
  return [...room.players.values()].filter((player) => player.connected);
}

function getReadyConnectedPlayers(room: ServerRoomState) {
  return getConnectedPlayers(room).filter((player) => player.isReady);
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
    isParrying: false,
    isStunned: false,
    moveCooldownRemaining: 0,
    attackCooldownRemaining: 0,
    parryCooldownRemaining: 0,
    parryWindowRemaining: 0,
    stunRemaining: 0,
    kills: 0,
    damageDealt: 0,
    eliminatedAt: null,
  };
}

function createLobbyMessage(room: ServerRoomState) {
  const connectedPlayers = getConnectedPlayers(room);
  const readyPlayers = getReadyConnectedPlayers(room);

  if (room.status === "starting") {
    return "Iniciando partida...";
  }

  if (connectedPlayers.length < MIN_ROOM_PLAYERS) {
    return `Esperando minimo ${MIN_ROOM_PLAYERS} jugadores.`;
  }

  if (readyPlayers.length < connectedPlayers.length) {
    return "Esperando confirmacion de todos.";
  }

  return "La sala puede iniciar. Esperando la confirmacion final del servidor.";
}

function syncLobbyState(room: ServerRoomState) {
  if (room.status === "playing" || room.status === "finished") {
    return false;
  }

  const now = Date.now();
  const connectedPlayers = getConnectedPlayers(room);
  const readyPlayers = connectedPlayers.filter((player) => player.isReady);
  let changed = false;

  if (connectedPlayers.length < MIN_ROOM_PLAYERS) {
    if (room.status !== "waiting") {
      room.status = "waiting";
      changed = true;
    }

    if (room.readyDeadline !== null) {
      room.readyDeadline = null;
      changed = true;
    }

    if (room.startAt !== null) {
      room.startAt = null;
      changed = true;
    }
  } else if (readyPlayers.length === connectedPlayers.length) {
    if (room.status !== "starting") {
      room.status = "starting";
      room.startAt = now + START_COUNTDOWN_MS;
      room.readyDeadline = null;
      changed = true;
    }
  } else {
    if (room.status !== "ready-check") {
      room.status = "ready-check";
      changed = true;
    }

    if (room.startAt !== null) {
      room.startAt = null;
      changed = true;
    }

    if (room.readyDeadline === null || room.readyDeadline <= now) {
      room.readyDeadline = now + READY_CONFIRMATION_WINDOW_MS;
      changed = true;
    }
  }

  const nextMessage = createLobbyMessage(room);

  if (room.message !== nextMessage) {
    room.message = nextMessage;
    changed = true;
  }

  return changed;
}

function startRoom(room: ServerRoomState) {
  room.status = "playing";
  room.readyDeadline = null;
  room.startedAt = Date.now();
  room.startAt = null;
  room.finishedAt = null;
  room.winnerId = null;
  room.message = "La cueva se cierra. Sobrevive la ultima criatura.";
  const playerEntries = [...room.players.values()];
  const spawnPositions = pickSeparatedSpawns(room.cave, room.tileLookup, playerEntries.length);

  for (const entry of playerEntries) {
    entry.status = entry.connected ? "playing" : "left";
    entry.position =
      spawnPositions[playerEntries.findIndex((playerItem) => playerItem.id === entry.id)] ??
      room.cave.startPosition;
    entry.combat = createInitialCombatState();
    entry.lastAction = "move";
    entry.lastAttackAt = 0;
    entry.lastMoveAt = room.startedAt ?? Date.now();
    entry.lastParryAt = 0;
    entry.moveCooldownUntil = 0;
    entry.movementPath = [];
    entry.parryUntil = 0;
    entry.stunnedUntil = 0;
  }

  room.noises = [];
  room.signals = [];
  room.enemies = room.cave.enemyConfigs.map((config) => createEnemyState(config));
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
  const connectedPlayers = getConnectedPlayers(room);
  const readyPlayers = connectedPlayers.filter((player) => player.isReady);

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
      readyDeadline: room.readyDeadline,
      startAt: room.startAt,
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
      playerCount: connectedPlayers.length,
      aliveCount: alivePlayers.length,
      minPlayers: MIN_ROOM_PLAYERS,
      maxPlayers: MAX_ROOM_PLAYERS,
      requiredPlayers: MIN_ROOM_PLAYERS,
      readyCount: readyPlayers.length,
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
  const spawns = pickSeparatedSpawns(room.cave, room.tileLookup, room.players.size);
  return spawns[Math.min(index, spawns.length - 1)] ?? room.cave.startPosition;
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
  player.combat.isParrying = false;
  player.combat.isStunned = false;
  player.parryUntil = 0;
  player.stunnedUntil = 0;
  player.movementPath = [];
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
    player.combat.isParrying = player.parryUntil > now;
    player.combat.isStunned = player.stunnedUntil > now;
    player.combat.moveCooldownRemaining = Math.max(0, player.moveCooldownUntil - now);
    player.combat.attackCooldownRemaining = Math.max(0, player.lastAttackAt + ATTACK_COOLDOWN - now);
    player.combat.parryCooldownRemaining = Math.max(0, player.lastParryAt + PARRY_COOLDOWN_MS - now);
    player.combat.parryWindowRemaining = Math.max(0, player.parryUntil - now);
    player.combat.stunRemaining = Math.max(0, player.stunnedUntil - now);

    if (player.movementPath.length > 0 && canTakeTurn({ now, stunnedUntil: player.stunnedUntil })) {
      const nextStep = player.movementPath.shift();

      if (nextStep) {
        player.position = nextStep;
        player.lastMoveAt = now;
        addSignal(room, "move", player.position, player.id);
      }
    }
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
    if (hitHazard(player.position, room.cave.hazardAreas)) {
      eliminatePlayer(room, player, `${player.name} fue tragado por la cueva.`);
      continue;
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
      isAttackReachableByTiles(updatedEnemy, closestTarget.position, 1, room.tileLookup)
    ) {
      const resolution = resolveCombatHit({
        targetHealth: closestTarget.combat.health,
        damage: CAVE_ATTACK_DAMAGE,
        now,
        targetParryUntil: closestTarget.parryUntil,
      });
      closestTarget.combat.health = resolution.nextHealth;
      closestTarget.parryUntil = resolution.nextParryUntil;
      addSignal(room, "attack", updatedEnemy, enemy.id);
      addNoise(room, "attack", updatedEnemy, 8, 1.1, enemy.id);

      if (resolution.wasParried) {
        room.message = `${closestTarget.name} desvia el golpe y aturde a ${updatedEnemy.name}.`;
        return {
          ...updatedEnemy,
          lastAttackAt: now,
          stunnedUntil: resolution.attackerStunnedUntil,
        };
      }

      if (resolution.nextHealth <= 0) {
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
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      const normalized = normalizeOrigin(origin);

      if (allowedOrigins.has(normalized) || vercelPreviewOrigin.test(normalized)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin not allowed by Socket.IO CORS: ${origin}`));
    },
    methods: ["GET", "POST"],
  },
});

setInterval(() => {
  for (const room of rooms.values()) {
    evaluateRoom(room, io);
  }
}, MOVE_INTERVAL_MS);

setInterval(() => {
  for (const room of rooms.values()) {
    if (room.status === "finished" || room.status === "playing") {
      continue;
    }

    const hadChanges = syncLobbyState(room);

    if (
      room.status === "starting" &&
      room.startAt !== null &&
      room.startAt <= Date.now()
    ) {
      startRoom(room);
      emitState(room, io);
      continue;
    }

    if (hadChanges) {
      emitState(room, io);
    }
  }
}, LOBBY_TICK_MS);

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
      readyDeadline: null,
      startAt: null,
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
      message: `Esperando minimo ${MIN_ROOM_PLAYERS} jugadores.`,
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
      lastParryAt: 0,
      moveCooldownUntil: 0,
      movementPath: [],
      parryUntil: 0,
      stunnedUntil: 0,
    };

    room.players.set(player.id, player);
    rooms.set(roomCode, room);
    socket.join(roomCode);
    syncLobbyState(room);
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

      if (room.status === "starting" || room.status === "playing" || room.status === "finished") {
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
        lastParryAt: 0,
        moveCooldownUntil: 0,
        movementPath: [],
        parryUntil: 0,
        stunnedUntil: 0,
      };

      room.players.set(player.id, player);
      socket.join(code);
      syncLobbyState(room);
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

    if (room.status === "starting" || room.status === "playing" || room.status === "finished") {
      return;
    }

    if (player.isReady) {
      emitState(room, io);
      return;
    }

    player.isReady = true;
    syncLobbyState(room);
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

      if (now < player.moveCooldownUntil || player.movementPath.length > 0) {
        socket.emit("error-message", "Tu criatura aun recupera el impulso.");
        return;
      }

      if (!canTakeTurn({ now, stunnedUntil: player.stunnedUntil })) {
        socket.emit("error-message", "Tu criatura esta aturdida.");
        return;
      }

      const intendedTarget =
        target ??
        (direction
          ? {
              x: player.position.x + Math.sign(direction.x || 0) * 80,
              y: player.position.y + Math.sign(direction.y || 0) * 80,
            }
          : null);

      if (!intendedTarget) {
        return;
      }

      const movePlan = planMovementPath(
        player.position,
        intendedTarget,
        PLAYER_MOVE_RANGE_TILES,
        room.tileLookup,
        characterOptions.find((option) => option.id === player.characterId)?.moveCooldownMultiplier ?? 1,
      );

      if (!movePlan) {
        socket.emit("error-message", "No hay una ruta valida hacia esa celda.");
        return;
      }

      player.lastAction = "move";
      player.movementPath = movePlan.worldPath;
      player.moveCooldownUntil = now + movePlan.cooldownMs;
      const moveMultiplier =
        characterOptions.find((option) => option.id === player.characterId)?.moveSignalMultiplier ?? 1;
      addNoise(room, "move", player.position, 4 + Math.round(moveMultiplier * 2), 0.45 * moveMultiplier, player.id);
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

    if (now < attacker.moveCooldownUntil || attacker.movementPath.length > 0) {
      socket.emit("error-message", "Tu criatura aun recupera el impulso.");
      return;
    }

    if (!canTakeTurn({ now, stunnedUntil: attacker.stunnedUntil })) {
      socket.emit("error-message", "Tu criatura esta aturdida.");
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

      if (!isAttackReachableByTiles(attacker.position, target.position, PLAYER_ATTACK_RANGE_TILES, room.tileLookup)) {
        continue;
      }

      const resolution = resolveCombatHit({
        targetHealth: target.combat.health,
        damage: PLAYER_ATTACK_DAMAGE,
        now,
        targetParryUntil: target.parryUntil,
        attackerStunnedUntil: attacker.stunnedUntil,
      });
      target.combat.health = resolution.nextHealth;
      target.parryUntil = resolution.nextParryUntil;
      attacker.stunnedUntil = resolution.attackerStunnedUntil;
      inflictedDamage += resolution.damageApplied;

      if (resolution.wasParried) {
        room.message = `${target.name} hace parry y aturde a ${attacker.name}.`;
        continue;
      }

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

      if (!isAttackReachableByTiles(attacker.position, enemy, PLAYER_ATTACK_RANGE_TILES, room.tileLookup)) {
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

    if (now - player.lastParryAt < PARRY_COOLDOWN_MS) {
      socket.emit("error-message", "Tu criatura aun no puede hacer parry otra vez.");
      return;
    }

    if (now < player.moveCooldownUntil || player.movementPath.length > 0) {
      socket.emit("error-message", "Tu criatura aun recupera el impulso.");
      return;
    }

    if (!canTakeTurn({ now, stunnedUntil: player.stunnedUntil })) {
      socket.emit("error-message", "Tu criatura esta aturdida.");
      return;
    }

    player.lastAction = "defend";
    player.lastParryAt = now;
    player.parryUntil = now + PARRY_WINDOW_MS;
    player.combat.isParrying = true;
    player.combat.parryCooldownRemaining = PARRY_COOLDOWN_MS;
    player.combat.parryWindowRemaining = PARRY_WINDOW_MS;
    addSignal(room, "defend", player.position, player.id);
    addNoise(room, "defend", player.position, 6, 0.65, player.id);
    room.message = `${player.name} abre una ventana corta de parry.`;
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

    syncLobbyState(room);
    room.message = `${player.name} abandono la sala. ${createLobbyMessage(room)}`;
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

    syncLobbyState(room);
    room.message = `${player.name} se desconecto. ${createLobbyMessage(room)}`;
    io.to(room.code).emit("player-left", {
      roomCode: room.code,
      playerId: player.id,
      message: room.message,
    });
    emitState(room, io);
  });
});

httpServer.listen(PORT, HOST, () => {
  console.log(`Socket server running on http://${HOST}:${PORT}`);
  console.log(`Allowed Socket.IO origins: ${[...allowedOrigins].join(", ")} + *.vercel.app`);
});
