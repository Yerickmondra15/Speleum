import type {
  EnemyBehaviorType,
  EnemyConfig,
  GoalArea,
  HazardArea,
  PlayerPosition,
  PointOfInterest,
  RadarSignalStrength,
  Rect,
  Zone,
} from "./gameConfig";
import {
  MAP_COLS,
  MAP_ROWS,
  TILE_SIZE,
  caveWalls,
  caveZones,
  goalArea,
  hazardAreas,
  multiplayerSpawnPositions,
  pointsOfInterest,
  stalkerConfigs,
  startPosition,
} from "./gameConfig";

export type CaveRoomTemplateType =
  | "start"
  | "tunnel"
  | "nest"
  | "wet"
  | "water"
  | "danger"
  | "combat"
  | "broken"
  | "shelter";

export type CaveEntranceSide = "left" | "right" | "top" | "bottom";

export type CaveRoomEntrance = {
  side: CaveEntranceSide;
  offset: number;
};

export type CaveRoomSpawnRule = {
  behavior: EnemyBehaviorType;
  localCol: number;
  localRow: number;
  strength: number;
  territoryRadiusTiles?: number;
  hearingBias?: RadarSignalStrength;
};

export type CaveRoomTemplate = {
  id: string;
  type: CaveRoomTemplateType;
  zoneTone: Zone["tone"];
  width: number;
  height: number;
  tiles: string[];
  entrances: CaveRoomEntrance[];
  dangerLevel: number;
  weight: number;
  minDistanceFromSpawn?: number;
  canSpawnCreatures: boolean;
  spawnRules?: CaveRoomSpawnRule[];
  pointOfInterestLabel?: string;
};

export type CaveLayout = {
  seed: string;
  source: "procedural" | "fallback";
  fallbackReason?: string | null;
  tileRows: string[];
  zones: Zone[];
  walls: Rect[];
  hazardAreas: HazardArea[];
  goalArea: GoalArea | null;
  startPosition: PlayerPosition;
  multiplayerSpawnPositions: PlayerPosition[];
  enemyConfigs: EnemyConfig[];
  pointsOfInterest: PointOfInterest[];
  templatesUsed: string[];
};

type TemplatePlacement = {
  template: CaveRoomTemplate;
  id: string;
  originCol: number;
  originRow: number;
};

type Frontier = {
  col: number;
  row: number;
  side: CaveEntranceSide;
  sourcePlacementId: string;
};

const WALL_TILE = "#";
const HAZARD_TILE = "H";
const WATER_TILE = "W";
const SPAWN_TILE = "S";
const NEST_TILE = "N";
const SHELTER_TILE = "R";

function mulberry32(seed: number) {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(seed: string) {
  let value = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    value ^= seed.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }

  return value >>> 0;
}

function oppositeSide(side: CaveEntranceSide): CaveEntranceSide {
  switch (side) {
    case "left":
      return "right";
    case "right":
      return "left";
    case "top":
      return "bottom";
    case "bottom":
      return "top";
  }
}

function sideVector(side: CaveEntranceSide) {
  switch (side) {
    case "left":
      return { col: -1, row: 0 };
    case "right":
      return { col: 1, row: 0 };
    case "top":
      return { col: 0, row: -1 };
    case "bottom":
      return { col: 0, row: 1 };
  }
}

function rotateClockwise(rows: string[]) {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const next: string[] = [];

  for (let col = 0; col < width; col += 1) {
    let rowText = "";

    for (let row = height - 1; row >= 0; row -= 1) {
      rowText += rows[row]?.[col] ?? WALL_TILE;
    }

    next.push(rowText);
  }

  return next;
}

function rotateEntrance(
  entrance: CaveRoomEntrance,
  width: number,
  height: number,
): CaveRoomEntrance {
  switch (entrance.side) {
    case "top":
      return { side: "right", offset: entrance.offset };
    case "right":
      return { side: "bottom", offset: height - 1 - entrance.offset };
    case "bottom":
      return { side: "left", offset: entrance.offset };
    case "left":
      return { side: "top", offset: height - 1 - entrance.offset };
  }
}

function rotateSpawnRule(
  spawnRule: CaveRoomSpawnRule,
  width: number,
  height: number,
): CaveRoomSpawnRule {
  return {
    ...spawnRule,
    localCol: height - 1 - spawnRule.localRow,
    localRow: spawnRule.localCol,
    territoryRadiusTiles: spawnRule.territoryRadiusTiles,
  };
}

function rotateTemplate(base: CaveRoomTemplate, turns: number): CaveRoomTemplate {
  let tiles = [...base.tiles];
  let width = base.width;
  let height = base.height;
  let entrances = [...base.entrances];
  let spawnRules = base.spawnRules ? [...base.spawnRules] : undefined;

  for (let turn = 0; turn < turns; turn += 1) {
    const previousWidth = width;
    const previousHeight = height;
    tiles = rotateClockwise(tiles);
    entrances = entrances.map((entry) => rotateEntrance(entry, previousWidth, previousHeight));
    spawnRules = spawnRules?.map((rule) => rotateSpawnRule(rule, previousWidth, previousHeight));
    width = previousHeight;
    height = previousWidth;
  }

  return {
    ...base,
    id: turns === 0 ? base.id : `${base.id}-r${turns}`,
    width,
    height,
    tiles,
    entrances,
    spawnRules,
  };
}

