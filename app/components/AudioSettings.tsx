"use client";

import { Volume2, VolumeX } from "lucide-react";

import { useAudio } from "@/lib/audio/AudioProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function AudioSettings({ compact = false }: { compact?: boolean }) {
  const { preferences, updatePreferences, unlock, playSfx } = useAudio();
  const { messages } = useLanguage();

  const toggleMute = () => {
    unlock();
    updatePreferences({ muted: !preferences.muted });
    if (preferences.muted) playSfx("ui");
  };

  if (compact) {
    return (
      <div className="theme-card flex flex-wrap items-center gap-3 rounded-2xl p-3">
        <button
          type="button"
          onClick={toggleMute}
          aria-label={preferences.muted ? messages.audio.unmute : messages.audio.mute}
          aria-pressed={preferences.muted}
          className="theme-button-secondary inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm"
        >
          {preferences.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          {preferences.muted ? messages.audio.muted : messages.audio.soundOn}
        </button>
        <label className="min-w-44 flex-1 text-xs text-(--text-muted)">
          <span className="mb-2 block">{messages.audio.volume}</span>
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(preferences.masterVolume * 100)}
            onChange={(event) => {
              unlock();
              updatePreferences({ masterVolume: Number(event.target.value) / 100 });
            }}
            className="w-full accent-rose-300"
          />
        </label>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <button
        type="button"
        onClick={toggleMute}
        aria-label={preferences.muted ? messages.audio.unmute : messages.audio.mute}
        aria-pressed={preferences.muted}
        className="theme-button-secondary inline-flex min-h-11 w-fit items-center gap-2 rounded-full px-4 py-2 text-sm"
      >
        {preferences.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        {preferences.muted ? messages.audio.muted : messages.audio.soundOn}
      </button>
      {(
        [
          ["masterVolume", messages.audio.master],
          ["ambientVolume", messages.audio.ambient],
          ["sfxVolume", messages.audio.effects],
        ] as const
      ).map(([field, label]) => (
        <label key={field} className="text-xs text-(--text-muted)">
          <span className="mb-2 flex justify-between gap-3">
            <span>{label}</span>
            <span>{Math.round(preferences[field] * 100)}%</span>
          </span>
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(preferences[field] * 100)}
            onChange={(event) => {
              unlock();
              updatePreferences({ [field]: Number(event.target.value) / 100 });
            }}
            className="w-full accent-rose-300"
          />
        </label>
      ))}
      <p className="text-xs leading-5 text-(--text-muted)">{messages.audio.autoplayHint}</p>
    </div>
  );
}
