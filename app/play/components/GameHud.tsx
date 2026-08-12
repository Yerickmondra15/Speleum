"use client";

import Image from "next/image";
import type { CharacterOption, Zone } from "../gameConfig";
import type { SanityStage } from "@/lib/gameplay/sanity";
import {
  localizeCharacterOption,
  localizeTerrainName,
  localizeZone,
  translateGameplayMessage,
} from "@/lib/i18n/content";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { useAuth } from "@/app/auth/AuthProvider";

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
  terrainName?: string;
  sanityStage?: SanityStage;
  idleDurationMs?: number;
  shelterProgress?: number;
  abilityName?: string;
  abilityCooldownRemaining?: number;
  otherPlayersSummary?: Array<{
    id: string;
    name: string;
    health: number;
    maxHealth: number;
    isParrying: boolean;
    isStunned: boolean;
  }>;
};

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
  kills = 0,
  nearbyDangerLabel = "low",
  terrainName = "Suelo cavernícola",
  sanityStage = "stable",
  idleDurationMs = 0,
  shelterProgress = 0,
}: GameHudProps) {
  const { locale, messages } = useLanguage();
  const { user } = useAuth();
  const isAdmin = user?.isAdmin === true;
  const creature = localizeCharacterOption(locale, selectedCharacter);
  const localizedZone = localizeZone(locale, zone);
  const hpPercent = Math.max(0, Math.min(100, (health / maxHealth) * 100));
  const mentalLabel =
    sanityStage === "stable"
      ? messages.play.hud.sanityStable
      : sanityStage === "warning"
        ? messages.play.hud.sanityWarning
        : sanityStage === "pressure"
          ? messages.play.hud.sanityPressure
          : messages.play.hud.sanityCritical;
  const dangerLabel =
    nearbyDangerLabel === "alto" || nearbyDangerLabel === "high"
      ? messages.play.hud.high
      : nearbyDangerLabel === "medio" || nearbyDangerLabel === "medium"
        ? messages.play.hud.medium
        : nearbyDangerLabel === "latente" || nearbyDangerLabel === "latent"
          ? messages.play.hud.latent
          : messages.play.hud.low;

  return (
    <div className="theme-panel min-w-0 rounded-[1rem] p-2 text-(--text-secondary) sm:rounded-[1.15rem] sm:p-3">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="theme-icon-shell flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full sm:h-11 sm:w-11">
          <Image src={selectedCharacter.imageGame} alt={creature.name} width={38} height={38} className="h-8 w-8 object-contain sm:h-9 sm:w-9" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.62rem] uppercase tracking-[0.18em] text-(--text-muted)">{creature.name}</p>
          <p className="truncate text-xs font-semibold text-(--text-primary) sm:text-sm">{localizedZone.name}</p>
          <p className="hidden truncate text-[0.65rem] text-(--text-muted) sm:block">{localizeTerrainName(locale, terrainName)}</p>
        </div>
        <div className="text-right text-[0.65rem] text-(--text-secondary)">
          <p>{Math.ceil(health)}/{maxHealth} HP</p>
          <p>{kills} {messages.play.hud.kills} · {score} {messages.play.hud.points}</p>
        </div>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
        <div className="h-full rounded-full bg-[linear-gradient(90deg,rgba(190,70,110,.72),rgba(244,244,245,.9))] transition-[width]" style={{ width: `${hpPercent}%` }} />
      </div>

      {shelterProgress > 0 && (
        <div className="mt-2 rounded-lg border border-rose-100/10 bg-rose-100/5 p-2 text-[0.65rem]">
          <div className="flex justify-between"><span>{messages.play.hud.recoveringShelter}</span><span>{Math.round(shelterProgress * 100)}%</span></div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-black/40"><div className="h-full bg-rose-100/65" style={{ width: `${shelterProgress * 100}%` }} /></div>
        </div>
      )}

      {sanityStage !== "stable" && (
        <div className="mt-2 rounded-lg border border-rose-400/15 bg-black/30 px-2 py-1.5 text-[0.65rem] text-rose-100">
          {messages.play.hud.sanity}: {mentalLabel} · {Math.floor(idleDurationMs / 1000)} s {messages.play.hud.still}
        </div>
      )}

      <div className="mt-1.5 text-[0.62rem] leading-3.5 text-(--text-secondary) sm:mt-2 sm:text-[0.67rem] sm:leading-4">
        <p className="line-clamp-1 text-(--text-primary) sm:line-clamp-2">{translateGameplayMessage(locale, message)}</p>
        {isAdmin && zoneMessage && <p className="mt-1 hidden text-(--text-muted) sm:block">{translateGameplayMessage(locale, zoneMessage)}</p>}
        {isAdmin && <p className="mt-1 hidden truncate sm:block">
          {enemyStateLabel} · {messages.play.hud.danger} {dangerLabel}
          {aliveCount !== undefined ? ` · ${aliveCount} ${messages.play.hud.alive}` : ""}
        </p>}
        {isPaused && <p className="mt-1 text-rose-200">{messages.play.hud.paused}</p>}
        <p className="sr-only">{objective}</p>
      </div>
    </div>
  );
}
