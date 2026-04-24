import type { LocalRankingEntry } from "@/app/play/types";

export const LOCAL_RANKING_KEY = "speleum.ranking.local.v1";

export function readLocalRanking() {
  if (typeof window === "undefined") {
    return [] as LocalRankingEntry[];
  }

  try {
    const raw = window.localStorage.getItem(LOCAL_RANKING_KEY);
    const parsed = raw ? (JSON.parse(raw) as LocalRankingEntry[]) : [];

    return parsed.sort(
      (a, b) =>
        new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
    );
  } catch {
    return [] as LocalRankingEntry[];
  }
}

export function writeLocalRanking(entries: LocalRankingEntry[]) {
  window.localStorage.setItem(LOCAL_RANKING_KEY, JSON.stringify(entries));
}

export function appendLocalRanking(entry: LocalRankingEntry) {
  const current = readLocalRanking();
  const next = [entry, ...current].slice(0, 20);
  writeLocalRanking(next);
}
