"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { Volume2, VolumeX } from "lucide-react";
import { useAudio } from "@/lib/audio/AudioProvider";

type GameTopControlsProps = {
  isUiHidden: boolean;
  showPause?: boolean;
  isPaused?: boolean;
  onTogglePause?: () => void;
  onToggleUi: () => void;
};

function controlButtonClass(compact = false) {
  return compact
    ? "theme-button-secondary pointer-events-auto inline-flex min-h-9 items-center justify-center rounded-full px-3 py-2 text-[0.65rem] font-medium tracking-[0.14em] backdrop-blur-md transition sm:min-h-11 sm:px-4 sm:text-sm"
    : "theme-button-secondary pointer-events-auto inline-flex min-h-9 items-center justify-center rounded-full px-3 py-2 text-[0.65rem] font-medium tracking-[0.14em] backdrop-blur-md transition sm:min-h-11 sm:px-4 sm:text-sm";
}

export function GameTopControls({
  isUiHidden,
  showPause = false,
  isPaused = false,
  onTogglePause,
  onToggleUi,
}: GameTopControlsProps) {
  const { messages } = useLanguage();
  const { preferences, updatePreferences, unlock, playSfx } = useAudio();

  return (
    <div className="pointer-events-auto flex items-center justify-end gap-1.5 sm:gap-2">
      {!isUiHidden && <button
        type="button"
        onClick={() => {
          unlock();
          updatePreferences({ muted: !preferences.muted });
          if (preferences.muted) playSfx("ui");
        }}
        aria-label={preferences.muted ? messages.audio.unmute : messages.audio.mute}
        aria-pressed={preferences.muted}
        className={controlButtonClass(true)}
      >
        {preferences.muted ? (
          <VolumeX className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        ) : (
          <Volume2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        )}
        <span className="sr-only">{preferences.muted ? messages.audio.muted : messages.audio.soundOn}</span>
      </button>}
      {!isUiHidden && showPause && onTogglePause && (
        <button
          type="button"
          onClick={onTogglePause}
          aria-label={isPaused ? messages.play.controls.resumeGame : messages.play.controls.pauseGame}
          className={controlButtonClass()}
        >
          {isPaused ? messages.common.continue : messages.common.pause}
        </button>
      )}

      <button
        type="button"
        onClick={onToggleUi}
        aria-label={isUiHidden ? messages.play.controls.showUi : messages.play.controls.hideUi}
        className={controlButtonClass(isUiHidden)}
      >
        {isUiHidden ? messages.play.controls.showUiShort : messages.play.controls.hideUiShort}
      </button>
    </div>
  );
}
