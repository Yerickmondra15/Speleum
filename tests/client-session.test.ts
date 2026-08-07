import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MultiplayerStatePayload } from "@/app/play/types";
import {
  clearMultiplayerSession,
  multiplayerSessionFromState,
  readMultiplayerSession,
  writeMultiplayerSession,
} from "@/lib/multiplayer/client-session";

function createMemoryStorage() {
  const values = new Map<string, string>();

  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("sesion multijugador del cliente", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { sessionStorage: createMemoryStorage() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("deriva y persiste la identidad autoritativa recibida en el snapshot", () => {
    const state = {
      matchId: "3f89c7e4-91d7-4fca-981b-8871f88cc714",
      roomCode: "ABC234",
      self: {
        id: "player-authoritative-id",
        name: "Criatura",
        characterId: "blind-fish",
      },
    } as Pick<MultiplayerStatePayload, "matchId" | "roomCode" | "self">;

    const session = multiplayerSessionFromState(state);
    writeMultiplayerSession(session);

    expect(readMultiplayerSession()).toEqual(session);
    expect(session).toMatchObject({
      playerId: state.self.id,
      playerName: state.self.name,
      characterId: state.self.characterId,
    });
  });

  it("limpia una sesion stale cuando la recuperacion termina", () => {
    writeMultiplayerSession({
      matchId: "3f89c7e4-91d7-4fca-981b-8871f88cc714",
      roomCode: "ABC234",
      playerId: "player-id",
      playerName: "Host",
      characterId: "cave-axolotl",
    });

    clearMultiplayerSession();

    expect(readMultiplayerSession()).toBeNull();
  });
});
