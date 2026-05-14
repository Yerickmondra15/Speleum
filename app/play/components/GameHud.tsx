"use client";

import Image from "next/image";
import type { CharacterOption, Zone } from "../gameConfig";

type GameHudProps = {
  selectedCharacter: CharacterOption;
  zone: Zone;
  objective: string;
  message: string;
  zoneMessage: string | null;
  health: number;
  maxHealth: number;
  aliveCount?: number;
  enemyStateLabel: string;
  isPaused: boolean;
  score?: number;
  kills?: number;
  parryActive?: boolean;
  isStunned?: boolean;
  moveCooldownRemaining?: number;
  attackCooldownRemaining?: number;
  parryCooldownRemaining?: number;
  parryWindowRemaining?: number;
  stunRemaining?: number;
  nearestThreatTiles?: number | null;
  nearbyDangerLabel?: string;
  detectedEnemies?: number;
  attackRangeLabel?: string;
  otherPlayersSummary?: Array<{
    id: string;
    name: string;
    health: number;
    maxHealth: number;
    isParrying: boolean;
    isStunned: boolean;
  }>;
};

function formatCooldown(value: number) {
  return value > 0 ? `${(value / 1000).toFixed(1)}s` : "listo";
}

function formatGuardState({
  isStunned,
  stunRemaining,
  parryActive,
  parryWindowRemaining,
  parryCooldownRemaining,
}: {
  isStunned: boolean;
  stunRemaining: number;
  parryActive: boolean;
  parryWindowRemaining: number;
  parryCooldownRemaining: number;
}) {
  if (isStunned) {
    return `stun · ${(stunRemaining / 1000).toFixed(1)}s`;
  }

  if (parryActive) {
    return `activo · ${(parryWindowRemaining / 1000).toFixed(1)}s`;
  }

  return formatCooldown(parryCooldownRemaining);
}

export function GameHud({
  selectedCharacter,
  zone,
  message,
  zoneMessage,
  health,
  maxHealth,
  score = 0,
  parryActive = false,
  isStunned = false,
  moveCooldownRemaining = 0,
  attackCooldownRemaining = 0,
  parryCooldownRemaining = 0,
  parryWindowRemaining = 0,
  stunRemaining = 0,
  nearbyDangerLabel = "bajo",
}: GameHudProps) {
  const hpPercent = Math.max(0, Math.min(100, (health / maxHealth) * 100));
  const guardState = formatGuardState({
    isStunned,
    stunRemaining,
    parryActive,
    parryWindowRemaining,
    parryCooldownRemaining,
  });

  return (
    <>
      <div className="pointer-events-none absolute inset-x-3 top-18 z-70 rounded-[1.35rem] border border-white/10 bg-[linear-gradient(180deg,rgba(9,9,11,0.88),rgba(22,10,15,0.8))] p-3 backdrop-blur-md sm:hidden">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-zinc-100/90">
            <Image
              src={selectedCharacter.imageGame}
              alt={selectedCharacter.name}
              width={34}
              height={34}
              className="h-8.5 w-8.5 object-contain"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[0.6rem] tracking-[0.18em] text-zinc-500">{zone.subtitle}</p>
                <h2 className="truncate text-base font-semibold text-white">{zone.name}</h2>
                <p className="truncate text-xs text-zinc-500">{selectedCharacter.name}</p>
              </div>
              <div className="text-right text-xs text-zinc-300">
                <p>{health}/{maxHealth} HP</p>
                <p className="text-zinc-500">{nearbyDangerLabel}</p>
              </div>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,rgba(244,114,182,0.7),rgba(255,255,255,0.9))]"
                style={{ width: `${hpPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-[0.65rem] tracking-[0.12em] text-zinc-400">
          <div className="rounded-xl border border-white/8 bg-black/35 px-3 py-2">
            <p className="text-zinc-500">Pulso</p>
            <p className="mt-1 text-zinc-100">{formatCooldown(moveCooldownRemaining)}</p>
          </div>
          <div className="rounded-xl border border-white/8 bg-black/35 px-3 py-2">
            <p className="text-zinc-500">Ataque</p>
            <p className="mt-1 text-zinc-100">{formatCooldown(attackCooldownRemaining)}</p>
          </div>
          <div className="rounded-xl border border-white/8 bg-black/35 px-3 py-2">
            <p className="text-zinc-500">Parry</p>
            <p className="mt-1 text-zinc-100">{guardState}</p>
          </div>
          <div className="rounded-xl border border-white/8 bg-black/35 px-3 py-2">
            <p className="text-zinc-500">Score</p>
            <p className="mt-1 text-zinc-100">{score}</p>
          </div>
        </div>

        <p className="mt-3 text-xs leading-5 text-zinc-300">{message}</p>
        {zoneMessage && (
          <p className="mt-3 rounded-xl border border-rose-200/10 bg-rose-200/5 px-3 py-2 text-[0.68rem] leading-4 text-rose-100/85">
            {zoneMessage}
          </p>
        )}
      </div>

      <div className="pointer-events-none absolute left-4 top-24 z-70 hidden max-w-sm rounded-[1.35rem] border border-white/10 bg-[linear-gradient(180deg,rgba(9,9,11,0.8),rgba(22,10,15,0.72))] p-4 backdrop-blur-md sm:block">
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
            <span className="text-zinc-100">{health}/{maxHealth}</span>
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
            <p className="text-zinc-500">Parry</p>
            <p className="mt-1 text-zinc-100">{guardState}</p>
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
    </>
  );
}
