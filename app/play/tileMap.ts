import type {
  HazardArea,
  PlayerPosition,
  Rect,
  TileCoordinate,
  Zone,
} from "./gameConfig";
import {
  MAP_COLS,
  MAP_ROWS,
  PLAYER_MOVE_RANGE_TILES,
  RADAR_SIGNAL_RANGE_TILES,
  TILE_SIZE,
  TILE_VISION_RADIUS,
  caveWalls,
  caveZones,
  goalArea,
  hazardAreas,
  multiplayerSpawnPositions,
  startPosition,
} from "./gameConfig";

export type TileType =
  | "floor"
  | "wall"
  | "obstacle"
  | "hazard"
  | "spawn"
  | "goal"
  | "dark";

export type TileCell = {
  col: number;
  row: number;
  x: number;
  y: number;
  type: TileType;
  walkable: boolean;
  zoneId: string;
};

function rectContainsTileCenter(rect: Rect, col: number, row: number) {
  const centerX = col * TILE_SIZE + TILE_SIZE / 2;
  const centerY = row * TILE_SIZE + TILE_SIZE / 2;

  return (
    centerX >= rect.x &&
    centerX <= rect.x + rect.width &&
    centerY >= rect.y &&
    centerY <= rect.y + rect.height
  );
}

function zoneForTile(col: number, row: number, zones: Zone[]) {
  return zones.find((zone) => rectContainsTileCenter(zone, col, row)) ?? zones[0];
}

function worldToTile(position: PlayerPosition): TileCoordinate {
  return {
    col: Math.max(0, Math.min(MAP_COLS - 1, Math.floor(position.x / TILE_SIZE))),
    row: Math.max(0, Math.min(MAP_ROWS - 1, Math.floor(position.y / TILE_SIZE))),
  };
}

function tileToWorld(tile: TileCoordinate): PlayerPosition {
  return {
    x: tile.col * TILE_SIZE + TILE_SIZE / 2,
    y: tile.row * TILE_SIZE + TILE_SIZE / 2,
  };
}

function isBoundaryWall(wallId: string) {
  return wallId === "north" || wallId === "south" || wallId === "west" || wallId === "east";
}

function tileTypeForCoordinate(
  col: number,
  row: number,
  walls: Rect[],
  hazards: HazardArea[],
) {
  const wall = walls.find((entry) => rectContainsTileCenter(entry, col, row));

  if (wall) {
    return isBoundaryWall(wall.id) ? "wall" : "obstacle";
  }

  if (rectContainsTileCenter(goalArea, col, row)) {
    return "goal";
  }

  if (hazards.some((hazard) => rectContainsTileCenter(hazard, col, row))) {
    return "hazard";
  }

  const tile = { col, row };
  const spawnTiles = [startPosition, ...multiplayerSpawnPositions].map(worldToTile);

  if (spawnTiles.some((spawnTile) => spawnTile.col === tile.col && spawnTile.row === tile.row)) {
    return "spawn";
  }

  return "floor";
}

export const tileMap: TileCell[] = Array.from({ length: MAP_ROWS * MAP_COLS }, (_, index) => {
  const col = index % MAP_COLS;
  const row = Math.floor(index / MAP_COLS);
  const zone = zoneForTile(col, row, caveZones);
  const type = tileTypeForCoordinate(col, row, caveWalls, hazardAreas);

  return {
    col,
    row,
    x: col * TILE_SIZE,
    y: row * TILE_SIZE,
    type,
    walkable: type !== "wall" && type !== "obstacle",
    zoneId: zone.id,
  };
});

export const tileMapByKey = new Map(
  tileMap.map((tile) => [`${tile.col},${tile.row}`, tile] as const),
);

export function getTileAt(tile: TileCoordinate) {
  return tileMapByKey.get(`${tile.col},${tile.row}`) ?? null;
}

export function getZoneAtTile(tile: TileCoordinate, zones = caveZones) {
  return zoneForTile(tile.col, tile.row, zones);
}

export function getTileNeighbors(tile: TileCoordinate) {
  const neighbors: TileCoordinate[] = [
    { col: tile.col + 1, row: tile.row },
    { col: tile.col - 1, row: tile.row },
    { col: tile.col, row: tile.row + 1 },
    { col: tile.col, row: tile.row - 1 },
  ];

  return neighbors.filter(
    (entry) =>
      entry.col >= 0 &&
      entry.col < MAP_COLS &&
      entry.row >= 0 &&
      entry.row < MAP_ROWS,
  );
}

