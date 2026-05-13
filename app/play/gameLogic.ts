import type {
  EnemyBehaviorType,
  EnemyConfig,
  GameStatus,
  GoalArea,
  HazardArea,
  PlayerPosition,
  Rect,
  TileCoordinate,
  Zone,
} from "./gameConfig";
import {
  CHASE_SANITY_DRAIN,
  CAVE_HEIGHT,
  CAVE_WIDTH,
  DEFEND_DAMAGE_REDUCTION,
  FEAR_CRITICAL_THRESHOLD,
  FEAR_WARNING_THRESHOLD,
  IDLE_SANITY_DRAIN,
  MAP_COLS,
  MAP_ROWS,
  MOVE_BASE_COOLDOWN,
  MOVE_BURST_IDLE_MS,
  MOVE_DISTANCE_COOLDOWN,
  MOVE_MAX_COOLDOWN,
  MOVING_SANITY_RECOVERY,
  PLAYER_RADIUS,
  SAFE_ZONE_SANITY_RECOVERY,
  SANITY_DAMAGE_PER_TICK,
  SANITY_DAMAGE_THRESHOLD,
  TILE_SIZE,
  THREAT_DEATH_MS,
  THREAT_HUNT_MS,
  THREAT_WARNING_MS,
  caveWalls,
} from "./gameConfig";
import {
  buildPathToTile,
  clampTile,
  getTileNeighbors,
  isWalkableTile,
  stepTowardTile,
  tileDistance,
  tileToWorld,
  worldToTile,
  type TileLookup,
} from "./tileMap";
import type { NoiseEvent } from "./types";

export type EnemyBehaviorState =
  | "idle"
  | "patrol"
  | "listening"
  | "investigating"
  | "ambushing"
  | "chasing"
  | "attacking"
  | "dead";
export type ThreatLevel = "calm" | "uneasy" | "hunted" | "doomed";

export type EnemyTarget = {
  id: string;
  position: PlayerPosition;
  alive?: boolean;
};

export type EnemyState = {
  id: string;
  name: string;
  behavior: EnemyBehaviorType;
  spriteCharacterId: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  damage: number;
  detectionRangeTiles: number;
  attackRangeTiles: number;
  giveUpRangeTiles: number;
  tetherRangeTiles: number;
  state: EnemyBehaviorState;
  patrolIndex: number;
  lastHeardNoiseTileKey: string | null;
  lastKnownPlayerTileKey: string | null;
  lastKnownTargetId: string | null;
  stateSince: number;
  lastPositions: string[];
};

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function distanceBetween(a: PlayerPosition, b: PlayerPosition) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function enemyStateLabel(state: EnemyBehaviorState) {
  switch (state) {
    case "idle":
      return "idle";
    case "patrol":
      return "patrol";
    case "listening":
      return "listening";
    case "investigating":
      return "investigating";
    case "ambushing":
      return "ambushing";
    case "chasing":
      return "chasing";
    case "attacking":
      return "attacking";
    case "dead":
      return "dead";
  }
}

export function isWithinVision(
  origin: PlayerPosition,
  target: PlayerPosition,
  radius: number,
) {
  return distanceBetween(origin, target) <= radius;
}