function expandTemplateRotations(
  template: CaveRoomTemplate,
  includeQuarterTurns = true,
) {
  const entries = [template];

  if (!includeQuarterTurns) {
    return entries;
  }

  for (let turns = 1; turns <= 3; turns += 1) {
    entries.push(rotateTemplate(template, turns));
  }

  return entries;
}

function weightedPick<T extends { weight: number }>(
  random: () => number,
  items: T[],
) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  const threshold = random() * total;
  let cursor = 0;

  for (const item of items) {
    cursor += item.weight;

    if (cursor >= threshold) {
      return item;
    }
  }

  return items[items.length - 1];
}

function weightedOrder<T extends { weight: number }>(
  random: () => number,
  items: T[],
) {
  const pool = [...items];
  const ordered: T[] = [];

  while (pool.length > 0) {
    const picked = weightedPick(random, pool);

    if (!picked) {
      break;
    }

    ordered.push(picked);
    pool.splice(pool.indexOf(picked), 1);
  }

  return ordered;
}

function shuffled<T>(random: () => number, items: T[]) {
  const entries = [...items];

  for (let index = entries.length - 1; index > 0; index -= 1) {
    const otherIndex = Math.floor(random() * (index + 1));
    [entries[index], entries[otherIndex]] = [entries[otherIndex]!, entries[index]!];
  }

  return entries;
}

const baseTemplates: CaveRoomTemplate[] = [
  {
    id: "start-refuge",
    type: "start",
    zoneTone: "safe",
    width: 11,
    height: 9,
    tiles: [
      "#####.#####",
      "#..R...S..#",
      "#.S.....S.#",
      "#.........#",
      "...........",
      "#..###....#",
      "#....###..#",
      "#..S...R..#",
      "#####.#####",
    ],
    entrances: [
      { side: "left", offset: 4 },
      { side: "right", offset: 4 },
      { side: "top", offset: 5 },
      { side: "bottom", offset: 5 },
    ],
    dangerLevel: 0,
    weight: 1,
    canSpawnCreatures: false,
    pointOfInterestLabel: "refugio inicial",
  },
  {
    id: "narrow-tunnel",
    type: "tunnel",
    zoneTone: "tunnels",
    width: 9,
    height: 5,
    tiles: [
      "####.####",
      "##.....##",
      ".........",
      "##.....##",
      "####.####",
    ],
    entrances: [
      { side: "left", offset: 2 },
      { side: "right", offset: 2 },
      { side: "top", offset: 4 },
      { side: "bottom", offset: 4 },
    ],
    dangerLevel: 1,
    weight: 8,
    canSpawnCreatures: false,
    pointOfInterestLabel: "tunel estrecho",
  },
  {
    id: "wide-tunnel",
    type: "tunnel",
    zoneTone: "tunnels",
    width: 11,
    height: 7,
    tiles: [
      "#####.#####",
      "###.....###",
      "##.......##",
      "...........",
      "##.......##",
      "###.....###",
      "#####.#####",
    ],
    entrances: [
      { side: "left", offset: 3 },
      { side: "right", offset: 3 },
      { side: "top", offset: 5 },
      { side: "bottom", offset: 5 },
    ],
    dangerLevel: 1,
    weight: 6,
    canSpawnCreatures: false,
    pointOfInterestLabel: "tunel ancho",
  },
  {
    id: "spider-nest",
    type: "nest",
    zoneTone: "danger",
    width: 9,
    height: 7,
    tiles: [
      "####.####",
      "#.......#",
      "....N....",
      "#..###..#",
      "#.......#",
      "#..###..#",
      "##.######",
    ],
    entrances: [
      { side: "left", offset: 2 },
      { side: "right", offset: 2 },
      { side: "top", offset: 4 },
      { side: "bottom", offset: 2 },
    ],
    dangerLevel: 3,
    weight: 3,
    minDistanceFromSpawn: 8,
    canSpawnCreatures: true,
    spawnRules: [
      {
        behavior: "territorial",
        localCol: 4,
        localRow: 2,
        strength: 3,
        territoryRadiusTiles: 5,
        hearingBias: "medium",
      },
      {
        behavior: "ambusher",
        localCol: 2,
        localRow: 4,
        strength: 2,
        territoryRadiusTiles: 4,
        hearingBias: "low",
      },
    ],
    pointOfInterestLabel: "nido de arana",
  },
  {
    id: "wet-chamber",
    type: "wet",
    zoneTone: "safe",
    width: 9,
    height: 7,
    tiles: [
      "####.####",
      "#..WWW..#",
      "#.W...W.#",
      "....W....",
      "#.W...W.#",
      "#..WWW..#",
      "####.####",
    ],
    entrances: [
      { side: "left", offset: 3 },
      { side: "right", offset: 3 },
      { side: "top", offset: 4 },
      { side: "bottom", offset: 4 },
    ],
    dangerLevel: 1,
    weight: 3,
    canSpawnCreatures: false,
    pointOfInterestLabel: "camara humeda",
  },
  {
    id: "water-pocket",
    type: "water",
    zoneTone: "trap",
    width: 9,
    height: 7,
    tiles: [
      "####.####",
      "#.......#",
      "#.WWWWW.#",
      "...WWW...",
      "#.WWWWW.#",
      "#.......#",
      "####.####",
    ],
    entrances: [
      { side: "left", offset: 3 },
      { side: "right", offset: 3 },
      { side: "top", offset: 4 },
      { side: "bottom", offset: 4 },
    ],
    dangerLevel: 2,
    weight: 3,
    canSpawnCreatures: true,
    spawnRules: [
      {
        behavior: "wanderer",
        localCol: 4,
        localRow: 1,
        strength: 2,
        hearingBias: "low",
      },
    ],
    pointOfInterestLabel: "zona de agua",
  },
  {
    id: "danger-pocket",
    type: "danger",
    zoneTone: "danger",
    width: 9,
    height: 7,
    tiles: [
      "##.######",
      "#..HHH..#",
      "...H.H...",
      ".........",
      "...H.H...",
      "#..HHH..#",
      "######.##",
    ],
    entrances: [
      { side: "left", offset: 2 },
      { side: "right", offset: 4 },
      { side: "top", offset: 2 },
      { side: "bottom", offset: 6 },
    ],
    dangerLevel: 3,
    weight: 3,
    minDistanceFromSpawn: 7,
    canSpawnCreatures: true,
    spawnRules: [
      {
        behavior: "aggressive",
        localCol: 6,
        localRow: 2,
        strength: 3,
        territoryRadiusTiles: 4,
        hearingBias: "high",
      },
    ],
    pointOfInterestLabel: "zona de peligro",
  },
  {
    id: "combat-chamber",
    type: "combat",
    zoneTone: "open",
    width: 11,
    height: 9,
    tiles: [
      "#####.#####",
      "##.......##",
      "#.........#",
      "...##.##...",
      "...........",
      "...##.##...",
      "#.........#",
      "##.......##",
      "#####.#####",
    ],
    entrances: [
      { side: "left", offset: 4 },
      { side: "right", offset: 4 },
      { side: "top", offset: 5 },
      { side: "bottom", offset: 5 },
    ],
    dangerLevel: 2,
    weight: 4,
    canSpawnCreatures: true,
    spawnRules: [
      {
        behavior: "stalker",
        localCol: 3,
        localRow: 2,
        strength: 2,
        hearingBias: "medium",
      },
      {
        behavior: "aggressive",
        localCol: 8,
        localRow: 6,
        strength: 2,
        hearingBias: "high",
      },
    ],
    pointOfInterestLabel: "sala abierta de combate",
  },
  {
    id: "broken-passage",
    type: "broken",
    zoneTone: "trap",
    width: 9,
    height: 5,
    tiles: [
      "##.######",
      "#..#H#..#",
      ".........",
      "#..#H#..#",
      "######.##",
    ],
    entrances: [
      { side: "left", offset: 2 },
      { side: "right", offset: 2 },
      { side: "top", offset: 2 },
      { side: "bottom", offset: 6 },
    ],
    dangerLevel: 2,
    weight: 4,
    canSpawnCreatures: true,
    spawnRules: [
      {
        behavior: "ambusher",
        localCol: 4,
        localRow: 2,
        strength: 2,
        territoryRadiusTiles: 3,
        hearingBias: "medium",
      },
    ],
    pointOfInterestLabel: "pasillo roto",
  },
  {
    id: "temporary-shelter",
    type: "shelter",
    zoneTone: "safe",
    width: 7,
    height: 7,
    tiles: [
      "###.###",
      "#..R..#",
      "#.....#",
      ".......",
      "#.....#",
      "#..R..#",
      "###.###",
    ],
    entrances: [
      { side: "left", offset: 3 },
      { side: "right", offset: 3 },
      { side: "top", offset: 3 },
      { side: "bottom", offset: 3 },
    ],
    dangerLevel: 0,
    weight: 2,
    canSpawnCreatures: false,
    pointOfInterestLabel: "refugio temporal",
  },
];

