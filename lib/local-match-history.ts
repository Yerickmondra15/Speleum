import type { LocalMatchSnapshot } from "@/app/play/types";

// Keep the existing key so previously stored browser snapshots are preserved.
export const LOCAL_MATCH_HISTORY_KEY = "speleum.ranking.local.v1";

export function readLocalMatchHistory() {
  if (typeof window === "undefined") return [] as LocalMatchSnapshot[];
  try {
    const raw = window.localStorage.getItem(LOCAL_MATCH_HISTORY_KEY);
    const parsed = raw ? (JSON.parse(raw) as LocalMatchSnapshot[]) : [];
    return parsed.sort(
      (left, right) =>
        new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime(),
    );
  } catch {
    return [] as LocalMatchSnapshot[];
  }
}

export function writeLocalMatchHistory(entries: LocalMatchSnapshot[]) {
  window.localStorage.setItem(LOCAL_MATCH_HISTORY_KEY, JSON.stringify(entries));
}

export function appendLocalMatchSnapshot(entry: LocalMatchSnapshot) {
  writeLocalMatchHistory([entry, ...readLocalMatchHistory()].slice(0, 20));
}
