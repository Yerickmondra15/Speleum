import type { CreatureId } from "@/lib/creatures";
import { TILE_SIZE } from "@/lib/gameplay/rules";

export type AbilityEffectKind =
  | "health-regeneration"
  | "radar-range"
  | "radar-precision"
  | "vision-range"
  | "move-range"
  | "noise-multiplier"
  | "incoming-damage-multiplier"
  | "movement-locked";

export type AbilityDefinition = {
  id: string;
  creatureId: CreatureId;
  name: string;
  description: string;
  cooldownMs: number;
  durationMs: number;
  targetRangeTiles: number;
  effects: Array<{ kind: AbilityEffectKind; value: number; consumesOn?: "move" }>;
  trap?: { durationMs: number; stunMs: number };
};

export type ActiveAbilityEffect = {
  abilityId: string;
  kind: AbilityEffectKind;
  value: number;
  expiresAt: number;
  startedAt: number;
  consumesOn?: "move";
};

export type AbilityState = { cooldownUntil: number; activeEffects: ActiveAbilityEffect[] };
export type AbilityPosition = { x: number; y: number };
export type SilkTrap = {
  id: string;
  ownerId: string;
  position: AbilityPosition;
  createdAt: number;
  expiresAt: number;
  stunMs: number;
};

export type AbilityGameplayEvent = {
  type: "silk-trap";
  abilityId: string;
  position: AbilityPosition;
  durationMs: number;
  stunMs: number;
};

export type AbilityActivationResult =
  | { ok: true; definition: AbilityDefinition; state: AbilityState; events: AbilityGameplayEvent[] }
  | {
      ok: false;
      reason: "dead" | "stunned" | "cooldown" | "target-required" | "target-out-of-range";
      state: AbilityState;
    };

export const creatureAbilities: Record<CreatureId, AbilityDefinition> = {
  "cave-axolotl": {
    id: "cavern-regeneration",
    creatureId: "cave-axolotl",
    name: "Regeneración cavernícola",
    description: "Recupera 18% de la vida máxima durante 4.5 s; un golpe de 12% o más la cancela.",
    cooldownMs: 32_000,
    durationMs: 4_500,
    targetRangeTiles: 0,
    effects: [{ kind: "health-regeneration", value: 0.18 }],
  },
  "cave-shrimp": {
    id: "ghost-surge",
    creatureId: "cave-shrimp",
    name: "Impulso fantasma",
    description: "El siguiente desplazamiento gana 2 tiles y apenas produce ruido.",
    cooldownMs: 17_000,
    durationMs: 6_000,
    targetRangeTiles: 0,
    effects: [
      { kind: "move-range", value: 2, consumesOn: "move" },
      { kind: "noise-multiplier", value: 0.15, consumesOn: "move" },
    ],
  },
  "blind-fish": {
    id: "echolocation",
    creatureId: "blind-fish",
    name: "Ecolocalización",
    description: "Amplía la visión 6 tiles, extiende el radar y reduce su imprecisión durante 5 s.",
    cooldownMs: 22_000,
    durationMs: 5_000,
    targetRangeTiles: 0,
    effects: [
      { kind: "radar-range", value: 10 },
      { kind: "radar-precision", value: 0.35 },
      { kind: "vision-range", value: 6 },
    ],
  },
  "cave-crab": {
    id: "fortified-shell",
    creatureId: "cave-crab",
    name: "Caparazón",
    description: "Reduce 70% del daño durante 2.5 s, pero inmoviliza mientras está cerrado.",
    cooldownMs: 24_000,
    durationMs: 2_500,
    targetRangeTiles: 0,
    effects: [
      { kind: "incoming-damage-multiplier", value: 0.3 },
      { kind: "movement-locked", value: 1 },
    ],
  },
  "cave-spider": {
    id: "silk-trap",
    creatureId: "cave-spider",
    name: "Trampa de seda",
    description: "Deja una trampa 11 s; el primer hostil que la pisa queda aturdido 1.5 s.",
    cooldownMs: 28_000,
    durationMs: 0,
    targetRangeTiles: 1,
    effects: [],
    trap: { durationMs: 11_000, stunMs: 1_500 },
  },
};