export const CAVE_ROOM_TEMPLATES = baseTemplates.flatMap((template) =>
  expandTemplateRotations(template),
);

function createEmptyGrid() {
  return Array.from({ length: MAP_ROWS }, () =>
    Array.from({ length: MAP_COLS }, () => WALL_TILE),
  );
}

function charAt(template: CaveRoomTemplate, col: number, row: number) {
  return template.tiles[row]?.[col] ?? WALL_TILE;
}

function isOpenChar(char: string) {
  return char !== WALL_TILE;
}

function entranceLocalPosition(template: CaveRoomTemplate, entrance: CaveRoomEntrance) {
  switch (entrance.side) {
    case "left":
      return { col: 0, row: entrance.offset };
    case "right":
      return { col: template.width - 1, row: entrance.offset };
    case "top":
      return { col: entrance.offset, row: 0 };
    case "bottom":
      return { col: entrance.offset, row: template.height - 1 };
  }
}

function entranceWorldPosition(
  placement: TemplatePlacement,
  entrance: CaveRoomEntrance,
) {
  const local = entranceLocalPosition(placement.template, entrance);

  return {
    col: placement.originCol + local.col,
    row: placement.originRow + local.row,
  };
}

function frontierFromPlacement(
  placement: TemplatePlacement,
  entrance: CaveRoomEntrance,
): Frontier {
  const world = entranceWorldPosition(placement, entrance);
  const vector = sideVector(entrance.side);

  return {
    col: world.col + vector.col,
    row: world.row + vector.row,
    side: entrance.side,
    sourcePlacementId: placement.id,
  };
}

