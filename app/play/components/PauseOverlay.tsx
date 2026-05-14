"use client";

type PauseOverlayProps = {
  onContinue: () => void;
  onExitToMenu: () => void;
};

export function PauseOverlay({
  onContinue,
  onExitToMenu,
}: PauseOverlayProps) {
  return (
    <div className="absolute inset-0 z-90 flex items-center justify-center bg-black/56 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(20,20,24,0.96),rgba(8,8,10,0.96))] p-6 text-center shadow-[0_24px_70px_rgba(0,0,0,0.58)] sm:p-8">
        <p className="text-xs tracking-[0.36em] text-zinc-500">SPELEUM</p>
        <h2 className="mt-4 text-3xl font-semibold tracking-[0.08em] text-white sm:text-4xl">
          Pausa
        </h2>
        <p className="mt-4 text-sm leading-7 text-zinc-300">
          La cueva queda en silencio.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onContinue}
            aria-label="Continuar partida"
            className="flex-1 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
          >
            Continuar
          </button>
          <button
            type="button"
            onClick={onExitToMenu}
            aria-label="Volver al menú"
            className="flex-1 rounded-full border border-white/10 bg-black/45 px-5 py-3 text-sm text-zinc-200 transition hover:bg-white/10"
          >
            Volver al menú
          </button>
        </div>
      </div>
    </div>
  );
}