export function pointInRect(point: PlayerPosition, rect: Rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

export function circleIntersectsRect(
  circle: PlayerPosition,
  radius: number,
  rect: Rect,
) {
  const closestX = clamp(circle.x, rect.x, rect.x + rect.width);
  const closestY = clamp(circle.y, rect.y, rect.y + rect.height);
  const distanceX = circle.x - closestX;
  const distanceY = circle.y - closestY;

  return distanceX * distanceX + distanceY * distanceY < radius * radius;
}

export function clampToMap(position: PlayerPosition, radius = PLAYER_RADIUS) {
  return {
    x: clamp(position.x, radius, CAVE_WIDTH - radius),
    y: clamp(position.y, radius, CAVE_HEIGHT - radius),
  };
}

function getBlockingTilesNearPosition(position: PlayerPosition, lookup: TileLookup) {
  const minCol = Math.max(0, Math.floor((position.x - PLAYER_RADIUS) / TILE_SIZE) - 1);
  const maxCol = Math.min(
    Math.ceil((position.x + PLAYER_RADIUS) / TILE_SIZE) + 1,
    Math.ceil(CAVE_WIDTH / TILE_SIZE),
  );
  const minRow = Math.max(0, Math.floor((position.y - PLAYER_RADIUS) / TILE_SIZE) - 1);
  const maxRow = Math.min(
    Math.ceil((position.y + PLAYER_RADIUS) / TILE_SIZE) + 1,
    Math.ceil(CAVE_HEIGHT / TILE_SIZE),
  );
  const blocking: Rect[] = [];

  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      const tile = lookup.byKey.get(`${col},${row}`);

      if (!tile || (tile.type !== "wall" && tile.type !== "obstacle")) {
        continue;
      }

      blocking.push({
        id: `tile-${col}-${row}`,
        x: tile.x,
        y: tile.y,
        width: TILE_SIZE,
        height: TILE_SIZE,
      });
    }
  }

  return blocking;
}

export function canStandAt(
  position: PlayerPosition,
  radius = PLAYER_RADIUS,
  walls = caveWalls,
  lookup?: TileLookup,
) {
  if (lookup) {
    return !getBlockingTilesNearPosition(position, lookup).some((wall) =>
      circleIntersectsRect(position, radius, wall),
    );
  }

  return !walls.some((wall) => circleIntersectsRect(position, radius, wall));
}

export function canTravelBetween(
  from: PlayerPosition,
  to: PlayerPosition,
  radius = PLAYER_RADIUS,
  walls = caveWalls,
  lookup?: TileLookup,
) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.ceil(distance / 18));

  for (let index = 1; index <= steps; index += 1) {
    const progress = index / steps;
    const sample = {
      x: from.x + (to.x - from.x) * progress,
      y: from.y + (to.y - from.y) * progress,
    };

    if (!canStandAt(sample, radius, walls, lookup)) {
      return false;
    }
  }

  return true;
}

export function limitMoveDistance(
  from: PlayerPosition,
  target: PlayerPosition,
  maxDistance: number,
) {
  const distance = Math.hypot(target.x - from.x, target.y - from.y);

  if (distance <= maxDistance) {
    return target;
  }

  const scale = maxDistance / distance;

  return {
    x: from.x + (target.x - from.x) * scale,
    y: from.y + (target.y - from.y) * scale,
  };
}

export function moveWithCollisions(
  from: PlayerPosition,
  delta: PlayerPosition,
  radius = PLAYER_RADIUS,
  walls = caveWalls,
  lookup?: TileLookup,
) {
  const intendedPosition = clampToMap(
    {
      x: from.x + delta.x,
      y: from.y + delta.y,
    },
    radius,
  );

  if (canTravelBetween(from, intendedPosition, radius, walls, lookup)) {
    return intendedPosition;
  }

  const horizontalStep = clampToMap(
    {
      x: from.x + delta.x,
      y: from.y,
    },
    radius,
  );

  if (canTravelBetween(from, horizontalStep, radius, walls, lookup)) {
    return horizontalStep;
  }

  const verticalStep = clampToMap(
    {
      x: from.x,
      y: from.y + delta.y,
    },
    radius,
  );

  if (canTravelBetween(from, verticalStep, radius, walls, lookup)) {
    return verticalStep;
  }

  return from;
}

export function moveTowardPosition(
  from: PlayerPosition,
  target: PlayerPosition,
  maxDistance: number,
  radius = PLAYER_RADIUS,
  walls = caveWalls,
  lookup?: TileLookup,
) {
  const deltaX = target.x - from.x;
  const deltaY = target.y - from.y;
  const distance = Math.hypot(deltaX, deltaY);

  if (distance === 0) {
    return from;
  }

  const scale = Math.min(1, maxDistance / distance);

  return moveWithCollisions(
    from,
    {
      x: deltaX * scale,
      y: deltaY * scale,
    },
    radius,
    walls,
    lookup,
  );
}

