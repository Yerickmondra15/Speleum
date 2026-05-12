"use client";

import Link from "next/link";
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
  UserRound,
} from "lucide-react";

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

const cards = [
  {
    icon: Eye,
    title: "Vision limitada",
    text: "Tu criatura solo percibe 8 casillas a su alrededor. Fuera de ese pulso visual, la cueva vuelve a cerrarse en oscuridad.",
  },
  {
    icon: Footprints,
    title: "Movimiento por ecos",
    text: "Selecciona una celda dentro de tu zona visible. Speleum calcula el trayecto por tiles y la roca bloquea rutas imposibles.",
  },
  {
    icon: Timer,
    title: "Pulso y cooldown",
    text: "Cuanto mas lejos te desplazas, mas tarda tu pulso en estabilizarse. Atacar y defender tambien exigen recuperacion.",
  },
  {
    icon: Radio,
    title: "Radar y senales",
    text: "Moverse deja una senal leve. Atacar emite una senal mas fuerte. Defenderse emite muy poco.",
  },
  {
    icon: Swords,
    title: "Ataque",
    text: "Puedes golpear amenazas dentro de 3 casillas. El ataque emite un eco fuerte y revela tu presencia cercana.",
  },
  {
    icon: Shield,
    title: "Defensa",
    text: "La defensa reduce dano durante una ventana corta y luego entra en recuperacion antes de poder activarse otra vez.",
  },
];

const creatures = [
  {
    title: "Ajolote de cueva",
    text: "Equilibrado: movimiento estable, cooldown normal y senal clara. Es la forma mas directa de aprender el mapa.",
  },
  {
    title: "Camaron de cueva",
    text: "Evasivo: se mueve mas lejos, recupera antes y deja una senal de movimiento mas tenue.",
  },
];

export default function ComoJugarPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-1/2 top-24 h-105 w-105 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.09),transparent_70%)] blur-3xl" />
        <div className="absolute bottom-0 left-0 right-0 h-56 bg-[linear-gradient(to_top,rgba(255,255,255,0.04),transparent)]" />
      </div>

      <header className="sticky top-0 z-40 border-b border-white/5 bg-black/50 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-zinc-300 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>

          <p className="text-sm tracking-[0.3em] text-zinc-400">COMO JUGAR</p>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-20">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="mx-auto max-w-3xl text-center"
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs tracking-[0.25em] text-zinc-300">
            <Ghost className="h-4 w-4" />
            GUIA DEL JUGADOR
          </div>

          <h1 className="text-4xl font-semibold tracking-[0.2em] text-white sm:text-6xl">
            Como jugar Speleum
          </h1>

          <p className="mt-6 text-sm leading-7 text-zinc-400 sm:text-base">
            Speleum se juega leyendo oscuridad, distancia y senales. Controlas
            una criatura subterranea, eliges celdas dentro de tu zona visible y
            sobrevives gestionando movimiento, ataque, defensa y radar.
          </p>
        </motion.div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
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
                className="rounded-4xl border border-white/10 bg-white/3 p-7"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5">
                  <Icon className="h-5 w-5 text-zinc-200" />
                </div>

                <h2 className="text-xl font-semibold text-white">
                  {item.title}
                </h2>

                <p className="mt-4 leading-7 text-zinc-400">{item.text}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="grid gap-8 rounded-4xl border border-white/10 bg-white/3 p-8 md:grid-cols-2"
        >
          <div>
            <p className="mb-3 text-xs tracking-[0.25em] text-zinc-500">
              CRIATURAS JUGABLES
            </p>
            <h3 className="text-2xl font-semibold text-white">
              Elige una forma de sobrevivir
            </h3>

            <div className="mt-5 grid gap-4">
              {creatures.map((creature) => (
                <div
                  key={creature.title}
                  className="rounded-2xl border border-white/10 bg-black/30 p-4"
                >
                  <div className="flex items-center gap-3">
                    <UserRound className="h-4 w-4 text-zinc-400" />
                    <h4 className="font-semibold text-white">
                      {creature.title}
                    </h4>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    {creature.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-3 text-xs tracking-[0.25em] text-zinc-500">
              CONSEJOS
            </p>
            <h3 className="text-2xl font-semibold text-white">
              Lo que conviene recordar
            </h3>

            <ul className="mt-5 space-y-3 text-zinc-400">
              <li>Marca trayectos cortos si necesitas recuperar pulso rapido.</li>
              <li>Ataca cuando una amenaza entre en tus 3 casillas de alcance.</li>
              <li>Usa defensa para amortiguar dano antes de exponerte.</li>
              <li>Mira el radar despues de cada accion: cada eco importa.</li>
            </ul>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
