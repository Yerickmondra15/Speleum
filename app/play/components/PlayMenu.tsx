"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Play, UserRound } from "lucide-react";
import type { CharacterOption } from "../gameConfig";

type PlayMenuProps = {
  selectedCharacter: CharacterOption;
  onOpenCharacters: () => void;
  onStartLocal: () => void;
  onStartMultiplayer: () => void;
};

export function PlayMenu({
  selectedCharacter,
  onOpenCharacters,
  onStartLocal,
  onStartMultiplayer,
}: PlayMenuProps) {
  return (
    <section className="relative z-10 min-h-screen overflow-hidden px-5">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(255,255,255,0.08),transparent_19%),radial-gradient(circle_at_58%_58%,rgba(82,9,20,0.22),transparent_34%)]" />
      <div className="absolute left-1/2 top-1/2 h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/5" />
      <div className="absolute left-1/2 top-1/2 h-[30rem] w-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/5" />
      <div className="absolute bottom-8 left-8 hidden text-xs tracking-[0.28em] text-zinc-600 sm:block">
        {selectedCharacter.name}
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center text-center">
        <Image
          src="/Grafico/Nombre-white.svg"
          alt="Speleum"
          width={180}
          height={40}
          className="h-8 w-auto opacity-90"
        />
        <p className="text-xs tracking-[0.42em] text-zinc-500">SPELEUM</p>
        <h1 className="mt-6 text-6xl font-semibold tracking-[0.32em] text-white sm:text-8xl">
          PLAY
        </h1>
        <p className="mt-7 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">
          Desciende con vision limitada, lee las senales de la cueva y decide
          cada accion antes de revelar tu posicion.
        </p>

        <div className="mt-12 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={onStartLocal}
              className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
            >
              <Play className="h-4 w-4 fill-black" />
              Local
            </button>
            <button
              type="button"
              onClick={onStartMultiplayer}
              className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-950/50 px-8 py-3 text-sm text-cyan-100 transition hover:bg-cyan-900/60"
            >
              <Play className="h-4 w-4 fill-cyan-100" />
              Multijugador
            </button>
            <button
              type="button"
              onClick={onOpenCharacters}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-8 py-3 text-sm text-white transition hover:bg-white/10"
            >
              <UserRound className="h-4 w-4" />
              Criatura
            </button>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-8 py-3 text-sm text-zinc-300 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Inicio
            </Link>
        </div>

        <div className="mt-14 flex items-center gap-4 text-left">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-white/25 bg-zinc-100/90 shadow-[0_0_34px_rgba(255,255,255,0.25)]">
            <div className="h-3.5 w-3.5 rounded-full bg-rose-300 shadow-[0_0_18px_rgba(253,164,175,0.9)]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              {selectedCharacter.name}
            </p>
            <p className="mt-1 text-xs text-zinc-500">{selectedCharacter.role}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