export function getZoneForPosition(position: PlayerPosition, zones: Zone[]) {
  return zones.find((zone) => pointInRect(position, zone)) ?? zones[0];
}

export function hitHazard(position: PlayerPosition, hazards: HazardArea[]) {
  return hazards.some((hazard) => circleIntersectsRect(position, PLAYER_RADIUS, hazard));
}

export function reachedGoal(position: PlayerPosition, goal: GoalArea | null) {
  if (!goal) {
    return false;
  }

  return circleIntersectsRect(position, PLAYER_RADIUS, goal);
}

export function applyDamage(
  health: number,
  damage: number,
  isDefending: boolean,
) {
  const mitigation = isDefending ? 1 - DEFEND_DAMAGE_REDUCTION : 1;

  return Math.max(0, Math.round(health - damage * mitigation));
}

export function calculateMoveCooldown(
  distance: number,
  moveCooldownMultiplier = 1,
) {
  if (distance <= 0) {
    return 0;
  }

  const scaled = Math.round(distance * MOVE_DISTANCE_COOLDOWN * moveCooldownMultiplier);
  return clamp(Math.max(MOVE_BASE_COOLDOWN, scaled), MOVE_BASE_COOLDOWN, MOVE_MAX_COOLDOWN);
}

export function getAdjacentTilePosition(
  from: PlayerPosition,
  delta: { col: number; row: number },
) {
  const tile = worldToTile(from);

  return tileToWorld(
    clampTile({
      col: tile.col + delta.col,
      row: tile.row + delta.row,
    }),
  );
}

export function moveByTile(
  from: PlayerPosition,
  delta: { col: number; row: number },
  radius = PLAYER_RADIUS,
) {
  const target = getAdjacentTilePosition(from, delta);

  if (!canTravelBetween(from, target, radius) || !isWalkableTile(worldToTile(target))) {
    return from;
  }

  return target;
}

export function getTileStepTowardPosition(from: PlayerPosition, target: PlayerPosition) {
  const currentTile = worldToTile(from);
  const targetTile = worldToTile(target);

  if (currentTile.col === targetTile.col && currentTile.row === targetTile.row) {
    return from;
  }

  return tileToWorld(stepTowardTile(currentTile, targetTile));
}

export function shouldFinalizeMoveBurst(lastMoveAt: number, now: number) {
  return now - lastMoveAt >= MOVE_BURST_IDLE_MS;
}

export function getThreatLevel(idleMs: number): ThreatLevel {
  if (idleMs >= THREAT_DEATH_MS) {
    return "doomed";
  }

  if (idleMs >= THREAT_HUNT_MS) {
    return "hunted";
  }

  if (idleMs >= THREAT_WARNING_MS) {
    return "uneasy";
  }

  return "calm";
}

export function getSanityStateLabel(sanity: number) {
  if (sanity <= FEAR_CRITICAL_THRESHOLD) {
    return "critico";
  }

  if (sanity <= FEAR_WARNING_THRESHOLD) {
    return "inestable";
  }

  return "estable";
}

export function updateSanity(
  sanity: number,
  deltaSeconds: number,
  zone: Zone,
  isMoving: boolean,
  threatLevel: ThreatLevel,
  enemyState: EnemyBehaviorState,
  darknessDrainPerSecond: number,
) {
  let delta = 0;

  if (zone.tone === "safe") {
    delta += SAFE_ZONE_SANITY_RECOVERY * deltaSeconds;
  } else {
    delta -= (darknessDrainPerSecond + zone.pressure) * deltaSeconds;
  }

  if (isMoving) {
    delta += MOVING_SANITY_RECOVERY * deltaSeconds;
  } else {
    delta -= IDLE_SANITY_DRAIN * deltaSeconds;
  }

  if (threatLevel === "uneasy") {
    delta -= 3 * deltaSeconds;
  } else if (threatLevel === "hunted") {
    delta -= 7 * deltaSeconds;
  } else if (threatLevel === "doomed") {
    delta -= 12 * deltaSeconds;
  }

  if (
    enemyState === "chasing" ||
    enemyState === "investigating" ||
    enemyState === "attacking"
  ) {
    delta -= CHASE_SANITY_DRAIN * deltaSeconds;
  }

  return clamp(Math.round((sanity + delta) * 100) / 100, 0, 100);
}

