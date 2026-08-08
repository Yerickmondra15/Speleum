import { describe, expect, it } from "vitest";

import type { EnemyConfig } from "@/app/play/gameConfig";
import { TILE_SIZE } from "@/app/play/gameConfig";
import {
  createEnemyState,
  createLocalEnemyTargets,
  selectNearestReachableTarget,
  updateEnemyState,
} from "@/app/play/gameLogic";
import {
  createTileLookup,
  tileDistance,
  tileToWorld,
  worldToTile,
  type TileCell,
} from "@/app/play/tileMap";
import type { NoiseEvent } from "@/app/play/types";
import { calculateEnemyMoveCooldown } from "@/lib/gameplay/rules";

function lookupFromGrid(rows: string[]) {
  const tiles: TileCell[] = rows.flatMap((row, rowIndex) =>
    [...row].map((value, colIndex) => ({
      col: colIndex,
      row: rowIndex,
      x: colIndex * TILE_SIZE,
      y: rowIndex * TILE_SIZE,
      type: value === "#" ? ("wall" as const) : ("floor" as const),
      walkable: value !== "#",
      zoneId: "ai-test",
    })),
  );

  return createTileLookup(tiles);
}

function enemyConfig(overrides: Partial<EnemyConfig> = {}): EnemyConfig {
  return {
    id: "enemy-ai",
    name: "Eco de prueba",
    behavior: "aggressive",
    spriteCharacterId: "cave-spider",
    start: tileToWorld({ col: 0, row: 1 }),
    patrolPoints: [tileToWorld({ col: 5, row: 1 })],
    speed: 100,
    chaseSpeed: 200,
    detectionRange: TILE_SIZE * 6,
    giveUpRange: TILE_SIZE * 12,
    touchRange: TILE_SIZE,
    tetherRange: TILE_SIZE * 12,
    hp: 80,
    damage: 17,
    scoreValue: 50,
    ...overrides,
  };
}

function update(
  state: ReturnType<typeof createEnemyState>,
  config: EnemyConfig,
  now: number,
  targetCol: number | null,
  lookup = lookupFromGrid(["............", "............", "............"]),
  noises: NoiseEvent[] = [],
) {
  return updateEnemyState(
    state,
    targetCol === null
      ? []
      : [{ id: "player", position: tileToWorld({ col: targetCol, row: 1 }) }],
    config,
    0.08,
    "playing",
    noises,
    now,
    lookup,
  );
}