function canPlaceTemplate(
  grid: string[][],
  template: CaveRoomTemplate,
  originCol: number,
  originRow: number,
) {
  if (
    originCol < 1 ||
    originRow < 1 ||
    originCol + template.width >= MAP_COLS - 1 ||
    originRow + template.height >= MAP_ROWS - 1
  ) {
    return false;
  }

  for (let row = 0; row < template.height; row += 1) {
    for (let col = 0; col < template.width; col += 1) {
      const char = charAt(template, col, row);

      if (!isOpenChar(char)) {
        continue;
      }

      const worldCol = originCol + col;
      const worldRow = originRow + row;

      if (grid[worldRow]?.[worldCol] !== WALL_TILE) {
        return false;
      }
    }
  }

  return true;
}

function placeTemplate(
  grid: string[][],
  placement: TemplatePlacement,
) {
  for (let row = 0; row < placement.template.height; row += 1) {
    for (let col = 0; col < placement.template.width; col += 1) {
      const char = charAt(placement.template, col, row);

      if (!isOpenChar(char)) {
        continue;
      }

      grid[placement.originRow + row]![placement.originCol + col] = char;
    }
  }
}

function carveBoundary(grid: string[][]) {
  for (let col = 0; col < MAP_COLS; col += 1) {
    grid[0]![col] = WALL_TILE;
    grid[MAP_ROWS - 1]![col] = WALL_TILE;
  }

  for (let row = 0; row < MAP_ROWS; row += 1) {
    grid[row]![0] = WALL_TILE;
    grid[row]![MAP_COLS - 1] = WALL_TILE;
  }
}

function buildGroupedRects(tileRows: string[], matcher: (char: string) => boolean) {
  const rectangles: Rect[] = [];

  for (let row = 0; row < tileRows.length; row += 1) {
    const text = tileRows[row] ?? "";
    let start = -1;

    for (let col = 0; col <= text.length; col += 1) {
      const match = matcher(text[col] ?? "");

      if (match && start === -1) {
        start = col;
      }

      if ((!match || col === text.length) && start !== -1) {
        const end = match && col === text.length ? col : col - 1;
        rectangles.push({
          id: `rect-${row}-${start}`,
          x: start * TILE_SIZE,
          y: row * TILE_SIZE,
          width: (end - start + 1) * TILE_SIZE,
          height: TILE_SIZE,
        });
        start = -1;
      }
    }
  }

  return rectangles;
}

function centerOfTile(col: number, row: number): PlayerPosition {
  return {
    x: col * TILE_SIZE + TILE_SIZE / 2,
    y: row * TILE_SIZE + TILE_SIZE / 2,
  };
}

function pointDistanceTiles(a: PlayerPosition, b: PlayerPosition) {
  return Math.max(
    Math.abs(Math.round(a.x / TILE_SIZE) - Math.round(b.x / TILE_SIZE)),
    Math.abs(Math.round(a.y / TILE_SIZE) - Math.round(b.y / TILE_SIZE)),
  );
}

function isEntitySafeChar(char: string) {
  return char !== WALL_TILE && char !== HAZARD_TILE && char !== WATER_TILE;
}

function safeTilesForPlacement(placement: TemplatePlacement) {
  const tiles: Array<{ col: number; row: number }> = [];

  for (let row = 0; row < placement.template.height; row += 1) {
    for (let col = 0; col < placement.template.width; col += 1) {
      if (!isEntitySafeChar(charAt(placement.template, col, row))) {
        continue;
      }

      tiles.push({
        col: placement.originCol + col,
        row: placement.originRow + row,
      });
    }
  }

  return tiles;
}

function closestUniqueSafeTile(
  safeTiles: Array<{ col: number; row: number }>,
  desired: { col: number; row: number },
  used: Set<string>,
) {
  return safeTiles
    .filter((tile) => !used.has(`${tile.col},${tile.row}`))
    .sort((left, right) => {
      const leftDistance = Math.abs(left.col - desired.col) + Math.abs(left.row - desired.row);
      const rightDistance = Math.abs(right.col - desired.col) + Math.abs(right.row - desired.row);

      return (
        leftDistance - rightDistance ||
        left.row - right.row ||
        left.col - right.col
      );
    })[0] ?? null;
}

function createEnemyConfigFromRule(
  placement: TemplatePlacement,
  rule: CaveRoomSpawnRule,
  index: number,
  zoneName: string,
): EnemyConfig {
  const safeTiles = safeTilesForPlacement(placement);
  const requestedStart = {
    col: placement.originCol + rule.localCol,
    row: placement.originRow + rule.localRow,
  };
  const startTile = closestUniqueSafeTile(safeTiles, requestedStart, new Set()) ?? requestedStart;
  const start = centerOfTile(startTile.col, startTile.row);
  const territoryRadius = rule.territoryRadiusTiles ?? 4;
  const usedPatrolTiles = new Set<string>([`${startTile.col},${startTile.row}`]);
  const requestedPatrolTiles = [
    { col: requestedStart.col - 2, row: requestedStart.row },
    { col: requestedStart.col + 2, row: requestedStart.row },
    { col: requestedStart.col, row: requestedStart.row - 2 },
    { col: requestedStart.col, row: requestedStart.row + 2 },
  ];
  const patrolPoints: PlayerPosition[] = [];

  for (const requestedPatrol of requestedPatrolTiles) {
    const patrolTile = closestUniqueSafeTile(safeTiles, requestedPatrol, usedPatrolTiles);

    if (!patrolTile) {
      continue;
    }

    usedPatrolTiles.add(`${patrolTile.col},${patrolTile.row}`);
    patrolPoints.push(centerOfTile(patrolTile.col, patrolTile.row));
  }

  const spriteCharacterId =
    rule.behavior === "territorial" || rule.behavior === "ambusher"
      ? "cave-spider"
      : rule.behavior === "wanderer"
        ? "blind-fish"
        : rule.behavior === "aggressive"
          ? "cave-crab"
          : "cave-axolotl";

  const baseSpeed = 104 + rule.strength * 8;
  const baseDamage = 12 + rule.strength * 3;
  const baseHp = 42 + rule.strength * 10;

  return {
    id: `${placement.id}-${placement.template.id}-enemy-${index}`,
    name: `${zoneName} ${index + 1}`,
    behavior: rule.behavior,
    spriteCharacterId,
    start,
    patrolPoints,
    speed: baseSpeed,
    chaseSpeed: baseSpeed + 40,
    detectionRange: (rule.behavior === "ambusher" ? 3.5 : 4.5 + rule.strength * 0.35) * TILE_SIZE,
    giveUpRange: (6 + rule.strength) * TILE_SIZE,
    touchRange: 44,
    tetherRange: territoryRadius * TILE_SIZE,
    hp: baseHp,
    damage: baseDamage,
    scoreValue: 70 + rule.strength * 25,
  };
}

