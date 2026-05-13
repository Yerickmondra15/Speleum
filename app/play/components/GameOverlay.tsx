"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import type { GameStatus } from "../gameConfig";

type GameOverlayProps = {
  status: GameStatus;
  onRestart: () => void;
  onExitToMenu: () => void;
  titleOverride?: string;
  messageOverride?: string;
  buttonLabelOverride?: string;
  summary?: ReactNode;
};

const overlayContent: Record<
  Extract<GameStatus, "won" | "lost">,
  { title: string; message: string; buttonLabel: string }
> = {
  won: {
    title: "Ganaste",
    message: "Fuiste la ultima criatura viva en la cueva.",
    buttonLabel: "Reiniciar",
  },
  lost: {
    title: "Perdiste",
    message: "La cueva te encontro antes del final.",
    buttonLabel: "Intentar de nuevo",
  },
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
  if (status === "playing" || status === "paused") {
    return null;
  }

  const content = overlayContent[status];
  const title = titleOverride ?? content.title;
  const message = messageOverride ?? content.message;
  const buttonLabel = buttonLabelOverride ?? content.buttonLabel;

  return (
    <div className="absolute inset-0 z-90 flex items-center justify-center bg-black/72 px-4 backdrop-blur-md">
      <div className="w-full max-w-md rounded-4xl border border-white/10 bg-[linear-gradient(180deg,rgba(24,24,27,0.96),rgba(10,10,12,0.96))] p-6 text-center shadow-[0_30px_80px_rgba(0,0,0,0.65)] sm:p-8">
        <div className="flex justify-center">
          <Image
            src="/Grafico/Logo blanco.svg"
            alt="Speleum"
            width={42}
            height={42}
            className="h-10 w-auto opacity-90"
          />
        </div>
        <p className="mt-3 text-xs tracking-[0.36em] text-zinc-500">SPELEUM</p>
        <h2 className="mt-4 text-3xl font-semibold tracking-[0.08em] text-white sm:text-4xl sm:tracking-[0.12em]">
          {title}
        </h2>
        <p className="mt-4 text-sm leading-7 text-zinc-300">{message}</p>
        {summary && <div className="mt-6">{summary}</div>}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onRestart}
            className="flex-1 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
          >
            {buttonLabel}
          </button>
          <button
            type="button"
            onClick={onExitToMenu}
            className="flex-1 rounded-full border border-white/10 bg-black/45 px-5 py-3 text-sm text-zinc-200 transition hover:bg-white/10"
          >
            Volver al menu
          </button>
        </div>
      </div>
    </div>
  );
}
