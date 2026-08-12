"use client";

import { Footprints, Shield, Sparkles, Swords } from "lucide-react";
import type { ActionKind } from "../gameConfig";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

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
  abilityName?: string;
  abilityCooldownRemaining?: number;
  abilityDisabled?: boolean;
  onAbility?: () => void;
};

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
  abilityName,
  abilityCooldownRemaining = 0,
  abilityDisabled = false,
  onAbility,
}: ActionControlsProps) {
  const { messages } = useLanguage();
  const label = (value: number) =>
    value > 0 ? `${(value / 1000).toFixed(1)}s` : messages.play.radar.ready;

  return (
    <div className="theme-panel min-w-0 rounded-[1.15rem] p-2 sm:rounded-[1.4rem] sm:p-3 [@media(max-height:600px)]:p-1.5">
        <div className={`grid gap-1.5 sm:gap-3 [@media(max-height:600px)]:gap-1.5 ${onAbility ? "grid-cols-4" : "grid-cols-3"}`}>
          <button
            type="button"
            onClick={onMove}
            className={`min-h-[3.6rem] rounded-[1rem] border px-1.5 py-2 text-center transition sm:min-h-[4.4rem] sm:rounded-2xl sm:px-4 sm:py-3 sm:text-left [@media(max-height:600px)]:min-h-[3.2rem] [@media(max-height:600px)]:py-1 ${
              activeAction === "move"
                ? "theme-border-strong bg-[var(--surface-3)]"
                : "theme-border bg-[var(--surface-2)] hover:bg-[var(--surface-3)]"
            }`}
          >
            <div className="flex flex-col items-center gap-1 sm:flex-row sm:items-center sm:gap-3">
              <Footprints className="theme-text-secondary h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <div>
                <p className="theme-text-muted text-[0.58rem] uppercase tracking-[0.18em] sm:text-[0.7rem] sm:tracking-[0.22em]">{messages.play.hud.move}</p>
                <p className="theme-text-secondary mt-0.5 text-[0.72rem] sm:mt-1 sm:text-sm">{label(moveCooldownRemaining)}</p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={onAttack}
            disabled={isRecovering}
            className={`min-h-[3.6rem] rounded-[1rem] border px-1.5 py-2 text-center transition sm:min-h-[4.4rem] sm:rounded-2xl sm:px-4 sm:py-3 sm:text-left [@media(max-height:600px)]:min-h-[3.2rem] [@media(max-height:600px)]:py-1 ${
              activeAction === "attack"
                ? "border-rose-200/25 bg-rose-900/20"
                : "theme-border bg-[var(--surface-2)] hover:bg-[var(--surface-3)]"
            } disabled:opacity-45`}
          >
            <div className="flex flex-col items-center gap-1 sm:flex-row sm:items-center sm:gap-3">
              <Swords className="h-3.5 w-3.5 text-rose-100 sm:h-4 sm:w-4" />
              <div>
                <p className="theme-text-muted text-[0.58rem] uppercase tracking-[0.18em] sm:text-[0.7rem] sm:tracking-[0.22em]">{messages.common.attack}</p>
                <p className="theme-text-secondary mt-0.5 text-[0.72rem] sm:mt-1 sm:text-sm">{label(cooldownRemaining)} / E</p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={onDefend}
            disabled={parryCooldownRemaining > 0}
            className={`min-h-[3.6rem] rounded-[1rem] border px-1.5 py-2 text-center transition sm:min-h-[4.4rem] sm:rounded-2xl sm:px-4 sm:py-3 sm:text-left [@media(max-height:600px)]:min-h-[3.2rem] [@media(max-height:600px)]:py-1 ${
              activeAction === "defend" || isParrying
                ? "border-amber-100/30 bg-amber-950/25"
                : "theme-border bg-[var(--surface-2)] hover:bg-[var(--surface-3)]"
            } disabled:opacity-45`}
          >
            <div className="flex flex-col items-center gap-1 sm:flex-row sm:items-center sm:gap-3">
              <Shield className="h-3.5 w-3.5 text-amber-100 sm:h-4 sm:w-4" />
              <div>
                <p className="theme-text-muted text-[0.58rem] uppercase tracking-[0.18em] sm:text-[0.7rem] sm:tracking-[0.22em]">{messages.common.parry}</p>
                <p className="theme-text-secondary mt-0.5 text-[0.72rem] sm:mt-1 sm:text-sm">
                  {isParrying ? `${messages.play.active.toLowerCase()} / Q` : `${label(parryCooldownRemaining)} / Q`}
                </p>
              </div>
            </div>
          </button>

          {onAbility && (
            <button
              type="button"
              onClick={onAbility}
              disabled={abilityDisabled || abilityCooldownRemaining > 0}
              className={`theme-border min-h-[3.6rem] rounded-[1rem] border px-1.5 py-2 text-center transition hover:bg-[var(--surface-3)] disabled:opacity-45 sm:min-h-[4.4rem] sm:rounded-2xl sm:px-4 sm:py-3 sm:text-left [@media(max-height:600px)]:min-h-[3.2rem] [@media(max-height:600px)]:py-1 ${activeAction === "ability" ? "bg-rose-950/25" : "bg-[var(--surface-2)]"}`}
            >
              <div className="flex flex-col items-center gap-1 sm:flex-row sm:items-center sm:gap-3">
                <Sparkles className="h-3.5 w-3.5 text-cyan-100 sm:h-4 sm:w-4" />
                <div className="min-w-0">
                  <p className="theme-text-muted truncate text-[0.52rem] uppercase tracking-[0.12em] sm:text-[0.66rem] sm:tracking-[0.18em]">{messages.play.hud.ability}</p>
                  <p className="theme-text-secondary mt-0.5 text-[0.68rem] sm:mt-1 sm:text-sm">
                    <span className="hidden lg:inline">{abilityName} · </span>{label(abilityCooldownRemaining)} / R
                  </p>
                </div>
              </div>
            </button>
          )}
        </div>
    </div>
  );
}