function zoneTitleForTemplate(type: CaveRoomTemplateType) {
  switch (type) {
    case "start":
      return "Refugio inicial";
    case "tunnel":
      return "Tunel de transicion";
    case "nest":
      return "Nido activo";
    case "wet":
      return "Camara humeda";
    case "water":
      return "Agua profunda";
    case "danger":
      return "Bolsa de peligro";
    case "combat":
      return "Camara abierta";
    case "broken":
      return "Pasillo roto";
    case "shelter":
      return "Refugio temporal";
  }
}

function zoneSubtitleForTemplate(type: CaveRoomTemplateType) {
  switch (type) {
    case "start":
      return "Base de respiracion";
    case "tunnel":
      return "Paso estrecho";
    case "nest":
      return "Territorio hostil";
    case "wet":
      return "Roca saturada";
    case "water":
      return "Suelo inestable";
    case "danger":
      return "Tension continua";
    case "combat":
      return "Espacio de choque";
    case "broken":
      return "Garganta rota";
    case "shelter":
      return "Cobertura precaria";
  }
}

function ambientForTemplate(type: CaveRoomTemplateType) {
  switch (type) {
    case "start":
      return "Las paredes todavia amortiguan el ruido y te dejan reagruparte.";
    case "tunnel":
      return "Cada eco viaja lejos en este cuello de botella.";
    case "nest":
      return "El nido vibra como si algo respirara en la piedra.";
    case "wet":
      return "La humedad deforma el sonido y confunde la distancia.";
    case "water":
      return "El agua devuelve un eco traicionero y castiga la quietud.";
    case "danger":
      return "La roca se siente hostil y cualquier error tiene costo.";
    case "combat":
      return "La amplitud abre lineas de ataque y deja poco escondite.";
    case "broken":
      return "La cueva se fractura y obliga a atravesar puntos tensos.";
    case "shelter":
      return "Un respiro corto antes de volver a exponerte.";
  }
}

function pressureForTemplate(template: CaveRoomTemplate) {
  if (template.zoneTone === "safe") {
    return template.type === "start" ? -1.1 : -0.5;
  }

  if (template.zoneTone === "open") {
    return 1.6;
  }

  if (template.zoneTone === "tunnels") {
    return 1.2;
  }

  if (template.zoneTone === "trap") {
    return 2.4;
  }

  return 3 + template.dangerLevel * 0.25;
}

