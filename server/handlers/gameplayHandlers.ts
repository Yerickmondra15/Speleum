import {
  ATTACK_COOLDOWN,
  PARRY_COOLDOWN_MS,
  PARRY_WINDOW_MS,
  TILE_SIZE,
} from "../../app/play/gameConfig";
import { canTakeTurn, planMovementPath } from "../../app/play/gameLogic";
import {
  applyCreatureNoise,
  getCreatureGameplayModifiers,
} from "../../lib/creature-gameplay";
import type { CreatureId } from "../../lib/creatures";
import {
  activateCreatureAbility,
  consumeAbilityEffects,
  getAbilityModifiers,
} from "../../lib/gameplay/abilities";
import { createGameplayEventId } from "../../lib/gameplay/event-ids";
import { getTileAt, worldToTile } from "../../app/play/tileMap";
import type { GameSocket, ServerContext } from "../types";
import {
  addNoise,
  addSignal,
  attackPlayerTargets,
  markRoomActivity,
} from "../rooms/roomLifecycle";
import { emitState } from "../rooms/roomSerialization";
import {
  parseSocketPayload,
  playerAbilitySchema,
  playerMoveSchema,
  roomActionSchema,
} from "../validation/socketSchemas";

function playingMembership(socket: GameSocket, context: ServerContext, roomCode: string) {
  const membership = context.store.getBySocket(socket.id);

  if (
    !membership ||
    membership.room.code !== roomCode ||
    membership.room.status !== "playing" ||
    membership.player.status !== "playing" ||
    !membership.player.connected
  ) {
    return null;
  }

  return membership;
}

