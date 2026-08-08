import type { TileLookup } from "@/app/play/tileMap";
import { getTileAt, worldToTile } from "@/app/play/tileMap";
import type { PlayerPosition } from "@/app/play/gameConfig";
import { SURVIVAL_RULES } from "@/lib/gameplay/rules";

export type ShelterRecoveryState = {
  shelterKey: string | null;
  enteredAt: number | null;
  progress: number;
};

export function clampHealing(health: number, maxHealth: number, amount: number) {
  return Math.min(maxHealth, Math.max(0, health + Math.max(0, amount)));
}

export function percentageHealing(maxHealth: number, fraction: number) {
  return Math.max(1, Math.round(maxHealth * fraction));
}

export function terrainAt(position: PlayerPosition, lookup: TileLookup) {
  return getTileAt(worldToTile(position), lookup)?.type ?? "floor";
}

export function terrainNameAt(position: PlayerPosition, lookup: TileLookup) {
  const type = terrainAt(position, lookup);
  if (type === "hazard") return "Peligro letal";
  if (type === "water") return "Agua oscura";
  if (type === "shelter") return "Refugio";
  if (type === "nest") return "Nido";
  if (type === "spawn") return "Punto de aparición";
  return "Suelo cavernícola";
}

export function movementTerrainMultiplier(path: PlayerPosition[], lookup: TileLookup) {
  return path.some((position) => terrainAt(position, lookup) === "water")
    ? SURVIVAL_RULES.terrain.waterMoveCooldownMultiplier
    : 1;
}

export function noiseTerrainMultiplier(position: PlayerPosition, lookup: TileLookup) {
  return terrainAt(position, lookup) === "water"
    ? SURVIVAL_RULES.terrain.waterNoiseMultiplier
    : 1;
}

export function updateShelterRecovery({
  state,
  position,
  lookup,
  now,
  exhaustedShelters,
}: {
  state: ShelterRecoveryState;
  position: PlayerPosition;
  lookup: TileLookup;
  now: number;
  exhaustedShelters: ReadonlySet<string>;
}) {
  const tile = worldToTile(position);
  const key = `${tile.col},${tile.row}`;
  const isShelter = getTileAt(tile, lookup)?.type === "shelter";

  if (!isShelter || exhaustedShelters.has(key)) {
    return { state: { shelterKey: isShelter ? key : null, enteredAt: null, progress: 0 }, ready: false };
  }

  const enteredAt = state.shelterKey === key && state.enteredAt !== null ? state.enteredAt : now;
  const progress = Math.min(1, (now - enteredAt) / SURVIVAL_RULES.shelter.activationMs);
  return {
    state: { shelterKey: key, enteredAt, progress },
    ready: progress >= 1,
  };
}
