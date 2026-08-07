import { describe, expect, it } from "vitest";

import { createRadarSignal, pruneExpiredRadarSignals, upsertRadarSignal } from "@/app/play/signalUtils";
import {
  applyCreatureIncomingDamage,
  applyCreatureNoise,
  applyCreatureOutgoingDamage,
  creatureGameplayModifiers,
  getCreatureGameplayModifiers,
} from "@/lib/creature-gameplay";
import { creatures } from "@/lib/creatures";
import { creatureIdSchema } from "@/lib/validation/schemas";

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

  it("elimina senales vencidas", () => {
    const expired = createRadarSignal({
      type: "attack",
      strength: "high",
      position: { x: 0, y: 0 },
      duration: 500,
      radarJitter: 0,
      createdAt: 1_000,
    });
    const active = { ...expired, id: 2_000, createdAt: 2_000 };
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
  });

  it("aplica defensa, ataque y sigilo de forma acotada", () => {
    expect(applyCreatureIncomingDamage(30, "cave-crab")).toBeLessThan(30);
    expect(applyCreatureOutgoingDamage(30, "cave-spider")).toBeGreaterThan(30);
    expect(applyCreatureNoise(6, 1, "cave-shrimp")).toMatchObject({ radiusTiles: 3, intensity: 0.55 });
  });
});