export function sanityHealthPenalty(sanity: number, deltaSeconds: number) {
  if (sanity > SANITY_DAMAGE_THRESHOLD) {
    return 0;
  }

  return Math.max(0, Math.round(SANITY_DAMAGE_PER_TICK * deltaSeconds));
}

export function createEnemyState(config: EnemyConfig): EnemyState {
  return {
    id: config.id,
    name: config.name,
    behavior: config.behavior,
    spriteCharacterId: config.spriteCharacterId,
    x: config.start.x,
    y: config.start.y,
    hp: config.hp,
    maxHp: config.hp,
    alive: true,
    damage: config.damage,
    detectionRangeTiles: Math.round(config.detectionRange / TILE_SIZE),
    attackRangeTiles: Math.max(1, Math.round(config.touchRange / TILE_SIZE)),
    giveUpRangeTiles: Math.round(config.giveUpRange / TILE_SIZE),
    tetherRangeTiles: Math.round(config.tetherRange / TILE_SIZE),
    state:
      config.behavior === "territorial"
        ? "idle"
        : config.behavior === "ambusher"
          ? "ambushing"
          : "patrol",
    patrolIndex: 0,
    lastKnownPlayerTileKey: null,
    lastHeardNoiseTileKey: null,
    lastKnownTargetId: null,
    stateSince: Date.now(),
    lastPositions: [],
  };
}

function rememberEnemyPosition(enemy: EnemyState, tile: TileCoordinate) {
  const key = toTileKey(tile);
  const nextPositions = [...enemy.lastPositions, key].slice(-6);

  return {
    ...enemy,
    lastPositions: nextPositions,
  };
}

function repeatedPositionCount(enemy: EnemyState, tile: TileCoordinate) {
  const key = toTileKey(tile);
  return enemy.lastPositions.filter((entry) => entry === key).length;
}

function isEnemyStuck(enemy: EnemyState) {
  if (enemy.lastPositions.length < 4) {
    return false;
  }

  const recent = enemy.lastPositions.slice(-4);
  return new Set(recent).size <= 2;
}

function moveEnemyOneStep(
  current: EnemyState,
  target: TileCoordinate,
  lookup?: TileLookup,
): EnemyState {
  const currentTile = worldToTile(current);
  const path = buildPathToTile(
    currentTile,
    target,
    MAP_COLS + MAP_ROWS,
    lookup,
  );
  const pathStep = path && path.length > 1 ? path[1] : null;
  const candidateTiles = getTileNeighbors(currentTile)
    .filter((tile) => isWalkableTile(tile, lookup))
    .sort((left, right) => {
      const leftPenalty = repeatedPositionCount(current, left) * 8;
      const rightPenalty = repeatedPositionCount(current, right) * 8;
      return (
        tileDistance(left, target) + leftPenalty - (tileDistance(right, target) + rightPenalty)
      );
    });
  const preferredStep =
    pathStep && repeatedPositionCount(current, pathStep) < 3
      ? pathStep
      : candidateTiles.find((tile) => repeatedPositionCount(current, tile) < 3) ??
        pathStep ??
        stepTowardTile(currentTile, target, lookup);
  const nextTile = preferredStep;

  if (nextTile.col === currentTile.col && nextTile.row === currentTile.row) {
    return current;
  }

  const nextPosition = tileToWorld(nextTile);

  return {
    ...rememberEnemyPosition(current, nextTile),
    x: nextPosition.x,
    y: nextPosition.y,
  };
}

function advancePatrol(current: EnemyState, config: EnemyConfig, lookup?: TileLookup): EnemyState {
  if (config.patrolPoints.length === 0) {
    return current;
  }

  const patrolTarget = config.patrolPoints[current.patrolIndex] ?? config.start;
  const patrolTile = worldToTile(patrolTarget);
  const currentTile = worldToTile(current);

  if (tileDistance(currentTile, patrolTile) === 0) {
    return {
      ...current,
      patrolIndex: (current.patrolIndex + 1) % config.patrolPoints.length,
      lastPositions: current.lastPositions,
    };
  }

  const moved = moveEnemyOneStep(current, patrolTile, lookup);

  if (moved.x === current.x && moved.y === current.y) {
    return {
      ...current,
      patrolIndex: (current.patrolIndex + 1) % config.patrolPoints.length,
    };
  }

  return moved;
}

