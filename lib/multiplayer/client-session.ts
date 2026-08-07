import type { MultiplayerSession } from "@/app/play/types";

const MULTIPLAYER_SESSION_KEY = "speleum.multiplayer.session.v1";
const roomCodePattern = /^[A-HJ-NP-Z2-9]{6}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function readMultiplayerSession() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(MULTIPLAYER_SESSION_KEY);
    const value = raw ? (JSON.parse(raw) as Partial<MultiplayerSession>) : null;

    if (
      !value ||
      typeof value.matchId !== "string" ||
      !uuidPattern.test(value.matchId) ||
      typeof value.roomCode !== "string" ||
      !roomCodePattern.test(value.roomCode) ||
      typeof value.playerId !== "string" ||
      value.playerId.length > 128 ||
      typeof value.playerName !== "string" ||
      value.playerName.length > 18 ||
      typeof value.characterId !== "string" ||
      value.characterId.length > 32
    ) {
      return null;
    }

    return value as MultiplayerSession;
  } catch {
    return null;
  }
}

export function writeMultiplayerSession(session: MultiplayerSession) {
  window.sessionStorage.setItem(MULTIPLAYER_SESSION_KEY, JSON.stringify(session));
}

export function clearMultiplayerSession() {
  window.sessionStorage.removeItem(MULTIPLAYER_SESSION_KEY);
}
