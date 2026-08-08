import { describe, expect, it } from "vitest";

import {
  collapseRadarSignals,
  createRadarSignal,
  pruneExpiredRadarSignals,
  upsertRadarSignal,
} from "@/app/play/signalUtils";
import {
  applyCreatureIncomingDamage,
  applyCreatureNoise,
  applyCreatureOutgoingDamage,
  creatureGameplayModifiers,
  getCreatureGameplayModifiers,
} from "@/lib/creature-gameplay";
import { creatures } from "@/lib/creatures";
import { creatureIdSchema } from "@/lib/validation/schemas";
import { creatureAbilities } from "@/lib/gameplay/abilities";
import { approximateRadarPosition, tileDistance } from "@/app/play/tileMap";
import { TILE_VISION_RADIUS } from "@/app/play/gameConfig";

describe("radar y criaturas", () => {
  it("crea y combina pulsos de movimiento cercanos", () => {
    const first = createRadarSignal({
      type: "move",
      strength: "low",
      position: { x: 100, y: 100 },
      duration: 1_000,
      radarJitter: 1,
      ownerId: "p1",
      createdAt: 1_000,
    });
    const next = createRadarSignal({
      type: "move",
      strength: "low",
      position: { x: 110, y: 110 },
      duration: 1_000,
      radarJitter: 1,
      ownerId: "p1",
      createdAt: 1_100,
    });
    const signals = upsertRadarSignal([first], next);
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({ x: 110, y: 110, createdAt: 1_100 });
  });

  it("mantiene un solo eco relevante por criatura", () => {
    const move = createRadarSignal({
      type: "move",
      strength: "low",
      position: { x: 100, y: 100 },
      duration: 1_050,
      radarJitter: 1,
      ownerId: "enemy-1",
      createdAt: 1_000,
    });
    const danger = createRadarSignal({
      type: "danger",
      strength: "medium",
      position: { x: 110, y: 110 },
      duration: 1_450,
      radarJitter: 1,
      ownerId: "enemy-1",
      createdAt: 1_050,
    });

    expect(collapseRadarSignals([move, danger])).toEqual([danger]);
  });

  it("asigna IDs distintos a eventos creados en el mismo milisegundo", () => {
    const input = {
      type: "attack" as const,
      strength: "high" as const,
      position: { x: 100, y: 100 },
      duration: 1_000,
      radarJitter: 1,
      ownerId: "enemy-1",
      createdAt: 1_000,
    };
    const first = createRadarSignal(input);
    const second = createRadarSignal(input);

    expect(first.id).not.toBe(second.id);
    expect(new Set([first.id, second.id])).toHaveLength(2);
  });

  it("elimina senales vencidas", () => {
    const expired = createRadarSignal({
      type: "attack",
      strength: "high",
      position: { x: 0, y: 0 },
      duration: 500,
      radarJitter: 0,
      createdAt: 1_000,
    });
    const active = { ...expired, id: "signal:2000:active", createdAt: 2_000 };
    expect(pruneExpiredRadarSignals([expired, active], 2_400)).toEqual([active]);
  });

  it("valida exactamente las cinco criaturas reales", () => {
    expect(creatures).toHaveLength(5);
    for (const creature of creatures) {
      expect(creatureIdSchema.parse(creature.id)).toBe(creature.id);
    }
    expect(creatureIdSchema.safeParse("dragon").success).toBe(false);
  });

  it("mantiene modificadores completos y diferenciados", () => {
    expect(Object.keys(creatureGameplayModifiers)).toHaveLength(5);
    expect(getCreatureGameplayModifiers("cave-crab").maxHealth).toBeGreaterThan(
      getCreatureGameplayModifiers("cave-shrimp").maxHealth,
    );
    expect(getCreatureGameplayModifiers("blind-fish").radarRangeTiles).toBeGreaterThan(
      getCreatureGameplayModifiers("cave-crab").radarRangeTiles,
    );
    for (const creature of creatures) {
      expect(getCreatureGameplayModifiers(creature.id)).toBe(creature.gameplay);
    }
  });

  it("aplica defensa, ataque y sigilo de forma acotada", () => {
    expect(applyCreatureIncomingDamage(30, "cave-crab")).toBeLessThan(30);
    expect(applyCreatureOutgoingDamage(30, "cave-spider")).toBeGreaterThan(30);
    expect(applyCreatureNoise(6, 1, "cave-shrimp")).toMatchObject({ radiusTiles: 3, intensity: 0.55 });
  });

  it("mantiene actualizada la habilidad mostrada en las páginas públicas", () => {
    for (const creature of creatures) {
      expect(creature.habilidad).toContain(creatureAbilities[creature.id].name);
      expect(creature.habilidad).toMatch(/Cooldown:/);
    }
  });

  it("el radar detecta fuera de la visión y escala con el rango real", () => {
    const origin = { col: 10, row: 10 };
    const distant = { col: 22, row: 10 };
    expect(tileDistance(origin, distant)).toBeGreaterThan(TILE_VISION_RADIUS);
    expect(tileDistance(origin, distant)).toBeLessThanOrEqual(
      getCreatureGameplayModifiers("cave-axolotl").radarRangeTiles,
    );
    expect(approximateRadarPosition(origin, distant, 0, 1, 18)).not.toEqual(
      approximateRadarPosition(origin, distant, 0, 1, 12),
    );
    expect(getCreatureGameplayModifiers("blind-fish").radarRangeTiles).toBe(22);
  });
});
