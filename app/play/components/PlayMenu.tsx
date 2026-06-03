"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Play, UserRound } from "lucide-react";
import type { CharacterOption } from "../gameConfig";
import { localizeCharacterOption } from "@/lib/i18n/content";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { useTheme } from "@/lib/theme/ThemeProvider";

type PlayMenuProps = {
  selectedCharacter: CharacterOption;
  onOpenCharacters: () => void;
  onStartLocal: () => void;
  onStartMultiplayer: () => void;
};

export function PlayMenu({
  selectedCharacter,
  onOpenCharacters,
  onStartLocal,
  onStartMultiplayer,
}: PlayMenuProps) {
  const { locale, messages } = useLanguage();
  const { theme } = useTheme();
  const localizedCharacter = localizeCharacterOption(locale, selectedCharacter);
  const wordmarkSrc = theme === "light" ? "/Grafico/Nombre.svg" : "/Grafico/Nombre-white.svg";

  return (
    <section className="relative z-10 min-h-screen overflow-x-hidden px-4 py-6 sm:px-5 sm:py-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,var(--glow-main),transparent_19%),radial-gradient(circle_at_58%_58%,var(--glow-accent),transparent_34%)]" />
      <div className="absolute left-1/2 top-1/2 h-128 w-lg -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--border-soft)] sm:h-168 sm:w-2xl" />
      <div className="absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--border-soft)] sm:h-120 sm:w-120" />
      <div className="absolute bottom-8 left-8 hidden text-xs tracking-[0.28em] text-[var(--text-soft)] sm:block">
        {localizedCharacter.name}
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center py-12 text-center">
        <Image
          src={wordmarkSrc}
          alt="Speleum"
          width={180}
          height={40}
          className="h-8 w-auto opacity-90"
        />
        <p className="mt-4 text-xs tracking-[0.42em] text-[var(--text-muted)]">SPELEUM</p>
        <h1 className="mt-6 text-4xl font-semibold tracking-[0.2em] text-[var(--text-primary)] sm:text-8xl sm:tracking-[0.32em]">
          {messages.common.play.toUpperCase()}
        </h1>
        <p className="mt-7 max-w-2xl text-sm leading-7 text-[var(--text-secondary)] sm:text-base">
          {messages.play.menuDescription}
        </p>

        <div className="mt-12 grid w-full max-w-md gap-3 sm:flex sm:max-w-none sm:flex-wrap sm:justify-center">
          <button
            type="button"
            onClick={onStartLocal}
            className="theme-button-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-8 py-3 text-sm font-semibold transition"
          >
            <Play className="h-4 w-4" />
            {messages.play.local}
          </button>
          <button
            type="button"
            onClick={onStartMultiplayer}
            className="theme-button-accent inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-8 py-3 text-sm transition"
          >
            <Play className="h-4 w-4" />
            {messages.play.multiplayer}
          </button>
          <button
            type="button"
            onClick={onOpenCharacters}
            className="theme-button-secondary inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-8 py-3 text-sm transition"
          >
            <UserRound className="h-4 w-4" />
            {messages.play.creature}
          </button>
          <Link
            href="/"
            className="theme-button-secondary inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-8 py-3 text-sm transition"
          >
            <ArrowLeft className="h-4 w-4" />
            {messages.common.home}
          </Link>
        </div>

        <div className="mt-14 flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <div className="theme-icon-shell relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full">
            <Image
              src={selectedCharacter.imageGame}
              alt={localizedCharacter.name}
              width={48}
              height={48}
              className="h-12 w-12 object-contain"
            />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {localizedCharacter.name}
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{localizedCharacter.role}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
