"use client";

type GameTopControlsProps = {
  isUiHidden: boolean;
  showPause?: boolean;
  isPaused?: boolean;
  onTogglePause?: () => void;
  onToggleUi: () => void;
};

function controlButtonClass(compact = false) {
  return compact
    ? "pointer-events-auto inline-flex min-h-9 items-center justify-center rounded-full border border-white/10 bg-black/55 px-3 py-2 text-[0.65rem] font-medium tracking-[0.14em] text-zinc-200 backdrop-blur-md transition hover:bg-black/70 hover:text-white sm:min-h-11 sm:px-4 sm:text-sm"
    : "pointer-events-auto inline-flex min-h-9 items-center justify-center rounded-full border border-white/10 bg-black/55 px-3 py-2 text-[0.65rem] font-medium tracking-[0.14em] text-zinc-200 backdrop-blur-md transition hover:bg-black/70 hover:text-white sm:min-h-11 sm:px-4 sm:text-sm";
}

export function GameTopControls({
  isUiHidden,
  showPause = false,
  isPaused = false,
  onTogglePause,
  onToggleUi,
}: GameTopControlsProps) {
  return (
    <div className="pointer-events-auto flex items-center justify-end gap-1.5 sm:gap-2">
      {!isUiHidden && showPause && onTogglePause && (
        <button
          type="button"
          onClick={onTogglePause}
          aria-label={isPaused ? "Continuar partida" : "Pausar partida"}
          className={controlButtonClass()}
        >
          {isPaused ? "Continuar" : "Pausa"}
        </button>
      )}

      <button
        type="button"
        onClick={onToggleUi}
        aria-label={isUiHidden ? "Mostrar interfaz" : "Ocultar interfaz"}
        className={controlButtonClass(isUiHidden)}
      >
        {isUiHidden ? "Mostrar UI" : "Ocultar UI"}
      </button>
    </div>
  );
}
