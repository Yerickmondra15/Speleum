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
  clampTile,
  getTileNeighbors,
  isWalkableTile,
  stepTowardTile,
  tileDistance,
  tileToWorld,
  worldToTile,
} from "./tileMap";

export type EnemyBehaviorState = "idle" | "patrol" | "alerted" | "attacking" | "dead";
export type ThreatLevel = "calm" | "uneasy" | "hunted" | "doomed";

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
  lastKnownPlayerTileKey: string | null;
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
    case "alerted":
      return "alerted";
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

export function canStandAt(position: PlayerPosition, radius = PLAYER_RADIUS) {
  return !caveWalls.some((wall) => circleIntersectsRect(position, radius, wall));
}

export function canTravelBetween(
  from: PlayerPosition,
  to: PlayerPosition,
  radius = PLAYER_RADIUS,
) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.ceil(distance / 18));

  for (let index = 1; index <= steps; index += 1) {
    const progress = index / steps;
    const sample = {
      x: from.x + (to.x - from.x) * progress,
      y: from.y + (to.y - from.y) * progress,
    };

    if (!canStandAt(sample, radius)) {
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
) {
  const intendedPosition = clampToMap(
    {
      x: from.x + delta.x,
      y: from.y + delta.y,
    },
    radius,
  );

  if (canTravelBetween(from, intendedPosition, radius)) {
    return intendedPosition;
  }

  const horizontalStep = clampToMap(
    {
      x: from.x + delta.x,
      y: from.y,
    },
    radius,
  );

  if (canTravelBetween(from, horizontalStep, radius)) {
    return horizontalStep;
  }

  const verticalStep = clampToMap(
    {
      x: from.x,
      y: from.y + delta.y,
    },
    radius,
  );

  if (canTravelBetween(from, verticalStep, radius)) {
    return verticalStep;
  }

  return from;
}

export function moveTowardPosition(
  from: PlayerPosition,
  target: PlayerPosition,
  maxDistance: number,
  radius = PLAYER_RADIUS,
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
  );
}

export function getZoneForPosition(position: PlayerPosition, zones: Zone[]) {
  return zones.find((zone) => pointInRect(position, zone)) ?? zones[0];
}

export function hitHazard(position: PlayerPosition, hazards: HazardArea[]) {
  return hazards.some((hazard) => circleIntersectsRect(position, PLAYER_RADIUS, hazard));
}

export function reachedGoal(position: PlayerPosition, goal: GoalArea) {
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

  if (enemyState === "alerted" || enemyState === "attacking") {
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
    state: config.behavior === "territorial" ? "idle" : "patrol",
    patrolIndex: 0,
    lastKnownPlayerTileKey: null,
  };
}

function moveEnemyOneStep(
  current: EnemyState,
  target: TileCoordinate,
): EnemyState {
  const currentTile = worldToTile(current);
  const nextTile = stepTowardTile(currentTile, target);

  if (nextTile.col === currentTile.col && nextTile.row === currentTile.row) {
    return current;
  }

  const nextPosition = tileToWorld(nextTile);

  return {
    ...current,
    x: nextPosition.x,
    y: nextPosition.y,
  };
}

function advancePatrol(current: EnemyState, config: EnemyConfig): EnemyState {
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
    };
  }

  return moveEnemyOneStep(current, patrolTile);
}

export function updateEnemyState(
  current: EnemyState,
  player: PlayerPosition,
  config: EnemyConfig,
  _deltaSeconds: number,
  gameStatus: GameStatus,
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
  const playerTile = worldToTile(player);
  const homeTile = worldToTile(config.start);
  const distanceToPlayer = tileDistance(enemyTile, playerTile);
  const distanceFromHome = tileDistance(enemyTile, homeTile);
  const inAttackRange = distanceToPlayer <= current.attackRangeTiles;
  const detectsPlayer = distanceToPlayer <= current.detectionRangeTiles;
  const lostPlayer = distanceToPlayer > current.giveUpRangeTiles;
  const playerInsideTerritory = tileDistance(playerTile, homeTile) <= current.tetherRangeTiles;

  if (inAttackRange) {
    return {
      ...current,
      state: "attacking",
      lastKnownPlayerTileKey: `${playerTile.col},${playerTile.row}`,
    };
  }

  if (current.behavior === "stalker") {
    if (detectsPlayer || (current.state === "alerted" && !lostPlayer)) {
      return {
        ...moveEnemyOneStep(current, playerTile),
        state: "alerted",
        lastKnownPlayerTileKey: `${playerTile.col},${playerTile.row}`,
      };
    }

    return {
      ...advancePatrol(current, config),
      state: "patrol",
      lastKnownPlayerTileKey: null,
    };
  }

  if (current.behavior === "territorial") {
    if (detectsPlayer && playerInsideTerritory && distanceFromHome <= current.tetherRangeTiles + 1) {
      return {
        ...moveEnemyOneStep(current, playerTile),
        state: "alerted",
        lastKnownPlayerTileKey: `${playerTile.col},${playerTile.row}`,
      };
    }

    if (distanceFromHome > 0) {
      return {
        ...moveEnemyOneStep(current, homeTile),
        state: distanceFromHome <= 1 ? "idle" : "patrol",
        lastKnownPlayerTileKey: null,
      };
    }

    return {
      ...current,
      state: "idle",
      lastKnownPlayerTileKey: null,
    };
  }

  if (detectsPlayer || (current.state === "alerted" && !lostPlayer)) {
    return {
      ...moveEnemyOneStep(current, playerTile),
      state: "alerted",
      lastKnownPlayerTileKey: `${playerTile.col},${playerTile.row}`,
    };
  }

  const pacedEnemy = advancePatrol(current, config);

  return {
    ...pacedEnemy,
    state:
      pacedEnemy.x === current.x && pacedEnemy.y === current.y
        ? "idle"
        : "patrol",
    lastKnownPlayerTileKey: null,
  };
}

export function getVisibleNeighbors(origin: PlayerPosition) {
  return getTileNeighbors(worldToTile(origin)).map(tileToWorld);
}
