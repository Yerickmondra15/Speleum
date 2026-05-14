"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Trophy } from "lucide-react";
import { getCreatureById } from "@/lib/creatures";

type RankingEntry = {
  rank: number;
  userId: string;
  username: string;
  activeCreature: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  score: number;
  lastMatchAt: string | null;
};

export default function RankingView() {
  const [entries, setEntries] = useState<RankingEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadRanking() {
      try {
        const response = await fetch("/api/ranking", {
          cache: "no-store",
        });
        const data = (await response.json()) as RankingEntry[];
        setEntries(Array.isArray(data) ? data : []);
      } finally {
        setIsLoading(false);
      }
    }

    void loadRanking();
  }, []);

  return (
    <main className="min-h-screen overflow-x-hidden bg-black px-4 py-8 text-white sm:px-5 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs tracking-[0.35em] text-zinc-500">SPELEUM</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[0.12em] text-white sm:text-4xl">
              RANKING
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
              Este panel resume puntuacion, victorias y actividad reciente de las criaturas registradas.
            </p>
          </div>
          <Link
            href="/play"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm text-zinc-300 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a Speleum
          </Link>
        </div>

        <div className="mt-8 rounded-4xl border border-white/10 bg-black/35 p-4 backdrop-blur-md sm:p-6">
          {isLoading ? (
            <div className="rounded-[1.4rem] border border-white/10 bg-black/30 p-6 text-zinc-400">
              Cargando ranking...
            </div>
          ) : entries.length === 0 ? (
            <div className="rounded-[1.4rem] border border-white/10 bg-black/30 p-6 text-zinc-400">
              Todavia no hay resultados persistidos para mostrar en el ranking.
            </div>
          ) : (
            <div className="space-y-4">
              {entries.map((entry) => {
                const creature = getCreatureById(entry.activeCreature);

                return (
                  <article
                    key={entry.userId}
                    className="rounded-[1.4rem] border border-white/10 bg-black/30 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs tracking-[0.24em] text-zinc-500">JUGADOR</p>
                        <h2 className="mt-2 text-xl font-semibold text-white">
                          #{entry.rank} {entry.username}
                        </h2>
                        <p className="mt-1 text-sm text-zinc-500">{creature.nombre}</p>
                      </div>
                      <div className="text-left text-sm text-zinc-400 sm:text-right">
                        <p>Score {entry.score}</p>
                        <p>{entry.wins} victorias</p>
                        <p>{entry.matchesPlayed} partidas</p>
                      </div>
                    </div>

                    <div className="mt-5 overflow-hidden rounded-[1.1rem] border border-white/10">
                      <div className="hidden grid-cols-[4rem_1fr_5rem_5rem_6rem] gap-3 border-b border-white/10 px-4 py-3 text-[0.65rem] tracking-[0.24em] text-zinc-500 sm:grid">
                        <span>PUESTO</span>
                        <span>CRIATURA</span>
                        <span>WINS</span>
                        <span>LOSS</span>
                        <span>JUGADAS</span>
                      </div>
                      <div className="grid gap-3 px-4 py-4 text-sm text-zinc-200 sm:grid-cols-[4rem_1fr_5rem_5rem_6rem] sm:items-center sm:gap-3 sm:py-3">
                        <span className="inline-flex items-center gap-2">
                          {entry.rank === 1 && <Trophy className="h-4 w-4 text-amber-200" />}
                          #{entry.rank}
                        </span>
                        <span>{creature.nombre}</span>
                        <span className="sm:text-center">Wins: {entry.wins}</span>
                        <span className="sm:text-center">Loss: {entry.losses}</span>
                        <span className="sm:text-center">Jugadas: {entry.matchesPlayed}</span>
                      </div>
                    </div>

                    <p className="mt-4 text-xs text-zinc-500">
                      Ultima partida:{" "}
                      {entry.lastMatchAt
                        ? new Date(entry.lastMatchAt).toLocaleString("es-CR")
                        : "Sin registro"}
                    </p>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
