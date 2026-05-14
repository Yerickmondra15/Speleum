"use client";

import { Footprints, Shield, Swords } from "lucide-react";
import type { ActionKind } from "../gameConfig";

type ActionControlsProps = {
  activeAction: ActionKind;
  cooldownRemaining: number;
  moveCooldownRemaining: number;
  parryCooldownRemaining: number;
  isRecovering: boolean;
  isParrying: boolean;
  onMove: () => void;
  onAttack: () => void;
  onDefend: () => void;
};

function label(value: number) {
  return value > 0 ? `${(value / 1000).toFixed(1)}s` : "listo";
}

export function ActionControls({
  activeAction,
  cooldownRemaining,
  moveCooldownRemaining,
  parryCooldownRemaining,
  isRecovering,
  isParrying,
  onMove,
  onAttack,
  onDefend,
}: ActionControlsProps) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-60 px-3 pb-3 sm:px-4 sm:pb-4">
      <div className="mx-auto max-w-3xl rounded-[1.4rem] border border-white/10 bg-black/70 p-2.5 backdrop-blur-xl sm:p-3">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onMove}
            className={`min-h-[4.4rem] rounded-2xl border px-2.5 py-3 text-center transition sm:px-4 sm:text-left ${
              activeAction === "move"
                ? "border-zinc-100/28 bg-zinc-100/10"
                : "border-white/8 bg-black/35 hover:bg-white/4"
            }`}
          >
            <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-3">
              <Footprints className="h-4 w-4 text-zinc-100" />
              <div>
                <p className="text-[0.7rem] uppercase tracking-[0.22em] text-zinc-500">Pulso</p>
                <p className="mt-1 text-sm text-zinc-100">{label(moveCooldownRemaining)}</p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={onAttack}
            disabled={isRecovering}
            className={`min-h-[4.4rem] rounded-2xl border px-2.5 py-3 text-center transition sm:px-4 sm:text-left ${
              activeAction === "attack"
                ? "border-rose-200/25 bg-rose-900/20"
                : "border-white/8 bg-black/35 hover:bg-white/4"
            } disabled:opacity-45`}
          >
            <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-3">
                <Swords className="h-4 w-4 text-rose-100" />
              <div>
                <p className="text-[0.7rem] uppercase tracking-[0.22em] text-zinc-500">Ataque</p>
                <p className="mt-1 text-sm text-zinc-100">{label(cooldownRemaining)} · E</p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={onDefend}
            disabled={parryCooldownRemaining > 0}
            className={`min-h-[4.4rem] rounded-2xl border px-2.5 py-3 text-center transition sm:px-4 sm:text-left ${
              activeAction === "defend" || isParrying
                ? "border-amber-100/30 bg-amber-950/25"
                : "border-white/8 bg-black/35 hover:bg-white/4"
            } disabled:opacity-45`}
          >
            <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-3">
              <Shield className="h-4 w-4 text-amber-100" />
              <div>
                <p className="text-[0.7rem] uppercase tracking-[0.22em] text-zinc-500">Parry</p>
                <p className="mt-1 text-sm text-zinc-100">
                  {isParrying ? "activo · Q" : `${label(parryCooldownRemaining)} · Q`}
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
