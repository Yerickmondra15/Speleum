"use client";

import { Radio } from "lucide-react";
import type { PlayerPosition } from "../gameConfig";
import { RADAR_SIGNAL_RANGE_TILES } from "../gameConfig";
import type { RadarSignal } from "../types";
import { approximateRadarPosition, tileDistance, worldToTile } from "../tileMap";
import { gameplayEventSeed } from "@/lib/gameplay/event-ids";
import { collapseRadarSignals } from "../signalUtils";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

type RadarPanelProps = {
  player: PlayerPosition;
  signals: RadarSignal[];
  ownerId?: string;
  rangeTiles?: number;
  precisionMultiplier?: number;
};

function signalClass(type: RadarSignal["type"]) {
  if (type === "danger") {
    return "h-3.5 w-3.5 border-rose-200/80 bg-rose-300/65 shadow-[0_0_14px_rgba(251,113,133,0.5)]";
  }

  if (type === "attack") {
    return "h-4 w-4 rotate-45 border-red-100 bg-red-400/75 shadow-[0_0_18px_rgba(248,113,113,0.75)]";
  }

  if (type === "defend") {
    return "h-2.5 w-2.5 border-zinc-100/70 bg-zinc-200/55 shadow-[0_0_8px_rgba(228,228,231,0.35)]";
  }

  return "h-2.5 w-2.5 border-zinc-200/60 bg-zinc-100/55 shadow-[0_0_8px_rgba(255,255,255,0.28)]";
}

function pulseClass(type: RadarSignal["type"]) {
  if (type === "danger") return "h-5 w-5 border-rose-200/70";
  if (type === "attack") return "h-5.5 w-5.5 border-red-200/80";
  if (type === "defend") return "h-4 w-4 border-zinc-200/60";
  return "h-4 w-4 border-zinc-100/55";
}

export function RadarPanel({
  player,
  signals,
  ownerId,
  rangeTiles = RADAR_SIGNAL_RANGE_TILES,
  precisionMultiplier = 1,
}: RadarPanelProps) {
  const { messages } = useLanguage();
  const playerTile = worldToTile(player);
  const nearbySignals = collapseRadarSignals(
    signals.filter(
      (signal) =>
        signal.ownerId !== ownerId &&
        tileDistance(playerTile, worldToTile(signal)) <= rangeTiles,
    ),
  );
  const hostileCount = nearbySignals.filter(
    (signal) => signal.type === "danger" || signal.type === "attack",
  ).length;

  return (
    <div className="theme-panel rounded-[1rem] p-2.5 sm:rounded-[1.2rem] sm:p-3">
      <div className="flex items-center justify-between">
        <p className="theme-text-muted text-[0.58rem] tracking-[0.22em] sm:text-[0.68rem] sm:tracking-[0.25em]">
          {messages.play.hud.radar} · {rangeTiles} {messages.play.hud.tiles}
        </p>
        <Radio className="theme-text-muted h-3.5 w-3.5 sm:h-4 sm:w-4" />
      </div>

      <div className="theme-border relative mt-2 aspect-square overflow-hidden rounded-full border bg-[radial-gradient(circle,var(--glow-main),transparent_28%),var(--app-bg)] sm:mt-4">
        <div className="theme-border absolute inset-1/2 h-px w-full -translate-x-1/2 bg-[var(--border-soft)]" />
        <div className="theme-border absolute left-1/2 top-0 h-full w-px bg-[var(--border-soft)]" />
        <div className="theme-border absolute inset-[18%] rounded-full border" />
        <div className="theme-border absolute inset-[34%] rounded-full border" />

        {nearbySignals.map((signal) => (
          <div
            key={signal.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={approximateRadarPosition(
              playerTile,
              worldToTile(signal),
              signal.radarJitter * precisionMultiplier,
              gameplayEventSeed(signal.id),
              rangeTiles,
            )}
          >
            <div className="relative">
              <div
                className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full border opacity-55 ${pulseClass(signal.type)}`}
              />
              <div className={`relative rounded-full border ${signalClass(signal.type)}`} />
            </div>
          </div>
        ))}

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="h-3.5 w-3.5 rounded-full border border-white bg-zinc-100">
            <div className="mx-auto mt-1 h-1.5 w-1.5 rounded-full bg-rose-300" />
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-[0.6rem] uppercase tracking-[0.16em] sm:text-[0.68rem]">
        <span className="theme-text-muted">
          {nearbySignals.length === 0
            ? messages.play.hud.silence
            : `${nearbySignals.length} ${nearbySignals.length === 1 ? messages.play.hud.echo : messages.play.hud.echoes}`}
        </span>
        <span className={hostileCount > 0 ? "text-rose-200" : "theme-text-secondary"}>
          {hostileCount > 1
            ? messages.play.hud.highDanger
            : hostileCount === 1
              ? messages.play.hud.dangerDetected
              : messages.play.hud.noThreat}
        </span>
      </div>
    </div>
  );
}
