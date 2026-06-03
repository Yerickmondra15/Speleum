"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, LogOut, Play, UserRound } from "lucide-react";
import { getCreatureById } from "@/lib/creatures";
import { LanguageSwitcher } from "@/app/components/LanguageSwitcher";
import { ThemeSwitcher } from "@/app/components/ThemeSwitcher";
import { getLocalizedCreature } from "@/lib/i18n/content";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { useAuth } from "../auth/AuthProvider";

type ProfileData = {
  username: string;
  email: string;
  activeCreature: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  score: number;
  lastMatchAt: string | null;
};

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

    async function loadProfile() {
      try {
        const response = await fetch("/api/profile", {
          cache: "no-store",
        });

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        const data = (await response.json()) as ProfileData;
        setProfile(data);
      } finally {
        setIsLoading(false);
      }
    }

    void loadProfile();
  }, [router, status]);

  const handleLogout = async () => {
    await logout();
    router.replace("/");
  };

  if (status === "loading" || isLoading || !profile) {
    return (
      <main className="theme-page flex min-h-screen items-center justify-center text-(--text-muted)">
        {messages.profile.loading}
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
              label={messages.profile.username}
              value={profile.username}
              valueClassName="wrap-break-word"
            />
            <ProfileFieldRow
              label={messages.profile.email}
              value={profile.email}
              valueClassName="break-all"
            />
            <ProfileFieldRow
              label={messages.profile.status}
              value={messages.profile.authenticatedSession}
            />
            <ProfileFieldRow
              label={messages.profile.activeCreature}
              value={localizedCreature.nombre}
            />
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
              label="Score"
              value={profile.score}
            />
            <ProfileFieldRow
              label={messages.profile.lastMatch}
              value={
                profile.lastMatchAt
                  ? new Date(profile.lastMatchAt).toLocaleString(locale === "es" ? "es-CR" : "en-US")
                  : messages.profile.noMatches
              }
              valueClassName="wrap-break-word sm:max-w-56"
            />
          </div>

          <div className="mt-7 rounded-3xl border border-(--border-soft) bg-(--surface-2) p-5">
            <p className="text-xs tracking-[0.28em] text-(--text-muted)">
              {messages.profile.preferencesTitle}
            </p>
            <p className="mt-3 text-sm leading-6 text-(--text-secondary)">
              {messages.profile.preferencesDescription}
            </p>

            <div className="mt-6 grid gap-5">
              <div>
                <p className="text-xs tracking-[0.2em] text-(--text-muted)">
                  {messages.profile.languagePreference}
                </p>
                <div className="mt-4">
                  <LanguageSwitcher />
                </div>
              </div>

              <div>
                <p className="text-xs tracking-[0.2em] text-(--text-muted)">
                  {messages.profile.themePreference}
                </p>
                <div className="mt-4">
                  <ThemeSwitcher />
                </div>
              </div>
            </div>
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
