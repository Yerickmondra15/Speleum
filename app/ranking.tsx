"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Trophy } from "lucide-react";
import { getCharacterName, type LocalRankingEntry } from "./play/types";
import { characterOptions } from "./play/gameConfig";
import { readLocalRanking } from "@/lib/ranking";

export default function RankingView() {
  const [entries] = useState<LocalRankingEntry[]>(() => readLocalRanking());

  return (
    <main className="min-h-screen bg-black px-5 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.35em] text-zinc-500">SPELEUM</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[0.12em] text-white">
              RANKING LOCAL
            </h1>
          </div>
          <Link
            href="/play"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm text-zinc-300 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a play
          </Link>
        </div>

        <div className="mt-8 rounded-4xl border border-white/10 bg-black/35 p-6 backdrop-blur-md">
          {entries.length === 0 ? (
            <div className="rounded-[1.4rem] border border-white/10 bg-black/30 p-6 text-zinc-400">
              Todavia no hay partidas guardadas. Termina una sala multijugador para ver resultados aqui.
            </div>
          ) : (
            <div className="space-y-4">
              {entries.map((entry) => (
                <article
                  key={entry.id}
                  className="rounded-[1.4rem] border border-white/10 bg-black/30 p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs tracking-[0.24em] text-zinc-500">GANADOR</p>
                      <h2 className="mt-2 text-xl font-semibold text-white">
                        {entry.winnerName}
                      </h2>
                      <p className="mt-1 text-sm text-zinc-500">
                        {getCharacterName(characterOptions, entry.winnerCharacterId)}
                      </p>
                    </div>
                    <div className="text-right text-sm text-zinc-400">
                      <p>Sala {entry.roomCode}</p>
                      <p>{entry.totalPlayers} criaturas</p>
                      <p>{Math.round(entry.durationMs / 1000)}s</p>
                    </div>
                  </div>

                  <div className="mt-5 overflow-hidden rounded-[1.1rem] border border-white/10">
                    <div className="grid grid-cols-[4rem_1fr_5rem_6rem] gap-3 border-b border-white/10 px-4 py-3 text-[0.65rem] tracking-[0.24em] text-zinc-500">
                      <span>PUESTO</span>
                      <span>CRIATURA</span>
                      <span>KILLS</span>
                      <span>DANO</span>
                    </div>
                    {entry.standings.map((standing) => (
                      <div
                        key={standing.playerId}
                        className="grid grid-cols-[4rem_1fr_5rem_6rem] gap-3 px-4 py-3 text-sm text-zinc-200"
                      >
                        <span className="inline-flex items-center gap-2">
                          {standing.placement === 1 && <Trophy className="h-4 w-4 text-amber-200" />}
                          #{standing.placement}
                        </span>
                        <span>{standing.name}</span>
                        <span>{standing.kills}</span>
                        <span>{standing.damageDealt}</span>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
