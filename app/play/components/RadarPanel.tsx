"use client";

import { Radio } from "lucide-react";
import type { PlayerPosition } from "../gameConfig";
import { CAVE_HEIGHT, CAVE_WIDTH } from "../gameConfig";
import type { RadarSignal } from "./TacticalGame";

type RadarPanelProps = {
  player: PlayerPosition;
  signals: RadarSignal[];
  cooldownRemaining: number;
};

function markerStyle(position: PlayerPosition) {
  return {
    left: `${(position.x / CAVE_WIDTH) * 100}%`,
    top: `${(position.y / CAVE_HEIGHT) * 100}%`,
  };
}

function signalClass(type: RadarSignal["type"]) {
  if (type === "attack") {
    return "h-5 w-5 border-red-200 bg-red-400/40 shadow-[0_0_22px_rgba(248,113,113,0.75)]";
  }

  if (type === "defend") {
    return "h-3.5 w-3.5 border-amber-100 bg-amber-200/35 shadow-[0_0_14px_rgba(253,230,138,0.45)]";
  }

  return "h-3 w-3 border-zinc-100 bg-white/30 shadow-[0_0_12px_rgba(255,255,255,0.35)]";
}

export function RadarPanel({
  player,
  signals,
  cooldownRemaining,
}: RadarPanelProps) {
  const latestSignal = signals[signals.length - 1];

  return (
    <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs tracking-[0.25em] text-zinc-500">RADAR</p>
        <Radio className="h-4 w-4 text-zinc-500" />
      </div>

      <div className="relative mt-4 aspect-square overflow-hidden rounded-full border border-white/10 bg-[radial-gradient(circle,rgba(255,255,255,0.06),transparent_28%),#050505]">
        <div className="absolute inset-1/2 h-px w-full -translate-x-1/2 bg-white/10" />
        <div className="absolute left-1/2 top-0 h-full w-px bg-white/10" />
        <div className="absolute inset-[18%] rounded-full border border-white/10" />
        <div className="absolute inset-[34%] rounded-full border border-white/10" />

        {signals.map((signal) => (
          <div
            key={signal.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={markerStyle(signal)}
          >
            <div
              className={`animate-ping rounded-full border ${signalClass(
                signal.type,
              )}`}
            />
          </div>
        ))}

        <div
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={markerStyle(player)}
        >
          <div className="h-3.5 w-3.5 rounded-full border border-white bg-zinc-100">
            <div className="mx-auto mt-1 h-1.5 w-1.5 rounded-full bg-rose-300" />
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-xs text-zinc-500">
        <div className="flex justify-between">
          <span>Ultima senal</span>
          <span className="text-zinc-300">{latestSignal?.type ?? "ninguna"}</span>
        </div>
        <div className="flex justify-between">
          <span>Recuperacion</span>
          <span className="text-zinc-300">
            {cooldownRemaining > 0
              ? `${(cooldownRemaining / 1000).toFixed(1)}s`
              : "lista"}
          </span>
        </div>
      </div>
    </div>
  );
}