function buildLayoutFromPlacements(
  seed: string,
  grid: string[][],
  placements: TemplatePlacement[],
) {
  const tileRows = grid.map((row) => row.join(""));
  const zones: Zone[] = [];
  const hazards: HazardArea[] = [];
  const pois: PointOfInterest[] = [];
  const enemyConfigs: EnemyConfig[] = [];
  const templatesUsed = placements.map((placement) => placement.template.id);
  const spawnCandidates: PlayerPosition[] = [];

  placements.forEach((placement, placementIndex) => {
    const template = placement.template;
    zones.push({
      id: `${template.id}-${placementIndex}`,
      name: zoneTitleForTemplate(template.type),
      subtitle: zoneSubtitleForTemplate(template.type),
      tone: template.zoneTone,
      x: placement.originCol * TILE_SIZE,
      y: placement.originRow * TILE_SIZE,
      width: template.width * TILE_SIZE,
      height: template.height * TILE_SIZE,
      ambient: ambientForTemplate(template.type),
      pressure: pressureForTemplate(template),
    });

    if (template.pointOfInterestLabel) {
      pois.push({
        id: `${template.id}-${placementIndex}`,
        label: template.pointOfInterestLabel,
        x: placement.originCol * TILE_SIZE + (template.width * TILE_SIZE) / 2,
        y: placement.originRow * TILE_SIZE + (template.height * TILE_SIZE) / 2,
      });
    }

    for (let row = 0; row < template.height; row += 1) {
      for (let col = 0; col < template.width; col += 1) {
        const char = charAt(template, col, row);
        const worldCol = placement.originCol + col;
        const worldRow = placement.originRow + row;

        if (char === SPAWN_TILE || char === SHELTER_TILE) {
          spawnCandidates.push(centerOfTile(worldCol, worldRow));
        }

        if (char === HAZARD_TILE) {
          hazards.push({
            id: `hazard-${placementIndex}-${col}-${row}`,
            label: "zona de peligro letal",
            x: worldCol * TILE_SIZE,
            y: worldRow * TILE_SIZE,
            width: TILE_SIZE,
            height: TILE_SIZE,
          });
        }

        if (char === NEST_TILE) {
          pois.push({
            id: `nest-${placementIndex}-${col}-${row}`,
            label: "nido",
            x: worldCol * TILE_SIZE + TILE_SIZE / 2,
            y: worldRow * TILE_SIZE + TILE_SIZE / 2,
          });
        }
      }
    }

    template.spawnRules?.forEach((rule, ruleIndex) => {
      enemyConfigs.push(
        createEnemyConfigFromRule(
          placement,
          rule,
          ruleIndex,
          zoneTitleForTemplate(template.type),
        ),
      );
    });
  });

  const startPositionCandidate =
    spawnCandidates[0] ??
    centerOfTile(
      placements[0]?.originCol + Math.floor(placements[0]!.template.width / 2),
      placements[0]?.originRow + Math.floor(placements[0]!.template.height / 2),
    );
  const startPoint = startPositionCandidate ?? startPosition;
  const startPlacement = placements[0];
  const startRoomSafeTiles = startPlacement ? safeTilesForPlacement(startPlacement) : [];
  const multiplayerSpawnCandidates = [
    startPoint,
    ...spawnCandidates,
    ...startRoomSafeTiles.map((tile) => centerOfTile(tile.col, tile.row)),
  ];
  const seenSpawnTiles = new Set<string>();
  const multiplayerSpawns = multiplayerSpawnCandidates
    .filter((candidate) => {
      const col = Math.floor(candidate.x / TILE_SIZE);
      const row = Math.floor(candidate.y / TILE_SIZE);
      const key = `${col},${row}`;

      if (seenSpawnTiles.has(key)) {
        return false;
      }

      seenSpawnTiles.add(key);
      return isEntitySafeChar(tileRows[row]?.[col] ?? WALL_TILE);
    })
    .slice(0, 6);
  const safeEnemyConfigs = enemyConfigs.filter(
    (enemy) => pointDistanceTiles(enemy.start, startPoint) >= 6,
  );

  return {
    seed,
    source: "procedural" as const,
    fallbackReason: null,
    tileRows,
    zones,
    walls: buildGroupedRects(tileRows, (char) => char === WALL_TILE),
    hazardAreas: hazards,
    goalArea: null,
    startPosition: startPoint,
    multiplayerSpawnPositions: multiplayerSpawns,
    enemyConfigs: safeEnemyConfigs,
    pointsOfInterest: pois,
    templatesUsed,
  };
}

function pickCandidatesForStage(
  stage: number,
  distanceFromSpawn: number,
  requiredSide: CaveEntranceSide,
) {
  return CAVE_ROOM_TEMPLATES.filter((template) => {
    if (template.id.startsWith("start-refuge")) {
      return false;
    }

    if (!template.entrances.some((entry) => entry.side === requiredSide)) {
      return false;
    }

    if ((template.minDistanceFromSpawn ?? 0) > distanceFromSpawn) {
      return false;
    }

    if (stage <= 2) {
      return template.type === "tunnel" || template.type === "shelter" || template.type === "wet";
    }

    if (stage <= 5) {
      return template.type !== "start";
    }

    return true;
  });
}

export type CaveConnectivityValidation = {
  connectedOpenTiles: number;
  openTiles: number;
  isConnected: boolean;
};

function collectReachableOpenTiles(tileRows: string[], start: PlayerPosition) {
  const startCol = Math.floor(start.x / TILE_SIZE);
  const startRow = Math.floor(start.y / TILE_SIZE);
  const queue: Array<[number, number]> = [[startCol, startRow]];
  const visited = new Set<string>();
  let queueIndex = 0;

  while (queueIndex < queue.length) {
    const current = queue[queueIndex++]!;
    const [col, row] = current;
    const key = `${col},${row}`;

    if (visited.has(key)) {
      continue;
    }

    const char = tileRows[row]?.[col] ?? WALL_TILE;

    if (char === WALL_TILE) {
      continue;
    }

    visited.add(key);

    const neighbors = [
      [col + 1, row],
      [col - 1, row],
      [col, row + 1],
      [col, row - 1],
    ];

    for (const [nextCol, nextRow] of neighbors) {
      if (
        nextCol <= 0 ||
        nextCol >= MAP_COLS - 1 ||
        nextRow <= 0 ||
        nextRow >= MAP_ROWS - 1
      ) {
        continue;
      }

      if (!visited.has(`${nextCol},${nextRow}`)) {
        queue.push([nextCol, nextRow]);
      }
    }
  }

  return visited;
}

export function validateCaveConnectivity(
  tileRows: string[],
  start: PlayerPosition,
): CaveConnectivityValidation {
  const visited = collectReachableOpenTiles(tileRows, start);
  let openTiles = 0;

  for (const row of tileRows) {
    for (const char of row) {
      if (char !== WALL_TILE) {
        openTiles += 1;
      }
    }
  }

  return {
    connectedOpenTiles: visited.size,
    openTiles,
    isConnected: openTiles > 0 && visited.size === openTiles,
  };
}

export type CaveLayoutValidation = CaveConnectivityValidation & {
  isValid: boolean;
  dimensionsValid: boolean;
  boundaryClosed: boolean;
  issues: string[];
};