function toTileKey(tile: TileCoordinate) {
  return `${tile.col},${tile.row}`;
}

function parseTileKey(tileKey: string | null) {
  if (!tileKey) {
    return null;
  }

  const [col, row] = tileKey.split(",").map(Number);

  if (Number.isNaN(col) || Number.isNaN(row)) {
    return null;
  }

  return { col, row };
}

function targetForEnemy(current: EnemyState, targets: EnemyTarget[]) {
  return (
    targets
      .filter((target) => target.alive !== false)
      .sort(
        (left, right) =>
          tileDistance(worldToTile(current), worldToTile(left.position)) -
          tileDistance(worldToTile(current), worldToTile(right.position)),
      )[0] ?? null
  );
}

function scoreNoiseForEnemy(
  current: EnemyState,
  noise: NoiseEvent,
  config: EnemyConfig,
) {
  const enemyTile = worldToTile(current);
  const noiseTile = worldToTile(noise.position);
  const distance = tileDistance(enemyTile, noiseTile);
  const hearingRangeByType =
    noise.type === "attack"
      ? current.detectionRangeTiles + 4
      : noise.type === "defend"
        ? current.detectionRangeTiles + 1
        : current.detectionRangeTiles + 2;

  if (distance > hearingRangeByType || distance > noise.radiusTiles) {
    return null;
  }

  const falloff = noise.intensity - distance * 0.22;
  const threshold =
    config.behavior === "ambusher"
      ? 0.45
      : config.behavior === "wanderer"
        ? 0.35
        : 0.25;

  if (falloff < threshold) {
    return null;
  }

  return {
    noise,
    tile: noiseTile,
    score: falloff,
  };
}

function pickHeardNoise(
  current: EnemyState,
  config: EnemyConfig,
  noises: NoiseEvent[],
  now: number,
) {
  const recentNoises = noises.filter((noise) => now - noise.createdAt <= 3200);
  const scored = recentNoises
    .map((noise) => scoreNoiseForEnemy(current, noise, config))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort((left, right) => right.score - left.score);

  return scored[0] ?? null;
}

function withEnemyState(current: EnemyState, state: EnemyBehaviorState, patch: Partial<EnemyState>) {
  return {
    ...current,
    ...patch,
    lastPositions: patch.lastPositions ?? current.lastPositions,
    state,
    stateSince: state === current.state ? current.stateSince : Date.now(),
  };
}

