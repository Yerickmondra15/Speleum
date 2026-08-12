import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  AudioController,
  audioStorageKey,
  defaultAudioPreferences,
  effectiveAudioVolume,
  readAudioPreferences,
  type AudioRuntime,
  type SpeleumSfx,
} from "@/lib/audio/audio";
import { persistLocale, readStoredLocale, resolveLocale } from "@/lib/i18n/language";
import {
  translateGameplayMessage,
  translateMultiplayerMessage,
} from "@/lib/i18n/content";
import {
  languageStorageKey,
  translations,
} from "@/lib/i18n/messages";
import { LOCAL_MATCH_HISTORY_KEY } from "@/lib/local-match-history";
import {
  compareCompetitiveRankingEntries,
  fetchRankingPage,
  RankingLoadError,
  type RankingEntry,
} from "@/lib/ranking-contract";
import {
  createRankingOrderBy,
  createRankingPagination,
  createRankingWhere,
  parseRankingSearchParams,
} from "@/lib/ranking-query";
import {
  persistTheme,
  readStoredTheme,
  resolveTheme,
  themeStorageKey,
} from "@/lib/theme/theme";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    values,
  };
}

function parsedFilters(query = "") {
  const parsed = parseRankingSearchParams(new URLSearchParams(query));
  if (!parsed.success) throw new Error("invalid fixture filters");
  return parsed.data;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const entry = (overrides: Partial<RankingEntry> = {}): RankingEntry => ({
  rank: 1,
  userId: "user-a",
  username: "Alpha",
  activeCreature: "cave-axolotl",
  matchesPlayed: 2,
  wins: 1,
  losses: 1,
  score: 100,
  bestScore: 80,
  winRate: 50,
  lastMatchAt: null,
  ...overrides,
});

class FakeAudioRuntime implements AudioRuntime {
  ambientCalls: Array<{ active: boolean; volume: number }> = [];
  effects: Array<{ effect: SpeleumSfx; volume: number }> = [];
  unlocks = 0;
  disposals = 0;

  async unlock() {
    this.unlocks += 1;
  }
  setAmbient(active: boolean, volume: number) {
    this.ambientCalls.push({ active, volume });
  }
  playEffect(effect: SpeleumSfx, volume: number) {
    this.effects.push({ effect, volume });
  }
  dispose() {
    this.disposals += 1;
  }
}

function translationPaths(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    translationPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("Bloque 3: idioma", () => {
  it("ES expone una cadena representativa en español", () => {
    expect(translations.es.play.game.localWinTitle).toBe("Dominaste la Cueva");
  });

  it("EN expone la cadena equivalente natural", () => {
    expect(translations.en.play.game.localWinTitle).toBe("You Dominated the Cave");
  });

  it("Gameplay y Multiplayer consumen i18n para textos críticos", () => {
    const actionControls = readFileSync(
      join(process.cwd(), "app/play/components/ActionControls.tsx"),
      "utf8",
    );
    const lobby = readFileSync(
      join(process.cwd(), "app/play/components/MultiplayerMenu.tsx"),
      "utf8",
    );
    const multiplayer = readFileSync(
      join(process.cwd(), "app/play/components/MultiplayerGame.tsx"),
      "utf8",
    );

    expect(actionControls).toContain("messages.play.hud.move");
    expect(actionControls).not.toContain(">MOVER<");
    expect(lobby).toContain("messages.play.lobby");
    expect(lobby).not.toContain("SALA PRIVADA");
    expect(multiplayer).toContain("gameCopy.multiWinTitle");
  });

  it("persiste y recupera la preferencia de idioma", () => {
    const storage = memoryStorage();
    persistLocale("en", storage);
    expect(storage.values.get(languageStorageKey)).toBe("en");
    expect(readStoredLocale(storage)).toBe("en");
  });

  it("normaliza una preferencia inválida al idioma por defecto", () => {
    expect(resolveLocale(null, "xx")).toBe("es");
    expect(resolveLocale("en", "es")).toBe("en");
  });

  it("ES y EN conservan la misma cobertura estructural", () => {
    expect(translationPaths(translations.en).sort()).toEqual(
      translationPaths(translations.es).sort(),
    );
  });

  it("traduce mensajes dinámicos del servidor y combate", () => {
    expect(
      translateMultiplayerMessage(
        "en",
        "Ari abandono la sala. Esperando minimo 2 jugadores.",
      ),
    ).toBe("Ari left the room. Waiting for at least 2 players.");
    expect(
      translateMultiplayerMessage("en", "Ari activa Ecolocalización."),
    ).toBe("Ari activates Echolocation.");
    expect(
      translateGameplayMessage("en", "Parry perfecto: Sombra queda aturdida."),
    ).toBe("Perfect parry: Sombra is stunned.");
  });
});

describe("Bloque 3: tema", () => {
  it("resuelve correctamente light", () => {
    expect(resolveTheme(null, "light")).toBe("light");
  });

  it("resuelve correctamente dark", () => {
    expect(resolveTheme(null, "dark")).toBe("dark");
  });

  it("persiste el cambio de tema", () => {
    const storage = memoryStorage();
    persistTheme("light", storage);
    expect(storage.values.get(themeStorageKey)).toBe("light");
    expect(readStoredTheme(storage)).toBe("light");
  });

  it("el estado ya aplicado prevalece durante hidratación", () => {
    expect(resolveTheme("dark", "light")).toBe("dark");
    expect(resolveTheme("light", "dark")).toBe("light");
  });
});

describe("Bloque 3: búsqueda y filtrado avanzado", () => {
  it("busca username exacto mediante contains server-side", () => {
    const where = createRankingWhere(parsedFilters("q=Alpha"));
    expect(where).toMatchObject({
      user: { is: { username: { contains: "Alpha", mode: "insensitive" } } },
    });
  });

  it("acepta una búsqueda parcial", () => {
    const where = createRankingWhere(parsedFilters("q=yer"));
    expect(where).toMatchObject({
      user: { is: { username: { contains: "yer" } } },
    });
  });

  it("configura búsqueda case-insensitive", () => {
    const where = createRankingWhere(parsedFilters("q=ALPHA"));
    expect(where).toMatchObject({
      user: { is: { username: { mode: "insensitive" } } },
    });
  });

  it("query vacía conserva el ranking competitivo normal", () => {
    expect(createRankingWhere(parsedFilters())).toEqual({
      matchesPlayed: { gt: 0 },
    });
  });

  it("rechaza una query demasiado larga", () => {
    const parsed = parseRankingSearchParams(
      new URLSearchParams({ q: "x".repeat(41) }),
    );
    expect(parsed.success).toBe(false);
  });

  it("aplica score mínimo", () => {
    expect(createRankingWhere(parsedFilters("minScore=50"))).toMatchObject({
      score: { gte: 50 },
    });
  });

  it("aplica score máximo", () => {
    expect(createRankingWhere(parsedFilters("maxScore=500"))).toMatchObject({
      score: { lte: 500 },
    });
  });

  it("aplica mínimo de victorias", () => {
    expect(createRankingWhere(parsedFilters("minWins=2"))).toMatchObject({
      wins: { gte: 2 },
    });
  });

  it("rechaza score mínimo mayor que máximo", () => {
    expect(
      parseRankingSearchParams(new URLSearchParams("minScore=20&maxScore=10"))
        .success,
    ).toBe(false);
  });

  it("combina username, score, wins, partidas y criatura", () => {
    const where = createRankingWhere(
      parsedFilters(
        "q=yer&minScore=10&maxScore=200&minWins=2&minMatches=3&creature=cave-crab",
      ),
    );
    expect(where).toMatchObject({
      matchesPlayed: { gt: 0, gte: 3 },
      score: { gte: 10, lte: 200 },
      wins: { gte: 2 },
      user: {
        is: {
          username: { contains: "yer", mode: "insensitive" },
          activeCreature: "cave-crab",
        },
      },
    });
  });

  it("ordena por bestScore y dirección solicitada", () => {
    expect(createRankingOrderBy(parsedFilters("sort=bestScore&direction=asc"))[0]).toEqual({
      bestScore: "asc",
    });
  });

  it("mantiene desempate determinista por username e id", () => {
    const items = [
      entry({ userId: "b", username: "Alpha" }),
      entry({ userId: "a", username: "Alpha" }),
      entry({ userId: "c", username: "Beta" }),
    ];
    items.sort(compareCompetitiveRankingEntries);
    expect(items.map(({ userId }) => userId)).toEqual(["a", "b", "c"]);

    const order = createRankingOrderBy(parsedFilters());
    expect(order.slice(-2)).toEqual([
      { user: { username: "asc" } },
      { userId: "asc" },
    ]);
  });

  it("pagina después de construir los filtros", () => {
    const filters = parsedFilters("page=3&limit=20&minWins=2&q=alpha");
    expect(createRankingWhere(filters)).toMatchObject({ wins: { gte: 2 } });
    expect(createRankingPagination(filters)).toEqual({ skip: 40, take: 20 });
  });

  it("cero resultados legítimos es un éxito vacío", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        entries: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      }),
    ) as unknown as typeof fetch;
    await expect(fetchRankingPage({ page: 1, fetchImpl })).resolves.toMatchObject({
      entries: [],
    });
  });

  it("HTTP error continúa siendo error y no vacío", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: "offline" }, 500)) as unknown as typeof fetch;
    await expect(fetchRankingPage({ page: 1, fetchImpl })).rejects.toBeInstanceOf(
      RankingLoadError,
    );
  });
});

