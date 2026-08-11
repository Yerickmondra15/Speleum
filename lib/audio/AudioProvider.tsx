"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  AudioController,
  defaultAudioPreferences,
  type AudioPreferences,
  type SpeleumSfx,
} from "@/lib/audio/audio";
import { WebAudioRuntime } from "@/lib/audio/web-audio-runtime";

type AudioContextValue = {
  preferences: AudioPreferences;
  updatePreferences: (patch: Partial<AudioPreferences>) => void;
  unlock: () => void;
  setAmbientActive: (active: boolean) => void;
  playSfx: (effect: SpeleumSfx) => boolean;
};

const SpeleumAudioContext = createContext<AudioContextValue | null>(null);

export function AudioProvider({ children }: { children: ReactNode }) {
  const controllerRef = useRef<AudioController | null>(null);
  const [preferences, setPreferences] = useState(defaultAudioPreferences);

  useEffect(() => {
    const controller = new AudioController(new WebAudioRuntime(), window.localStorage);
    controllerRef.current = controller;
    const hydratePreferences = window.setTimeout(
      () => setPreferences(controller.getPreferences()),
      0,
    );

    const unlockOnInteraction = () => void controller.unlock();
    window.addEventListener("pointerdown", unlockOnInteraction, { once: true });
    window.addEventListener("keydown", unlockOnInteraction, { once: true });

    return () => {
      window.removeEventListener("pointerdown", unlockOnInteraction);
      window.removeEventListener("keydown", unlockOnInteraction);
      window.clearTimeout(hydratePreferences);
      controller.dispose();
      controllerRef.current = null;
    };
  }, []);

  const updatePreferences = useCallback((patch: Partial<AudioPreferences>) => {
    const next = controllerRef.current?.updatePreferences(patch);
    if (next) setPreferences(next);
  }, []);
  const unlock = useCallback(() => {
    void controllerRef.current?.unlock();
  }, []);
  const setAmbientActive = useCallback((active: boolean) => {
    controllerRef.current?.setAmbientActive(active);
  }, []);
  const playSfx = useCallback(
    (effect: SpeleumSfx) => controllerRef.current?.play(effect) ?? false,
    [],
  );

  const value = useMemo<AudioContextValue>(
    () => ({ preferences, updatePreferences, unlock, setAmbientActive, playSfx }),
    [playSfx, preferences, setAmbientActive, unlock, updatePreferences],
  );

  return (
    <SpeleumAudioContext.Provider value={value}>
      {children}
    </SpeleumAudioContext.Provider>
  );
}

export function useAudio() {
  const value = useContext(SpeleumAudioContext);
  if (!value) throw new Error("useAudio must be used inside AudioProvider.");
  return value;
}
