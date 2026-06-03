"use client";

import Image from "next/image";
import type { CharacterOption, Zone } from "../gameConfig";
import { localizeCharacterOption, localizeZone } from "@/lib/i18n/content";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

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
    return `stun / ${(stunRemaining / 1000).toFixed(1)}s`;
  }

  if (parryActive) {
    return `activo / ${(parryWindowRemaining / 1000).toFixed(1)}s`;
  }

  return formatCooldown(parryCooldownRemaining);
}

export function GameHud({
  selectedCharacter,
  zone,
  objective,
  message,
  zoneMessage,
  health,
  maxHealth,
  aliveCount,
  enemyStateLabel,
  isPaused,
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
  const { locale, messages } = useLanguage();
  const localizedCharacter = localizeCharacterOption(locale, selectedCharacter);
  const localizedZone = localizeZone(locale, zone);
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
      <div
        className="theme-panel pointer-events-none absolute inset-x-2 z-70 rounded-[1.05rem] bg-[linear-gradient(180deg,var(--surface-1),var(--surface-accent))] p-2.5 sm:hidden"
        style={{ top: "calc(env(safe-area-inset-top) + 3.55rem)" }}
      >
        <div className="flex items-start gap-2.5">
          <div className="theme-icon-shell flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full">
            <Image
              src={selectedCharacter.imageGame}
              alt={localizedCharacter.name}
              width={30}
              height={30}
              className="h-7.5 w-7.5 object-contain"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="theme-text-muted truncate text-[0.52rem] tracking-[0.14em]">{localizedZone.subtitle}</p>
                <h2 className="theme-text-primary truncate text-[0.95rem] font-semibold">{localizedZone.name}</h2>
                <p className="theme-text-muted truncate text-[0.68rem]">{localizedCharacter.name}</p>
              </div>
              <div className="theme-text-secondary text-right text-[0.68rem]">
                <p>{health}/{maxHealth} HP</p>
                <p className="theme-text-muted">{nearbyDangerLabel}</p>
              </div>
            </div>

            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,rgba(244,114,182,0.7),rgba(255,255,255,0.9))]"
                style={{ width: `${hpPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="theme-text-secondary mt-2 grid grid-cols-2 gap-1.5 text-[0.58rem] tracking-[0.08em]">
          <div className="theme-card-soft rounded-[0.85rem] px-2 py-1.5">
            <p className="theme-text-muted">{messages.common.pulse}</p>
            <p className="mt-0.5">{formatCooldown(moveCooldownRemaining)}</p>
          </div>
          <div className="theme-card-soft rounded-[0.85rem] px-2 py-1.5">
            <p className="theme-text-muted">{messages.common.attack}</p>
            <p className="mt-0.5">{formatCooldown(attackCooldownRemaining)}</p>
          </div>
          <div className="theme-card-soft rounded-[0.85rem] px-2 py-1.5">
            <p className="theme-text-muted">{messages.common.parry}</p>
            <p className="mt-0.5">{guardState}</p>
          </div>
          <div className="theme-card-soft rounded-[0.85rem] px-2 py-1.5">
            <p className="theme-text-muted">{messages.common.score}</p>
            <p className="mt-0.5">{score}</p>
          </div>
        </div>

        <p className="theme-text-secondary mt-2 text-[0.68rem] leading-4">{message}</p>
        {zoneMessage && (
          <p className="mt-2 rounded-[0.85rem] border border-rose-200/10 bg-rose-200/5 px-2 py-1.5 text-[0.62rem] leading-4 text-rose-100/85">
            {zoneMessage}
          </p>
        )}
      </div>

      <div
        className="theme-panel pointer-events-none absolute left-4 z-70 hidden max-w-sm rounded-[1.35rem] bg-[linear-gradient(180deg,var(--surface-1),var(--surface-accent))] p-4 sm:block"
        style={{ top: "calc(env(safe-area-inset-top) + 5.4rem)" }}
      >
        <div className="flex items-start gap-3">
          <div className="theme-icon-shell flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full">
            <Image
              src={selectedCharacter.imageGame}
              alt={localizedCharacter.name}
              width={40}
              height={40}
              className="h-10 w-10 object-contain"
            />
          </div>
          <div>
            <p className="theme-text-muted text-xs tracking-[0.25em]">{localizedZone.subtitle}</p>
            <h2 className="theme-text-primary mt-1 text-lg font-semibold">{localizedZone.name}</h2>
            <p className="theme-text-muted mt-1 text-xs">{localizedCharacter.name}</p>
          </div>
        </div>

        <div className="theme-card-soft mt-4 rounded-2xl px-3 py-3">
          <div className="theme-text-muted flex items-center justify-between text-[0.7rem] tracking-[0.18em]">
            <span>{messages.play.hud.life}</span>
            <span className="theme-text-secondary">{health}/{maxHealth}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface-3)]">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,rgba(244,114,182,0.7),rgba(255,255,255,0.9))]"
              style={{ width: `${hpPercent}%` }}
            />
          </div>
        </div>

        <div className="theme-text-secondary mt-3 grid grid-cols-2 gap-2 text-[0.7rem] tracking-[0.16em]">
          <div className="theme-card-soft rounded-xl px-3 py-2">
            <p className="theme-text-muted">{messages.common.pulse}</p>
            <p className="mt-1">{formatCooldown(moveCooldownRemaining)}</p>
          </div>
          <div className="theme-card-soft rounded-xl px-3 py-2">
            <p className="theme-text-muted">{messages.common.attack}</p>
            <p className="mt-1">{formatCooldown(attackCooldownRemaining)}</p>
          </div>
          <div className="theme-card-soft rounded-xl px-3 py-2">
            <p className="theme-text-muted">{messages.common.parry}</p>
            <p className="mt-1">{guardState}</p>
          </div>
          <div className="theme-card-soft rounded-xl px-3 py-2">
            <p className="theme-text-muted">{messages.common.danger}</p>
            <p className="mt-1">{nearbyDangerLabel}</p>
          </div>
        </div>

        <p className="theme-text-secondary mt-3 text-sm leading-6">{message}</p>
        {zoneMessage && (
          <p className="mt-3 rounded-xl border border-rose-200/10 bg-rose-200/5 px-3 py-2 text-xs tracking-[0.08em] text-rose-100/85">
            {zoneMessage}
          </p>
        )}
        <div className="theme-text-muted mt-3 text-[0.68rem]">
          <p>{objective}</p>
          {aliveCount !== undefined && <p className="mt-1">Vivos: {aliveCount}</p>}
          <p className="mt-1">{enemyStateLabel}</p>
          {isPaused && <p className="theme-text-secondary mt-1">{messages.play.hud.paused}</p>}
        </div>
      </div>
    </>
  );
}
