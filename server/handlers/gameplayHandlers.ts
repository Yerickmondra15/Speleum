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
    const movement = target
      ? planMovementPath(
          player.position,
          target,
          modifiers.moveRangeTiles,
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
    player.moveCooldownUntil = now + movement.cooldownMs;
    const noise = applyCreatureNoise(6, 0.45, player.characterId);
    addNoise(room, "move", player.position, noise.radiusTiles, noise.intensity, player.id);
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
    room.message = `${player.name} abre una ventana corta de parry.`;
    markRoomActivity(room, context, now);
    emitState(room, context);
  });
}