export function isWalkableTile(tile: TileCoordinate) {
  return getTileAt(tile)?.walkable ?? false;
}

export function clampTile(tile: TileCoordinate): TileCoordinate {
  return {
    col: Math.max(0, Math.min(MAP_COLS - 1, tile.col)),
    row: Math.max(0, Math.min(MAP_ROWS - 1, tile.row)),
  };
}

export function tileDistance(a: TileCoordinate, b: TileCoordinate) {
  return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));
}

export function manhattanDistance(a: TileCoordinate, b: TileCoordinate) {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

export function isTileVisible(origin: TileCoordinate, target: TileCoordinate) {
  return tileDistance(origin, target) <= TILE_VISION_RADIUS;
}

export function stepTowardTile(from: TileCoordinate, target: TileCoordinate) {
  const candidates = getTileNeighbors(from)
    .filter(isWalkableTile)
    .sort((a, b) => manhattanDistance(a, target) - manhattanDistance(b, target));

  return candidates[0] ?? from;
}

function radarJitter(seed: number) {
  const normalized = Math.sin(seed * 12.9898) * 43758.5453;
  return normalized - Math.floor(normalized);
}

export function approximateRadarPosition(
  origin: TileCoordinate,
  target: TileCoordinate,
  jitterTiles = 0,
  seed = 0,
) {
  const deltaCol = Math.max(
    -RADAR_SIGNAL_RANGE_TILES,
    Math.min(RADAR_SIGNAL_RANGE_TILES, target.col - origin.col),
  );
  const deltaRow = Math.max(
    -RADAR_SIGNAL_RANGE_TILES,
    Math.min(RADAR_SIGNAL_RANGE_TILES, target.row - origin.row),
  );
  const offsetX = (radarJitter(seed + target.col) - 0.5) * jitterTiles;
  const offsetY = (radarJitter(seed + target.row + 99) - 0.5) * jitterTiles;

  const normalizedX =
    50 + ((deltaCol + offsetX) / RADAR_SIGNAL_RANGE_TILES) * 34;
  const normalizedY =
    50 + ((deltaRow + offsetY) / RADAR_SIGNAL_RANGE_TILES) * 34;

  return {
    left: `${Math.round(normalizedX / 4) * 4}%`,
    top: `${Math.round(normalizedY / 4) * 4}%`,
  };
}

export function findReachableTiles(
  origin: TileCoordinate,
  maxSteps = PLAYER_MOVE_RANGE_TILES,
) {
  const visited = new Map<string, { tile: TileCoordinate; distance: number }>();
  const queue: Array<{ tile: TileCoordinate; distance: number }> = [
    { tile: origin, distance: 0 },
  ];

  visited.set(`${origin.col},${origin.row}`, { tile: origin, distance: 0 });

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current) {
      break;
    }

    if (current.distance >= maxSteps) {
      continue;
    }

    for (const neighbor of getTileNeighbors(current.tile)) {
      const key = `${neighbor.col},${neighbor.row}`;

      if (visited.has(key) || !isWalkableTile(neighbor)) {
        continue;
      }

      const next = { tile: neighbor, distance: current.distance + 1 };
      visited.set(key, next);
      queue.push(next);
    }
  }

  return visited;
}

export function buildPathToTile(
  origin: TileCoordinate,
  target: TileCoordinate,
  maxSteps = PLAYER_MOVE_RANGE_TILES,
) {
  const parents = new Map<string, string | null>();
  const queue: Array<{ tile: TileCoordinate; distance: number }> = [
    { tile: origin, distance: 0 },
  ];
  const originKey = `${origin.col},${origin.row}`;
  const targetKey = `${target.col},${target.row}`;

  parents.set(originKey, null);

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current) {
      break;
    }

    const currentKey = `${current.tile.col},${current.tile.row}`;

    if (currentKey === targetKey) {
      const path: TileCoordinate[] = [];
      let walkKey: string | null = currentKey;

      while (walkKey) {
        const [col, row] = walkKey.split(",").map(Number);
        path.unshift({ col, row });
        walkKey = parents.get(walkKey) ?? null;
      }

      return path;
    }

    if (current.distance >= maxSteps) {
      continue;
    }

    for (const neighbor of getTileNeighbors(current.tile)) {
      const neighborKey = `${neighbor.col},${neighbor.row}`;

      if (parents.has(neighborKey) || !isWalkableTile(neighbor)) {
        continue;
      }

      parents.set(neighborKey, currentKey);
      queue.push({ tile: neighbor, distance: current.distance + 1 });
    }
  }

  return null;
}

export { worldToTile, tileToWorld };
