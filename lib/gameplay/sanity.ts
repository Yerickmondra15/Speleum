export type SanityBand = "stable" | "tense" | "distorted" | "crisis";

export type SanityState = {
  value: number;
  lastMeaningfulActionAt: number;
  lastAppliedAt: Partial<Record<SanityEvent["type"], number>>;
};

export type SanityEvent =
  | { type: "move" | "attack" | "defend" | "ability"; now: number }
  | { type: "safe-zone"; now: number }
  | { type: "took-damage"; now: number; amount: number }
  | { type: "hostile-nearby"; now: number; distanceTiles: number }
  | { type: "prolonged-idle"; now: number };

const EVENT_COOLDOWNS: Partial<Record<SanityEvent["type"], number>> = {
  "safe-zone": 5_000,
  "hostile-nearby": 5_000,
  "prolonged-idle": 7_000,
};

function clampSanity(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function createSanityState(now = 0): SanityState {
  return {
    value: 100,
    lastMeaningfulActionAt: now,
    lastAppliedAt: {},
  };
}

export function getSanityBand(value: number): SanityBand {
  if (value >= 70) return "stable";
  if (value >= 40) return "tense";
  if (value >= 20) return "distorted";
  return "crisis";
}

export function getSanityEffects(value: number) {
  const band = getSanityBand(value);

  if (band === "stable") {
    return { radarJitterMultiplier: 1, falseSignalChance: 0, perceptionPenaltyTiles: 0 };
  }
  if (band === "tense") {
    return { radarJitterMultiplier: 1.15, falseSignalChance: 0.04, perceptionPenaltyTiles: 0 };
  }
  if (band === "distorted") {
    return { radarJitterMultiplier: 1.45, falseSignalChance: 0.12, perceptionPenaltyTiles: 1 };
  }
  return { radarJitterMultiplier: 1.8, falseSignalChance: 0.24, perceptionPenaltyTiles: 2 };
}

function eventDelta(state: SanityState, event: SanityEvent) {
  switch (event.type) {
    case "move":
      return state.value < 70 ? 2 : 0;
    case "attack":
      return 2;
    case "defend":
      return 1;
    case "ability":
      return 3;
    case "safe-zone":
      return 6;
    case "took-damage":
      return -Math.min(18, Math.max(6, Math.round(event.amount * 0.45)));
    case "hostile-nearby":
      return event.distanceTiles <= 1 ? -10 : event.distanceTiles <= 3 ? -7 : -4;
    case "prolonged-idle":
      return event.now - state.lastMeaningfulActionAt >= 12_000 ? -6 : 0;
  }
}

export function reduceSanity(state: SanityState, event: SanityEvent): SanityState {
  const cooldown = EVENT_COOLDOWNS[event.type] ?? 0;
  const lastAppliedAt = state.lastAppliedAt[event.type] ?? Number.NEGATIVE_INFINITY;

  if (event.now - lastAppliedAt < cooldown) {
    return state;
  }

  const meaningful = ["move", "attack", "defend", "ability"].includes(event.type);
  const delta = eventDelta(state, event);

  if (delta === 0 && !meaningful) {
    return state;
  }

  return {
    value: clampSanity(state.value + delta),
    lastMeaningfulActionAt: meaningful ? event.now : state.lastMeaningfulActionAt,
    lastAppliedAt: delta === 0
      ? state.lastAppliedAt
      : { ...state.lastAppliedAt, [event.type]: event.now },
  };
}
