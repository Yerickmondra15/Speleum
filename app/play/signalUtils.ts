import { TILE_SIZE, type PlayerPosition } from "./gameConfig";
import type { RadarSignal, SignalType } from "./types";
import { createGameplayEventId } from "@/lib/gameplay/event-ids";

const SIGNAL_BUFFER_LIMIT = 24;
const MOVE_SIGNAL_MERGE_WINDOW_MS = 180;
const DEFEND_SIGNAL_MERGE_WINDOW_MS = 260;
const POSITION_MERGE_RADIUS = TILE_SIZE * 1.35;

type CreateRadarSignalInput = {
  type: SignalType;
  strength: RadarSignal["strength"];
  position: PlayerPosition;
  duration: number;
  radarJitter: number;
  ownerId?: string;
  createdAt?: number;
  id?: string;
};

function distanceBetweenPoints(left: PlayerPosition, right: PlayerPosition) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function shouldMergeSignal(current: RadarSignal, next: RadarSignal) {
  if (current.type !== next.type || current.ownerId !== next.ownerId) {
    return false;
  }

  if (next.type === "move") {
    return (
      next.createdAt - current.createdAt <= MOVE_SIGNAL_MERGE_WINDOW_MS &&
      distanceBetweenPoints(current, next) <= POSITION_MERGE_RADIUS
    );
  }

  if (next.type === "defend") {
    return (
      next.createdAt - current.createdAt <= DEFEND_SIGNAL_MERGE_WINDOW_MS &&
      distanceBetweenPoints(current, next) <= POSITION_MERGE_RADIUS
    );
  }

  return false;
}

export function createRadarSignal({
  type,
  strength,
  position,
  duration,
  radarJitter,
  ownerId,
  createdAt = Date.now(),
  id,
}: CreateRadarSignalInput): RadarSignal {
  return {
    id: id ?? createGameplayEventId("signal", ownerId, createdAt),
    type,
    strength,
    x: position.x,
    y: position.y,
    createdAt,
    duration,
    radarJitter,
    ownerId,
  };
}

export function upsertRadarSignal(
  currentSignals: RadarSignal[],
  nextSignal: RadarSignal,
) {
  for (let index = currentSignals.length - 1; index >= 0; index -= 1) {
    const currentSignal = currentSignals[index];

    if (!shouldMergeSignal(currentSignal, nextSignal)) {
      continue;
    }

    return currentSignals.map((signal, signalIndex) =>
      signalIndex === index
        ? {
            ...signal,
            x: nextSignal.x,
            y: nextSignal.y,
            createdAt: nextSignal.createdAt,
            duration: nextSignal.duration,
            radarJitter: nextSignal.radarJitter,
            strength: nextSignal.strength,
          }
        : signal,
    );
  }

  return [...currentSignals.slice(-(SIGNAL_BUFFER_LIMIT - 1)), nextSignal];
}

export function pruneExpiredRadarSignals(signals: RadarSignal[], now = Date.now()) {
  return signals.filter((signal) => now - signal.createdAt < signal.duration);
}
