import { describe, expect, it } from "vitest";

import {
  activateCreatureAbility,
  cancelRegenerationOnDamage,
  consumeAbilityEffects,
  createAbilityState,
  creatureAbilities,
  getAbilityModifiers,
} from "@/lib/gameplay/abilities";
import {
  createSanityState,
  shiftSanityTimeline,
  updateSanityForPosition,
} from "@/lib/gameplay/sanity";
import {
  clampHealing,
  percentageHealing,
  updateShelterRecovery,
} from "@/lib/gameplay/survival";
import { createTileLookup, tileToWorld, type TileCell } from "@/app/play/tileMap";
import { SURVIVAL_RULES, TILE_SIZE } from "@/lib/gameplay/rules";

describe("habilidades compartidas", () => {
  it("define una habilidad activa y diferente para cada criatura", () => {
    const abilities = Object.values(creatureAbilities);
    expect(abilities).toHaveLength(5);
    expect(new Set(abilities.map((ability) => ability.id)).size).toBe(5);
    expect(creatureAbilities["cave-axolotl"].effects[0]?.kind).toBe("health-regeneration");
    expect(creatureAbilities["cave-shrimp"].effects.some((effect) => effect.kind === "move-range")).toBe(true);
    expect(creatureAbilities["blind-fish"].effects.some((effect) => effect.kind === "radar-range")).toBe(true);
    expect(creatureAbilities["blind-fish"].effects).toContainEqual({
      kind: "vision-range",
      value: 6,
    });
    expect(creatureAbilities["cave-crab"].effects.some((effect) => effect.kind === "movement-locked")).toBe(true);
    expect(creatureAbilities["cave-spider"].trap?.stunMs).toBe(1_500);
  });

  it("activa caparazón, reduce 70% y respeta cooldown", () => {
    const first = activateCreatureAbility({
      creatureId: "cave-crab",
      state: createAbilityState(),
      now: 1_000,
      actorPosition: { x: 40, y: 40 },
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(getAbilityModifiers(first.state, 2_000)).toMatchObject({
      incomingDamageMultiplier: 0.3,
      movementLocked: true,
    });
    expect(getAbilityModifiers(first.state, 3_501).movementLocked).toBe(false);
    expect(activateCreatureAbility({
      creatureId: "cave-crab",
      state: first.state,
      now: 2_000,
      actorPosition: { x: 40, y: 40 },
    })).toMatchObject({ ok: false, reason: "cooldown" });
  });

  it("crea una trampa solo dentro del rango válido", () => {
    const invalid = activateCreatureAbility({
      creatureId: "cave-spider",
      state: createAbilityState(),
      now: 1_000,
      actorPosition: { x: 40, y: 40 },
      targetPosition: { x: 280, y: 40 },
    });
    expect(invalid).toMatchObject({ ok: false, reason: "target-out-of-range" });
    const valid = activateCreatureAbility({
      creatureId: "cave-spider",
      state: createAbilityState(),
      now: 1_000,
      actorPosition: { x: 40, y: 40 },
      targetPosition: { x: 120, y: 40 },
    });
    expect(valid).toMatchObject({ ok: true, events: [{ type: "silk-trap", durationMs: 11_000, stunMs: 1_500 }] });
  });

  it("consume el impulso fantasma una sola vez", () => {
    const result = activateCreatureAbility({
      creatureId: "cave-shrimp",
      state: createAbilityState(),
      now: 1_000,
      actorPosition: { x: 40, y: 40 },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(getAbilityModifiers(result.state, 2_000).moveRangeBonusTiles).toBe(2);
    expect(getAbilityModifiers(consumeAbilityEffects(result.state, "move", 2_000), 2_000)).toMatchObject({
      moveRangeBonusTiles: 0,
      noiseMultiplier: 1,
    });
  });

  it("ecolocalización amplía la visión durante cinco segundos", () => {
    const result = activateCreatureAbility({
      creatureId: "blind-fish",
      state: createAbilityState(),
      now: 1_000,
      actorPosition: { x: 40, y: 40 },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(getAbilityModifiers(result.state, 5_999).visionRangeBonusTiles).toBe(6);
    expect(getAbilityModifiers(result.state, 6_000).visionRangeBonusTiles).toBe(0);
  });

  it("cancela regeneración solo ante daño importante", () => {
    const result = activateCreatureAbility({
      creatureId: "cave-axolotl",
      state: createAbilityState(),
      now: 1_000,
      actorPosition: { x: 40, y: 40 },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(getAbilityModifiers(cancelRegenerationOnDamage(result.state, 11, 100), 2_000).regenerationFraction).toBe(0.18);
    expect(getAbilityModifiers(cancelRegenerationOnDamage(result.state, 12, 100), 2_000).regenerationFraction).toBe(0);
  });
});

describe("sanidad posicional y supervivencia", () => {
  it("empieza feedback a 10 s y daño a 20 s por intervalos", () => {
    const initial = createSanityState(0, "1,1");
    expect(updateSanityForPosition({ state: initial, positionKey: "1,1", now: 9_999, maxHealth: 100 }).state.stage).toBe("stable");
    const warning = updateSanityForPosition({ state: initial, positionKey: "1,1", now: 10_000, maxHealth: 100 });
    expect(warning).toMatchObject({ damage: 0, state: { stage: "warning" } });
    const damaging = updateSanityForPosition({ state: warning.state, positionKey: "1,1", now: 20_000, maxHealth: 100 });
    expect(damaging).toMatchObject({ damage: 5, state: { stage: "damaging" } });
    expect(updateSanityForPosition({ state: damaging.state, positionKey: "1,1", now: 21_999, maxHealth: 100 }).damage).toBe(0);
    expect(updateSanityForPosition({ state: damaging.state, positionKey: "1,1", now: 22_000, maxHealth: 100 }).damage).toBe(5);
  });

  it("un movimiento real resetea sanidad y una pausa no suma inactividad", () => {
    const warning = updateSanityForPosition({ state: createSanityState(0, "1,1"), positionKey: "1,1", now: 12_000, maxHealth: 100 }).state;
    const moved = updateSanityForPosition({ state: warning, positionKey: "2,1", now: 12_100, maxHealth: 100 });
    expect(moved.state).toMatchObject({ stage: "stable", idleDurationMs: 0, lastPositionKey: "2,1" });
    const shifted = shiftSanityTimeline(moved.state, 30_000);
    expect(updateSanityForPosition({ state: shifted, positionKey: "2,1", now: 42_100, maxHealth: 100, paused: true }).state.stage).toBe("stable");
  });

  it("R cura 22% tras 2.8 s, se agota y nunca supera maxHealth", () => {
    const tiles: TileCell[] = [{ col: 1, row: 1, x: TILE_SIZE, y: TILE_SIZE, type: "shelter", walkable: true, zoneId: "test" }];
    const lookup = createTileLookup(tiles);
    const position = tileToWorld({ col: 1, row: 1 });
    const initial = { shelterKey: null, enteredAt: null, progress: 0 };
    const entered = updateShelterRecovery({ state: initial, position, lookup, now: 1_000, exhaustedShelters: new Set() });
    expect(entered.ready).toBe(false);
    const ready = updateShelterRecovery({ state: entered.state, position, lookup, now: 1_000 + SURVIVAL_RULES.shelter.activationMs, exhaustedShelters: new Set() });
    expect(ready.ready).toBe(true);
    expect(clampHealing(90, 100, percentageHealing(100, SURVIVAL_RULES.shelter.healFraction))).toBe(100);
    expect(updateShelterRecovery({ state: ready.state, position, lookup, now: 5_000, exhaustedShelters: new Set(["1,1"]) }).ready).toBe(false);
  });
});
