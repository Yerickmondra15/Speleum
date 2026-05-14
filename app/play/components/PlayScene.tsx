"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CharacterOption } from "../gameConfig";
import { characterOptions } from "../gameConfig";
import { CharacterSelect } from "./CharacterSelect";
import { TacticalGame } from "./TacticalGame";
import { PlayMenu } from "./PlayMenu";
import { MatchmakingScreen } from "./MatchmakingScreen";
import { LoadingCaveScreen } from "./LoadingCaveScreen";
import { MultiplayerMenu } from "./MultiplayerMenu";
import { MultiplayerGame } from "./MultiplayerGame";
import { useAuth } from "../../auth/AuthProvider";

type Screen =
  | "menu"
  | "characters"
  | "searching"
  | "loading"
  | "game"
  | "multiplayer-menu"
  | "multiplayer-game";
type PlayMode = "local" | "multiplayer";
const SELECTED_CREATURE_KEY = "speleum.selectedCreature.v1";

export function PlayScene() {
  const router = useRouter();
  const { user, status, updateActiveCreature } = useAuth();
  const [screen, setScreen] = useState<Screen>("menu");
  const [playMode, setPlayMode] = useState<PlayMode>("local");
  const [multiplayerSession, setMultiplayerSession] = useState<{
    matchId: string;
    roomCode: string;
    playerId: string;
    playerName: string;
    characterId: string;
  } | null>(null);
  const [storedCharacterId, setStoredCharacterId] = useState(() => {
    if (typeof window === "undefined") return "cave-axolotl";

    return (
      window.localStorage.getItem(SELECTED_CREATURE_KEY) ?? "cave-axolotl"
    );
  });
  const selectedCharacterId = user?.activeCreature ?? storedCharacterId;

  const selectedCharacter = useMemo<CharacterOption>(() => {
    return (
      characterOptions.find((option) => option.id === selectedCharacterId) ??
      characterOptions[0]
    );
  }, [selectedCharacterId]);

  const selectCharacter = (character: CharacterOption) => {
    setStoredCharacterId(character.id);
    window.localStorage.setItem(SELECTED_CREATURE_KEY, character.id);
    void updateActiveCreature(character.id);
  };

  useEffect(() => {
    if (status === "signed-out") {
      router.replace("/login");
    }
  }, [router, status]);

  useEffect(() => {
    if (screen !== "searching") {
      return;
    }

    const timer = window.setTimeout(() => setScreen("loading"), 3400);

    return () => window.clearTimeout(timer);
  }, [screen]);

  useEffect(() => {
    if (screen !== "loading") {
      return;
    }

    const timer = window.setTimeout(() => setScreen("game"), 3600);

    return () => window.clearTimeout(timer);
  }, [screen]);

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-zinc-400">
        Cargando expedicion...
      </main>
    );
  }

  return (
    <main className="relative h-dvh min-h-dvh overflow-hidden bg-black text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-16 h-136 w-136 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.07),transparent_70%)] blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-[linear-gradient(to_top,rgba(82,9,20,0.22),transparent)]" />
      </div>

      {screen === "menu" && (
        <PlayMenu
          selectedCharacter={selectedCharacter}
          onOpenCharacters={() => setScreen("characters")}
          onStartLocal={() => {
            setPlayMode("local");
            setScreen("searching");
          }}
          onStartMultiplayer={() => {
            setPlayMode("multiplayer");
            setScreen("multiplayer-menu");
          }}
        />
      )}

      {screen === "characters" && (
        <CharacterSelect
          selectedCharacterId={selectedCharacterId}
          onBack={() => setScreen("menu")}
          onSelect={selectCharacter}
          onStart={() =>
            setScreen(playMode === "multiplayer" ? "multiplayer-menu" : "searching")
          }
        />
      )}

      {screen === "searching" && (
        <MatchmakingScreen
          selectedCharacter={selectedCharacter}
          onCancel={() => setScreen("menu")}
        />
      )}

      {screen === "loading" && (
        <LoadingCaveScreen selectedCharacter={selectedCharacter} />
      )}

      {screen === "multiplayer-menu" && (
        <MultiplayerMenu
          selectedCharacter={selectedCharacter}
          defaultPlayerName={user?.username ?? "Explorador"}
          onBack={() => setScreen("menu")}
          onGameStart={(session) => {
            setMultiplayerSession(session);
            setScreen("multiplayer-game");
          }}
        />
      )}

      {screen === "game" && (
        <TacticalGame
          selectedCharacter={selectedCharacter}
          onExitToMenu={() => setScreen("menu")}
        />
      )}

      {screen === "multiplayer-game" && multiplayerSession && (
        <MultiplayerGame
          matchId={multiplayerSession.matchId}
          roomCode={multiplayerSession.roomCode}
          selectedCharacter={selectedCharacter}
          onExitToMenu={() => {
            setMultiplayerSession(null);
            setScreen("menu");
          }}
        />
      )}
    </main>
  );
}
