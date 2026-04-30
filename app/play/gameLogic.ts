import type {
  EnemyConfig,
  GameStatus,
  GoalArea,
  HazardArea,
  PlayerPosition,
  Rect,
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
  MOVING_SANITY_RECOVERY,
  ENEMY_RADIUS,
  PLAYER_RADIUS,
  SAFE_ZONE_SANITY_RECOVERY,
  SANITY_DAMAGE_PER_TICK,
  SANITY_DAMAGE_THRESHOLD,
  THREAT_DEATH_MS,
  THREAT_HUNT_MS,
  THREAT_WARNING_MS,
  caveWalls,
} from "./gameConfig";

export type EnemyMode = "patrol" | "chase";
export type ThreatLevel = "calm" | "uneasy" | "hunted" | "doomed";

export type EnemyState = {
  x: number;
  y: number;
  mode: EnemyMode;
  patrolIndex: number;
};

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function distanceBetween(a: PlayerPosition, b: PlayerPosition) {
  return Math.hypot(a.x - b.x, a.y - b.y);
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

  return Math.round(
    (MOVE_BASE_COOLDOWN + distance * MOVE_DISTANCE_COOLDOWN) *
      moveCooldownMultiplier,
  );
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
  enemyMode: EnemyMode,
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

  if (enemyMode === "chase") {
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
    x: config.start.x,
    y: config.start.y,
    mode: "patrol",
    patrolIndex: 0,
  };
}

export function updateEnemyState(
  current: EnemyState,
  player: PlayerPosition,
  config: EnemyConfig,
  deltaSeconds: number,
  gameStatus: GameStatus,
) {
  if (gameStatus !== "playing") {
    return current;
  }

  const enemyPosition = { x: current.x, y: current.y };
  const playerDistance = distanceBetween(enemyPosition, player);
  const shouldChase = playerDistance <= config.detectionRange;
  const shouldReturnToPatrol =
    current.mode === "chase" && playerDistance >= config.giveUpRange;
  const targetMode: EnemyMode =
    shouldChase || (!shouldReturnToPatrol && current.mode === "chase")
      ? "chase"
      : "patrol";

  const patrolTarget = config.patrolPoints[current.patrolIndex] ?? config.start;
  const target = targetMode === "chase" ? player : patrolTarget;
  const speed = targetMode === "chase" ? config.chaseSpeed : config.speed;
  const nextPosition = moveTowardPosition(
    enemyPosition,
    target,
    speed * deltaSeconds,
    ENEMY_RADIUS,
  );

  const reachedPatrolPoint =
    targetMode === "patrol" && distanceBetween(nextPosition, patrolTarget) < 20;

  return {
    x: nextPosition.x,
    y: nextPosition.y,
    mode: targetMode,
    patrolIndex: reachedPatrolPoint
      ? (current.patrolIndex + 1) % config.patrolPoints.length
      : current.patrolIndex,
  };
}
