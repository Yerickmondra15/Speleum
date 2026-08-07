import type { CreatureId } from "@/lib/creatures";

export type CreatureGameplayModifiers = {
  maxHealth: number;
  moveRangeTiles: number;
  moveCooldownMultiplier: number;
  noiseMultiplier: number;
  outgoingDamageMultiplier: number;
  incomingDamageMultiplier: number;
  radarRangeTiles: number;
};

export const creatureGameplayModifiers: Record<CreatureId, CreatureGameplayModifiers> = {
  "cave-axolotl": {
    maxHealth: 100,
    moveRangeTiles: 4,
    moveCooldownMultiplier: 1,
    noiseMultiplier: 0.9,
    outgoingDamageMultiplier: 1,
    incomingDamageMultiplier: 0.94,
    radarRangeTiles: 13,
  },
  "cave-shrimp": {
    maxHealth: 78,
    moveRangeTiles: 5,
    moveCooldownMultiplier: 0.78,
    noiseMultiplier: 0.55,
    outgoingDamageMultiplier: 0.9,
    incomingDamageMultiplier: 1.12,
    radarRangeTiles: 10,
  },
  "blind-fish": {
    maxHealth: 86,
    moveRangeTiles: 4,
    moveCooldownMultiplier: 0.92,
    noiseMultiplier: 0.72,
    outgoingDamageMultiplier: 0.92,
    incomingDamageMultiplier: 1.04,
    radarRangeTiles: 14,
  },
  "cave-crab": {
    maxHealth: 125,
    moveRangeTiles: 3,
    moveCooldownMultiplier: 1.12,
    noiseMultiplier: 1.15,
    outgoingDamageMultiplier: 0.95,
    incomingDamageMultiplier: 0.72,
    radarRangeTiles: 9,
  },
  "cave-spider": {
    maxHealth: 84,
    moveRangeTiles: 4,
    moveCooldownMultiplier: 0.88,
    noiseMultiplier: 0.62,
    outgoingDamageMultiplier: 1.15,
    incomingDamageMultiplier: 1.06,
    radarRangeTiles: 11,
  },
};

export function getCreatureGameplayModifiers(id: string) {
  return (
    creatureGameplayModifiers[id as CreatureId] ??
    creatureGameplayModifiers["cave-axolotl"]
  );
}

export function applyCreatureOutgoingDamage(baseDamage: number, creatureId: string) {
  return Math.max(
    0,
    Math.round(baseDamage * getCreatureGameplayModifiers(creatureId).outgoingDamageMultiplier),
  );
}

export function applyCreatureIncomingDamage(baseDamage: number, creatureId: string) {
  return Math.max(
    0,
    Math.round(baseDamage * getCreatureGameplayModifiers(creatureId).incomingDamageMultiplier),
  );
}

export function applyCreatureNoise(
  baseRadiusTiles: number,
  baseIntensity: number,
  creatureId: string,
) {
  const multiplier = getCreatureGameplayModifiers(creatureId).noiseMultiplier;
  return {
    radiusTiles: Math.max(1, Math.round(baseRadiusTiles * multiplier)),
    intensity: Math.max(0.05, Number((baseIntensity * multiplier).toFixed(3))),
  };
}