describe("Bloque 3: audio", () => {
  it("mute impide reproducción efectiva", () => {
    const runtime = new FakeAudioRuntime();
    const controller = new AudioController(runtime);
    controller.updatePreferences({ muted: true });
    expect(controller.play("attack")).toBe(false);
    expect(runtime.effects).toEqual([]);
  });

  it("aplica master y volumen de canal", () => {
    const runtime = new FakeAudioRuntime();
    const controller = new AudioController(runtime);
    controller.setAmbientActive(true);
    controller.updatePreferences({ masterVolume: 0.5, ambientVolume: 0.4 });
    expect(runtime.ambientCalls.at(-1)).toEqual({ active: true, volume: 0.2 });
    expect(
      effectiveAudioVolume(
        { ...defaultAudioPreferences, masterVolume: 0.5, sfxVolume: 0.6 },
        "sfx",
      ),
    ).toBeCloseTo(0.3);
  });

  it("persiste y recupera las preferencias", () => {
    const storage = memoryStorage();
    const controller = new AudioController(new FakeAudioRuntime(), storage);
    controller.updatePreferences({ muted: true, masterVolume: 0.25 });
    expect(storage.values.has(audioStorageKey)).toBe(true);
    expect(readAudioPreferences(storage)).toMatchObject({
      muted: true,
      masterVolume: 0.25,
    });
  });

  it("cleanup es idempotente y evita reproducción huérfana", () => {
    const runtime = new FakeAudioRuntime();
    const controller = new AudioController(runtime);
    controller.dispose();
    controller.dispose();
    expect(runtime.disposals).toBe(1);
    expect(controller.play("victory")).toBe(false);
    expect(runtime.effects).toEqual([]);
  });

  it("unlock activa una sola instancia ambiental solicitada", async () => {
    const runtime = new FakeAudioRuntime();
    const controller = new AudioController(runtime);
    controller.setAmbientActive(true);
    await controller.unlock();
    expect(runtime.unlocks).toBe(1);
    expect(runtime.ambientCalls.filter(({ active }) => active).length).toBe(2);
  });
});

