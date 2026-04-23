"use client";

import { ArrowLeft, Lock, Play } from "lucide-react";
import { characterOptions, type CharacterOption } from "../gameConfig";

type CharacterSelectProps = {
  selectedCharacterId: string;
  onBack: () => void;
  onSelect: (character: CharacterOption) => void;
  onStart: () => void;
};

export function CharacterSelect({
  selectedCharacterId,
  onBack,
  onSelect,
  onStart,
}: CharacterSelectProps) {
  return (
    <section className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-8">
      <header className="flex items-center justify-between border-b border-white/5 pb-5">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-zinc-300 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Menu
        </button>
        <p className="text-xs tracking-[0.34em] text-zinc-500">
          SELECCION DE PERSONAJE
        </p>
      </header>

      <div className="grid flex-1 content-center gap-8 py-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-xs tracking-[0.3em] text-zinc-500">CRIATURAS</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[0.16em] text-white sm:text-5xl">
            Elige como entrar a la cueva
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-7 text-zinc-400">
            Cada criatura cambia la forma de moverte y la senal que dejas en el
            radar. Elige una entrada antes de buscar partida.
          </p>
        </div>

        <div className="grid gap-3">
          {characterOptions.map((character) => {
            const isSelected = selectedCharacterId === character.id;
            const isLocked = character.status === "locked";

            return (
              <button
                key={character.id}
                type="button"
                disabled={isLocked}
                onClick={() => onSelect(character)}
                className={`grid grid-cols-[4rem_1fr_auto] items-center gap-4 rounded-[1.25rem] border p-4 text-left transition ${
                  isSelected
                    ? "border-white/35 bg-white/10"
                    : "border-white/10 bg-white/[0.035] hover:bg-white/[0.06]"
                } ${isLocked ? "cursor-not-allowed opacity-45" : ""}`}
              >
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-zinc-100/80">
                  <div
                    className={`h-3 w-3 rounded-full ${
                      isLocked ? "bg-zinc-500" : "bg-rose-300"
                    }`}
                  />
                </div>

                <div>
                  <h2 className="font-semibold text-white">{character.name}</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    {character.role}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-zinc-500">
                    {character.trait}
                  </p>
                </div>

                <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  {isLocked ? (
                    <span className="inline-flex items-center gap-2">
                      <Lock className="h-3.5 w-3.5" />
                      Proximamente
                    </span>
                  ) : (
                    isSelected ? "Activa" : "Disponible"
                  )}
                </div>
              </button>
            );
          })}

          <button
            type="button"
            onClick={onStart}
            className="mt-3 inline-flex w-fit items-center gap-2 justify-self-end rounded-full bg-white px-7 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
          >
            <Play className="h-4 w-4 fill-black" />
            Iniciar
          </button>
        </div>
      </div>
    </section>
  );
}
