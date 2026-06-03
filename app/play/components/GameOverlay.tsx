"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import type { GameStatus } from "../gameConfig";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { useTheme } from "@/lib/theme/ThemeProvider";

type GameOverlayProps = {
  status: GameStatus;
  onRestart: () => void;
  onExitToMenu: () => void;
  titleOverride?: string;
  messageOverride?: string;
  buttonLabelOverride?: string;
  summary?: ReactNode;
};

export function GameOverlay({
  status,
  onRestart,
  onExitToMenu,
  titleOverride,
  messageOverride,
  buttonLabelOverride,
  summary,
}: GameOverlayProps) {
  const { messages } = useLanguage();
  const { theme } = useTheme();

  if (status === "playing" || status === "paused") {
    return null;
  }

  const title = titleOverride ?? (status === "won" ? messages.play.overlay.win : messages.play.overlay.lose);
  const message = messageOverride ?? (status === "won" ? messages.play.overlay.winMessage : messages.play.overlay.loseMessage);
  const buttonLabel = buttonLabelOverride ?? (status === "won" ? messages.play.overlay.restart : messages.play.overlay.retry);

  return (
    <div className="theme-overlay absolute inset-0 z-90 flex items-center justify-center px-4 backdrop-blur-md">
      <div className="theme-panel w-full max-w-md rounded-4xl bg-[linear-gradient(180deg,var(--surface-1),var(--app-bg-soft))] p-6 text-center shadow-[0_30px_80px_rgba(0,0,0,0.35)] sm:p-8">
        <div className="flex justify-center">
          <Image
            src={theme === "light" ? "/Grafico/Logo Speleum.svg" : "/Grafico/Logo blanco.svg"}
            alt="Speleum"
            width={42}
            height={42}
            className="h-10 w-auto opacity-90"
          />
        </div>
        <p className="theme-text-muted mt-3 text-xs tracking-[0.36em]">SPELEUM</p>
        <h2 className="theme-text-primary mt-4 text-3xl font-semibold tracking-[0.08em] sm:text-4xl sm:tracking-[0.12em]">
          {title}
        </h2>
        <p className="theme-text-secondary mt-4 text-sm leading-7">{message}</p>
        {summary && <div className="mt-6">{summary}</div>}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onRestart}
            className="theme-button-primary flex-1 rounded-full px-5 py-3 text-sm font-semibold transition"
          >
            {buttonLabel}
          </button>
          <button
            type="button"
            onClick={onExitToMenu}
            className="theme-button-secondary flex-1 rounded-full px-5 py-3 text-sm transition"
          >
            {messages.play.overlay.backToMenu}
          </button>
        </div>
      </div>
    </div>
  );
}