describe("Bloque 3: responsive y descubribilidad", () => {
  it("gameplay local y multiplayer usan viewport dinámico, safe areas y breakpoints", () => {
    for (const file of ["TacticalGame.tsx", "MultiplayerGame.tsx"]) {
      const source = readFileSync(
        join(process.cwd(), "app/play/components", file),
        "utf8",
      );
      expect(source).toContain("h-dvh");
      expect(source).toContain("safe-area-inset-top");
      expect(source).toContain("md:grid-cols");
    }
  });

  it("controles táctiles preservan cuatro acciones y altura usable", () => {
    const source = readFileSync(
      join(process.cwd(), "app/play/components/ActionControls.tsx"),
      "utf8",
    );
    expect(source).toContain("grid-cols-4");
    expect(source).toContain("min-h-[3.6rem]");
    expect(source).toContain("messages.play.hud.ability");
  });

  it("idioma, tema y audio son encontrables sin duplicar arquitectura", () => {
    const home = readFileSync(join(process.cwd(), "app/page.tsx"), "utf8");
    const profile = readFileSync(
      join(process.cwd(), "app/profile/profile-panel.tsx"),
      "utf8",
    );
    const playMenu = readFileSync(
      join(process.cwd(), "app/play/components/PlayMenu.tsx"),
      "utf8",
    );
    expect(home).not.toContain("<LanguageSwitcher />");
    expect(home).toContain("<ThemeSwitcher compact />");
    expect(profile).toContain("<LanguageSwitcher />");
    expect(profile).toContain("<ThemeSwitcher />");
    expect(profile).toContain("<AudioSettings compact />");
    expect(playMenu).toContain("<AudioSettings compact />");
  });

  it("renombra el ranking local sin perder snapshots existentes", () => {
    expect(LOCAL_MATCH_HISTORY_KEY).toBe("speleum.ranking.local.v1");
    expect(existsSync(join(process.cwd(), "lib/ranking.ts"))).toBe(false);
    expect(existsSync(join(process.cwd(), "lib/local-match-history.ts"))).toBe(true);
  });
});
