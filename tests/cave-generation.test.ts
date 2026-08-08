import { describe, expect, it } from "vitest";

import {
  CAVE_ROOM_TEMPLATES,
  createCaveLayout,
  validateCaveLayout,
  type CaveEntranceSide,
  type CaveRoomTemplate,
} from "@/app/play/proceduralCave";
import { pickSeparatedSpawns } from "@/app/play/gameLogic";
import { TILE_SIZE } from "@/app/play/gameConfig";
import {
  buildTileMap,
  createTileLookup,
  getTileAt,
  getTileNeighbors,
  tileDistance,
  worldToTile,
} from "@/app/play/tileMap";

function entranceCoordinate(
  template: CaveRoomTemplate,
  side: CaveEntranceSide,
  offset: number,
) {
  switch (side) {
    case "left":
      return { col: 0, row: offset };
    case "right":
      return { col: template.width - 1, row: offset };
    case "top":
      return { col: offset, row: 0 };
    case "bottom":
      return { col: offset, row: template.height - 1 };
  }
}

function countConnectedTemplateTiles(template: CaveRoomTemplate) {
  const firstEntrance = template.entrances[0]!;
  const start = entranceCoordinate(
    template,
    firstEntrance.side,
    firstEntrance.offset,
  );
  const queue = [start];
  const visited = new Set<string>();

  for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
    const current = queue[queueIndex]!;
    const key = `${current.col},${current.row}`;

    if (
      visited.has(key) ||
      current.col < 0 ||
      current.col >= template.width ||
      current.row < 0 ||
      current.row >= template.height ||
      template.tiles[current.row]?.[current.col] === "#"
    ) {
      continue;
    }

    visited.add(key);
    queue.push(
      { col: current.col + 1, row: current.row },
      { col: current.col - 1, row: current.row },
      { col: current.col, row: current.row + 1 },
      { col: current.col, row: current.row - 1 },
    );
  }

  return visited.size;
}

function tileCharacter(layout: ReturnType<typeof createCaveLayout>, x: number, y: number) {
  return layout.tileRows[Math.floor(y / TILE_SIZE)]?.[Math.floor(x / TILE_SIZE)];
}

