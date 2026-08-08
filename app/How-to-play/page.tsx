"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, type Variants } from "framer-motion";
import {
  ArrowLeft,
  Eye,
  Footprints,
  Ghost,
  Radio,
  Shield,
  Swords,
  Timer,
} from "lucide-react";
import { ThemeSwitcher } from "@/app/components/ThemeSwitcher";
import { creatures } from "@/lib/creatures";
import { getLocalizedCreature } from "@/lib/i18n/content";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: "easeOut",
    },
  },
};

export default function ComoJugarPage() {
  const { locale, messages } = useLanguage();
  const cards =
    locale === "es"
      ? [
          {
            icon: Eye,
            title: "Vision limitada",
            text: "Tu criatura solo percibe 8 casillas a su alrededor. Fuera de ese pulso visual, la cueva vuelve a cerrarse en oscuridad.",
          },
          {
            icon: Footprints,
            title: "Movimiento por ecos",
            text: "Selecciona una celda dentro de tu zona visible. Speleum calcula el trayecto por tiles y la roca bloquea rutas imposibles tanto en la partida local como en la base multijugador.",
          },
          {
            icon: Timer,
            title: "Pulso y cooldown",
            text: "Cuanto mas lejos te desplazas, mas tarda tu pulso en estabilizarse. Atacar y defender tambien exigen recuperacion.",
          },
          {
            icon: Radio,
            title: "Radar y senales",
            text: "Moverse deja una senal leve. Atacar emite una senal fuerte. Defenderse deja una marca corta y discreta. El radar orienta, pero no revela posiciones perfectas.",
          },
          {
            icon: Swords,
            title: "Ataque",
            text: "Puedes golpear amenazas dentro de 3 casillas. El ataque emite un eco fuerte y revela tu presencia cercana.",
          },
          {
            icon: Shield,
            title: "Defensa",
            text: "Un parry bien medido anula el golpe y aturde al atacante durante 2,4 s. Si nadie golpea durante la ventana, quedas aturdido 1,4 s.",
          },
        ]
      : [
          {
            icon: Eye,
            title: "Limited vision",
            text: "Your creature only perceives 8 tiles around it. Outside that visual pulse, the cave closes back into darkness.",
          },
          {
            icon: Footprints,
            title: "Echo movement",
            text: "Select a cell inside your visible area. Speleum calculates the tile route and rock blocks impossible paths in both local play and the multiplayer foundation.",
          },
          {
            icon: Timer,
            title: "Pulse and cooldown",
            text: "The farther you move, the longer your pulse takes to stabilize. Attacking and defending also require recovery.",
          },
          {
            icon: Radio,
            title: "Radar and signals",
            text: "Moving leaves a light signal. Attacking emits a strong signal. Defending leaves a short, discreet mark. Radar guides you, but never reveals perfect positions.",
          },
          {
            icon: Swords,
            title: "Attack",
            text: "You can hit threats within 3 tiles. Attacking emits a strong echo and reveals your nearby presence.",
          },
          {
            icon: Shield,
            title: "Defense",
            text: "A well-timed parry cancels the hit and stuns the attacker for 2.4 s. If no attack arrives, you are stunned for 1.4 s.",
          },
        ];
  const localizedCreatures = creatures.map((creature) => ({
    ...creature,
    copy: getLocalizedCreature(locale, creature.id),
  }));

  return (
    <main className="theme-page min-h-screen">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-1/2 top-24 h-105 w-105 -translate-x-1/2 rounded-full theme-spotlight blur-3xl" />
        <div className="absolute bottom-0 left-0 right-0 h-56 theme-accent-fade" />
      </div>

      <header className="theme-header sticky top-0 z-40 border-b backdrop-blur-md">
        <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link
            href="/"
            className="flex min-h-11 items-center gap-2 text-sm text-(--text-secondary) transition hover:text-(--text-primary)"
          >
            <ArrowLeft className="h-4 w-4" />
            {messages.howToPlay.back}
          </Link>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <p className="text-xs tracking-[0.24em] text-(--text-muted) sm:text-sm sm:tracking-[0.3em]">{messages.howToPlay.header}</p>
            <ThemeSwitcher />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pt-20">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="mx-auto max-w-3xl text-center"
        >
          <div className="theme-chip mb-4 inline-flex items-center gap-2 rounded-full px-4 py-1 text-xs tracking-[0.25em]">
            <Ghost className="h-4 w-4" />
            {messages.howToPlay.guide}
          </div>

          <h1 className="text-3xl font-semibold tracking-[0.12em] text-(--text-primary) sm:text-6xl sm:tracking-[0.2em]">
            {messages.howToPlay.title}
          </h1>

          <p className="mt-6 text-sm leading-7 text-(--text-secondary) sm:text-base">
            {messages.howToPlay.description}
          </p>
        </motion.div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((item, index) => {
            const Icon = item.icon;

            return (
              <motion.div
                key={item.title}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
                transition={{ delay: index * 0.05 }}
                className="theme-card rounded-4xl p-7"
              >
                <div className="theme-chip mb-4 flex h-12 w-12 items-center justify-center rounded-full">
                  <Icon className="h-5 w-5 text-(--text-secondary)" />
                </div>

                <h2 className="text-xl font-semibold text-(--text-primary)">
                  {item.title}
                </h2>

                <p className="mt-4 leading-7 text-(--text-secondary)">{item.text}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="theme-card grid gap-8 rounded-4xl p-8 md:grid-cols-2"
        >
          <div>
            <p className="mb-3 text-xs tracking-[0.25em] text-(--text-muted)">
              {messages.howToPlay.creatures}
            </p>
            <h3 className="text-2xl font-semibold text-(--text-primary)">
              {messages.howToPlay.creaturesTitle}
            </h3>

            <div className="mt-5 grid gap-4">
              {localizedCreatures.map((creature) => (
                <div
                  key={creature.id}
                  className="rounded-2xl border border-(--border-soft) bg-(--surface-2) p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="theme-icon-shell flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl">
                      <Image
                        src={creature.imagenJuego}
                        alt={creature.copy.nombre}
                        width={56}
                        height={56}
                        className="h-14 w-14 object-contain"
                      />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-(--text-primary)">
                        {creature.copy.nombre}
                      </h4>
                      <p className="mt-1 text-xs text-(--text-muted)">
                        {creature.copy.rol}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-(--text-secondary)">
                    {creature.copy.descripcionCorta}
                  </p>
                  <p className="mt-3 rounded-xl border border-(--border-soft) bg-(--surface-1) px-3 py-2 text-xs leading-5 text-(--text-secondary)">
                    {creature.copy.habilidad}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-3 text-xs tracking-[0.25em] text-(--text-muted)">
              {messages.howToPlay.tips}
            </p>
            <h3 className="text-2xl font-semibold text-(--text-primary)">
              {messages.howToPlay.tipsTitle}
            </h3>

            <ul className="mt-5 space-y-3 text-(--text-secondary)">
              {messages.howToPlay.advice.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