describe("IA autoritativa y determinista", () => {
  it("no mueve dos veces en el mismo instante", () => {
    const now = 10_000;
    const config = enemyConfig();
    const lookup = lookupFromGrid(["............", "............", "............"]);
    const initial = createEnemyState(config, now);
    const first = update(initial, config, now, 6, lookup);
    const second = update(first, config, now, 6, lookup);

    expect(worldToTile(first)).toEqual({ col: 1, row: 1 });
    expect({ x: second.x, y: second.y }).toEqual({ x: first.x, y: first.y });
    expect(second.lastMoveAt).toBe(now);
    expect(second.nextMoveAt).toBe(
      now + calculateEnemyMoveCooldown(config.chaseSpeed, config.behavior, config.id, true),
    );
  });

  it("un salto grande de reloj produce como maximo un paso, sin catch-up", () => {
    const now = 20_000;
    const config = enemyConfig({ detectionRange: TILE_SIZE * 20 });
    const lookup = lookupFromGrid(["............", "............", "............"]);
    const initial = createEnemyState(config, now);
    const first = update(initial, config, now, 10, lookup);
    const afterClockJump = update(first, config, now + 60_000, 10, lookup);

    expect(tileDistance(worldToTile(first), worldToTile(afterClockJump))).toBe(1);
    expect(worldToTile(afterClockJump)).toEqual({ col: 2, row: 1 });
    expect(afterClockJump.lastMoveAt).toBe(now + 60_000);
  });

  it("deriva cooldown de speed al patrullar y chaseSpeed al perseguir", () => {
    const now = 30_000;
    const config = enemyConfig({ speed: 80, chaseSpeed: 320 });
    const lookup = lookupFromGrid(["............", "............", "............"]);
    const patrolling = update(createEnemyState(config, now), config, now, null, lookup);
    const chasing = update(createEnemyState(config, now), config, now, 5, lookup);

    expect(patrolling.nextMoveAt - now).toBe(
      calculateEnemyMoveCooldown(config.speed, config.behavior, config.id, false),
    );
    expect(chasing.nextMoveAt - now).toBe(
      calculateEnemyMoveCooldown(config.chaseSpeed, config.behavior, config.id, true),
    );
    expect(chasing.nextMoveAt - now).toBeGreaterThanOrEqual(900);
    expect(chasing.nextMoveAt - now).toBeLessThanOrEqual(1_020);
  });

  it("congela la ultima posicion vista cuando el objetivo sale de deteccion", () => {
    const now = 40_000;
    const config = enemyConfig({ detectionRange: TILE_SIZE * 5 });
    const lookup = lookupFromGrid(["............", "............", "............"]);
    const detected = update(createEnemyState(config, now), config, now, 4, lookup);
    const outsideVision = update(detected, config, now + 1, 11, lookup);

    expect(detected.lastKnownPlayerTileKey).toBe("4,1");
    expect(outsideVision.lastKnownPlayerTileKey).toBe("4,1");
    expect(outsideVision.lastKnownPlayerTileKey).not.toBe("11,1");
    expect(outsideVision.state).toBe("investigating");
  });

  it("normaliza la muerte una vez y mantiene al enemigo inerte", () => {
    const now = 50_000;
    const config = enemyConfig();
    const initial = {
      ...createEnemyState(config, now - 1_000),
      hp: 0,
      lastKnownPlayerTileKey: "4,1",
      lastKnownTargetId: "player",
      lastHeardNoiseTileKey: "3,1",
      lastPositions: ["0,1", "1,1"],
      nextMoveAt: now + 5_000,
      nextAttackAt: now + 5_000,
    };
    const dead = update(initial, config, now, 4);
    const stillDead = update(dead, config, now + 60_000, 1);

    expect(dead).toMatchObject({
      alive: false,
      hp: 0,
      state: "dead",
      stateSince: now,
      lastKnownPlayerTileKey: null,
      lastKnownTargetId: null,
      lastHeardNoiseTileKey: null,
      lastPositions: [],
      nextMoveAt: 0,
      nextAttackAt: 0,
    });
    expect(stillDead).toEqual(dead);
  });

  it("oye ruido reciente y avanza a investigarlo", () => {
    const now = 60_000;
    const config = enemyConfig();
    const lookup = lookupFromGrid(["............", "............", "............"]);
    const noise: NoiseEvent = {
      id: "noise:test",
      type: "attack",
      sourceId: "player",
      position: tileToWorld({ col: 2, row: 1 }),
      radiusTiles: 10,
      intensity: 1.2,
      createdAt: now,
    };
    const investigating = update(
      createEnemyState(config, now),
      config,
      now,
      null,
      lookup,
      [noise],
    );

    expect(investigating.state).toBe("investigating");
    expect(investigating.lastHeardNoiseTileKey).toBe("2,1");
    expect(investigating.lastKnownPlayerTileKey).toBe("2,1");
    expect(worldToTile(investigating)).toEqual({ col: 1, row: 1 });
  });

  it("elige un unico objetivo alcanzable con desempate estable por id", () => {
    const lookup = lookupFromGrid([".....", ".....", "....."]);
    const origin = tileToWorld({ col: 2, row: 1 });
    const selected = selectNearestReachableTarget(
      origin,
      [
        { id: "z-target", position: tileToWorld({ col: 1, row: 1 }) },
        { id: "a-target", position: tileToWorld({ col: 3, row: 1 }) },
        { id: "closer-but-blocked", position: tileToWorld({ col: 4, row: 1 }) },
      ],
      1,
      lookup,
    );

    expect(selected?.id).toBe("a-target");
  });

  it("offline solo entrega al jugador humano como objetivo, nunca otra IA", () => {
    expect(createLocalEnemyTargets(tileToWorld({ col: 2, row: 1 }))).toEqual([
      { id: "player", position: tileToWorld({ col: 2, row: 1 }), alive: true },
    ]);
  });

  it("respeta paredes y nunca atraviesa más de una celda", () => {
    const now = 80_000;
    const config = enemyConfig({ detectionRange: TILE_SIZE * 20 });
    const lookup = lookupFromGrid(["............", ".#..........", "............"]);
    const initial = createEnemyState(config, now);
    const moved = update(initial, config, now, 5, lookup);
    expect(worldToTile(moved)).not.toEqual({ col: 1, row: 1 });
    expect(tileDistance(worldToTile(initial), worldToTile(moved))).toBe(1);
  });
});