export function validateCaveLayout(layout: CaveLayout): CaveLayoutValidation {
  const issues: string[] = [];
  const dimensionsValid =
    layout.tileRows.length === MAP_ROWS &&
    layout.tileRows.every((row) => row.length === MAP_COLS);

  if (!dimensionsValid) {
    issues.push(`expected a ${MAP_COLS}x${MAP_ROWS} tile grid`);
  }

  const boundaryClosed =
    dimensionsValid &&
    [...(layout.tileRows[0] ?? ""), ...(layout.tileRows[MAP_ROWS - 1] ?? "")].every(
      (char) => char === WALL_TILE,
    ) &&
    layout.tileRows.every(
      (row) => row[0] === WALL_TILE && row[MAP_COLS - 1] === WALL_TILE,
    );

  if (!boundaryClosed) {
    issues.push("outer boundary must be completely closed");
  }

  const connectivity = validateCaveConnectivity(
    layout.tileRows,
    layout.startPosition,
  );
  const reachableTiles = collectReachableOpenTiles(
    layout.tileRows,
    layout.startPosition,
  );

  if (!connectivity.isConnected) {
    issues.push(
      `only ${connectivity.connectedOpenTiles}/${connectivity.openTiles} open tiles are reachable`,
    );
  }

  const validateEntityPosition = (label: string, position: PlayerPosition) => {
    const col = Math.floor(position.x / TILE_SIZE);
    const row = Math.floor(position.y / TILE_SIZE);
    const char = layout.tileRows[row]?.[col] ?? WALL_TILE;
    const key = `${col},${row}`;

    if (!isEntitySafeChar(char)) {
      issues.push(`${label} is not on a safe walkable tile (${key})`);
    } else if (!reachableTiles.has(key)) {
      issues.push(`${label} is outside the start component (${key})`);
    }
  };

  validateEntityPosition("startPosition", layout.startPosition);

  if (layout.multiplayerSpawnPositions.length !== 6) {
    issues.push(
      `expected 6 multiplayer spawns, found ${layout.multiplayerSpawnPositions.length}`,
    );
  }

  const spawnKeys = new Set<string>();

  layout.multiplayerSpawnPositions.forEach((spawn, index) => {
    validateEntityPosition(`multiplayerSpawnPositions[${index}]`, spawn);
    spawnKeys.add(`${Math.floor(spawn.x / TILE_SIZE)},${Math.floor(spawn.y / TILE_SIZE)}`);
  });

  if (spawnKeys.size !== layout.multiplayerSpawnPositions.length) {
    issues.push("multiplayer spawns must occupy unique tiles");
  }

  const enemyIds = new Set<string>();

  layout.enemyConfigs.forEach((enemy, enemyIndex) => {
    if (enemyIds.has(enemy.id)) {
      issues.push(`duplicate enemy id: ${enemy.id}`);
    }

    enemyIds.add(enemy.id);
    validateEntityPosition(`enemyConfigs[${enemyIndex}].start`, enemy.start);

    if (enemy.patrolPoints.length === 0) {
      issues.push(`enemy ${enemy.id} has no patrol points`);
    }

    const patrolKeys = new Set<string>();

    enemy.patrolPoints.forEach((patrolPoint, patrolIndex) => {
      validateEntityPosition(
        `enemyConfigs[${enemyIndex}].patrolPoints[${patrolIndex}]`,
        patrolPoint,
      );
      patrolKeys.add(
        `${Math.floor(patrolPoint.x / TILE_SIZE)},${Math.floor(patrolPoint.y / TILE_SIZE)}`,
      );
    });

    if (patrolKeys.size !== enemy.patrolPoints.length) {
      issues.push(`enemy ${enemy.id} has duplicate patrol points`);
    }
  });

  if (layout.enemyConfigs.length === 0) {
    issues.push("layout must contain at least one enemy");
  }

  return {
    ...connectivity,
    dimensionsValid,
    boundaryClosed,
    issues,
    isValid: issues.length === 0,
  };
}

function buildFallbackTileRows() {
  const rows = Array.from({ length: MAP_ROWS }, (_, row) =>
    Array.from({ length: MAP_COLS }, (_, col) => {
      const centerX = col * TILE_SIZE + TILE_SIZE / 2;
      const centerY = row * TILE_SIZE + TILE_SIZE / 2;
      const isWall = caveWalls.some(
        (wall) =>
          centerX >= wall.x &&
          centerX <= wall.x + wall.width &&
          centerY >= wall.y &&
          centerY <= wall.y + wall.height,
      );

      if (isWall) {
        return WALL_TILE;
      }

      const isHazard = hazardAreas.some(
        (hazard) =>
          centerX >= hazard.x &&
          centerX <= hazard.x + hazard.width &&
          centerY >= hazard.y &&
          centerY <= hazard.y + hazard.height,
      );

      if (isHazard) {
        return HAZARD_TILE;
      }

      return ".";
    }).join(""),
  );

  return rows;
}

export function createFallbackCaveLayout(seed = "fallback-layout"): CaveLayout {
  return {
    seed,
    source: "fallback",
    fallbackReason: "static fallback requested",
    tileRows: buildFallbackTileRows(),
    zones: caveZones,
    walls: caveWalls,
    hazardAreas,
    goalArea: goalArea ?? null,
    startPosition,
    multiplayerSpawnPositions,
    enemyConfigs: stalkerConfigs,
    pointsOfInterest,
    templatesUsed: [
      "safe-hollow",
      "thin-tunnels",
      "false-passage",
      "open-abyss",
      "hunter-den",
      "last-corridor",
    ],
  };
}

