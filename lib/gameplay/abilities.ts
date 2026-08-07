import type { CreatureId } from "@/lib/creatures";
import { TILE_SIZE } from "@/lib/gameplay/rules";

export type AbilityEffectKind =
  | "radar-range"
  | "radar-precision"
  | "move-range"
  | "noise-multiplier"
  | "incoming-damage-multiplier";

export type AbilityDefinition = {
  id: string;
  creatureId: CreatureId;
  name: string;
  cooldownMs: number;
  durationMs: number;
  targetRangeTiles: number;
  effects: Array<{
    kind: AbilityEffectKind;
    value: number;
    consumesOn?: "move";
  }>;
  emitsDecoyNoise?: {
    radiusTiles: number;
    intensity: number;
  };
};

export type ActiveAbilityEffect = {
  abilityId: string;
  kind: AbilityEffectKind;
  value: number;
  expiresAt: number;
  consumesOn?: "move";
};

export type AbilityState = {
  cooldownUntil: number;
  activeEffects: ActiveAbilityEffect[];
};

export type AbilityPosition = { x: number; y: number };

export type AbilityGameplayEvent = {
  type: "decoy-noise";
  abilityId: string;
  position: AbilityPosition;
  radiusTiles: number;
  intensity: number;
};

export type AbilityActivationResult =
  | {
      ok: true;
      definition: AbilityDefinition;
      state: AbilityState;
      events: AbilityGameplayEvent[];
    }
  | {
      ok: false;
      reason: "dead" | "stunned" | "cooldown" | "target-required" | "target-out-of-range";
      state: AbilityState;
    };

export const creatureAbilities: Record<CreatureId, AbilityDefinition> = {
  "cave-axolotl": {
    id: "echo-focus",
    creatureId: "cave-axolotl",
    name: "Enfoque de eco",
    cooldownMs: 12_000,
    durationMs: 5_000,
    targetRangeTiles: 0,
    effects: [
      { kind: "radar-range", value: 3 },
      { kind: "radar-precision", value: 0.65 },
    ],
  },
  "cave-shrimp": {
    id: "silent-surge",
    creatureId: "cave-shrimp",
    name: "Impulso silencioso",
    cooldownMs: 10_000,
    durationMs: 4_000,
    targetRangeTiles: 0,
    effects: [
      { kind: "move-range", value: 1, consumesOn: "move" },
      { kind: "noise-multiplier", value: 0.25, consumesOn: "move" },
    ],
  },
  "blind-fish": {
    id: "current-sense",
    creatureId: "blind-fish",
    name: "Lectura de corrientes",
    cooldownMs: 14_000,
    durationMs: 5_000,
    targetRangeTiles: 0,
    effects: [
      { kind: "radar-range", value: 5 },
      { kind: "radar-precision", value: 0.4 },
    ],
  },
  "cave-crab": {
    id: "stone-shell",
    creatureId: "cave-crab",
    name: "Caparazón pétreo",
    cooldownMs: 15_000,
    durationMs: 3_000,
    targetRangeTiles: 0,
    effects: [{ kind: "incoming-damage-multiplier", value: 0.55 }],
  },
  "cave-spider": {
    id: "false-echo",
    creatureId: "cave-spider",
    name: "Eco falso",
    cooldownMs: 13_000,
    durationMs: 0,
    targetRangeTiles: 4,
    effects: [],
    emitsDecoyNoise: {
      radiusTiles: 9,
      intensity: 1.05,
    },
  },
};

export function createAbilityState(): AbilityState {
  return { cooldownUntil: 0, activeEffects: [] };
}

export function pruneAbilityState(state: AbilityState, now: number): AbilityState {
  return {
    ...state,
    activeEffects: state.activeEffects.filter((effect) => effect.expiresAt > now),
  };
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

  if (!alive) {
    return { ok: false, reason: "dead", state: current };
  }
  if (stunned) {
    return { ok: false, reason: "stunned", state: current };
  }
  if (current.cooldownUntil > now) {
    return { ok: false, reason: "cooldown", state: current };
  }
  if (definition.targetRangeTiles > 0 && !targetPosition) {
    return { ok: false, reason: "target-required", state: current };
  }
  if (
    targetPosition &&
    definition.targetRangeTiles > 0 &&
    positionDistanceTiles(actorPosition, targetPosition) > definition.targetRangeTiles
  ) {
    return { ok: false, reason: "target-out-of-range", state: current };
  }

  const activeEffects = definition.effects.map((effect) => ({
    abilityId: definition.id,
    kind: effect.kind,
    value: effect.value,
    expiresAt: now + definition.durationMs,
    consumesOn: effect.consumesOn,
  }));
  const events: AbilityGameplayEvent[] = [];

  if (definition.emitsDecoyNoise && targetPosition) {
    events.push({
      type: "decoy-noise",
      abilityId: definition.id,
      position: targetPosition,
      ...definition.emitsDecoyNoise,
    });
  }

  return {
    ok: true,
    definition,
    state: {
      cooldownUntil: now + definition.cooldownMs,
      activeEffects: [...current.activeEffects, ...activeEffects],
    },
    events,
  };
}

export function getAbilityModifiers(state: AbilityState, now: number) {
  const active = pruneAbilityState(state, now).activeEffects;
  const values = (kind: AbilityEffectKind) =>
    active.filter((effect) => effect.kind === kind).map((effect) => effect.value);

  return {
    radarRangeBonusTiles: values("radar-range").reduce((sum, value) => sum + value, 0),
    radarPrecisionMultiplier: values("radar-precision").reduce(
      (result, value) => result * value,
      1,
    ),
    moveRangeBonusTiles: values("move-range").reduce((sum, value) => sum + value, 0),
    noiseMultiplier: values("noise-multiplier").reduce(
      (result, value) => result * value,
      1,
    ),
    incomingDamageMultiplier: values("incoming-damage-multiplier").reduce(
      (result, value) => result * value,
      1,
    ),
  };
}

export function consumeAbilityEffects(
  state: AbilityState,
  trigger: "move",
  now: number,
): AbilityState {
  const current = pruneAbilityState(state, now);
  return {
    ...current,
    activeEffects: current.activeEffects.filter((effect) => effect.consumesOn !== trigger),
  };
}