export function registerGameplayHandlers(socket: GameSocket, context: ServerContext) {
  socket.on("player-move", (payload) => {
    const input = parseSocketPayload(playerMoveSchema, payload);

    if (!input) {
      socket.emit("error-message", "El movimiento enviado no es valido.");
      return;
    }

    const membership = playingMembership(socket, context, input.roomCode);
    if (!membership) {
      socket.emit("error-message", "No puedes moverte en el estado actual.");
      return;
    }

    const { room, player } = membership;
    const now = Date.now();

    if (now < player.moveCooldownUntil || player.movementPath.length > 0) {
      socket.emit("error-message", "Tu criatura aun recupera el impulso.");
      return;
    }

    if (!canTakeTurn({ now, stunnedUntil: player.stunnedUntil })) {
      socket.emit("error-message", "Tu criatura esta aturdida.");
      return;
    }

    const target =
      input.target ??
      (input.direction
        ? {
            x: player.position.x + Math.sign(input.direction.x) * TILE_SIZE,
            y: player.position.y + Math.sign(input.direction.y) * TILE_SIZE,
          }
        : null);
    const modifiers = getCreatureGameplayModifiers(player.characterId);
    const abilityModifiers = getAbilityModifiers(player.abilityState, now);
    if (abilityModifiers.movementLocked) {
      socket.emit("error-message", "El caparazón cerrado impide desplazarte.");
      return;
    }
    const movement = target
      ? planMovementPath(
          player.position,
          target,
          modifiers.moveRangeTiles + abilityModifiers.moveRangeBonusTiles,
          room.tileLookup,
          modifiers.moveCooldownMultiplier,
        )
      : null;

    if (!movement) {
      socket.emit("error-message", "No hay una ruta valida hacia esa celda.");
      return;
    }

    player.lastAction = "move";
    player.movementPath = movement.worldPath;
    player.movementNoiseMultiplier = abilityModifiers.noiseMultiplier;
    player.moveCooldownUntil = now + movement.cooldownMs;
    const noise = applyCreatureNoise(6, 0.45, player.characterId);
    addNoise(
      room,
      "move",
      player.position,
      Math.max(1, Math.round(noise.radiusTiles * abilityModifiers.noiseMultiplier)),
      noise.intensity * abilityModifiers.noiseMultiplier,
      player.id,
    );
    player.abilityState = consumeAbilityEffects(player.abilityState, "move", now);
    markRoomActivity(room, context, now);
    emitState(room, context);
  });

  socket.on("player-attack", (payload) => {
    const input = parseSocketPayload(roomActionSchema, payload);

    if (!input) {
      socket.emit("error-message", "El ataque enviado no es valido.");
      return;
    }

    const membership = playingMembership(socket, context, input.roomCode);
    if (!membership) {
      socket.emit("error-message", "No puedes atacar en el estado actual.");
      return;
    }

    const { room, player } = membership;
    const now = Date.now();

    if (
      now - player.lastAttackAt < ATTACK_COOLDOWN ||
      now < player.moveCooldownUntil ||
      player.movementPath.length > 0
    ) {
      socket.emit("error-message", "Tu criatura aun esta recuperandose.");
      return;
    }

    if (!canTakeTurn({ now, stunnedUntil: player.stunnedUntil })) {
      socket.emit("error-message", "Tu criatura esta aturdida.");
      return;
    }

    player.lastAttackAt = now;
    player.lastAction = "attack";
    player.combat.attackCooldownRemaining = ATTACK_COOLDOWN;
    addSignal(room, "attack", player.position, player.id);
    const noise = applyCreatureNoise(9, 1.2, player.characterId);
    addNoise(room, "attack", player.position, noise.radiusTiles, noise.intensity, player.id);
    const damage = attackPlayerTargets(room, player, now);

    if (damage === 0 && !room.message) {
      room.message = `${player.name} ataco, pero no encontro presa.`;
    }

    markRoomActivity(room, context, now);
    emitState(room, context);
  });

  socket.on("player-defend", (payload) => {
    const input = parseSocketPayload(roomActionSchema, payload);

    if (!input) {
      socket.emit("error-message", "La defensa enviada no es valida.");
      return;
    }

    const membership = playingMembership(socket, context, input.roomCode);
    if (!membership) {
      socket.emit("error-message", "No puedes defenderte en el estado actual.");
      return;
    }

    const { room, player } = membership;
    const now = Date.now();

    if (
      now - player.lastParryAt < PARRY_COOLDOWN_MS ||
      now < player.moveCooldownUntil ||
      player.movementPath.length > 0
    ) {
      socket.emit("error-message", "Tu criatura aun no puede hacer parry.");
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
    const noise = applyCreatureNoise(6, 0.65, player.characterId);
    addNoise(room, "defend", player.position, noise.radiusTiles, noise.intensity, player.id);
    room.message = `${player.name} abre una ventana de parry arriesgada.`;
    markRoomActivity(room, context, now);
    emitState(room, context);
  });

  socket.on("player-ability", (payload) => {
    const input = parseSocketPayload(playerAbilitySchema, payload);
    if (!input) {
      socket.emit("error-message", "La habilidad enviada no es válida.");
      return;
    }
    const membership = playingMembership(socket, context, input.roomCode);
    if (!membership) {
      socket.emit("error-message", "No puedes usar habilidades en el estado actual.");
      return;
    }
    const { room, player } = membership;
    const now = Date.now();
    const targetPosition = input.target ?? player.position;
    const targetTile = getTileAt(worldToTile(targetPosition), room.tileLookup);
    if (!targetTile?.walkable || targetTile.type === "hazard") {
      socket.emit("error-message", "La habilidad requiere un tile seguro y caminable.");
      return;
    }
    const result = activateCreatureAbility({
      creatureId: player.characterId as CreatureId,
      state: player.abilityState,
      now,
      alive: player.status === "playing" && player.combat.health > 0,
      stunned: !canTakeTurn({ now, stunnedUntil: player.stunnedUntil }),
      actorPosition: player.position,
      targetPosition,
    });
    if (!result.ok) {
      socket.emit("error-message", `No se pudo activar la habilidad: ${result.reason}.`);
      return;
    }

    player.abilityState = result.state;
    player.lastAbilityTickAt = now;
    player.lastAction = "ability";
    for (const event of result.events) {
      room.traps.push({
        id: createGameplayEventId("trap", player.id, now),
        ownerId: player.id,
        position: event.position,
        createdAt: now,
        expiresAt: now + event.durationMs,
        stunMs: event.stunMs,
      });
    }
    room.message = `${player.name} activa ${result.definition.name}.`;
    markRoomActivity(room, context, now);
    emitState(room, context);
  });
}