export function createAbilityState(): AbilityState {
  return { cooldownUntil: 0, activeEffects: [] };
}

export function pruneAbilityState(state: AbilityState, now: number): AbilityState {
  return { ...state, activeEffects: state.activeEffects.filter((effect) => effect.expiresAt > now) };
}

function positionDistanceTiles(left: AbilityPosition, right: AbilityPosition) {
  return Math.max(
    Math.abs(Math.floor(left.x / TILE_SIZE) - Math.floor(right.x / TILE_SIZE)),
    Math.abs(Math.floor(left.y / TILE_SIZE) - Math.floor(right.y / TILE_SIZE)),
  );
}

export function activateCreatureAbility({
  creatureId,
  state,
  now,
  alive = true,
  stunned = false,
  actorPosition,
  targetPosition,
}: {
  creatureId: CreatureId;
  state: AbilityState;
  now: number;
  alive?: boolean;
  stunned?: boolean;
  actorPosition: AbilityPosition;
  targetPosition?: AbilityPosition;
}): AbilityActivationResult {
  const current = pruneAbilityState(state, now);
  const definition = creatureAbilities[creatureId];
  if (!alive) return { ok: false, reason: "dead", state: current };
  if (stunned) return { ok: false, reason: "stunned", state: current };
  if (current.cooldownUntil > now) return { ok: false, reason: "cooldown", state: current };
  if (definition.targetRangeTiles > 0 && !targetPosition) {
    return { ok: false, reason: "target-required", state: current };
  }
  if (
    targetPosition && definition.targetRangeTiles > 0 &&
    positionDistanceTiles(actorPosition, targetPosition) > definition.targetRangeTiles
  ) {
    return { ok: false, reason: "target-out-of-range", state: current };
  }

  const activeEffects = definition.effects.map((effect) => ({
    ...effect,
    abilityId: definition.id,
    startedAt: now,
    expiresAt: now + definition.durationMs,
  }));
  const events: AbilityGameplayEvent[] = [];
  if (definition.trap && targetPosition) {
    events.push({
      type: "silk-trap",
      abilityId: definition.id,
      position: targetPosition,
      ...definition.trap,
    });
  }

  return {
    ok: true,
    definition,
    state: { cooldownUntil: now + definition.cooldownMs, activeEffects: [...current.activeEffects, ...activeEffects] },
    events,
  };
}

export function getAbilityModifiers(state: AbilityState, now: number) {
  const active = pruneAbilityState(state, now).activeEffects;
  const values = (kind: AbilityEffectKind) => active.filter((effect) => effect.kind === kind).map((effect) => effect.value);
  return {
    radarRangeBonusTiles: values("radar-range").reduce((sum, value) => sum + value, 0),
    radarPrecisionMultiplier: values("radar-precision").reduce((result, value) => result * value, 1),
    visionRangeBonusTiles: values("vision-range").reduce((sum, value) => sum + value, 0),
    moveRangeBonusTiles: values("move-range").reduce((sum, value) => sum + value, 0),
    noiseMultiplier: values("noise-multiplier").reduce((result, value) => result * value, 1),
    incomingDamageMultiplier: values("incoming-damage-multiplier").reduce((result, value) => result * value, 1),
    movementLocked: values("movement-locked").some((value) => value > 0),
    regenerationFraction: values("health-regeneration").reduce((sum, value) => sum + value, 0),
  };
}

export function cancelRegenerationOnDamage(state: AbilityState, damage: number, maxHealth: number) {
  if (damage < maxHealth * 0.12) return state;
  return {
    ...state,
    activeEffects: state.activeEffects.filter((effect) => effect.kind !== "health-regeneration"),
  };
}

export function consumeAbilityEffects(state: AbilityState, trigger: "move", now: number): AbilityState {
  const current = pruneAbilityState(state, now);
  return { ...current, activeEffects: current.activeEffects.filter((effect) => effect.consumesOn !== trigger) };
}
