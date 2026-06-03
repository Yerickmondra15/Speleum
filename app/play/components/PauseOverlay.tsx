"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";

type PauseOverlayProps = {
  onContinue: () => void;
  onExitToMenu: () => void;
};

export function PauseOverlay({
  onContinue,
  onExitToMenu,
}: PauseOverlayProps) {
  const { messages } = useLanguage();

  return (
    <div className="theme-overlay absolute inset-0 z-90 flex items-center justify-center px-4 backdrop-blur-sm">
      <div className="theme-panel w-full max-w-md rounded-[2rem] bg-[linear-gradient(180deg,var(--surface-1),var(--app-bg-soft))] p-6 text-center shadow-[0_24px_70px_rgba(0,0,0,0.3)] sm:p-8">
        <p className="theme-text-muted text-xs tracking-[0.36em]">SPELEUM</p>
        <h2 className="theme-text-primary mt-4 text-3xl font-semibold tracking-[0.08em] sm:text-4xl">
          {messages.play.pause.title}
        </h2>
        <p className="theme-text-secondary mt-4 text-sm leading-7">
          {messages.play.pause.text}
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onContinue}
            aria-label={messages.play.controls.resumeGame}
            className="theme-button-primary flex-1 rounded-full px-5 py-3 text-sm font-semibold transition"
          >
            {messages.common.continue}
          </button>
          <button
            type="button"
            onClick={onExitToMenu}
            aria-label={messages.play.overlay.backToMenu}
            className="theme-button-secondary flex-1 rounded-full px-5 py-3 text-sm transition"
          >
            {messages.play.overlay.backToMenu}
          </button>
        </div>
      </div>
    </div>
  );
}
