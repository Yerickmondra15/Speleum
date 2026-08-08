/**
 * Canonical, mode-independent Speleum rules.
 *
 * The browser and authoritative multiplayer server both consume these values.
 * Mode-specific orchestration belongs in the UI/server, never a second copy of
 * these rules.
 */
export const GAMEPLAY_RULES = {
  map: {
    width: 5_200,
    height: 3_200,
    tileSize: 80,
  },
  ranges: {
    visionTiles: 8,
    defaultMovementTiles: 4,
    playerAttackTiles: 3,
    enemyAttackTiles: 1,
    parryTiles: 3,
    hearingTiles: 12,
    defaultDetectionTiles: 5,
    radarTiles: 18,
  },
  timing: {
    moveBaseCooldownMs: 1_000,
    moveDistanceCooldownMs: 850,
    moveMaxCooldownMs: 7_000,
    moveBurstIdleMs: 220,
    movementStepIntervalMs: 80,
    aiDecisionIntervalMs: 80,
    attackCooldownMs: 950,
    parryWindowMs: 850,
    parryCooldownMs: 4_800,
    stunDurationMs: 2_400,
    missedParryStunMs: 1_400,
    enemyMoveMinCooldownMs: 900,
    enemyMoveMaxCooldownMs: 1_400,
  },
  combat: {
    playerAttackDamage: 30,
    caveAttackDamage: 18,
  },
  entities: {
    playerRadius: 24,
    enemyRadius: 26,
    defaultPlayerMaxHealth: 100,
  },
} as const;

export const SURVIVAL_RULES = {
  shelter: {
    activationMs: 2_800,
    healFraction: 0.22,
    usesPerShelter: 1,
  },
  sanity: {
    warningAfterMs: 10_000,
    damageAfterMs: 20_000,
    damageIntervalMs: 2_000,
    damageFraction: 0.05,
  },
  terrain: {
    waterMoveCooldownMultiplier: 1.25,
    waterNoiseMultiplier: 1.3,
  },
  multiplayer: {
    playerKillHealFraction: 0.2,
  },
} as const;

export const CAVE_WIDTH: number = GAMEPLAY_RULES.map.width;
export const CAVE_HEIGHT: number = GAMEPLAY_RULES.map.height;
export const TILE_SIZE: number = GAMEPLAY_RULES.map.tileSize;
export const MAP_COLS = CAVE_WIDTH / TILE_SIZE;
export const MAP_ROWS = CAVE_HEIGHT / TILE_SIZE;

export const PLAYER_RADIUS: number = GAMEPLAY_RULES.entities.playerRadius;
export const ENEMY_RADIUS: number = GAMEPLAY_RULES.entities.enemyRadius;
export const PLAYER_MAX_HEALTH: number = GAMEPLAY_RULES.entities.defaultPlayerMaxHealth;
export const MAX_HEALTH = PLAYER_MAX_HEALTH;

export const TILE_VISION_RADIUS: number = GAMEPLAY_RULES.ranges.visionTiles;
export const VISION_TILE_SIZE = TILE_SIZE;
export const VISION_RADIUS = TILE_SIZE * TILE_VISION_RADIUS;
export const PLAYER_MOVE_RANGE_TILES: number = GAMEPLAY_RULES.ranges.defaultMovementTiles;
export const PLAYER_ATTACK_RANGE_TILES: number = GAMEPLAY_RULES.ranges.playerAttackTiles;
export const ENEMY_ATTACK_RANGE_TILES: number = GAMEPLAY_RULES.ranges.enemyAttackTiles;
export const PARRY_RANGE_TILES: number = GAMEPLAY_RULES.ranges.parryTiles;
export const HEARING_RANGE_TILES: number = GAMEPLAY_RULES.ranges.hearingTiles;
export const DEFAULT_DETECTION_RANGE_TILES: number = GAMEPLAY_RULES.ranges.defaultDetectionTiles;
export const RADAR_SIGNAL_RANGE_TILES: number = GAMEPLAY_RULES.ranges.radarTiles;

export const MOVE_BASE_COOLDOWN = GAMEPLAY_RULES.timing.moveBaseCooldownMs;
export const MOVE_DISTANCE_COOLDOWN = GAMEPLAY_RULES.timing.moveDistanceCooldownMs;
export const MOVE_MAX_COOLDOWN = GAMEPLAY_RULES.timing.moveMaxCooldownMs;
export const MOVE_BURST_IDLE_MS = GAMEPLAY_RULES.timing.moveBurstIdleMs;
export const MOVEMENT_STEP_INTERVAL_MS = GAMEPLAY_RULES.timing.movementStepIntervalMs;
export const ENEMY_MOVE_INTERVAL = GAMEPLAY_RULES.timing.aiDecisionIntervalMs;
export const ATTACK_COOLDOWN = GAMEPLAY_RULES.timing.attackCooldownMs;
export const PARRY_WINDOW_MS = GAMEPLAY_RULES.timing.parryWindowMs;
export const PARRY_COOLDOWN_MS = GAMEPLAY_RULES.timing.parryCooldownMs;
export const STUN_DURATION_MS = GAMEPLAY_RULES.timing.stunDurationMs;
export const MISSED_PARRY_STUN_MS = GAMEPLAY_RULES.timing.missedParryStunMs;

export const ATTACK_RADIUS = TILE_SIZE * PLAYER_ATTACK_RANGE_TILES;
export const PLAYER_ATTACK_DAMAGE = GAMEPLAY_RULES.combat.playerAttackDamage;
export const CAVE_ATTACK_DAMAGE = GAMEPLAY_RULES.combat.caveAttackDamage;

export type EnemyPacingBehavior =
  | "stalker"
  | "territorial"
  | "wanderer"
  | "ambusher"
  | "aggressive";

function stableUnitInterval(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

export function calculateEnemyMoveCooldown(
  speedWorldUnitsPerSecond: number,
  behavior?: EnemyPacingBehavior,
  enemyId = "enemy",
  isChasing = false,
) {
  if (behavior) {
    const range: readonly [number, number] =
      isChasing
        ? behavior === "aggressive"
          ? [900, 950]
          : behavior === "stalker"
            ? [920, 980]
            : behavior === "ambusher"
              ? [960, 1_020]
              : [940, 1_000]
        : behavior === "aggressive"
          ? [1_000, 1_100]
          : behavior === "stalker"
            ? [1_050, 1_180]
            : behavior === "ambusher"
              ? [1_250, 1_400]
              : [1_120, 1_300];
    const jitter = stableUnitInterval(`${enemyId}:${isChasing ? "chase" : "pace"}`);
    return Math.round(range[0] + (range[1] - range[0]) * jitter);
  }

  if (!Number.isFinite(speedWorldUnitsPerSecond) || speedWorldUnitsPerSecond <= 0) {
    return GAMEPLAY_RULES.timing.enemyMoveMaxCooldownMs;
  }

  const tileTravelMs = Math.round((TILE_SIZE / speedWorldUnitsPerSecond) * 1_000);
  return Math.min(
    GAMEPLAY_RULES.timing.enemyMoveMaxCooldownMs,
    Math.max(GAMEPLAY_RULES.timing.enemyMoveMinCooldownMs, tileTravelMs),
  );
}