describe("generacion de cuevas", () => {
  it("mantiene conectadas todas las plantillas y sus entradas tras rotarlas", () => {
    for (const template of CAVE_ROOM_TEMPLATES) {
      expect(template.tiles, template.id).toHaveLength(template.height);
      expect(
        template.tiles.every((row) => row.length === template.width),
        template.id,
      ).toBe(true);

      for (const entrance of template.entrances) {
        const tile = entranceCoordinate(template, entrance.side, entrance.offset);
        expect(template.tiles[tile.row]?.[tile.col], `${template.id} ${entrance.side}`).not.toBe(
          "#",
        );
      }

      const openTiles = template.tiles.reduce(
        (total, row) => total + [...row].filter((char) => char !== "#").length,
        0,
      );
      expect(countConnectedTemplateTiles(template), template.id).toBe(openTiles);
      expect(template.entrances.length, template.id).toBeGreaterThanOrEqual(4);
    }
  });

  it("mantiene accesibles todos los tiles seguros sin obligar a cruzar H", () => {
    for (let index = 0; index < 32; index += 1) {
      const layout = createCaveLayout(`safe-route-${index}`);
      const lookup = createTileLookup(buildTileMap(layout));
      const queue = [worldToTile(layout.startPosition)];
      const visited = new Set<string>();

      for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
        const tile = queue[queueIndex]!;
        const key = `${tile.col},${tile.row}`;
        if (visited.has(key)) continue;
        const cell = getTileAt(tile, lookup);
        if (!cell?.walkable || cell.type === "hazard") continue;
        visited.add(key);
        queue.push(...getTileNeighbors(tile));
      }

      const safeTiles = lookup.tiles.filter(
        (tile) => tile.walkable && tile.type !== "hazard",
      );
      expect(visited.size, layout.seed).toBe(safeTiles.length);
    }
  });

  it("reproduce todo el layout para la misma semilla", () => {
    const first = createCaveLayout("academic-seed-42");
    const second = createCaveLayout("academic-seed-42");

    expect(second).toEqual(first);
  });

  it("genera mapas procedurales validos y variados para muchas semillas", () => {
    const layouts = Array.from({ length: 64 }, (_, index) =>
      createCaveLayout(`generation-matrix-${index}`),
    );
    const geometries = new Set(layouts.map((layout) => layout.tileRows.join("\n")));

    expect(layouts.every((layout) => layout.source === "procedural")).toBe(true);
    expect(geometries.size).toBeGreaterThanOrEqual(60);

    for (const layout of layouts) {
      const validation = validateCaveLayout(layout);

      expect(validation.issues, layout.seed).toEqual([]);
      expect(validation.connectedOpenTiles, layout.seed).toBe(validation.openTiles);
      expect(layout.multiplayerSpawnPositions, layout.seed).toHaveLength(6);
      expect(
        layout.templatesUsed.some((templateId) => templateId.startsWith("spider-nest")),
        layout.seed,
      ).toBe(true);
      expect(
        layout.templatesUsed.some((templateId) => templateId.startsWith("combat-chamber")),
        layout.seed,
      ).toBe(true);

      const enemyIds = new Set(layout.enemyConfigs.map((enemy) => enemy.id));
      expect(enemyIds.size, layout.seed).toBe(layout.enemyConfigs.length);

      for (const enemy of layout.enemyConfigs) {
        expect(enemy.id).toMatch(/^section-\d+-/);
        expect(tileCharacter(layout, enemy.start.x, enemy.start.y)).not.toMatch(/[#HW]/);
        expect(enemy.patrolPoints).toHaveLength(4);

        const patrolTiles = new Set(
          enemy.patrolPoints.map(
            (point) => `${Math.floor(point.x / TILE_SIZE)},${Math.floor(point.y / TILE_SIZE)}`,
          ),
        );
        expect(patrolTiles.size, enemy.id).toBe(enemy.patrolPoints.length);

        for (const patrolPoint of enemy.patrolPoints) {
          expect(tileCharacter(layout, patrolPoint.x, patrolPoint.y)).not.toMatch(/[#HW]/);
        }
      }
    }
  });

  it("detecta incluso una sola isla abierta fuera del componente inicial", () => {
    const layout = createCaveLayout("strict-connectivity");
    const mutableRows = layout.tileRows.map((row) => [...row]);
    let isolatedTile: { col: number; row: number } | null = null;

    for (let row = 2; row < mutableRows.length - 2 && !isolatedTile; row += 1) {
      for (let col = 2; col < mutableRows[row]!.length - 2; col += 1) {
        if (
          mutableRows[row]?.[col] === "#" &&
          mutableRows[row - 1]?.[col] === "#" &&
          mutableRows[row + 1]?.[col] === "#" &&
          mutableRows[row]?.[col - 1] === "#" &&
          mutableRows[row]?.[col + 1] === "#"
        ) {
          isolatedTile = { col, row };
          break;
        }
      }
    }

    expect(isolatedTile).not.toBeNull();
    mutableRows[isolatedTile!.row]![isolatedTile!.col] = ".";
    const validation = validateCaveLayout({
      ...layout,
      tileRows: mutableRows.map((row) => row.join("")),
    });

    expect(validation.isConnected).toBe(false);
    expect(validation.connectedOpenTiles).toBe(validation.openTiles - 1);
  });

  it("selecciona spawns separados y caminables", () => {
    const layout = createCaveLayout("spawn-separation");
    const lookup = createTileLookup(buildTileMap(layout));
    const spawns = pickSeparatedSpawns(layout, lookup, 4, 4);

    expect(spawns).toHaveLength(4);

    for (let left = 0; left < spawns.length; left += 1) {
      for (let right = left + 1; right < spawns.length; right += 1) {
        expect(
          tileDistance(worldToTile(spawns[left]!), worldToTile(spawns[right]!)),
        ).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it("conserva significado mecánico distinto para H, W, R, N y S", () => {
    const layout = createCaveLayout("tile-semantics");
    const rows = layout.tileRows.map((row) => [...row]);
    ["H", "W", "R", "N", "S"].forEach((char, index) => {
      rows[1]![index + 1] = char;
    });
    const lookup = createTileLookup(buildTileMap({ ...layout, tileRows: rows.map((row) => row.join("")) }));
    expect(getTileAt({ col: 1, row: 1 }, lookup)).toMatchObject({ type: "hazard", walkable: true });
    expect(getTileAt({ col: 2, row: 1 }, lookup)).toMatchObject({ type: "water", walkable: true });
    expect(getTileAt({ col: 3, row: 1 }, lookup)).toMatchObject({ type: "shelter", walkable: true });
    expect(getTileAt({ col: 4, row: 1 }, lookup)).toMatchObject({ type: "nest", walkable: true });
    expect(getTileAt({ col: 5, row: 1 }, lookup)).toMatchObject({ type: "spawn", walkable: true });
  });

  it("elige conjuntos reproducibles pero diferentes por partida", () => {
    const layout = createCaveLayout("spawn-randomization");
    const lookup = createTileLookup(buildTileMap(layout));
    const first = pickSeparatedSpawns(layout, lookup, 4, 4, "match-a");
    const repeated = pickSeparatedSpawns(layout, lookup, 4, 4, "match-a");
    const second = pickSeparatedSpawns(layout, lookup, 4, 4, "match-b");
    expect(repeated).toEqual(first);
    expect(second).not.toEqual(first);
    for (const spawn of [...first, ...second]) {
      const cell = getTileAt(worldToTile(spawn), lookup);
      expect(cell?.walkable).toBe(true);
      expect(["wall", "obstacle", "hazard"]).not.toContain(cell?.type);
    }
  });

  it("encuentra seis spawns con separación mínima para una sala llena", () => {
    for (let index = 0; index < 24; index += 1) {
      const layout = createCaveLayout(`full-room-spawns-${index}`);
      const lookup = createTileLookup(buildTileMap(layout));
      const spawns = pickSeparatedSpawns(layout, lookup, 6, 6, `match-${index}`);
      expect(spawns, layout.seed).toHaveLength(6);
      for (let left = 0; left < spawns.length; left += 1) {
        for (let right = left + 1; right < spawns.length; right += 1) {
          expect(tileDistance(worldToTile(spawns[left]!), worldToTile(spawns[right]!))).toBeGreaterThanOrEqual(6);
        }
      }
    }
  });
});
