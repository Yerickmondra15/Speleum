import {
  ATTACK_COOLDOWN,
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
  pickSeparatedSpawns,
  resolveCombatHit,
  resolveMissedParry,
  selectNearestReachableTarget,
  transitionEnemyToDead,
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
import { createGameplayEventId } from "../../lib/gameplay/event-ids";
import {
  cancelRegenerationOnDamage,
  createAbilityState,
  getAbilityModifiers,
  pruneAbilityState,
} from "../../lib/gameplay/abilities";
import { createSanityState, updateSanityForPosition } from "../../lib/gameplay/sanity";
import {
  clampHealing,
  noiseTerrainMultiplier,
  percentageHealing,
  updateShelterRecovery,
} from "../../lib/gameplay/survival";
import { SURVIVAL_RULES } from "../../lib/gameplay/rules";
import { worldToTile } from "../../app/play/tileMap";
import {
  buildOfficialResultBatch,
  scheduleOfficialResultPersistence,
} from "../results/officialResultPersistence";
import type { ServerContext, ServerPlayerState, ServerRoomState } from "../types";
import {
  buildResults,
  cleanupTransientEvents,
  emitState,
  getAlivePlayers,
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
    abilityCooldownRemaining: 0,
    abilityActiveRemaining: 0,
    sanityStage: "stable" as const,
    idleDurationMs: 0,
    shelterProgress: 0,
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
  const lobbyPlayers = [...room.players.values()].filter((player) => player.status !== "left");
  const readyPlayers = getReadyConnectedPlayers(room);

  if (room.status === "starting") {
    return "Iniciando partida...";
  }

  if (lobbyPlayers.some((player) => !player.connected)) {
    return "Esperando la reconexion de los jugadores admitidos.";
  }

  if (lobbyPlayers.length < MIN_ROOM_PLAYERS) {
    return `Esperando minimo ${MIN_ROOM_PLAYERS} jugadores.`;
  }

  if (readyPlayers.length < lobbyPlayers.length) {
    return "Esperando confirmacion de todos.";
  }

  return "La sala puede iniciar. Esperando la confirmacion final del servidor.";
}

export function syncLobbyState(room: ServerRoomState, context: ServerContext, now = Date.now()) {
  if (room.status === "playing" || room.status === "finished") {
    return false;
  }

  const lobbyPlayers = [...room.players.values()].filter((player) => player.status !== "left");
  const connectedPlayers = lobbyPlayers.filter((player) => player.connected);
  const readyPlayers = lobbyPlayers.filter((player) => player.connected && player.isReady);
  const hasDisconnectedPlayer = connectedPlayers.length !== lobbyPlayers.length;
  let changed = false;

  if (lobbyPlayers.length < MIN_ROOM_PLAYERS || hasDisconnectedPlayer) {
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
  const entries = [...room.players.values()]
    .filter((player) => player.status !== "left")
    .sort((left, right) => {
      const leftKey = `${room.matchId}:${left.id}`;
      const rightKey = `${room.matchId}:${right.id}`;
      return leftKey.localeCompare(rightKey);
    });

  if (
    entries.length < MIN_ROOM_PLAYERS ||
    entries.some((player) => !player.connected || !player.isReady)
  ) {
    syncLobbyState(room, context, now);
    return false;
  }

  room.status = "playing";
  room.readyDeadline = null;
  room.startedAt = now;
  room.startAt = null;
  room.finishedAt = null;
  room.winnerId = null;
  room.nextEliminationOrder = 0;
  room.message = "La cueva se cierra. Sobrevive la ultima criatura.";
  const spawns = pickSeparatedSpawns(
    room.cave,
    room.tileLookup,
    entries.length,
    undefined,
    `${room.cave.seed}:${room.matchId}`,
  );

  entries.forEach((player, index) => {
    player.status = "playing";
    player.eliminationOrder = null;
    player.position = spawns[index] ?? room.cave.startPosition;
    player.combat = createInitialCombatState(player.characterId);
    player.lastAction = "move";
    player.lastAttackAt = 0;
    player.lastMoveAt = now;
    player.lastParryAt = 0;
    player.moveCooldownUntil = 0;
    player.movementPath = [];
    player.movementNoiseMultiplier = 1;
    player.parryUntil = 0;
    player.stunnedUntil = 0;
    player.resultReceipt = null;
    player.abilityState = createAbilityState();
    player.lastAbilityTickAt = now;
    const spawnTile = worldToTile(player.position);
    player.sanityState = createSanityState(now, `${spawnTile.col},${spawnTile.row}`);
    player.shelterState = { shelterKey: null, enteredAt: null, progress: 0 };
  });

  room.noises = [];
  room.signals = [];
  room.traps = [];
  room.exhaustedShelters.clear();
  room.enemies = room.cave.enemyConfigs.map((config) => createEnemyState(config, now));
  markRoomActivity(room, context, now);
  return true;
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
  now = Date.now(),
) {
  room.noises = [
    ...room.noises.slice(-31),
    {
      id: createGameplayEventId("noise", sourceId, now),
      type,
      sourceId,
      position,
      radiusTiles,
      intensity,
      createdAt: now,
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
  player.eliminationOrder = ++room.nextEliminationOrder;
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
    attacker.combat.health = clampHealing(
      attacker.combat.health,
      attacker.combat.maxHealth,
      percentageHealing(
        attacker.combat.maxHealth,
        SURVIVAL_RULES.multiplayer.playerKillHealFraction,
      ),
    );
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

  const winner = winnerId ? room.players.get(winnerId) ?? null : null;
  if (winner) {
    winner.status = "won";
    winner.eliminationOrder = null;
    winner.combat.eliminatedAt = null;
  }

  const remainingPlayers = [...room.players.values()]
    .filter((player) => player.id !== winnerId && player.status === "playing")
    .sort((left, right) => left.id.localeCompare(right.id));
  for (const player of remainingPlayers) {
    player.status = "lost";
    player.eliminationOrder = ++room.nextEliminationOrder;
    player.combat.health = 0;
    player.combat.eliminatedAt = now;
  }

  room.results = buildResults(room);
  const officialResults = buildOfficialResultBatch(room);
  const playersByUserId = new Map(
    [...room.players.values()].map((player) => [player.userId, player]),
  );

  for (const { userId, result } of officialResults) {
    const player = playersByUserId.get(userId);
    if (!player) {
      continue;
    }
    player.resultReceipt = createResultReceipt(
      {
        matchId: result.matchId,
        userId,
        winnerUserId: result.winnerId,
        participantCount: result.participantCount ?? undefined,
        creature: result.creature,
        result: result.result,
        scoreEarned: result.scoreEarned,
        startedAt: result.startedAt.toISOString(),
        endedAt: result.endedAt.toISOString(),
      },
      context.resultSecret,
      now,
    );
  }

  scheduleOfficialResultPersistence(room, context, officialResults);
  markRoomActivity(room, context, now);
  context.io.to(room.code).emit("game-over", { winnerId, message, results: room.results });
  emitState(room, context);
}

export function evaluateRoom(room: ServerRoomState, context: ServerContext, now = Date.now()) {
  if (room.status !== "playing" || room.cleanupStatus === "deleting") {
    return;
  }

  room.traps = room.traps.filter((trap) => trap.expiresAt > now);

  for (const player of room.players.values()) {
    const missedParry = resolveMissedParry({
      parryUntil: player.parryUntil,
      stunnedUntil: player.stunnedUntil,
      now,
    });
    if (missedParry.missed) {
      player.parryUntil = missedParry.nextParryUntil;
      player.stunnedUntil = missedParry.nextStunnedUntil;
      player.movementPath = [];
      room.message = `${player.name} bloqueó en falso y quedó expuesto.`;
    }
    const regeneration = player.abilityState.activeEffects.find(
      (effect) => effect.kind === "health-regeneration" && effect.expiresAt > player.lastAbilityTickAt,
    );
    if (regeneration && player.status === "playing") {
      const overlapEnd = Math.min(now, regeneration.expiresAt);
      const elapsed = Math.max(0, overlapEnd - Math.max(player.lastAbilityTickAt, regeneration.startedAt));
      const totalDuration = Math.max(1, regeneration.expiresAt - regeneration.startedAt);
      player.combat.health = clampHealing(
        player.combat.health,
        player.combat.maxHealth,
        player.combat.maxHealth * regeneration.value * (elapsed / totalDuration),
      );
    }
    player.lastAbilityTickAt = now;
    player.abilityState = pruneAbilityState(player.abilityState, now);
    player.combat.abilityCooldownRemaining = Math.max(0, player.abilityState.cooldownUntil - now);
    player.combat.abilityActiveRemaining = Math.max(
      0,
      ...player.abilityState.activeEffects.map((effect) => effect.expiresAt - now),
    );
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
        const playerTile = worldToTile(player.position);
        const trap = room.traps.find((entry) => {
          const trapTile = worldToTile(entry.position);
          return (
            entry.ownerId !== player.id &&
            trapTile.col === playerTile.col &&
            trapTile.row === playerTile.row
          );
        });
        if (trap) {
          player.stunnedUntil = Math.max(player.stunnedUntil, now + trap.stunMs);
          player.movementPath = [];
          room.traps = room.traps.filter((entry) => entry.id !== trap.id);
          room.message = `${player.name} quedó atrapado en seda.`;
        }
        addSignal(room, "move", player.position, player.id);
        const noise = applyCreatureNoise(6, 0.45, player.characterId);
        const terrainNoise = noiseTerrainMultiplier(player.position, room.tileLookup);
        addNoise(
          room,
          "move",
          player.position,
          Math.max(
            1,
            Math.round(noise.radiusTiles * terrainNoise * player.movementNoiseMultiplier),
          ),
          noise.intensity * terrainNoise * player.movementNoiseMultiplier,
          player.id,
          now,
        );
        if (player.movementPath.length === 0) {
          player.movementNoiseMultiplier = 1;
        }
      }
    }

    if (player.connected && player.status === "playing") {
      const shelter = updateShelterRecovery({
        state: player.shelterState,
        position: player.position,
        lookup: room.tileLookup,
        now,
        exhaustedShelters: room.exhaustedShelters,
      });
      player.shelterState = shelter.state;
      player.combat.shelterProgress = shelter.state.progress;
      if (shelter.ready && shelter.state.shelterKey) {
        player.combat.health = clampHealing(
          player.combat.health,
          player.combat.maxHealth,
          percentageHealing(player.combat.maxHealth, SURVIVAL_RULES.shelter.healFraction),
        );
        room.exhaustedShelters.add(shelter.state.shelterKey);
        player.shelterState = { ...shelter.state, enteredAt: null, progress: 0 };
        player.combat.shelterProgress = 0;
        room.message = `${player.name} agotó la energía de un refugio.`;
      }

      const tile = worldToTile(player.position);
      const sanity = updateSanityForPosition({
        state: player.sanityState,
        positionKey: `${tile.col},${tile.row}`,
        now,
        maxHealth: player.combat.maxHealth,
      });
      player.sanityState = sanity.state;
      player.combat.sanityStage = sanity.state.stage;
      player.combat.idleDurationMs = sanity.state.idleDurationMs;
      if (sanity.damage > 0) {
        player.combat.health = Math.max(0, player.combat.health - sanity.damage);
        room.message = `${player.name} escucha a la cueva acercarse: debe moverse.`;
        if (player.combat.health <= 0) {
          eliminatePlayer(room, player, `${player.name} cedió al encierro de la cueva.`, null, now);
        }
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
    const selectedTarget = selectNearestReachableTarget(
      updated,
      connectedSurvivors.map((player) => ({
        id: player.id,
        position: player.position,
        player,
      })),
      updated.attackRangeTiles,
      room.tileLookup,
    );
    const target = selectedTarget?.player ?? null;

    if (
      target &&
      updated.state === "attacking" &&
      now >= updated.nextAttackAt
    ) {
      const abilityDefense = getAbilityModifiers(target.abilityState, now).incomingDamageMultiplier;
      const damage = Math.max(
        0,
        Math.round(applyCreatureIncomingDamage(updated.damage, target.characterId) * abilityDefense),
      );
      const resolution = resolveCombatHit({
        targetHealth: target.combat.health,
        damage,
        now,
        targetParryUntil: target.parryUntil,
      });
      target.combat.health = resolution.nextHealth;
      target.abilityState = cancelRegenerationOnDamage(
        target.abilityState,
        resolution.damageApplied,
        target.combat.maxHealth,
      );
      target.parryUntil = resolution.nextParryUntil;
      addSignal(room, "attack", updated, enemy.id);
      addNoise(room, "attack", updated, 8, 1.1, enemy.id, now);

      if (resolution.wasParried) {
        room.message = `${target.name} desvia el golpe y aturde a ${updated.name}.`;
        return {
          ...updated,
          lastAttackAt: now,
          nextAttackAt: now + ATTACK_COOLDOWN,
          stunnedUntil: resolution.attackerStunnedUntil,
        };
      }

      if (resolution.nextHealth <= 0) {
        eliminatePlayer(room, target, `${target.name} fue cazado por la cueva.`, null, now);
      } else {
        room.message = `${updated.name} golpeo a ${target.name}.`;
      }

      return {
        ...updated,
        lastAttackAt: now,
        nextAttackAt: now + ATTACK_COOLDOWN,
      };
    }

    if (moved) {
      const enemyTile = worldToTile(updated);
      const trap = room.traps.find(
        (entry) =>
          entry.ownerId !== updated.id &&
          worldToTile(entry.position).col === enemyTile.col &&
          worldToTile(entry.position).row === enemyTile.row,
      );
      if (trap) {
        updated.stunnedUntil = Math.max(updated.stunnedUntil, now + trap.stunMs);
        room.traps = room.traps.filter((entry) => entry.id !== trap.id);
        room.message = `${updated.name} quedó atrapada en seda.`;
      }
      addSignal(room, "move", updated, enemy.id);
    }

    if (stateChanged && ["chasing", "investigating"].includes(updated.state)) {
      addSignal(room, "danger", updated, enemy.id);
    }

    return updated;
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
      } else if (room.startedAt === null && room.status !== "finished") {
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
  const candidates = [
    ...getAlivePlayers(room)
      .filter((player) => player.id !== attacker.id && player.connected)
      .map((player) => ({
        id: player.id,
        position: player.position,
        kind: "player" as const,
        player,
      })),
    ...room.enemies
      .filter((enemy) => enemy.alive && enemy.state !== "dead")
      .map((enemy) => ({
        id: enemy.id,
        position: { x: enemy.x, y: enemy.y },
        kind: "enemy" as const,
        enemy,
      })),
  ];
  const target = selectNearestReachableTarget(
    attacker.position,
    candidates,
    PLAYER_ATTACK_RANGE_TILES,
    room.tileLookup,
  );

  if (!target) {
    return 0;
  }

  let inflictedDamage = 0;

  if (target.kind === "player") {
    const abilityDefense = getAbilityModifiers(target.player.abilityState, now).incomingDamageMultiplier;
    const defendedDamage = Math.max(
      0,
      Math.round(applyCreatureIncomingDamage(attackDamage, target.player.characterId) * abilityDefense),
    );
    const resolution = resolveCombatHit({
      targetHealth: target.player.combat.health,
      damage: defendedDamage,
      now,
      targetParryUntil: target.player.parryUntil,
      attackerStunnedUntil: attacker.stunnedUntil,
    });
    target.player.combat.health = resolution.nextHealth;
    target.player.abilityState = cancelRegenerationOnDamage(
      target.player.abilityState,
      resolution.damageApplied,
      target.player.combat.maxHealth,
    );
    target.player.parryUntil = resolution.nextParryUntil;
    attacker.stunnedUntil = resolution.attackerStunnedUntil;
    inflictedDamage = resolution.damageApplied;

    if (resolution.wasParried) {
      room.message = `${target.player.name} hace parry y aturde a ${attacker.name}.`;
    } else if (target.player.combat.health <= 0) {
      eliminatePlayer(
        room,
        target.player,
        `${attacker.name} depredo a ${target.player.name}.`,
        attacker,
        now,
      );
    }
  } else {
    const previousHp = target.enemy.hp;
    const nextHp = Math.max(0, previousHp - attackDamage);
    inflictedDamage = previousHp - nextHp;

    if (nextHp <= 0) {
      Object.assign(target.enemy, transitionEnemyToDead(target.enemy, now));
      attacker.combat.kills += 1;
      room.message = `${attacker.name} derribo a ${target.enemy.name}.`;
    } else {
      target.enemy.hp = nextHp;
      target.enemy.stateSince = target.enemy.state === "chasing" ? target.enemy.stateSince : now;
      target.enemy.state = "chasing";
    }
  }

  attacker.combat.damageDealt += inflictedDamage;
  return inflictedDamage;
}

export function roomHasCapacity(room: ServerRoomState) {
  return [...room.players.values()].filter((player) => player.status !== "left").length < MAX_ROOM_PLAYERS;
}
