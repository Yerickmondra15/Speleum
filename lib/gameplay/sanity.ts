import { SURVIVAL_RULES } from "@/lib/gameplay/rules";

export type SanityStage = "stable" | "warning" | "pressure" | "damaging";
export type SanityBand = SanityStage;

export type SanityState = {
  lastMeaningfulMoveAt: number;
  lastPositionKey: string;
  idleDurationMs: number;
  stage: SanityStage;
  nextDamageAt: number;
};

export type SanityUpdate = {
  state: SanityState;
  damage: number;
};

export function createSanityState(now = 0, positionKey = "unknown"): SanityState {
  return {
    lastMeaningfulMoveAt: now,
    lastPositionKey: positionKey,
    idleDurationMs: 0,
    stage: "stable",
    nextDamageAt: now + SURVIVAL_RULES.sanity.damageAfterMs,
  };
}

export function sanityStageForIdle(idleDurationMs: number): SanityStage {
  if (idleDurationMs < SURVIVAL_RULES.sanity.warningAfterMs) return "stable";
  if (idleDurationMs < 15_000) return "warning";
  if (idleDurationMs < SURVIVAL_RULES.sanity.damageAfterMs) return "pressure";
  return "damaging";
}

export function updateSanityForPosition({
  state,
  positionKey,
  now,
  maxHealth,
  paused = false,
}: {
  state: SanityState;
  positionKey: string;
  now: number;
  maxHealth: number;
  paused?: boolean;
}): SanityUpdate {
  if (paused) return { state, damage: 0 };

  if (positionKey !== state.lastPositionKey) {
    return {
      state: createSanityState(now, positionKey),
      damage: 0,
    };
  }

  const idleDurationMs = Math.max(0, now - state.lastMeaningfulMoveAt);
  const stage = sanityStageForIdle(idleDurationMs);
  let damage = 0;
  let nextDamageAt = state.nextDamageAt;

  if (stage === "damaging" && now >= nextDamageAt) {
    damage = Math.max(1, Math.round(maxHealth * SURVIVAL_RULES.sanity.damageFraction));
    nextDamageAt = now + SURVIVAL_RULES.sanity.damageIntervalMs;
  }

  return {
    state: { ...state, idleDurationMs, stage, nextDamageAt },
    damage,
  };
}

export function shiftSanityTimeline(state: SanityState, deltaMs: number): SanityState {
  return {
    ...state,
    lastMeaningfulMoveAt: state.lastMeaningfulMoveAt + deltaMs,
    nextDamageAt: state.nextDamageAt + deltaMs,
  };
}

export function getSanityBand(value: number): SanityBand {
  return sanityStageForIdle(Math.max(0, 100 - value) * 200);
}

export function getSanityEffects(stageOrValue: SanityStage | number) {
  const stage = typeof stageOrValue === "number" ? getSanityBand(stageOrValue) : stageOrValue;
  if (stage === "stable") return { darkness: 0, vignette: 0, pulse: 0 };
  if (stage === "warning") return { darkness: 0.12, vignette: 0.22, pulse: 0.12 };
  if (stage === "pressure") return { darkness: 0.22, vignette: 0.4, pulse: 0.28 };
  return { darkness: 0.32, vignette: 0.62, pulse: 0.48 };
}
