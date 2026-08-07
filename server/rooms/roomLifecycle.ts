import {
  ATTACK_COOLDOWN,
  CAVE_ATTACK_DAMAGE,
  MAX_ROOM_PLAYERS,
  MIN_ROOM_PLAYERS,
  PARRY_COOLDOWN_MS,
  PLAYER_ATTACK_DAMAGE,
  PLAYER_ATTACK_RANGE_TILES,
  RADAR_SIGNAL_PROFILES,
} from "../../app/play/gameConfig";
import type { PlayerPosition } from "../../app/play/gameConfig";
import {
  canTakeTurn,
  createEnemyState,
  distanceBetween,
  hitHazard,
  isAttackReachableByTiles,
  pickSeparatedSpawns,
  resolveCombatHit,
  updateEnemyState,
} from "../../app/play/gameLogic";
import type { NoiseEvent, RadarSignal } from "../../app/play/types";
import { createRadarSignal, upsertRadarSignal } from "../../app/play/signalUtils";
import {
  applyCreatureIncomingDamage,
  applyCreatureNoise,
  applyCreatureOutgoingDamage,
  getCreatureGameplayModifiers,
} from "../../lib/creature-gameplay";
import { createResultReceipt } from "../../lib/multiplayer/tickets";
import { calculateCompetitiveScore } from "../game/scoring";
import type { ServerContext, ServerPlayerState, ServerRoomState } from "../types";
import {
  buildResults,
  cleanupTransientEvents,
  emitState,
  getAlivePlayers,
  getConnectedPlayers,
  getReadyConnectedPlayers,
} from "./roomSerialization";

