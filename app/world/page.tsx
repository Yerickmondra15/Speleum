import Link from "next/link";
import { ArrowLeft, EyeOff, Radio, Waves } from "lucide-react";

const sections = [
  {
    icon: EyeOff,
    title: "Troglobios",
    text: "Los troglobios son organismos adaptados a vivir en cuevas. En ambientes sin luz, muchas especies reducen pigmento y vision, mientras aumentan su sensibilidad al tacto, vibraciones o cambios de corriente.",
  },
  {
    icon: Radio,
    title: "Senales",
    text: "Speleum convierte esa biologia en radar: moverse, atacar o defenderse no solo cambia tu posicion, tambien produce rastros que otros podrian interpretar.",
  },
  {
    icon: Waves,
    title: "Adaptacion",
    text: "Cada criatura toma una idea biologica y la vuelve mecanica. El ajolote es estable y sensible; el camaron usa impulsos evasivos y deja menos huella al desplazarse.",
  },
];

const creatures = [
  {
    name: "Ajolote de cueva",
    biology:
      "Inspirado en anfibios palidos y sensibles al entorno, con lectura constante del espacio cercano.",
    game: "En juego es equilibrado: buen control, senal normal y recuperacion estable.",
  },
  {
    name: "Camaron de cueva",
    biology:
      "Inspirado en crustaceos de cueva que se orientan por tacto, corrientes y movimientos breves.",
    game: "En juego es evasivo: se desplaza mas lejos, recupera antes y su movimiento se detecta menos.",
  },
  {
    name: "Pez ciego",
    biology:
      "Muchos peces de cueva reducen la vision y dependen de presion, corriente y memoria espacial.",
    game: "Su lectura de corrientes queda reservada para una mecanica futura.",
  },
  {
    name: "Cangrejo cavernicola",
    biology:
      "Los crustaceos de cueva suelen aprovechar grietas, paredes y zonas estrechas.",
    game: "Su identidad apunta a controlar pasillos y resistir encuentros cercanos.",
  },
];

export default function WorldPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-24 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.08),transparent_70%)] blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-72 bg-[linear-gradient(to_top,rgba(82,9,20,0.24),transparent)]" />
      </div>

      <header className="relative z-10 mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-zinc-300 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Inicio
        </Link>
        <p className="text-xs tracking-[0.34em] text-zinc-500">
          MUNDO SPELEUM
        </p>
      </header>

      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-16 pt-20 text-center">
        <p className="text-xs tracking-[0.35em] text-zinc-500">
          CUEVAS / BIOLOGIA / JUEGO
        </p>
        <h1 className="mx-auto mt-5 max-w-4xl text-4xl font-semibold tracking-[0.16em] text-white sm:text-6xl">
          Criaturas que aprendieron a vivir sin luz
        </h1>
        <p className="mx-auto mt-6 max-w-3xl text-sm leading-7 text-zinc-400 sm:text-base">
          Speleum no copia biologia real de forma literal: la traduce en
          sensaciones jugables. La oscuridad limita informacion, las criaturas
          leen vibraciones y cada accion deja una huella.
        </p>
      </section>

      <section className="relative z-10 mx-auto grid max-w-6xl gap-6 px-6 pb-20 md:grid-cols-3">
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

      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        <div className="mb-8">
          <p className="text-xs tracking-[0.25em] text-zinc-500">
            BESTIARIO
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-white">
            De adaptacion a mecanica
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {creatures.map((creature) => (
            <article
              key={creature.name}
              className="rounded-4xl border border-white/10 bg-white/3 p-7"
            >
              <h3 className="text-xl font-semibold text-white">
                {creature.name}
              </h3>
              <p className="mt-4 text-sm leading-7 text-zinc-400">
                {creature.biology}
              </p>
              <p className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm leading-6 text-zinc-300">
                {creature.game}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
