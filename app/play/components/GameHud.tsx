"use client";

import Image from "next/image";
import type { CharacterOption, Zone } from "../gameConfig";
import type { SanityStage } from "@/lib/gameplay/sanity";
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
  nearbyDangerLabel = "bajo",
  terrainName = "Suelo cavernícola",
  sanityStage = "stable",
  idleDurationMs = 0,
  shelterProgress = 0,
}: GameHudProps) {
  const { locale } = useLanguage();
  const creature = localizeCharacterOption(locale, selectedCharacter);
  const localizedZone = localizeZone(locale, zone);
  const hpPercent = Math.max(0, Math.min(100, (health / maxHealth) * 100));
  const mentalLabel =
    sanityStage === "stable"
      ? "estable"
      : sanityStage === "warning"
        ? "algo te observa"
        : sanityStage === "pressure"
          ? "la oscuridad se acerca"
          : "muévete ahora";

  return (
    <div className="theme-panel min-w-0 rounded-[1.15rem] p-3 text-zinc-200">
      <div className="flex items-center gap-3">
        <div className="theme-icon-shell flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full">
          <Image src={selectedCharacter.imageGame} alt={creature.name} width={38} height={38} className="h-9 w-9 object-contain" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.62rem] uppercase tracking-[0.18em] text-zinc-500">{creature.name}</p>
          <p className="truncate text-sm font-semibold text-white">{localizedZone.name}</p>
          <p className="truncate text-[0.65rem] text-zinc-500">{terrainName}</p>
        </div>
        <div className="text-right text-[0.65rem] text-zinc-400">
          <p>{Math.ceil(health)}/{maxHealth} HP</p>
          <p>{kills} bajas · {score} pts</p>
        </div>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
        <div className="h-full rounded-full bg-[linear-gradient(90deg,rgba(190,70,110,.72),rgba(244,244,245,.9))] transition-[width]" style={{ width: `${hpPercent}%` }} />
      </div>

      {shelterProgress > 0 && (
        <div className="mt-2 rounded-lg border border-rose-100/10 bg-rose-100/5 p-2 text-[0.65rem]">
          <div className="flex justify-between"><span>Recuperando en refugio</span><span>{Math.round(shelterProgress * 100)}%</span></div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-black/40"><div className="h-full bg-rose-100/65" style={{ width: `${shelterProgress * 100}%` }} /></div>
        </div>
      )}

      {sanityStage !== "stable" && (
        <div className="mt-2 rounded-lg border border-rose-400/15 bg-black/30 px-2 py-1.5 text-[0.65rem] text-rose-100">
          Sanidad: {mentalLabel} · {Math.floor(idleDurationMs / 1000)} s inmóvil
        </div>
      )}

      <div className="mt-2 text-[0.67rem] leading-4 text-zinc-400">
        <p className="text-zinc-200">{message}</p>
        {zoneMessage && <p className="mt-1 text-zinc-500">{zoneMessage}</p>}
        <p className="mt-1 truncate">{enemyStateLabel} · peligro {nearbyDangerLabel}{aliveCount !== undefined ? ` · ${aliveCount} vivos` : ""}</p>
        {isPaused && <p className="mt-1 text-rose-100">Partida pausada</p>}
        <p className="sr-only">{objective}</p>
      </div>
    </div>
  );
}
