"use client";

import { Radio } from "lucide-react";
import type { PlayerPosition } from "../gameConfig";
import { RADAR_SIGNAL_PROFILES, RADAR_SIGNAL_RANGE_TILES } from "../gameConfig";
import type { RadarSignal } from "../types";
import { approximateRadarPosition, tileDistance, worldToTile } from "../tileMap";

type RadarPanelProps = {
  player: PlayerPosition;
  signals: RadarSignal[];
  moveCooldownRemaining: number;
};

function signalClass(type: RadarSignal["type"]) {
  if (type === "danger") {
    return "h-4 w-4 border-rose-200 bg-rose-300/30 shadow-[0_0_18px_rgba(251,113,133,0.55)]";
  }

  if (type === "attack") {
    return "h-4.5 w-4.5 border-red-200 bg-red-400/40 shadow-[0_0_22px_rgba(248,113,113,0.75)]";
  }

  if (type === "defend") {
    return "h-3 w-3 border-amber-100/80 bg-amber-200/20 shadow-[0_0_10px_rgba(253,230,138,0.28)]";
  }

  return "h-3 w-3 border-zinc-100 bg-white/30 shadow-[0_0_12px_rgba(255,255,255,0.35)]";
}

function signalLabel(type: RadarSignal["type"]) {
  switch (type) {
    case "move":
      return "movimiento";
    case "attack":
      return "ataque";
    case "defend":
      return "defensa";
    default:
      return "alerta";
  }
}

export function RadarPanel({
  player,
  signals,
  moveCooldownRemaining,
}: RadarPanelProps) {
  const playerTile = worldToTile(player);
  const nearbySignals = signals.filter(
    (signal) => tileDistance(playerTile, worldToTile(signal)) <= RADAR_SIGNAL_RANGE_TILES,
  );
  const latestSignal = nearbySignals[nearbySignals.length - 1];
  const hostileCount = nearbySignals.filter(
    (signal) => signal.type === "danger" || signal.type === "attack",
  ).length;

  return (
    <div className="rounded-[1.2rem] border border-white/10 bg-black/28 p-3 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <p className="text-[0.68rem] tracking-[0.25em] text-zinc-500">ECOS</p>
        <Radio className="h-4 w-4 text-zinc-500" />
      </div>

      <div className="relative mt-3 aspect-square overflow-hidden rounded-full border border-white/10 bg-[radial-gradient(circle,rgba(255,255,255,0.04),transparent_28%),#050505] sm:mt-4">
        <div className="absolute inset-1/2 h-px w-full -translate-x-1/2 bg-white/10" />
        <div className="absolute left-1/2 top-0 h-full w-px bg-white/10" />
        <div className="absolute inset-[18%] rounded-full border border-white/10" />
        <div className="absolute inset-[34%] rounded-full border border-white/10" />

        {nearbySignals.map((signal) => (
          <div
            key={signal.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={approximateRadarPosition(
              playerTile,
              worldToTile(signal),
              signal.radarJitter,
              signal.id,
            )}
          >
            <div
              className={`animate-ping rounded-full border ${signalClass(signal.type)}`}
            />
          </div>
        ))}

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="h-3.5 w-3.5 rounded-full border border-white bg-zinc-100">
            <div className="mx-auto mt-1 h-1.5 w-1.5 rounded-full bg-rose-300" />
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-1.5 text-[0.7rem] text-zinc-500 sm:mt-4 sm:gap-2 sm:text-xs">
        <div className="flex justify-between">
          <span>Ultima senal</span>
          <span className="text-zinc-300">
            {latestSignal
              ? `${signalLabel(latestSignal.type)} · ${latestSignal.strength}`
              : "ninguna"}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Pulso</span>
          <span className="text-zinc-300">
            {moveCooldownRemaining > 0
              ? `${(moveCooldownRemaining / 1000).toFixed(1)}s`
              : "lista"}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Contactos</span>
          <span className="text-zinc-300">{nearbySignals.length}</span>
        </div>
        <div className="flex justify-between">
          <span>Peligro</span>
          <span className="text-zinc-300">
            {hostileCount > 1
              ? "alto"
              : hostileCount === 1
                ? "medio"
                : nearbySignals.length > 0
                  ? "latente"
                  : "bajo"}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Ruido propio</span>
          <span className="text-zinc-300">
            {RADAR_SIGNAL_PROFILES.move.strength} / {RADAR_SIGNAL_PROFILES.attack.strength}
          </span>
        </div>
      </div>
    </div>
  );
}