export function updateEnemyState(
  current: EnemyState,
  targets: EnemyTarget[],
  config: EnemyConfig,
  _deltaSeconds: number,
  gameStatus: GameStatus,
  noises: NoiseEvent[] = [],
  now = Date.now(),
  lookup?: TileLookup,
): EnemyState {
  if (gameStatus !== "playing") {
    return current;
  }

  if (current.alive === false || current.hp <= 0) {
    return {
      ...current,
      alive: false,
      hp: 0,
      state: "dead",
    };
  }

  const enemyTile = worldToTile(current);
  const selectedTarget = targetForEnemy(current, targets);
  const homeTile = worldToTile(config.start);
  const distanceFromHome = tileDistance(enemyTile, homeTile);
  const targetTile = selectedTarget ? worldToTile(selectedTarget.position) : null;
  const distanceToTarget = targetTile ? tileDistance(enemyTile, targetTile) : Number.POSITIVE_INFINITY;
  const detectsTarget = Boolean(targetTile && distanceToTarget <= current.detectionRangeTiles);
  const inAttackRange = Boolean(targetTile && distanceToTarget <= current.attackRangeTiles);
  const heardNoise = pickHeardNoise(current, config, noises, now);
  const knownTargetTile =
    targetTile && (detectsTarget || current.lastKnownTargetId === selectedTarget?.id)
      ? targetTile
      : parseTileKey(current.lastKnownPlayerTileKey);
  const playerInsideTerritory = Boolean(
    targetTile && tileDistance(targetTile, homeTile) <= current.tetherRangeTiles,
  );

  if (inAttackRange && targetTile && selectedTarget) {
    return withEnemyState(current, "attacking", {
      lastKnownPlayerTileKey: toTileKey(targetTile),
      lastKnownTargetId: selectedTarget.id,
    });
  }

  if (detectsTarget && targetTile && selectedTarget) {
    if (
      current.behavior === "territorial" &&
      !playerInsideTerritory &&
      distanceFromHome >= current.tetherRangeTiles
    ) {
      return withEnemyState(moveEnemyOneStep(current, homeTile, lookup), "patrol", {
        lastKnownPlayerTileKey: null,
        lastKnownTargetId: null,
      });
    }

    if (current.behavior === "ambusher" && distanceToTarget > 2 && heardNoise) {
      return withEnemyState(current, "ambushing", {
        lastKnownPlayerTileKey: toTileKey(targetTile),
        lastKnownTargetId: selectedTarget.id,
      });
    }

    return withEnemyState(moveEnemyOneStep(current, targetTile, lookup), "chasing", {
      lastKnownPlayerTileKey: toTileKey(targetTile),
      lastKnownTargetId: selectedTarget.id,
    });
  }

  if (heardNoise) {
    const investigatingMove =
      current.behavior === "ambusher" && heardNoise.score >= 0.7
        ? current
        : moveEnemyOneStep(current, heardNoise.tile, lookup);
    const nextState =
      current.behavior === "ambusher" && heardNoise.score >= 0.7
        ? "ambushing"
        : heardNoise.score >= 0.55
          ? "investigating"
          : "listening";

    return withEnemyState(investigatingMove, nextState, {
      lastHeardNoiseTileKey: toTileKey(heardNoise.tile),
      lastKnownPlayerTileKey: toTileKey(heardNoise.tile),
      lastKnownTargetId: null,
    });
  }

  if (knownTargetTile && tileDistance(enemyTile, knownTargetTile) <= current.giveUpRangeTiles) {
    const moved = moveEnemyOneStep(current, knownTargetTile, lookup);

    if ((moved.x === current.x && moved.y === current.y) || isEnemyStuck(moved)) {
      return withEnemyState(current, "patrol", {
        lastKnownPlayerTileKey: null,
        lastKnownTargetId: null,
      });
    }

    if (tileDistance(worldToTile(moved), knownTargetTile) === 0) {
      return withEnemyState(moved, "listening", {
        lastKnownPlayerTileKey: null,
        lastKnownTargetId: null,
      });
    }

    return withEnemyState(moved, "investigating", {
      lastKnownPlayerTileKey: toTileKey(knownTargetTile),
      lastKnownTargetId: null,
    });
  }

  if (current.behavior === "territorial") {
    if (distanceFromHome > 0) {
      const homebound = moveEnemyOneStep(current, homeTile, lookup);
      return withEnemyState(homebound, distanceFromHome <= 1 ? "idle" : "patrol", {
        lastKnownPlayerTileKey: null,
        lastKnownTargetId: null,
      });
    }

    return withEnemyState(current, "idle", {
      lastKnownPlayerTileKey: null,
      lastKnownTargetId: null,
    });
  }

  if (current.behavior === "ambusher") {
    return withEnemyState(current, "ambushing", {
      lastKnownPlayerTileKey: null,
      lastKnownTargetId: null,
    });
  }

  const pacedEnemy = advancePatrol(current, config, lookup);

  return withEnemyState(
    pacedEnemy,
    pacedEnemy.x === current.x && pacedEnemy.y === current.y ? "idle" : "patrol",
    {
      lastKnownPlayerTileKey: null,
      lastKnownTargetId: null,
    },
  );
}

export function getVisibleNeighbors(origin: PlayerPosition) {
  return getTileNeighbors(worldToTile(origin)).map(tileToWorld);
}
