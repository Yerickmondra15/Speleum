"use client";

import { Heart, Pause, Play, Target } from "lucide-react";
import type { Zone } from "../gameConfig";

type GameHudProps = {
  zone: Zone;
  objective: string;
  message: string;
  zoneMessage: string | null;
  health: number;
  maxHealth: number;
  sanity?: number;
  maxSanity?: number;
  aliveCount?: number;
  enemyStateLabel: string;
  isPaused: boolean;
  onTogglePause?: () => void;
};

export function GameHud({
  zone,
  objective,
  message,
  zoneMessage,
  health,
  maxHealth,
  sanity,
  maxSanity,
  aliveCount,
  enemyStateLabel,
  isPaused,
  onTogglePause,
}: GameHudProps) {
  return (
    <>
      <div className="pointer-events-none absolute left-4 top-24 z-70 max-w-sm rounded-[1.25rem] border border-white/10 bg-black/55 p-4 backdrop-blur-md">
        <p className="text-xs tracking-[0.25em] text-zinc-500">{zone.subtitle}</p>
        <h2 className="mt-1 text-lg font-semibold text-white">{zone.name}</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-300">{message}</p>
        {zoneMessage && (
          <p className="mt-3 rounded-xl border border-rose-200/10 bg-rose-200/5 px-3 py-2 text-xs tracking-[0.08em] text-rose-100/85">
            {zoneMessage}
          </p>
        )}
      </div>

      <div className="pointer-events-none absolute left-4 top-[15.8rem] z-70 hidden w-76 rounded-[1.25rem] border border-white/10 bg-black/45 p-4 backdrop-blur-md sm:block">
        <div className="flex items-center justify-between text-xs tracking-[0.2em] text-zinc-500">
          <span className="inline-flex items-center gap-2">
            <Target className="h-4 w-4" />
            OBJETIVO
          </span>
          <span>{enemyStateLabel}</span>
        </div>
        <p className="mt-2 text-sm text-zinc-200">{objective}</p>
        <div className="mt-4 flex items-center justify-between text-xs text-zinc-400">
          <span className="inline-flex items-center gap-2">
            <Heart className="h-4 w-4 text-rose-200" />
            Vida
          </span>
          <span className="text-zinc-200">
            {health}/{maxHealth}
          </span>
        </div>
        {typeof sanity === "number" && typeof maxSanity === "number" && (
          <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
            <span>Sanidad</span>
            <span className="text-zinc-200">
              {Math.round(sanity)}/{maxSanity}
            </span>
          </div>
        )}
        {typeof aliveCount === "number" && (
          <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
            <span>Supervivientes</span>
            <span className="text-zinc-200">{aliveCount}</span>
          </div>
        )}
      </div>

      {onTogglePause && (
        <button
          type="button"
          onClick={onTogglePause}
          className="absolute right-4 top-4 z-72 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/55 px-4 py-2 text-sm text-zinc-300 backdrop-blur-md transition hover:text-white"
        >
          {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          {isPaused ? "Reanudar" : "Pausa"}
        </button>
      )}
    </>
  );
}
