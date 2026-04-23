"use client";

import { Footprints, Shield, Swords } from "lucide-react";
import type { ActionKind } from "../gameConfig";

type ActionControlsProps = {
  activeAction: ActionKind;
  cooldownRemaining: number;
  isRecovering: boolean;
  isDefending: boolean;
  onMove: () => void;
  onAttack: () => void;
  onDefend: () => void;
};

function cooldownLabel(cooldownRemaining: number) {
  if (cooldownRemaining <= 0) return "listo";

  return `${(cooldownRemaining / 1000).toFixed(1)}s`;
}

export function ActionControls({
  activeAction,
  cooldownRemaining,
  isRecovering,
  isDefending,
  onMove,
  onAttack,
  onDefend,
}: ActionControlsProps) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-[60] border-t border-white/10 bg-black/75 px-3 py-3 backdrop-blur-md">
      <div className="mx-auto flex max-w-2xl items-center justify-center gap-3">
        <button
          type="button"
          onClick={onAttack}
          disabled={isRecovering}
          className={`flex h-16 w-24 flex-col items-center justify-center gap-1 rounded-[1rem] border text-xs font-semibold uppercase tracking-[0.16em] transition ${
            activeAction === "attack"
              ? "border-red-200/70 bg-red-800 text-white"
              : "border-red-200/20 bg-red-950/75 text-red-100 hover:bg-red-900/80"
          } disabled:cursor-not-allowed disabled:opacity-45`}
        >
          <Swords className="h-5 w-5" />
          Atacar
        </button>

        <button
          type="button"
          onClick={onMove}
          disabled={isRecovering}
          className={`flex h-16 w-24 flex-col items-center justify-center gap-1 rounded-[1rem] border text-xs font-semibold uppercase tracking-[0.16em] transition ${
            activeAction === "move"
              ? "border-white/50 bg-zinc-100 text-black"
              : "border-white/15 bg-black text-zinc-200 hover:bg-zinc-900"
          } disabled:cursor-not-allowed disabled:opacity-45`}
        >
          <Footprints className="h-5 w-5" />
          Mover
        </button>

        <button
          type="button"
          onClick={onDefend}
          disabled={isRecovering}
          className={`flex h-16 w-24 flex-col items-center justify-center gap-1 rounded-[1rem] border text-xs font-semibold uppercase tracking-[0.16em] transition ${
            activeAction === "defend" || isDefending
              ? "border-amber-100/80 bg-amber-300 text-black"
              : "border-amber-100/25 bg-amber-950/80 text-amber-100 hover:bg-amber-900/80"
          } disabled:cursor-not-allowed disabled:opacity-45`}
        >
          <Shield className="h-5 w-5" />
          Defender
        </button>
      </div>

      <div className="mx-auto mt-3 h-1.5 max-w-2xl overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-white transition-all duration-100"
          style={{
            width: isRecovering
              ? `${Math.max(0, Math.min(100, cooldownRemaining / 26))}%`
              : "0%",
            opacity: isRecovering ? 0.8 : 0,
          }}
        />
      </div>
      <p className="mt-2 text-center text-xs tracking-[0.2em] text-zinc-500">
        cooldown {cooldownLabel(cooldownRemaining)}
      </p>
    </div>
  );
}
