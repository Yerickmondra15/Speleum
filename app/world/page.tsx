"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, EyeOff, Radio, Waves } from "lucide-react";
import { creatures } from "@/lib/creatures";
import { LanguageSwitcher } from "@/app/components/LanguageSwitcher";
import { getLocalizedCreature } from "@/lib/i18n/content";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export default function WorldPage() {
  const { locale, messages } = useLanguage();

  const sections = [
    {
      icon: EyeOff,
      title: messages.world.sections.troglobites.title,
      text: messages.world.sections.troglobites.text,
    },
    {
      icon: Radio,
      title: messages.world.sections.signals.title,
      text: messages.world.sections.signals.text,
    },
    {
      icon: Waves,
      title: messages.world.sections.adaptation.title,
      text: messages.world.sections.adaptation.text,
    },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-24 h-136 w-136 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.08),transparent_70%)] blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-72 bg-[linear-gradient(to_top,rgba(82,9,20,0.24),transparent)]" />
      </div>

      <header className="relative z-10 mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 text-sm text-zinc-300 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          {messages.world.backHome}
        </Link>
        <div className="flex items-center gap-3">
          <p className="text-xs tracking-[0.34em] text-zinc-500">
            {messages.world.header}
          </p>
          <LanguageSwitcher />
        </div>
      </header>

      <section className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-16 text-center sm:px-6 sm:pt-20">
        <p className="text-xs tracking-[0.35em] text-zinc-500">
          {messages.world.eyebrow}
        </p>
        <h1 className="mx-auto mt-5 max-w-4xl text-3xl font-semibold tracking-[0.12em] text-white sm:text-6xl sm:tracking-[0.16em]">
          {messages.world.title}
        </h1>
        <p className="mx-auto mt-6 max-w-3xl text-sm leading-7 text-zinc-400 sm:text-base">
          {messages.world.description}
        </p>
      </section>

      <section className="relative z-10 mx-auto grid max-w-6xl gap-6 px-4 pb-20 sm:px-6 md:grid-cols-3">
        {sections.map((section) => {
          const Icon = section.icon;

          return (
            <article
              key={section.title}
              className="rounded-4xl border border-white/10 bg-white/3 p-7"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5">
                <Icon className="h-5 w-5 text-zinc-200" />
              </div>
              <h2 className="text-xl font-semibold text-white">
                {section.title}
              </h2>
              <p className="mt-4 leading-7 text-zinc-400">{section.text}</p>
            </article>
          );
        })}
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <div className="mb-8">
          <p className="text-xs tracking-[0.25em] text-zinc-500">
            {messages.world.bestiary}
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-white">
            {messages.world.bestiaryTitle}
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {creatures.map((creature) => {
            const localizedCreature = getLocalizedCreature(locale, creature.id);

            return (
              <article
                key={creature.id}
                className="rounded-4xl border border-white/10 bg-white/3 p-7"
              >
                <div className="mb-5 flex items-center gap-4">
                  <div className="relative h-20 w-20 overflow-hidden rounded-3xl border border-white/10 bg-black/25">
                    <Image
                      src={creature.imagenIlustracion}
                      alt={localizedCreature.nombre}
                      fill
                      sizes="80px"
                      className="object-contain p-2"
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xl font-semibold text-white">
                      {localizedCreature.nombre}
                    </h3>
                    <p className="mt-1 wrap-break-word text-sm text-zinc-500">{localizedCreature.rol}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-7 text-zinc-400">
                  {localizedCreature.descripcionCorta}
                </p>
                <p className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm leading-6 text-zinc-300">
                  {localizedCreature.habilidad}
                </p>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
