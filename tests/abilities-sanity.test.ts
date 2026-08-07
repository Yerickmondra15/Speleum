import { describe, expect, it } from "vitest";

import {
  activateCreatureAbility,
  consumeAbilityEffects,
  createAbilityState,
  creatureAbilities,
  getAbilityModifiers,
} from "@/lib/gameplay/abilities";
import {
  createSanityState,
  getSanityBand,
  getSanityEffects,
  reduceSanity,
} from "@/lib/gameplay/sanity";

describe("habilidades compartidas", () => {
  it("define una habilidad acotada para cada criatura", () => {
    expect(Object.keys(creatureAbilities)).toHaveLength(5);
    expect(new Set(Object.values(creatureAbilities).map((ability) => ability.id)).size).toBe(5);
  });

  it("activa efectos temporales y respeta cooldown", () => {
    const first = activateCreatureAbility({
      creatureId: "cave-crab",
      state: createAbilityState(),
      now: 1_000,
      actorPosition: { x: 40, y: 40 },
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    expect(getAbilityModifiers(first.state, 2_000).incomingDamageMultiplier).toBe(0.55);
    expect(getAbilityModifiers(first.state, 4_001).incomingDamageMultiplier).toBe(1);
    expect(
      activateCreatureAbility({
        creatureId: "cave-crab",
        state: first.state,
        now: 2_000,
        actorPosition: { x: 40, y: 40 },
      }),
    ).toMatchObject({ ok: false, reason: "cooldown" });
  });

  it("valida el objetivo del eco falso y emite ruido abstracto", () => {
    const invalid = activateCreatureAbility({
      creatureId: "cave-spider",
      state: createAbilityState(),
      now: 1_000,
      actorPosition: { x: 40, y: 40 },
      targetPosition: { x: 600, y: 40 },
    });
    expect(invalid).toMatchObject({ ok: false, reason: "target-out-of-range" });

    const valid = activateCreatureAbility({
      creatureId: "cave-spider",
      state: createAbilityState(),
      now: 1_000,
      actorPosition: { x: 40, y: 40 },
      targetPosition: { x: 280, y: 40 },
    });
    expect(valid).toMatchObject({
      ok: true,
      events: [{ type: "decoy-noise", radiusTiles: 9 }],
    });
  });

  it("consume el impulso de movimiento una sola vez", () => {
    const result = activateCreatureAbility({
      creatureId: "cave-shrimp",
      state: createAbilityState(),
      now: 1_000,
      actorPosition: { x: 40, y: 40 },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(getAbilityModifiers(result.state, 2_000).moveRangeBonusTiles).toBe(1);
    const consumed = consumeAbilityEffects(result.state, "move", 2_000);
    expect(getAbilityModifiers(consumed, 2_000).moveRangeBonusTiles).toBe(0);
    expect(getAbilityModifiers(consumed, 2_000).noiseMultiplier).toBe(1);
  });
});

describe("cordura por eventos", () => {
  it("no penaliza por tick y solo aplica inactividad significativa", () => {
    const initial = createSanityState(0);
    expect(reduceSanity(initial, { type: "prolonged-idle", now: 11_999 })).toBe(initial);
    const idle = reduceSanity(initial, { type: "prolonged-idle", now: 12_000 });
    expect(idle.value).toBe(94);
    expect(reduceSanity(idle, { type: "prolonged-idle", now: 13_000 })).toBe(idle);
  });

  it("combina peligro, daño, refugio y acción con límites", () => {
    let state = createSanityState(0);
    state = reduceSanity(state, { type: "hostile-nearby", now: 5_000, distanceTiles: 1 });
    state = reduceSanity(state, { type: "took-damage", now: 5_100, amount: 30 });
    expect(state.value).toBe(76);
    state = reduceSanity(state, { type: "safe-zone", now: 6_000 });
    state = reduceSanity(state, { type: "attack", now: 6_100 });
    expect(state.value).toBe(84);
  });

  it("expone consecuencias graduales por umbral", () => {
    expect(getSanityBand(100)).toBe("stable");
    expect(getSanityBand(69)).toBe("tense");
    expect(getSanityBand(39)).toBe("distorted");
    expect(getSanityBand(19)).toBe("crisis");
    expect(getSanityEffects(19).radarJitterMultiplier).toBeGreaterThan(
      getSanityEffects(80).radarJitterMultiplier,
    );
  });
});
