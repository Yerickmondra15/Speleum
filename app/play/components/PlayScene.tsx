"use client";

import { useEffect, useMemo, useState } from "react";
import type { CharacterOption } from "../gameConfig";
import { characterOptions } from "../gameConfig";
import { CharacterSelect } from "./CharacterSelect";
import { TacticalGame } from "./TacticalGame";
import { PlayMenu } from "./PlayMenu";
import { MatchmakingScreen } from "./MatchmakingScreen";
import { LoadingCaveScreen } from "./LoadingCaveScreen";
import { useAuth } from "../../auth/AuthProvider";

type Screen = "menu" | "characters" | "searching" | "loading" | "game";
const SELECTED_CREATURE_KEY = "speleum.selectedCreature.v1";

export function PlayScene() {
  const { user, updateActiveCreature } = useAuth();
  const [screen, setScreen] = useState<Screen>("menu");
  const [storedCharacterId, setStoredCharacterId] = useState(() => {
    if (typeof window === "undefined") return "cave-axolotl";

    return (
      window.localStorage.getItem(SELECTED_CREATURE_KEY) ?? "cave-axolotl"
    );
  });
  const selectedCharacterId = user?.activeCreatureId ?? storedCharacterId;

  const selectedCharacter = useMemo<CharacterOption>(() => {
    return (
      characterOptions.find((option) => option.id === selectedCharacterId) ??
      characterOptions[0]
    );
  }, [selectedCharacterId]);

  const selectCharacter = (character: CharacterOption) => {
    setStoredCharacterId(character.id);
    window.localStorage.setItem(SELECTED_CREATURE_KEY, character.id);
    updateActiveCreature(character.id);
  };

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

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-16 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.07),transparent_70%)] blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-[linear-gradient(to_top,rgba(82,9,20,0.22),transparent)]" />
      </div>

      {screen === "menu" && (
        <PlayMenu
          selectedCharacter={selectedCharacter}
          onOpenCharacters={() => setScreen("characters")}
          onStart={() => setScreen("searching")}
        />
      )}

      {screen === "characters" && (
        <CharacterSelect
          selectedCharacterId={selectedCharacterId}
          onBack={() => setScreen("menu")}
          onSelect={selectCharacter}
          onStart={() => setScreen("searching")}
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

      {screen === "game" && (
        <TacticalGame
          selectedCharacter={selectedCharacter}
          onExitToMenu={() => setScreen("menu")}
        />
      )}
    </main>
  );
}