export function generateProceduralCave(seed: string): CaveLayout {
  const random = mulberry32(hashSeed(seed));
  const maxAttempts = 28;
  let fallbackReason = "unknown procedural failure";

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const grid = createEmptyGrid();
    carveBoundary(grid);

    const startTemplate = baseTemplates[0]!;
    const startOriginCol = 4 + Math.floor(random() * Math.max(1, MAP_COLS - startTemplate.width - 8));
    const startOriginRow = 4 + Math.floor(random() * Math.max(1, MAP_ROWS - startTemplate.height - 8));
    const startPlacement: TemplatePlacement = {
      template: startTemplate,
      id: "start-0",
      originCol: startOriginCol,
      originRow: startOriginRow,
    };
    placeTemplate(grid, startPlacement);

    const placements: TemplatePlacement[] = [startPlacement];
    const frontiers: Frontier[] = startTemplate.entrances.map((entrance) =>
      frontierFromPlacement(startPlacement, entrance),
    );
    const targetSections = 10 + Math.floor(random() * 4);
    let sectionIndex = 1;
    let deadEnds = 0;

    while (frontiers.length > 0 && placements.length < targetSections) {
      const frontierIndex = Math.floor(random() * frontiers.length);
      const frontier = frontiers.splice(frontierIndex, 1)[0];

      if (!frontier) {
        continue;
      }

      const distanceFromSpawn = Math.max(
        Math.abs(frontier.col - startOriginCol),
        Math.abs(frontier.row - startOriginRow),
      );
      const requiredSide = oppositeSide(frontier.side);
      const candidates = pickCandidatesForStage(
        placements.length,
        distanceFromSpawn,
        requiredSide,
      );
      const hasCombatRoom = placements.some(
        (placement) => placement.template.type === "combat",
      );
      const hasNestRoom = placements.some(
        (placement) => placement.template.type === "nest",
      );
      const mandatoryCandidates =
        placements.length >= 3 && !hasCombatRoom
          ? candidates.filter((candidate) => candidate.type === "combat")
          : placements.length >= 4 && !hasNestRoom
            ? candidates.filter((candidate) => candidate.type === "nest")
            : [];
      const eligibleCandidates =
        mandatoryCandidates.length > 0 ? mandatoryCandidates : candidates;
      let placed = false;

      const candidatePool =
        eligibleCandidates.length > 0
          ? eligibleCandidates
          : CAVE_ROOM_TEMPLATES.filter((template) =>
              template.entrances.some((entry) => entry.side === requiredSide),
            );

      for (const candidate of weightedOrder(random, candidatePool)) {
        const matchingEntrances = shuffled(
          random,
          candidate.entrances.filter((entry) => entry.side === requiredSide),
        );

        for (const entrance of matchingEntrances) {
          const local = entranceLocalPosition(candidate, entrance);
          const originCol = frontier.col - local.col;
          const originRow = frontier.row - local.row;

          if (!canPlaceTemplate(grid, candidate, originCol, originRow)) {
            continue;
          }

          const placement: TemplatePlacement = {
            template: candidate,
            id: `section-${sectionIndex}`,
            originCol,
            originRow,
          };
          placeTemplate(grid, placement);
          placements.push(placement);
          sectionIndex += 1;

          for (const nextEntrance of candidate.entrances) {
            if (nextEntrance === entrance) {
              continue;
            }

            frontiers.push(frontierFromPlacement(placement, nextEntrance));
          }

          placed = true;
          break;
        }

        if (placed) {
          break;
        }
      }

      if (!placed) {
        deadEnds += 1;
      }
    }

    if (placements.length < 8 || deadEnds > 8) {
      fallbackReason = `attempt ${attempt + 1}: low section count (${placements.length}) or too many dead ends (${deadEnds})`;
      continue;
    }

    const layout = buildLayoutFromPlacements(seed, grid, placements);
    const validation = validateCaveLayout(layout);
    const nestCount = placements.filter((placement) => placement.template.type === "nest").length;
    const openCount = placements.filter((placement) => placement.template.type === "combat").length;

    if (
      !validation.isValid ||
      validation.openTiles < 280 ||
      validation.openTiles > 1320 ||
      nestCount === 0 ||
      openCount === 0 ||
      layout.enemyConfigs.length === 0
    ) {
      fallbackReason =
        `attempt ${attempt + 1}: invalid layout connected=${validation.isConnected} ` +
        `openTiles=${validation.openTiles} nests=${nestCount} combat=${openCount} ` +
        `enemies=${layout.enemyConfigs.length} issues=${validation.issues.join("; ") || "none"}`;
      continue;
    }

    return layout;
  }

  console.warn("[Speleum] Procedural cave fallback:", {
    seed,
    reason: fallbackReason,
  });
  return {
    ...createFallbackCaveLayout(seed),
    fallbackReason,
  };
}

export function createCaveLayout(seed: string) {
  const layout = generateProceduralCave(seed);

  if (layout.enemyConfigs.length > 0) {
    return layout;
  }

  console.warn("[Speleum] Cave layout had no enemy configs, forcing fallback:", { seed });
  return {
    ...createFallbackCaveLayout(seed),
    fallbackReason: "generated layout had no enemy configs",
  };
}
