import {
  creatures,
  getCreatureById,
  type CreatureGameplayProfile,
  type CreatureId,
} from "@/lib/creatures";

export type CreatureGameplayModifiers = CreatureGameplayProfile;

export const creatureGameplayModifiers = Object.fromEntries(
  creatures.map((creature) => [creature.id, creature.gameplay]),
) as Record<CreatureId, CreatureGameplayModifiers>;

export function getCreatureGameplayModifiers(id: string) {
  return getCreatureById(id).gameplay;
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
