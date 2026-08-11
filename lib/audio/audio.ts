export const audioStorageKey = "speleum.audio.v1";

export type AudioPreferences = {
  muted: boolean;
  masterVolume: number;
  ambientVolume: number;
  sfxVolume: number;
};

export type SpeleumSfx =
  | "ui"
  | "ready"
  | "start"
  | "attack"
  | "damage"
  | "defend"
  | "death"
  | "victory"
  | "defeat";

export const defaultAudioPreferences: AudioPreferences = {
  muted: false,
  masterVolume: 0.55,
  ambientVolume: 0.28,
  sfxVolume: 0.65,
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function clampVolume(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : fallback;
}

export function normalizeAudioPreferences(value: unknown): AudioPreferences {
  if (!value || typeof value !== "object") return defaultAudioPreferences;
  const candidate = value as Partial<AudioPreferences>;
  return {
    muted:
      typeof candidate.muted === "boolean"
        ? candidate.muted
        : defaultAudioPreferences.muted,
    masterVolume: clampVolume(
      candidate.masterVolume,
      defaultAudioPreferences.masterVolume,
    ),
    ambientVolume: clampVolume(
      candidate.ambientVolume,
      defaultAudioPreferences.ambientVolume,
    ),
    sfxVolume: clampVolume(candidate.sfxVolume, defaultAudioPreferences.sfxVolume),
  };
}

export function readAudioPreferences(storage?: StorageLike): AudioPreferences {
  if (!storage) return defaultAudioPreferences;
  try {
    const raw = storage.getItem(audioStorageKey);
    return raw ? normalizeAudioPreferences(JSON.parse(raw)) : defaultAudioPreferences;
  } catch {
    return defaultAudioPreferences;
  }
}

export function writeAudioPreferences(
  preferences: AudioPreferences,
  storage?: StorageLike,
) {
  if (!storage) return;
  try {
    storage.setItem(audioStorageKey, JSON.stringify(preferences));
  } catch {
    // Audio remains functional when browser storage is unavailable.
  }
}

export function effectiveAudioVolume(
  preferences: AudioPreferences,
  channel: "ambient" | "sfx",
) {
  if (preferences.muted) return 0;
  return (
    preferences.masterVolume *
    (channel === "ambient" ? preferences.ambientVolume : preferences.sfxVolume)
  );
}

export interface AudioRuntime {
  unlock(): Promise<void>;
  setAmbient(active: boolean, volume: number): void;
  playEffect(effect: SpeleumSfx, volume: number): void;
  dispose(): void;
}

export class AudioController {
  private preferences: AudioPreferences;
  private ambientActive = false;
  private disposed = false;

  constructor(
    private readonly runtime: AudioRuntime,
    private readonly storage?: StorageLike,
  ) {
    this.preferences = readAudioPreferences(storage);
  }

  getPreferences() {
    return this.preferences;
  }

  updatePreferences(patch: Partial<AudioPreferences>) {
    if (this.disposed) return this.preferences;
    this.preferences = normalizeAudioPreferences({ ...this.preferences, ...patch });
    writeAudioPreferences(this.preferences, this.storage);
    this.runtime.setAmbient(
      this.ambientActive,
      effectiveAudioVolume(this.preferences, "ambient"),
    );
    return this.preferences;
  }

  async unlock() {
    if (this.disposed) return;
    await this.runtime.unlock();
    this.runtime.setAmbient(
      this.ambientActive,
      effectiveAudioVolume(this.preferences, "ambient"),
    );
  }

  setAmbientActive(active: boolean) {
    if (this.disposed) return;
    this.ambientActive = active;
    this.runtime.setAmbient(
      active,
      effectiveAudioVolume(this.preferences, "ambient"),
    );
  }

  play(effect: SpeleumSfx) {
    if (this.disposed) return false;
    const volume = effectiveAudioVolume(this.preferences, "sfx");
    if (volume <= 0) return false;
    this.runtime.playEffect(effect, volume);
    return true;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.ambientActive = false;
    this.runtime.dispose();
  }
}