export function createInitialCombatState(characterId: string) {
  const maxHealth = getCreatureGameplayModifiers(characterId).maxHealth;
  return {
    health: maxHealth,
    maxHealth,
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

export function markRoomActivity(room: ServerRoomState, context: ServerContext, now = Date.now()) {
  room.lastActivityAt = now;
  room.expiresAt =
    room.status === "finished"
      ? now + context.timings.finishedRetentionMs
      : room.status === "playing"
        ? now + 4 * 60 * 60_000
        : now + context.timings.lobbyIdleMs;
}

export function createLobbyMessage(room: ServerRoomState) {
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

export function syncLobbyState(room: ServerRoomState, context: ServerContext, now = Date.now()) {
  if (room.status === "playing" || room.status === "finished") {
    return false;
  }

  const connectedPlayers = getConnectedPlayers(room);
  const readyPlayers = connectedPlayers.filter((player) => player.isReady);
  let changed = false;

  if (connectedPlayers.length < MIN_ROOM_PLAYERS) {
    if (room.status !== "waiting") {
      room.status = "waiting";
      changed = true;
    }
    if (room.readyDeadline !== null || room.startAt !== null) {
      room.readyDeadline = null;
      room.startAt = null;
      changed = true;
    }
  } else if (readyPlayers.length === connectedPlayers.length) {
    if (room.status !== "starting") {
      room.status = "starting";
      room.startAt = now + context.timings.startCountdownMs;
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

    if (room.readyDeadline === null) {
      room.readyDeadline = now + context.timings.readyWindowMs;
      changed = true;
    } else if (room.readyDeadline <= now) {
      for (const player of connectedPlayers) {
        player.isReady = false;
      }
      room.readyDeadline = now + context.timings.readyWindowMs;
      changed = true;
    }
  }

  const message = createLobbyMessage(room);
  if (room.message !== message) {
    room.message = message;
    changed = true;
  }

  return changed;
}

export function startRoom(room: ServerRoomState, context: ServerContext, now = Date.now()) {
  room.status = "playing";
  room.readyDeadline = null;
  room.startedAt = now;
  room.startAt = null;
  room.finishedAt = null;
  room.winnerId = null;
  room.message = "La cueva se cierra. Sobrevive la ultima criatura.";
  const entries = [...room.players.values()].filter((player) => player.connected);
  const spawns = pickSeparatedSpawns(room.cave, room.tileLookup, entries.length);

  entries.forEach((player, index) => {
    player.status = "playing";
    player.position = spawns[index] ?? room.cave.startPosition;
    player.combat = createInitialCombatState(player.characterId);
    player.lastAction = "move";
    player.lastAttackAt = 0;
    player.lastMoveAt = now;
    player.lastParryAt = 0;
    player.moveCooldownUntil = 0;
    player.movementPath = [];
    player.parryUntil = 0;
    player.stunnedUntil = 0;
    player.resultReceipt = null;
  });

  room.noises = [];
  room.signals = [];
  room.enemies = room.cave.enemyConfigs.map((config) => createEnemyState(config));
  markRoomActivity(room, context, now);
}

export function addSignal(
  room: ServerRoomState,
  type: RadarSignal["type"],
  position: PlayerPosition,
  ownerId?: string,
) {
  const profile = RADAR_SIGNAL_PROFILES[type];
  room.signals = upsertRadarSignal(
    room.signals,
    createRadarSignal({
      type,
      strength: profile.strength,
      position,
      duration: profile.duration,
      radarJitter: profile.radarJitter,
      ownerId,
    }),
  );
}

export function addNoise(
  room: ServerRoomState,
  type: NoiseEvent["type"],
  position: PlayerPosition,
  radiusTiles: number,
  intensity: number,
  sourceId: string,
) {
  room.noises = [
    ...room.noises.slice(-31),
    {
      id: `${sourceId}-${Date.now()}-${room.noises.length}`,
      type,
      sourceId,
      position,
      radiusTiles,
      intensity,
      createdAt: Date.now(),
    },
  ];
}

export function eliminatePlayer(
  room: ServerRoomState,
  player: ServerPlayerState,
  reason: string,
  attacker?: ServerPlayerState | null,
  now = Date.now(),
) {
  if (["lost", "left", "won"].includes(player.status)) {
    return false;
  }

  player.status = "lost";
  player.combat.health = 0;
  player.combat.eliminatedAt = now;
  player.combat.isParrying = false;
  player.combat.isStunned = false;
  player.parryUntil = 0;
  player.stunnedUntil = 0;
  player.movementPath = [];
  room.message = reason;

  if (attacker && attacker.id !== player.id) {
    attacker.combat.kills += 1;
  }

  return true;
}

export function finishRoom(
  room: ServerRoomState,
  context: ServerContext,
  winnerId: string | null,
  message: string,
  now = Date.now(),
) {
  if (room.status === "finished") {
    return;
  }

  room.status = "finished";
  room.finishedAt = now;
  room.winnerId = winnerId;
  room.message = message;

  for (const player of room.players.values()) {
    if (winnerId && player.id === winnerId) {
      player.status = "won";
    } else if (player.status === "playing") {
      player.status = "lost";
      player.combat.eliminatedAt = now;
    }
  }

  room.results = buildResults(room);
  const winnerUserId = winnerId ? room.players.get(winnerId)?.userId ?? null : null;
  const startedAt = new Date(room.startedAt ?? room.createdAt).toISOString();
  const endedAt = new Date(now).toISOString();

  for (const player of room.players.values()) {
    const placement = room.results.find((entry) => entry.playerId === player.id)?.placement ?? 6;
    const won = player.id === winnerId;
    player.resultReceipt = createResultReceipt(
      {
        matchId: room.matchId,
        userId: player.userId,
        winnerUserId,
        creature: player.characterId,
        result: won ? "win" : "loss",
        scoreEarned: calculateCompetitiveScore({
          won,
          kills: player.combat.kills,
          placement,
        }),
        startedAt,
        endedAt,
      },
      context.resultSecret,
      now,
    );
  }

  markRoomActivity(room, context, now);
  context.io.to(room.code).emit("game-over", { winnerId, message, results: room.results });
  emitState(room, context);
}

export function evaluateRoom(room: ServerRoomState, context: ServerContext, now = Date.now()) {
  if (room.status !== "playing" || room.cleanupStatus === "deleting") {
    return;
  }

  for (const player of room.players.values()) {
    player.combat.isParrying = player.parryUntil > now;
    player.combat.isStunned = player.stunnedUntil > now;
    player.combat.moveCooldownRemaining = Math.max(0, player.moveCooldownUntil - now);
    player.combat.attackCooldownRemaining = Math.max(0, player.lastAttackAt + ATTACK_COOLDOWN - now);
    player.combat.parryCooldownRemaining = Math.max(0, player.lastParryAt + PARRY_COOLDOWN_MS - now);
    player.combat.parryWindowRemaining = Math.max(0, player.parryUntil - now);
    player.combat.stunRemaining = Math.max(0, player.stunnedUntil - now);

    if (
      player.connected &&
      player.movementPath.length > 0 &&
      canTakeTurn({ now, stunnedUntil: player.stunnedUntil })
    ) {
      const nextStep = player.movementPath.shift();

      if (nextStep) {
        player.position = nextStep;
        player.lastMoveAt = now;
        addSignal(room, "move", player.position, player.id);
        const noise = applyCreatureNoise(6, 0.45, player.characterId);
        addNoise(room, "move", player.position, noise.radiusTiles, noise.intensity, player.id);
      }
    }
  }

  const alivePlayers = getAlivePlayers(room);

  if (alivePlayers.length <= 1) {
    const winner = alivePlayers[0] ?? null;
    finishRoom(
      room,
      context,
      winner?.id ?? null,
      winner ? `${winner.name} domina la cadena de la vida.` : "La cueva consumio a todas las criaturas.",
      now,
    );
    return;
  }

  for (const player of alivePlayers.filter((entry) => entry.connected)) {
    if (hitHazard(player.position, room.cave.hazardAreas)) {
      eliminatePlayer(room, player, `${player.name} fue tragado por la cueva.`, null, now);
    }
  }

  const survivors = getAlivePlayers(room);
  if (survivors.length <= 1) {
    const winner = survivors[0] ?? null;
    finishRoom(
      room,
      context,
      winner?.id ?? null,
      winner ? `${winner.name} resiste como la ultima criatura viva.` : "La cueva consumio a todas las criaturas.",
      now,
    );
    return;
  }

  const connectedSurvivors = survivors.filter((player) => player.connected);
  room.enemies = room.enemies.map((enemy) => {
    if (!enemy.alive || enemy.state === "dead") {
      return enemy;
    }

    const config = room.cave.enemyConfigs.find((entry) => entry.id === enemy.id);
    if (!config) {
      return enemy;
    }

    const updated = updateEnemyState(
      enemy,
      connectedSurvivors.map((player) => ({
        id: player.id,
        position: player.position,
        alive: true,
      })),
      config,
      context.timings.moveTickMs / 1_000,
      "playing",
      room.noises,
      now,
      room.tileLookup,
    );
    const moved = distanceBetween(enemy, updated) >= 24;
    const stateChanged = enemy.state !== updated.state;
    const target = connectedSurvivors
      .slice()
      .sort((left, right) => distanceBetween(updated, left.position) - distanceBetween(updated, right.position))[0];

    if (
      target &&
      updated.state === "attacking" &&
      now - enemy.lastAttackAt >= ATTACK_COOLDOWN &&
      isAttackReachableByTiles(updated, target.position, 1, room.tileLookup)
    ) {
      const damage = applyCreatureIncomingDamage(CAVE_ATTACK_DAMAGE, target.characterId);
      const resolution = resolveCombatHit({
        targetHealth: target.combat.health,
        damage,
        now,
        targetParryUntil: target.parryUntil,
      });
      target.combat.health = resolution.nextHealth;
      target.parryUntil = resolution.nextParryUntil;
      addSignal(room, "attack", updated, enemy.id);
      addNoise(room, "attack", updated, 8, 1.1, enemy.id);

      if (resolution.wasParried) {
        room.message = `${target.name} desvia el golpe y aturde a ${updated.name}.`;
        return { ...updated, lastAttackAt: now, stunnedUntil: resolution.attackerStunnedUntil };
      }

      if (resolution.nextHealth <= 0) {
        eliminatePlayer(room, target, `${target.name} fue cazado por la cueva.`, null, now);
      } else {
        room.message = `${updated.name} golpeo a ${target.name}.`;
      }

      return { ...updated, lastAttackAt: now };
    }

    if (moved) {
      addSignal(room, "move", updated, enemy.id);
    }

    if (stateChanged && ["chasing", "investigating"].includes(updated.state)) {
      addSignal(room, "danger", updated, enemy.id);
    }

    return { ...updated, lastAttackAt: enemy.lastAttackAt };
  });

  const finalSurvivors = getAlivePlayers(room);
  if (finalSurvivors.length <= 1) {
    const winner = finalSurvivors[0] ?? null;
    finishRoom(
      room,
      context,
      winner?.id ?? null,
      winner ? `${winner.name} resistio hasta el final.` : "Ninguna criatura sobrevivio al colapso.",
      now,
    );
    return;
  }

  emitState(room, context);
}

export function processRoomLifecycle(context: ServerContext, now = Date.now()) {
  for (const room of [...context.store.rooms.values()]) {
    cleanupTransientEvents(room, now);
    let changed = false;

    for (const player of [...room.players.values()]) {
      if (
        player.connected ||
        player.reconnectDeadline === null ||
        player.reconnectDeadline > now
      ) {
        continue;
      }

      player.reconnectDeadline = null;
      player.disconnectedAt = player.disconnectedAt ?? now;

      if (room.status === "playing" && player.status === "playing") {
        changed = eliminatePlayer(
          room,
          player,
          `${player.name} no regreso antes de cerrarse la ventana de reconexion.`,
          null,
          now,
        ) || changed;
      } else if (room.status !== "finished") {
        room.players.delete(player.id);
        changed = true;
      }
    }

    if (room.players.size === 0) {
      context.store.delete(room.code);
      continue;
    }

    if (room.status === "finished" && room.finishedAt && now >= room.expiresAt) {
      context.store.delete(room.code);
      continue;
    }

    if (
      room.status !== "playing" &&
      room.status !== "finished" &&
      now - room.lastActivityAt >= context.timings.lobbyIdleMs
    ) {
      context.io.to(room.code).emit("error-message", "La sala expiro por inactividad.");
      context.store.delete(room.code);
      continue;
    }

    if (room.status === "playing") {
      if (changed) {
        emitState(room, context);
      }
      continue;
    }

    if (room.status !== "finished") {
      changed = syncLobbyState(room, context, now) || changed;
    }

    if (changed) {
      emitState(room, context);
    }
  }
}

export function attackPlayerTargets(
  room: ServerRoomState,
  attacker: ServerPlayerState,
  now: number,
) {
  const attackDamage = applyCreatureOutgoingDamage(PLAYER_ATTACK_DAMAGE, attacker.characterId);
  let inflictedDamage = 0;

  for (const target of getAlivePlayers(room)) {
    if (target.id === attacker.id || !target.connected) {
      continue;
    }

    if (!isAttackReachableByTiles(attacker.position, target.position, PLAYER_ATTACK_RANGE_TILES, room.tileLookup)) {
      continue;
    }

    const defendedDamage = applyCreatureIncomingDamage(attackDamage, target.characterId);
    const resolution = resolveCombatHit({
      targetHealth: target.combat.health,
      damage: defendedDamage,
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
    } else if (target.combat.health <= 0) {
      eliminatePlayer(room, target, `${attacker.name} depredo a ${target.name}.`, attacker, now);
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
    enemy.hp = Math.max(0, enemy.hp - attackDamage);
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
  return inflictedDamage;
}

export function roomHasCapacity(room: ServerRoomState) {
  return [...room.players.values()].filter((player) => player.status !== "left").length < MAX_ROOM_PLAYERS;
}
