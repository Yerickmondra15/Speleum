"use client";

import Image from "next/image";
import { Heart, Pause, Play, Target } from "lucide-react";
import { getSanityStateLabel } from "../gameLogic";
import type { CharacterOption, Zone } from "../gameConfig";

type GameHudProps = {
  selectedCharacter: CharacterOption;
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
  score?: number;
  kills?: number;
  defenseActive?: boolean;
  moveCooldownRemaining?: number;
  attackCooldownRemaining?: number;
  defenseCooldownRemaining?: number;
  defenseDurationRemaining?: number;
  nearestThreatTiles?: number | null;
  nearbyDangerLabel?: string;
  detectedEnemies?: number;
  attackRangeLabel?: string;
};

function formatCooldown(value: number) {
  return value > 0 ? `${(value / 1000).toFixed(1)}s` : "listo";
}

export function GameHud({
  selectedCharacter,
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
  score = 0,
  kills = 0,
  defenseActive = false,
  moveCooldownRemaining = 0,
  attackCooldownRemaining = 0,
  defenseCooldownRemaining = 0,
  defenseDurationRemaining = 0,
  nearestThreatTiles = null,
  nearbyDangerLabel = "bajo",
  detectedEnemies = 0,
  attackRangeLabel = "3 casillas",
}: GameHudProps) {
  const sanityLabel =
    typeof sanity === "number" ? getSanityStateLabel(sanity) : null;
  const hpPercent = Math.max(0, Math.min(100, (health / maxHealth) * 100));

  return (
    <>
      <div
        className={`pointer-events-none absolute left-4 top-24 z-70 max-w-sm rounded-[1.35rem] border bg-[linear-gradient(180deg,rgba(9,9,11,0.8),rgba(22,10,15,0.72))] p-4 backdrop-blur-md ${
          sanityLabel === "critico"
            ? "border-rose-200/35 shadow-[0_0_40px_rgba(251,113,133,0.14)]"
            : "border-white/10"
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-zinc-100/90">
            <Image
              src={selectedCharacter.imageGame}
              alt={selectedCharacter.name}
              width={40}
              height={40}
              className="h-10 w-10 object-contain"
            />
          </div>
          <div>
            <p className="text-xs tracking-[0.25em] text-zinc-500">{zone.subtitle}</p>
            <h2 className="mt-1 text-lg font-semibold text-white">{zone.name}</h2>
            <p className="mt-1 text-xs text-zinc-500">{selectedCharacter.name}</p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/8 bg-black/35 px-3 py-3">
          <div className="flex items-center justify-between text-[0.7rem] tracking-[0.18em] text-zinc-500">
            <span>VIDA</span>
            <span className="text-zinc-100">
              {health}/{maxHealth}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,rgba(244,114,182,0.7),rgba(255,255,255,0.9))]"
              style={{ width: `${hpPercent}%` }}
            />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-[0.7rem] tracking-[0.16em] text-zinc-400">
          <div className="rounded-xl border border-white/8 bg-black/35 px-3 py-2">
            <p className="text-zinc-500">Pulso</p>
            <p className="mt-1 text-zinc-100">{formatCooldown(moveCooldownRemaining)}</p>
          </div>
          <div className="rounded-xl border border-white/8 bg-black/35 px-3 py-2">
            <p className="text-zinc-500">Ataque</p>
            <p className="mt-1 text-zinc-100">{formatCooldown(attackCooldownRemaining)}</p>
          </div>
          <div className="rounded-xl border border-white/8 bg-black/35 px-3 py-2">
            <p className="text-zinc-500">Coraza</p>
            <p className="mt-1 text-zinc-100">
              {defenseActive
                ? `activa · ${(defenseDurationRemaining / 1000).toFixed(1)}s`
                : formatCooldown(defenseCooldownRemaining)}
            </p>
          </div>
          <div className="rounded-xl border border-white/8 bg-black/35 px-3 py-2">
            <p className="text-zinc-500">Peligro</p>
            <p className="mt-1 text-zinc-100">{nearbyDangerLabel}</p>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-zinc-300">{message}</p>
        {zoneMessage && (
          <p className="mt-3 rounded-xl border border-rose-200/10 bg-rose-200/5 px-3 py-2 text-xs tracking-[0.08em] text-rose-100/85">
            {zoneMessage}
          </p>
        )}
      </div>

      <div className="pointer-events-none absolute left-4 top-[18.8rem] z-70 hidden w-76 rounded-[1.25rem] border border-white/10 bg-[linear-gradient(180deg,rgba(6,6,8,0.72),rgba(20,10,14,0.62))] p-4 backdrop-blur-md sm:block">
        <div className="flex items-center justify-between text-xs tracking-[0.2em] text-zinc-500">
          <span className="inline-flex items-center gap-2">
            <Target className="h-4 w-4" />
            SUPERVIVENCIA
          </span>
          <span>Zona visible</span>
        </div>
        <p className="mt-2 text-sm text-zinc-200">{objective}</p>

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-zinc-400">
          <div className="rounded-xl border border-white/8 bg-black/35 px-3 py-3">
            <p className="inline-flex items-center gap-2 text-zinc-500">
              <Heart className="h-4 w-4 text-rose-200" />
              Vida
            </p>
            <p className="mt-2 text-zinc-100">
              {health}/{maxHealth}
            </p>
          </div>
          <div className="rounded-xl border border-white/8 bg-black/35 px-3 py-3">
            <p className="text-zinc-500">Amenazas</p>
            <p className="mt-2 text-zinc-100">{enemyStateLabel}</p>
          </div>
          <div className="rounded-xl border border-white/8 bg-black/35 px-3 py-3">
            <p className="text-zinc-500">Score</p>
            <p className="mt-2 text-zinc-100">{score}</p>
          </div>
          <div className="rounded-xl border border-white/8 bg-black/35 px-3 py-3">
            <p className="text-zinc-500">Eliminaciones</p>
            <p className="mt-2 text-zinc-100">{kills}</p>
          </div>
          <div className="rounded-xl border border-white/8 bg-black/35 px-3 py-3">
            <p className="text-zinc-500">Defensa</p>
            <p className="mt-2 text-zinc-100">
              {defenseActive
                ? `activa · ${(defenseDurationRemaining / 1000).toFixed(1)}s`
                : formatCooldown(defenseCooldownRemaining)}
            </p>
          </div>
          <div className="rounded-xl border border-white/8 bg-black/35 px-3 py-3">
            <p className="text-zinc-500">Eco cercano</p>
            <p className="mt-2 text-zinc-100">
              {nearestThreatTiles ? `${nearestThreatTiles} tiles` : "sin rastro"}
            </p>
          </div>
          <div className="rounded-xl border border-white/8 bg-black/35 px-3 py-3">
            <p className="text-zinc-500">Enemigos por eco</p>
            <p className="mt-2 text-zinc-100">{detectedEnemies}</p>
          </div>
          <div className="rounded-xl border border-white/8 bg-black/35 px-3 py-3">
            <p className="text-zinc-500">Rango de ataque</p>
            <p className="mt-2 text-zinc-100">{attackRangeLabel}</p>
          </div>
        </div>

        {typeof sanity === "number" && typeof maxSanity === "number" && (
          <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
            <span>Sanidad {sanityLabel ? `· ${sanityLabel}` : ""}</span>
            <span className="text-zinc-200">
              {Math.round(sanity)}/{maxSanity}
            </span>
          </div>
        )}
        {typeof aliveCount === "number" && (
          <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
            <span>Ultimas presencias</span>
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
