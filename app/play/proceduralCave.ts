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
      return { side: "left", offset: width - 1 - entrance.offset };
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

const baseTemplates: CaveRoomTemplate[] = [
  {
    id: "start-refuge",
    type: "start",
    zoneTone: "safe",
    width: 11,
    height: 9,
    tiles: [
      "###########",
      "#..R...S..#",
      "#.........#",
      "#..###....#",
      "..........#",
      "#....###..#",
      "#.........#",
      "#..S...R..#",
      "###########",
    ],
    entrances: [
      { side: "left", offset: 4 },
      { side: "right", offset: 4 },
      { side: "top", offset: 5 },
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
      "#########",
      "##.....##",
      ".........",
      "##.....##",
      "#########",
    ],
    entrances: [
      { side: "left", offset: 2 },
      { side: "right", offset: 2 },
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
      "###########",
      "###.....###",
      "##.......##",
      "...........",
      "##.......##",
      "###.....###",
      "###########",
    ],
    entrances: [
      { side: "left", offset: 3 },
      { side: "right", offset: 3 },
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
      "#########",
      "#..###..#",
      "...#N#...",
      "..##.##..",
      "...#.#...",
      "#..###..#",
      "#########",
    ],
    entrances: [
      { side: "left", offset: 2 },
      { side: "right", offset: 2 },
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
      "#########",
      "#..WWW..#",
      "#.W...W.#",
      "....W....",
      "#.W...W.#",
      "#..WWW..#",
      "#########",
    ],
    entrances: [
      { side: "left", offset: 3 },
      { side: "right", offset: 3 },
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
      "#########",
      "#.......#",
      "#.WWWWW.#",
      "...WWW...",
      "#.WWWWW.#",
      "#.......#",
      "#########",
    ],
    entrances: [
      { side: "left", offset: 3 },
      { side: "right", offset: 3 },
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
      "#########",
      "#..HHH..#",
      "...H.H...",
      "..HH.HH..",
      "...H.H...",
      "#..HHH..#",
      "#########",
    ],
    entrances: [
      { side: "left", offset: 2 },
      { side: "right", offset: 4 },
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
      "###########",
    ],
    entrances: [
      { side: "left", offset: 4 },
      { side: "right", offset: 4 },
      { side: "top", offset: 5 },
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
      "#########",
      "..##H##..",
      "...#.#...",
      "..##H##..",
      "#########",
    ],
    entrances: [
      { side: "left", offset: 2 },
      { side: "right", offset: 2 },
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
      "#######",
      "#..R..#",
      "#.....#",
      ".......",
      "#.....#",
      "#..R..#",
      "#######",
    ],
    entrances: [
      { side: "left", offset: 3 },
      { side: "right", offset: 3 },
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

function createEnemyConfigFromRule(
  placement: TemplatePlacement,
  rule: CaveRoomSpawnRule,
  index: number,
  zoneName: string,
): EnemyConfig {
  const start = centerOfTile(
    placement.originCol + rule.localCol,
    placement.originRow + rule.localRow,
  );
  const territoryRadius = rule.territoryRadiusTiles ?? 4;
  const patrolPoints: PlayerPosition[] = [
    centerOfTile(
      Math.max(1, placement.originCol + Math.max(0, rule.localCol - 2)),
      Math.max(1, placement.originRow + rule.localRow),
    ),
    centerOfTile(
      Math.min(MAP_COLS - 2, placement.originCol + Math.min(placement.template.width - 1, rule.localCol + 2)),
      Math.max(1, placement.originRow + rule.localRow),
    ),
    centerOfTile(
      Math.max(1, placement.originCol + rule.localCol),
      Math.max(1, placement.originRow + Math.max(0, rule.localRow - 2)),
    ),
    centerOfTile(
      Math.max(1, placement.originCol + rule.localCol),
      Math.min(MAP_ROWS - 2, placement.originRow + Math.min(placement.template.height - 1, rule.localRow + 2)),
    ),
  ];

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
    id: `${placement.template.id}-${index}`,
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

        if (char === HAZARD_TILE || char === WATER_TILE) {
          hazards.push({
            id: `hazard-${placementIndex}-${col}-${row}`,
            label: char === WATER_TILE ? "agua inestable" : "zona de peligro",
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
  const playerSpawns = spawnCandidates
    .filter((candidate) => pointDistanceTiles(candidate, startPoint) <= 5)
    .slice(0, 6);
  const multiplayerSpawns =
    playerSpawns.length >= 6
      ? playerSpawns
      : [
          startPoint,
          ...spawnCandidates
            .filter((candidate) => candidate !== startPoint)
            .slice(0, 5),
        ].slice(0, 6);
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

function validateConnectivity(tileRows: string[], start: PlayerPosition) {
  const startCol = Math.floor(start.x / TILE_SIZE);
  const startRow = Math.floor(start.y / TILE_SIZE);
  const queue = [[startCol, startRow]];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current) {
      break;
    }

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
    isConnected: visited.size >= openTiles * 0.95,
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
      let placed = false;

      for (let localAttempt = 0; localAttempt < Math.max(6, candidates.length); localAttempt += 1) {
        const candidate =
          weightedPick(
            random,
            candidates.length > 0 ? candidates : CAVE_ROOM_TEMPLATES.filter((template) =>
              template.entrances.some((entry) => entry.side === requiredSide),
            ),
          ) ?? null;

        if (!candidate) {
          break;
        }

        const matchingEntrances = candidate.entrances.filter((entry) => entry.side === requiredSide);
        const entrance = matchingEntrances[Math.floor(random() * matchingEntrances.length)];

        if (!entrance) {
          continue;
        }

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

      if (!placed) {
        deadEnds += 1;
      }
    }

    if (placements.length < 8 || deadEnds > 8) {
      fallbackReason = `attempt ${attempt + 1}: low section count (${placements.length}) or too many dead ends (${deadEnds})`;
      continue;
    }

    const layout = buildLayoutFromPlacements(seed, grid, placements);
    const connectivity = validateConnectivity(layout.tileRows, layout.startPosition);
    const nestCount = placements.filter((placement) => placement.template.type === "nest").length;
    const openCount = placements.filter((placement) => placement.template.type === "combat").length;

    if (
      !connectivity.isConnected ||
      connectivity.openTiles < 280 ||
      connectivity.openTiles > 1320 ||
      nestCount === 0 ||
      openCount === 0 ||
      layout.enemyConfigs.length === 0
    ) {
      fallbackReason =
        `attempt ${attempt + 1}: invalid layout connected=${connectivity.isConnected} ` +
        `openTiles=${connectivity.openTiles} nests=${nestCount} combat=${openCount} enemies=${layout.enemyConfigs.length}`;
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
