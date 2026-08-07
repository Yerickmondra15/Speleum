"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Trophy } from "lucide-react";
import { getCreatureById } from "@/lib/creatures";
import { getLocalizedCreature } from "@/lib/i18n/content";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

type RankingEntry = {
  rank: number;
  userId: string;
  username: string;
  activeCreature: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  score: number;
  winRate: number;
  lastMatchAt: string | null;
};

export default function RankingView() {
  const { locale, messages } = useLanguage();
  const [entries, setEntries] = useState<RankingEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    async function loadRanking() {
      try {
        const response = await fetch(`/api/ranking?page=${page}&limit=20`, {
          cache: "no-store",
        });
        const data = (await response.json()) as {
          entries?: RankingEntry[];
          pagination?: { totalPages?: number };
        };
        setEntries(Array.isArray(data.entries) ? data.entries : []);
        setTotalPages(data.pagination?.totalPages ?? 1);
      } finally {
        setIsLoading(false);
      }
    }

    void loadRanking();
  }, [page]);

  return (
    <main className="theme-page min-h-screen overflow-x-hidden px-4 py-8 sm:px-5 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs tracking-[0.35em] text-(--text-muted)">SPELEUM</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[0.12em] text-(--text-primary) sm:text-4xl">
              {messages.common.ranking}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-(--text-secondary)">
              {messages.ranking.subtitle}
            </p>
          </div>
          <Link
            href="/play"
            className="theme-button-secondary inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm transition"
          >
            <ArrowLeft className="h-4 w-4" />
            {messages.ranking.backToSpeleum}
          </Link>
        </div>

        <div className="theme-panel mt-8 rounded-4xl p-4 sm:p-6">
          {isLoading ? (
            <div className="theme-card rounded-[1.4rem] p-6 text-(--text-secondary)">
              {messages.ranking.loading}
            </div>
          ) : entries.length === 0 ? (
            <div className="theme-card rounded-[1.4rem] p-6 text-(--text-secondary)">
              {messages.ranking.empty}
            </div>
          ) : (
            <div className="space-y-4">
              {entries.map((entry) => {
                const creature = getLocalizedCreature(locale, getCreatureById(entry.activeCreature).id);

                return (
                  <article
                    key={entry.userId}
                    className="theme-card rounded-[1.4rem] p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs tracking-[0.24em] text-(--text-muted)">{messages.ranking.player}</p>
                        <h2 className="mt-2 text-xl font-semibold text-(--text-primary)">
                          #{entry.rank} {entry.username}
                        </h2>
                        <p className="mt-1 text-sm text-(--text-muted)">{creature.nombre}</p>
                      </div>
                      <div className="text-left text-sm text-(--text-secondary) sm:text-right">
                        <p>Score {entry.score}</p>
                        <p>{entry.wins} {messages.ranking.wins}</p>
                        <p>{entry.winRate}%</p>
                        <p>{entry.matchesPlayed} {messages.ranking.matches}</p>
                      </div>
                    </div>

                    <div className="mt-5 overflow-hidden rounded-[1.1rem] border border-(--border-soft)">
                      <div className="hidden grid-cols-[4rem_1fr_5rem_5rem_6rem] gap-3 border-b border-(--border-soft) px-4 py-3 text-[0.65rem] tracking-[0.24em] text-(--text-muted) sm:grid">
                        <span>{messages.ranking.rank}</span>
                        <span>{messages.ranking.creature}</span>
                        <span>{messages.ranking.winsShort}</span>
                        <span>{messages.ranking.lossShort}</span>
                        <span>{messages.ranking.playedShort}</span>
                      </div>
                      <div className="grid gap-3 px-4 py-4 text-sm text-(--text-secondary) sm:grid-cols-[4rem_1fr_5rem_5rem_6rem] sm:items-center sm:gap-3 sm:py-3">
                        <span className="inline-flex items-center gap-2">
                          {entry.rank === 1 && <Trophy className="h-4 w-4 text-amber-200" />}
                          #{entry.rank}
                        </span>
                        <span>{creature.nombre}</span>
                        <span className="sm:text-center">Wins: {entry.wins}</span>
                        <span className="sm:text-center">Loss: {entry.losses}</span>
                        <span className="sm:text-center">{messages.ranking.playedShort}: {entry.matchesPlayed}</span>
                      </div>
                    </div>

                    <p className="mt-4 text-xs text-(--text-muted)">
                      {messages.ranking.lastMatch}:{" "}
                      {entry.lastMatchAt
                        ? new Date(entry.lastMatchAt).toLocaleString(locale === "es" ? "es-CR" : "en-US")
                        : messages.ranking.noRecord}
                    </p>
                  </article>
                );
              })}
            </div>
          )}
          {!isLoading && totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => {
                  setIsLoading(true);
                  setPage((current) => Math.max(1, current - 1));
                }}
                className="theme-button-secondary rounded-full px-4 py-2 text-sm disabled:opacity-40"
              >
                {messages.common.back}
              </button>
              <span className="text-sm text-(--text-muted)">{page}/{totalPages}</span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => {
                  setIsLoading(true);
                  setPage((current) => Math.min(totalPages, current + 1));
                }}
                className="theme-button-secondary rounded-full px-4 py-2 text-sm disabled:opacity-40"
              >
                {messages.common.continue}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
