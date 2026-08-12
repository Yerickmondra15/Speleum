"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, LogOut, Play, UserRound } from "lucide-react";
import { getCreatureById } from "@/lib/creatures";
import { LanguageSwitcher } from "@/app/components/LanguageSwitcher";
import { ThemeSwitcher } from "@/app/components/ThemeSwitcher";
import { AudioSettings } from "@/app/components/AudioSettings";
import { getLocalizedCreature } from "@/lib/i18n/content";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { fetchProfile, type ProfileData } from "@/lib/profile-contract";
import { useAuth } from "../auth/AuthProvider";

type ProfileFieldRowProps = {
  label: string;
  value: string | number;
  valueClassName?: string;
};

function ProfileFieldRow({
  label,
  value,
  valueClassName = "",
}: ProfileFieldRowProps) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-(--border-soft) bg-(--surface-2) px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <span className="text-(--text-muted)">{label}: </span>
      <span className={`text-(--text-secondary) sm:text-right ${valueClassName}`}>{value}</span>
    </div>
  );
}

export function ProfilePanel() {
  const router = useRouter();
  const { user, status, logout } = useAuth();
  const { locale, messages } = useLanguage();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const activeCreature = getCreatureById(
    profile?.activeCreature ?? user?.activeCreature ?? "cave-axolotl",
  );
  const localizedCreature = getLocalizedCreature(locale, activeCreature.id);

  useEffect(() => {
    if (status === "signed-out") {
      router.replace("/login");
      return;
    }

    if (status !== "signed-in") {
      return;
    }

    const controller = new AbortController();

    async function loadProfile() {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const data = await fetchProfile({ signal: controller.signal });
        setProfile(data);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (
          error &&
          typeof error === "object" &&
          "status" in error &&
          error.status === 401
        ) {
          router.replace("/login");
          return;
        }
        setProfile(null);
        setErrorMessage(
          error instanceof Error ? error.message : messages.profile.error,
        );
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    void loadProfile();
    return () => controller.abort();
  }, [messages.profile.error, router, status]);

  const handleLogout = async () => {
    await logout();
    router.replace("/");
    router.refresh();
  };

  if (status === "loading" || isLoading) {
    return (
      <main className="theme-page flex min-h-screen items-center justify-center text-(--text-muted)">
        {messages.profile.loading}
      </main>
    );
  }

  if (errorMessage || !profile) {
    return (
      <main className="theme-page flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <p role="alert" className="text-red-300">
          {messages.profile.error} {errorMessage}
        </p>
        <Link href="/" className="theme-button-secondary rounded-full px-5 py-3 text-sm">
          {messages.common.home}
        </Link>
      </main>
    );
  }

  return (
    <main className="theme-page relative min-h-screen overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-24 h-128 w-lg -translate-x-1/2 rounded-full theme-spotlight blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-64 theme-accent-fade" />
      </div>

      <header className="relative z-10 mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 text-sm text-(--text-secondary) transition hover:text-(--text-primary)"
        >
          <ArrowLeft className="h-4 w-4" />
          {messages.common.home}
        </Link>
        <p className="text-xs tracking-[0.34em] text-(--text-muted)">{messages.profile.title}</p>
      </header>

      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl content-center gap-8 px-4 py-10 sm:px-6 sm:py-12 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-xs tracking-[0.35em] text-(--text-muted)">{messages.profile.idLabel}</p>
          <h1 className="mt-4 wrap-break-word text-3xl font-semibold tracking-[0.12em] text-(--text-primary) sm:text-5xl sm:tracking-[0.18em]">
            {profile.username}
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-7 text-(--text-secondary)">
            {messages.profile.description}
          </p>
          <div className="mt-6 rounded-3xl border border-(--border-soft) bg-(--surface-2) p-4 sm:p-5">
            <p className="text-xs tracking-[0.28em] text-(--text-muted)">{messages.profile.preferencesTitle}</p>
            <div className="mt-4 grid gap-4">
              <div><p className="mb-2 text-xs text-(--text-muted)">{messages.profile.languagePreference}</p><LanguageSwitcher /></div>
              <div><p className="mb-2 text-xs text-(--text-muted)">{messages.profile.themePreference}</p><ThemeSwitcher /></div>
              <div><p className="mb-2 text-xs text-(--text-muted)">{messages.audio.title}</p><AudioSettings compact /></div>
            </div>
          </div>
        </div>

        <div className="theme-panel rounded-3xl p-6">
          <div className="flex items-center gap-4">
            <div className="theme-icon-shell flex h-16 w-16 items-center justify-center overflow-hidden rounded-full">
              <Image
                src={activeCreature.imagenJuego}
                alt={localizedCreature.nombre}
                width={44}
                height={44}
                className="h-11 w-11 object-contain"
              />
            </div>
            <div>
              <p className="text-xs tracking-[0.24em] text-(--text-muted)">
                {messages.profile.activeSession}
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-(--text-primary)">
                {profile.username}
              </h2>
            </div>
          </div>

          <div className="mt-7 grid gap-3 text-sm">
            <ProfileFieldRow
              label={messages.profile.email}
              value={profile.email}
              valueClassName="break-all"
            />
            {user?.isAdmin === true && <ProfileFieldRow label={messages.profile.status} value={messages.profile.authenticatedSession} />}
            <ProfileFieldRow
              label={messages.profile.ability}
              value={localizedCreature.habilidad}
              valueClassName="max-w-full wrap-break-word sm:max-w-52"
            />
            <ProfileFieldRow
              label={messages.profile.matchesPlayed}
              value={profile.matchesPlayed}
            />
            <ProfileFieldRow
              label={messages.profile.wins}
              value={profile.wins}
            />
            <ProfileFieldRow
              label={messages.profile.losses}
              value={profile.losses}
            />
            <ProfileFieldRow
              label={messages.profile.winRate}
              value={`${profile.winRate}%`}
            />
            <ProfileFieldRow
              label="Score"
              value={profile.score}
            />
            <ProfileFieldRow
              label={messages.profile.bestScore}
              value={profile.bestScore}
            />
          </div>

          <div className="mt-7 rounded-3xl border border-(--border-soft) bg-(--surface-2) p-5">
            <p className="text-xs tracking-[0.28em] text-(--text-muted)">
              {messages.profile.recentHistory}
            </p>
            {profile.history.length === 0 ? (
              <p className="mt-4 text-sm text-(--text-muted)">{messages.profile.noMatches}</p>
            ) : (
              <div className="mt-4 space-y-3">
                {profile.history.map((entry) => {
                  const creature = getLocalizedCreature(
                    locale,
                    getCreatureById(entry.creature).id,
                  );
                  return (
                    <div
                      key={entry.id}
                      className="rounded-2xl border border-(--border-soft) bg-(--surface-1) px-4 py-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-(--text-primary)">
                          {entry.result === "win" ? messages.profile.victory : messages.profile.defeat}
                        </span>
                        <span className="text-(--text-muted)">
                          {entry.mode === "multiplayer" ? messages.play.multiplayer : messages.play.local}
                        </span>
                      </div>
                      <p className="mt-2 text-(--text-secondary)">
                        {creature.nombre} · {entry.scoreEarned} pts ·{" "}
                        {entry.competitive
                          ? messages.profile.verified
                          : messages.profile.localUnverified}
                      </p>
                      <p className="mt-1 text-xs text-(--text-muted)">
                        {new Date(entry.date).toLocaleString(locale === "es" ? "es-CR" : "en-US")}
                        {entry.durationMs !== null
                          ? ` · ${Math.max(1, Math.round(entry.durationMs / 1000))}s`
                          : ""}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/play"
              className="theme-button-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition"
            >
              <Play className="h-4 w-4" />
              {messages.profile.goPlay}
            </Link>
            <Link
              href="/play"
              className="theme-button-secondary inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 py-3 text-sm transition"
            >
              <UserRound className="h-4 w-4" />
              {messages.profile.changeCreature}
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="theme-button-secondary inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 py-3 text-sm transition"
            >
              <LogOut className="h-4 w-4" />
              {messages.common.logout}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
