let eventSequence = 0;

function normalizePart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 48) || "anonymous";
}

/**
 * Produces a stable React/transport identifier even when multiple events are
 * created in the same millisecond. The sequence is process-local because each
 * event is created only by the active authority (server or offline session).
 */
export function createGameplayEventId(
  kind: "signal" | "noise",
  ownerId: string | undefined,
  createdAt: number,
) {
  eventSequence = (eventSequence + 1) % Number.MAX_SAFE_INTEGER;
  return `${kind}:${createdAt}:${eventSequence}:${normalizePart(ownerId ?? "world")}`;
}

export function gameplayEventSeed(id: string) {
  let hash = 2_166_136_261;

  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}
