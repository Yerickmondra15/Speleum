import { describe, expect, it } from "vitest";

import {
  applyDamage,
  calculateMoveCooldown,
  canTakeTurn,
  isAttackReachableByTiles,
  hitHazard,
  planMovementPath,
  resolveCombatHit,
  resolveMissedParry,
} from "@/app/play/gameLogic";
import {
  buildPathToTile,
  createTileLookup,
  isTileVisible,
  tileToWorld,
  worldToTile,
  type TileCell,
} from "@/app/play/tileMap";
import { STUN_DURATION_MS, TILE_SIZE, TILE_VISION_RADIUS } from "@/app/play/gameConfig";

function lookupFromGrid(rows: string[]) {
  const tiles: TileCell[] = rows.flatMap((row, rowIndex) =>
    [...row].map((value, colIndex) => ({
      col: colIndex,
      row: rowIndex,
      x: colIndex * TILE_SIZE,
      y: rowIndex * TILE_SIZE,
      type: value === "#" ? ("wall" as const) : ("floor" as const),
      walkable: value !== "#",
      zoneId: "test",
    })),
  );
  return createTileLookup(tiles);
}

describe("mecanicas tacticas", () => {
  it("convierte coordenadas de mundo a tiles y vuelve al centro", () => {
    expect(worldToTile({ x: 165, y: 241 })).toEqual({ col: 2, row: 3 });
    expect(tileToWorld({ col: 2, row: 3 })).toEqual({ x: 200, y: 280 });
  });

  it("encuentra una ruta caminable dentro del rango", () => {
    const lookup = lookupFromGrid([".....", ".....", "....."]);
    const path = buildPathToTile({ col: 0, row: 1 }, { col: 3, row: 1 }, 4, lookup);
    expect(path?.at(0)).toEqual({ col: 0, row: 1 });
    expect(path?.at(-1)).toEqual({ col: 3, row: 1 });
    expect(path).toHaveLength(4);
  });

  it("rechaza rutas bloqueadas", () => {
    const lookup = lookupFromGrid([".#.", ".#.", ".#."]);
    expect(buildPathToTile({ col: 0, row: 1 }, { col: 2, row: 1 }, 6, lookup)).toBeNull();
    expect(
      planMovementPath(tileToWorld({ col: 0, row: 1 }), tileToWorld({ col: 2, row: 1 }), 6, lookup),
    ).toBeNull();
  });

  it("limita el ataque por distancia y por paredes", () => {
    const open = lookupFromGrid(["....."]);
    const blocked = lookupFromGrid([".#..."]);
    const origin = tileToWorld({ col: 0, row: 0 });
    expect(isAttackReachableByTiles(origin, tileToWorld({ col: 3, row: 0 }), 3, open)).toBe(true);
    expect(isAttackReachableByTiles(origin, tileToWorld({ col: 4, row: 0 }), 3, open)).toBe(false);
    expect(isAttackReachableByTiles(origin, tileToWorld({ col: 2, row: 0 }), 3, blocked)).toBe(false);
  });

  it("limita la vision por radio de tiles", () => {
    expect(isTileVisible({ col: 10, row: 10 }, { col: 10 + TILE_VISION_RADIUS, row: 10 })).toBe(true);
    expect(isTileVisible({ col: 10, row: 10 }, { col: 11 + TILE_VISION_RADIUS, row: 10 })).toBe(false);
  });

  it("aplica dano sin producir vida negativa", () => {
    expect(applyDamage(100, 18)).toBe(82);
    expect(applyDamage(10, 30)).toBe(0);
  });

  it("el parry evita dano y aturde al atacante", () => {
    const result = resolveCombatHit({
      targetHealth: 100,
      damage: 30,
      now: 1_000,
      targetParryUntil: 1_500,
      stunDurationMs: 700,
    });
    expect(result).toMatchObject({ nextHealth: 100, damageApplied: 0, wasParried: true });
    expect(result.attackerStunnedUntil).toBe(1_700);
  });

  it("stun impide turnos solo durante su ventana", () => {
    expect(canTakeTurn({ now: 1_000, stunnedUntil: 1_001 })).toBe(false);
    expect(canTakeTurn({ now: 1_001, stunnedUntil: 1_001 })).toBe(true);
    expect(canTakeTurn({ now: 1_001, alive: false })).toBe(false);
  });

  it("calcula cooldowns acotados y ajustables", () => {
    expect(calculateMoveCooldown(0)).toBe(0);
    expect(calculateMoveCooldown(1)).toBeGreaterThanOrEqual(1_000);
    expect(calculateMoveCooldown(3, 0.5)).toBeLessThan(calculateMoveCooldown(3, 1));
    expect(calculateMoveCooldown(100)).toBe(7_000);
  });

  it("el stun de parry dura 2.4 s y un bloqueo fallido aturde al defensor", () => {
    const successful = resolveCombatHit({
      targetHealth: 100,
      damage: 30,
      now: 1_000,
      targetParryUntil: 1_500,
    });
    expect(successful.attackerStunnedUntil).toBe(1_000 + STUN_DURATION_MS);
    expect(successful.nextParryUntil).toBe(0);

    expect(resolveMissedParry({ parryUntil: 1_500, now: 1_499 })).toMatchObject({
      missed: false,
      nextStunnedUntil: 0,
    });
    expect(resolveMissedParry({ parryUntil: 1_500, now: 1_500 })).toMatchObject({
      missed: true,
      nextParryUntil: 0,
      nextStunnedUntil: 2_900,
    });
  });

  it("H sigue siendo letal y W solo ralentiza el movimiento", () => {
    const hazard = { id: "H", label: "letal", x: 80, y: 0, width: 80, height: 80 };
    expect(hitHazard(tileToWorld({ col: 1, row: 0 }), [hazard])).toBe(true);

    const floorLookup = lookupFromGrid(["..."]);
    const waterLookup = createTileLookup([
      { col: 0, row: 0, x: 0, y: 0, type: "floor", walkable: true, zoneId: "test" },
      { col: 1, row: 0, x: 80, y: 0, type: "water", walkable: true, zoneId: "test" },
      { col: 2, row: 0, x: 160, y: 0, type: "floor", walkable: true, zoneId: "test" },
    ]);
    const floorMove = planMovementPath(tileToWorld({ col: 0, row: 0 }), tileToWorld({ col: 2, row: 0 }), 3, floorLookup)!;
    const waterMove = planMovementPath(tileToWorld({ col: 0, row: 0 }), tileToWorld({ col: 2, row: 0 }), 3, waterLookup)!;
    expect(waterMove.cooldownMs).toBeGreaterThan(floorMove.cooldownMs);
  });
});
