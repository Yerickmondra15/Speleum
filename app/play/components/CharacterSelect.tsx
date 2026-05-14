"use client";

import Image from "next/image";
import { ArrowLeft, Play } from "lucide-react";
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
  const selectedCharacter =
    characterOptions.find((character) => character.id === selectedCharacterId) ??
    characterOptions[0];
  const statEntries = Object.entries(selectedCharacter.stats) as Array<
    [keyof typeof selectedCharacter.stats, number]
  >;

  return (
    <section className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-5 sm:py-8">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-5">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-11 items-center gap-2 text-sm text-zinc-300 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Menu
        </button>
        <p className="text-xs tracking-[0.24em] text-zinc-500 sm:tracking-[0.34em]">
          SELECCION DE PERSONAJE
        </p>
      </header>

      <div className="grid flex-1 content-center gap-8 py-8 sm:py-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-xs tracking-[0.3em] text-zinc-500">CRIATURAS</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-[0.12em] text-white sm:text-5xl sm:tracking-[0.16em]">
            Elige como entrar a la cueva
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-7 text-zinc-400">
            Cada criatura cambia la forma de moverte y la senal que dejas en el
            radar. Elige una entrada antes de buscar partida o registrar nuevos resultados.
          </p>

          <div className="mt-8 overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/[0.035]">
            <div className="relative flex min-h-72 items-center justify-center border-b border-white/10 bg-[radial-gradient(circle,rgba(255,255,255,0.07),transparent_70%)] p-6">
              <Image
                src={selectedCharacter.imageIllustration}
                alt={selectedCharacter.name}
                width={280}
                height={280}
                className="max-h-64 w-auto object-contain"
              />
            </div>
            <div className="grid gap-4 p-5">
              <div>
                <h2 className="text-2xl font-semibold text-white">
                  {selectedCharacter.name}
                </h2>
                <p className="mt-1 text-sm text-zinc-400">{selectedCharacter.role}</p>
                <p className="mt-3 text-sm leading-6 text-zinc-400">
                  {selectedCharacter.description}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <p className="text-xs tracking-[0.22em] text-zinc-500">HABILIDAD</p>
                <p className="mt-2 text-sm text-zinc-200">{selectedCharacter.ability}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {statEntries.map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
                      <span className="capitalize">{label}</span>
                      <span className="text-zinc-200">{value}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-rose-200/80"
                        style={{ width: `${value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3">
          {characterOptions.map((character) => {
            const isSelected = selectedCharacterId === character.id;

            return (
              <button
                key={character.id}
                type="button"
                onClick={() => onSelect(character)}
                className={`grid items-center gap-4 rounded-[1.25rem] border p-4 text-left transition sm:grid-cols-[4rem_1fr_auto] ${
                  isSelected
                    ? "border-white/35 bg-white/10"
                    : "border-white/10 bg-white/[0.035] hover:bg-white/[0.06]"
                }`}
              >
                <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-zinc-100/80">
                  <Image
                    src={character.imageGame}
                    alt={character.name}
                    width={46}
                    height={46}
                    className="h-11 w-11 object-contain"
                  />
                </div>

                <div className="min-w-0">
                  <h2 className="font-semibold text-white">{character.name}</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    {character.role}
                  </p>
                  <p className="mt-2 break-words text-xs leading-5 text-zinc-500">
                    {character.ability}
                  </p>
                </div>

                <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 sm:text-right">
                  {isSelected ? "Activa" : "Disponible"}
                </div>
              </button>
            );
          })}

          <button
            type="button"
            onClick={onStart}
            className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 sm:w-fit sm:justify-self-end"
          >
            <Play className="h-4 w-4 fill-black" />
            Seleccionar criatura
          </button>
        </div>
      </div>
    </section>
  );
}
