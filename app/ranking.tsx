"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, Search, SlidersHorizontal, Trophy, X } from "lucide-react";
import { creatures, getCreatureById } from "@/lib/creatures";
import { getLocalizedCreature } from "@/lib/i18n/content";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { fetchRankingPage, type RankingEntry } from "@/lib/ranking-contract";
import {
  rankingFiltersSchema,
  type RankingFilters,
} from "@/lib/ranking-query";

type ActiveFilters = Omit<RankingFilters, "page" | "limit">;

const defaultFilters: ActiveFilters = {
  q: "",
  minScore: undefined,
  maxScore: undefined,
  minWins: undefined,
  minMatches: undefined,
  creature: undefined,
  sort: "score",
  direction: "desc",
};

const defaultDraft = {
  q: "",
  minScore: "",
  maxScore: "",
  minWins: "",
  minMatches: "",
  creature: "",
  sort: "score",
  direction: "desc",
};

export default function RankingView() {
  const { locale, messages } = useLanguage();
  const [entries, setEntries] = useState<RankingEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<ActiveFilters>(defaultFilters);
  const [draft, setDraft] = useState(defaultDraft);
  const [filterError, setFilterError] = useState<string | null>(null);
  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        filters.q ||
          filters.minScore !== undefined ||
          filters.maxScore !== undefined ||
          filters.minWins !== undefined ||
          filters.minMatches !== undefined ||
          filters.creature ||
          filters.sort !== "score" ||
          filters.direction !== "desc",
      ),
    [filters],
  );

  useEffect(() => {
    const controller = new AbortController();

    async function loadRanking() {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const data = await fetchRankingPage({
          page,
          filters,
          signal: controller.signal,
        });
        setEntries(data.entries);
        setTotalPages(data.pagination.totalPages);
        setTotal(data.pagination.total);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setEntries([]);
        setTotalPages(1);
        setTotal(0);
        setErrorMessage(
          error instanceof Error ? error.message : messages.ranking.error,
        );
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    void loadRanking();
    return () => controller.abort();
  }, [filters, messages.ranking.error, page]);

  const submitFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = rankingFiltersSchema.safeParse({
      page: 1,
      limit: 20,
      ...draft,
    });
    if (!parsed.success) {
      setFilterError(messages.ranking.invalidFilters);
      return;
    }

    const { page: _page, limit: _limit, ...nextFilters } = parsed.data;
    void _page;
    void _limit;
    setFilterError(null);
    setPage(1);
    setFilters(nextFilters);
  };

  const clearFilters = () => {
    setDraft(defaultDraft);
    setFilters(defaultFilters);
    setFilterError(null);
    setPage(1);
  };

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

        <form
          onSubmit={submitFilters}
          className="theme-panel mt-8 rounded-4xl p-4 sm:p-6"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1 text-sm text-(--text-secondary)">
              <span className="mb-2 block text-xs tracking-[0.18em] text-(--text-muted)">
                {messages.ranking.searchLabel}
              </span>
              <span className="theme-input flex min-h-12 items-center gap-3 rounded-full px-4">
                <Search className="h-4 w-4 shrink-0 text-(--text-muted)" />
                <input
                  value={draft.q}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, q: event.target.value }))
                  }
                  maxLength={40}
                  className="min-w-0 flex-1 bg-transparent outline-none"
                  placeholder={messages.ranking.searchPlaceholder}
                />
              </span>
            </label>
            <button
              type="submit"
              className="theme-button-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold"
            >
              <Search className="h-4 w-4" />
              {messages.ranking.applyFilters}
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="theme-button-secondary inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 py-3 text-sm"
            >
              <X className="h-4 w-4" />
              {messages.ranking.clearFilters}
            </button>
          </div>

          <details className="theme-card mt-4 rounded-[1.4rem] p-4">
            <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 text-sm font-medium text-(--text-primary)">
              <SlidersHorizontal className="h-4 w-4" />
              {messages.ranking.filtersTitle}
            </summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(
                [
                  ["minScore", messages.ranking.minScore],
                  ["maxScore", messages.ranking.maxScore],
                  ["minWins", messages.ranking.minWins],
                  ["minMatches", messages.ranking.minMatches],
                ] as const
              ).map(([field, label]) => (
                <label key={field} className="text-xs text-(--text-muted)">
                  <span className="mb-2 block">{label}</span>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={draft[field]}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        [field]: event.target.value,
                      }))
                    }
                    className="theme-input min-h-11 w-full rounded-xl px-3 py-2 text-sm"
                  />
                </label>
              ))}

              <label className="text-xs text-(--text-muted)">
                <span className="mb-2 block">{messages.ranking.activeCreature}</span>
                <select
                  value={draft.creature}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, creature: event.target.value }))
                  }
                  className="theme-input min-h-11 w-full rounded-xl px-3 py-2 text-sm"
                >
                  <option value="">{messages.ranking.allCreatures}</option>
                  {creatures.map((creature) => (
                    <option key={creature.id} value={creature.id}>
                      {getLocalizedCreature(locale, creature.id).nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs text-(--text-muted)">
                <span className="mb-2 block">{messages.ranking.sortBy}</span>
                <select
                  value={draft.sort}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, sort: event.target.value }))
                  }
                  className="theme-input min-h-11 w-full rounded-xl px-3 py-2 text-sm"
                >
                  <option value="score">{messages.ranking.sortScore}</option>
                  <option value="wins">{messages.ranking.sortWins}</option>
                  <option value="matchesPlayed">{messages.ranking.sortMatches}</option>
                  <option value="bestScore">{messages.ranking.sortBestScore}</option>
                </select>
              </label>

              <label className="text-xs text-(--text-muted)">
                <span className="mb-2 block">{messages.ranking.direction}</span>
                <select
                  value={draft.direction}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, direction: event.target.value }))
                  }
                  className="theme-input min-h-11 w-full rounded-xl px-3 py-2 text-sm"
                >
                  <option value="desc">{messages.ranking.descending}</option>
                  <option value="asc">{messages.ranking.ascending}</option>
                </select>
              </label>
            </div>
          </details>

          {filterError && (
            <p role="alert" className="theme-error mt-4 rounded-xl px-4 py-3 text-sm">
              {filterError}
            </p>
          )}
        </form>

        <div className="theme-panel mt-5 rounded-4xl p-4 sm:p-6">
          {!isLoading && !errorMessage && total > 0 && (
            <p className="mb-4 text-xs text-(--text-muted)" aria-live="polite">
              {total} {messages.ranking.resultsFound}
            </p>
          )}
          {isLoading ? (
            <div className="theme-card rounded-[1.4rem] p-6 text-(--text-secondary)">
              {messages.ranking.loading}
            </div>
          ) : errorMessage ? (
            <div
              role="alert"
              className="theme-card rounded-[1.4rem] p-6 text-red-300"
            >
              {messages.ranking.error} {errorMessage}
            </div>
          ) : entries.length === 0 ? (
            <div className="theme-card rounded-[1.4rem] p-6 text-(--text-secondary)">
              {hasActiveFilters ? messages.ranking.filteredEmpty : messages.ranking.empty}
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
                        <p>{messages.ranking.bestScore} {entry.bestScore}</p>
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
                        <span className="sm:text-center">{messages.ranking.winsShort}: {entry.wins}</span>
                        <span className="sm:text-center">{messages.ranking.lossShort}: {entry.losses}</span>
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
