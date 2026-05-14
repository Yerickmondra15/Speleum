"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import {
  Trophy,
  CircleHelp,
  User,
  Play,
  LogIn,
  Lightbulb,
  ChevronDown,
} from "lucide-react";
import { motion, type Variants } from "framer-motion";
import { LIGHTS_ON_KEY, creatures } from "@/lib/creatures";
import { useAuth } from "./auth/AuthProvider";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 35, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.7,
      ease: "easeOut",
    },
  },
};

export default function Home() {
  const { status } = useAuth();
  const [turnedOn, setTurnedOn] = useState(false);
  const hasSession = status === "signed-in";

  useEffect(() => {
    const frame = window.setTimeout(() => {
      setTurnedOn(window.localStorage.getItem(LIGHTS_ON_KEY) === "true");
    }, 0);

    return () => window.clearTimeout(frame);
  }, []);

  const primaryHref = hasSession ? "/play" : "/login";
  const primaryLabel = hasSession ? "Entrar a la cueva" : "Iniciar sesion";

  const handleTurnOn = () => {
    setTurnedOn(true);
    window.localStorage.setItem(LIGHTS_ON_KEY, "true");
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      {!turnedOn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.04),transparent_45%)]" />
          <div className="flex flex-col items-center">
            <button
              onClick={handleTurnOn}
              className="group relative flex h-24 w-24 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/70 transition duration-300 hover:scale-105 hover:border-zinc-400 hover:bg-zinc-800"
            >
              <Lightbulb className="h-10 w-10 text-zinc-300 transition group-hover:text-yellow-200" />
              <span className="absolute -bottom-10 text-sm tracking-wide text-zinc-500 group-hover:text-zinc-300">
                Enciendeme
              </span>
            </button>
          </div>
        </div>
      )}

      <div className={`transition-all duration-1000 ${turnedOn ? "opacity-100" : "opacity-0"}`}>
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-32 h-137.5 w-137.5 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,220,0.12),rgba(255,255,255,0.03),transparent_70%)] blur-2xl" />
          <div className="absolute bottom-0 left-0 right-0 h-64 bg-[linear-gradient(to_top,rgba(255,255,255,0.05),transparent)]" />
        </div>

        <header className="sticky top-0 z-40 border-b border-white/5 bg-black/40 backdrop-blur-md">
          <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Image
                src="/Grafico/Logo blanco.svg"
                alt="Speleum logo"
                width={36}
                height={36}
                className="h-9 w-auto"
              />
              <Image
                src="/Grafico/Nombre-white.svg"
                alt="Speleum"
                width={140}
                height={32}
                className="h-6 w-auto sm:h-7"
              />
            </div>

            <Link
              href={primaryHref}
              className={`order-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-full border px-5 py-3 text-sm font-medium tracking-wide transition sm:order-2 sm:min-h-0 sm:w-auto sm:py-2 ${
                hasSession
                  ? "border-rose-200/30 bg-rose-300/90 text-black shadow-[0_0_24px_rgba(251,113,133,0.28)] hover:bg-rose-200"
                  : "border-white/10 bg-white/5 text-white hover:bg-white/10"
              }`}
            >
              {hasSession ? <Play className="h-4 w-4 fill-black" /> : <LogIn className="h-4 w-4" />}
              {primaryLabel}
            </Link>

            <div className="order-2 flex items-center gap-2 sm:order-3 sm:gap-3">
              <Link href="/ranking" className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 p-2 transition hover:bg-white/10">
                <Trophy className="h-5 w-5 text-zinc-200" />
              </Link>
              <Link href="/How-to-play" className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 p-2 transition hover:bg-white/10">
                <CircleHelp className="h-5 w-5 text-zinc-200" />
              </Link>
              <Link href="/login" className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 p-2 transition hover:bg-white/10">
                <LogIn className="h-5 w-5 text-zinc-200" />
              </Link>
              <Link href="/profile" className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 p-2 transition hover:bg-white/10">
                <User className="h-5 w-5 text-zinc-200" />
              </Link>
            </div>
          </nav>
        </header>

        <section className="relative mx-auto flex min-h-[88vh] max-w-7xl flex-col items-center justify-center px-4 pt-10 text-center sm:px-6">
          <div className="absolute inset-x-0 top-16 -z-10 h-80 bg-[radial-gradient(circle,rgba(255,255,255,0.06),transparent_60%)] blur-3xl" />

          <div className="mb-4 inline-flex max-w-full items-center rounded-full border border-white/10 bg-white/5 px-4 py-1 text-center text-[0.65rem] tracking-[0.24em] text-zinc-300 sm:text-xs sm:tracking-[0.3em]">
            Oscuridad · Ecos · Supervivencia
          </div>

          <h1 className="text-4xl font-serif font-semibold tracking-[0.22em] text-white sm:text-7xl sm:tracking-[0.35em]">
            SPELEUM
          </h1>

          <p className="mt-5 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">
            Un juego web multijugador de supervivencia en cuevas con criaturas subterraneas,
            vision limitada, radar de ecos y ranking competitivo.
          </p>

          <div className="mt-14 flex w-full justify-center">
            <div className="relative flex min-h-90 w-full max-w-4xl items-center justify-center overflow-hidden rounded-4xl shadow-[0_0_120px_rgba(255,255,255,0.05)] sm:h-90">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.07),transparent_85%)]" />
              <div className="absolute bottom-0 left-0 right-0 h-32 bg-linear-to-t from-black via-black/70 to-transparent" />
              <div className="relative w-full overflow-hidden px-4 sm:px-6">
                <pre className="overflow-x-auto pb-2 text-center text-[5px] leading-[0.42rem] text-zinc-300 sm:text-[11px] sm:leading-2.75">
{String.raw`                                                                                                                                
                                                                                                                                
                                                                                                                                
                                                                                                                                
                                                                                                                                
                                                                                                                                
                                                                                                                                
                                                                                                                                
                                                                                                                                
                                                                                                                                
                                                                                                                                
                                                                                                                                
                                                                    .:-=%@@@@@%##*##%*%%#+*-:...                                
                               .:.                            -%@@%@%#***=====-:------=-------*=+**-.                           
                              :#*-                      .=%@@%#*#=+=--:--.::.:::...:.....:.:.-.:::=-==+=-.                      
                             :+@#:                   =@@%%*=*==--:.:.:=......:. . .:... .. -... : :.:.:--=++.                   
                             +@*+.    .:#+.     .+@@%#*#=+---:::.::..... .. ......: ..... ..... . ......:::-=%+                 
                         =%-.#@+=.   -*@*-.:-%@#*#**+=-=:-.-.:. ........... ........ ......  : ......:.....:.:=%+.              
                         =@+#@%*-. .+%@%*=*=++-+-=::::-..:.. .:.: .  .....- :.:.....::-:.... ....  .:::....:-.:-=#=             
                        .+@#@@**+*#@@@@*-==--::-::.::....... ...........:::::--:---:.#:=.::.:::..:.:.:....:.:...:-%=            
                       .+@@@@@***+@@*#=:::-::::....... . .   .....:::--=++%-+:.     %#--. .:=-+*:==.-.:::::.... ..-%*           
                   .@@@@**##%++#%%+=+**%@@%-...... .....  .:..---=+=-:.              -*#-::--:     .:===::.:...:..-+%.          
                -@@@%**+*-::-:---*%@@#*==-... -.. ......::-:=**=:                       .#**=--.        :+=-.:..:.:=@+          
             .@@#%@@+---::.::::.:+*+-:..-.. .. . :......=+#-.                           ..-: .            .==:::..:-@+.         
           -@@@#*+=:::::..:.:.::--=**+:=+:.......-=+++::                                                    =-..:.:+#=.         
          %@%#=@*:::...:::.:..:-:..::-=:=#%::-:-:                                                            -:.:.-*#::         
         @@%%+=--+:-::-=--.:--=:       .-+-#*                                                                :=.:.*@-:          
         .@@@%#*#%+++*=++=-.          :*+-=+:                                                                ::--*@--:          
                                  -*@#=*#.                                                                   ::-@%-=..          
                                 :=*=++:                                                                   .-:#@+-.::           
                                  :  :                                                                    ::#@+-:..:            
                                                                                                       .::@#=::..:..            
                                                                                                   .:==*#-::...:..              
                                                                                               :-=*%*=:-........                
                                                                                   .:.:-::=#+++=-::::....:...                   
                                                                      ....-=====+++*+-:::.::.......:......                      
                                                                 .:.+++-:-.-: :........:......:......                           
                                                            .:+=--:...::............ .....                                      
                                                         .-==::::.. . .                                                         
                                                       .=-:.:.                                                                  
                                                     .--..                                                                      
                                                     =.                                                                         
                                                                                                                                
                                                                                                                                
                                                                                                                                
                                                                                                                                
                                                                                                                                
                                                                                                                                
                                                                                                                                
                                                                                                                                
                                                                                                                                
                                                                                                                                
`}
                </pre>
                <p className="mt-4 text-center text-sm tracking-[0.25em] text-zinc-500">ajolote de cueva</p>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center gap-4">
            <Link
              href={primaryHref}
              className={`min-h-11 rounded-full border px-7 py-3 text-sm font-semibold transition hover:scale-[1.02] ${
                hasSession
                  ? "border-rose-200/30 bg-rose-300 text-black shadow-[0_0_28px_rgba(251,113,133,0.28)] hover:bg-rose-200"
                  : "border-white/10 bg-white text-black hover:bg-zinc-200"
              }`}
            >
              {primaryLabel}
            </Link>

            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <ChevronDown className="h-4 w-4" />
              Conoce mas de Speleum
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <div className="grid gap-8 md:grid-cols-2">
            <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.25 }} className="rounded-4xl border border-white/10 bg-white/3 p-8">
              <p className="mb-3 text-xs tracking-[0.25em] text-zinc-500">QUE ES SPELEUM</p>
              <h2 className="text-2xl font-semibold text-white">Supervivencia subterranea con vision limitada</h2>
              <p className="mt-4 leading-7 text-zinc-400">
                Speleum es un juego web multijugador donde cada partida te pone en una cueva
                oscura, con criaturas subterraneas, lectura de ecos y enfrentamientos por supervivencia.
              </p>
            </motion.div>

            <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.25 }} transition={{ delay: 0.12 }} className="rounded-4xl border border-white/10 bg-white/3 p-8">
              <p className="mb-3 text-xs tracking-[0.25em] text-zinc-500">IDEA PRINCIPAL</p>
              <h2 className="text-2xl font-semibold text-white">Leer la cueva, cazar y sobrevivir mas que los demas</h2>
              <p className="mt-4 leading-7 text-zinc-400">
                El proyecto combina una identidad visual oscura con mecanicas de vision limitada,
                movimiento por tiles, combate y competencia por score y eliminaciones dentro de la cueva.
              </p>
            </motion.div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 sm:pb-24">
          <div className="mb-10 max-w-2xl">
            <p className="text-xs tracking-[0.25em] text-zinc-500">CRIATURAS</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">Formas de sobrevivir</h2>
            <p className="mt-4 leading-7 text-zinc-400">
              Cada criatura entra a Speleum con una lectura distinta del peligro, el movimiento y los ecos.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {creatures.slice(0, 2).map((creature) => (
              <motion.div key={creature.id} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} className="rounded-4xl border border-white/10 bg-white/3 p-7">
                <div className="mb-5 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-zinc-100/80 shadow-[0_0_28px_rgba(255,255,255,0.12)]">
                  <Image src={creature.imagenJuego} alt={creature.nombre} width={40} height={40} className="h-10 w-10 object-contain" />
                </div>
                <h3 className="text-xl font-semibold text-white">{creature.nombre}</h3>
                <p className="mt-3 leading-7 text-zinc-400">{creature.descripcionCorta}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 sm:pb-24">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} className="relative overflow-hidden rounded-4xl border border-white/10 bg-white/3 p-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_right,rgba(255,255,255,0.08),transparent_55%)]" />
            <div className="relative grid gap-8 md:grid-cols-[1.2fr_0.8fr]">
              <div>
                <p className="text-xs tracking-[0.25em] text-zinc-500">MUNDO SUBTERRANEO</p>
                <h2 className="mt-3 text-3xl font-semibold text-white">Un ecosistema hecho de ecos</h2>
                <p className="mt-4 leading-7 text-zinc-400">
                  Speleum toma inspiracion de animales adaptados a cuevas: baja vision, cuerpos palidos,
                  sensibilidad al movimiento y orientacion por vibraciones. El juego convierte esas ideas en radar,
                  vision limitada y combate de supervivencia.
                </p>
              </div>
              <div className="flex items-end md:justify-end">
                <Link href="/world" className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200">
                  Explorar mundo
                </Link>
              </div>
            </div>
          </motion.div>
        </section>

        <motion.footer initial={{ opacity: 0, y: 25 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }} transition={{ duration: 0.7, ease: "easeOut" }} className="relative border-t border-white/5 px-4 py-16 sm:px-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_55%)]" />
          <div className="relative mx-auto grid max-w-7xl gap-10 md:grid-cols-[1.2fr_1fr_1fr]">
            <div>
              <p className="text-xs tracking-[0.25em] text-zinc-500">ULTIMA INCURSION</p>
              <h3 className="mt-3 text-3xl font-semibold text-white">Entra a Speleum</h3>
              <p className="mt-4 max-w-md leading-7 text-zinc-400">
                Explora la oscuridad, detecta ecos hostiles y sobrevive con vision limitada dentro de la cueva.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href={primaryHref} className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200">
                  {primaryLabel}
                </Link>
                <Link href="/login" className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm text-white transition hover:bg-white/10">
                  Login
                </Link>
                <Link href="/How-to-play" className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm text-white transition hover:bg-white/10">
                  Como jugar
                </Link>
              </div>
            </div>

            <div>
              <p className="mb-4 text-xs tracking-[0.25em] text-zinc-500">SECCIONES</p>
              <div className="flex flex-col gap-3 text-sm text-zinc-400">
                <Link href="/" className="transition hover:text-white">Inicio</Link>
                <Link href="/play" className="transition hover:text-white">Jugar</Link>
                <Link href="/login" className="transition hover:text-white">Login</Link>
                <Link href="/ranking" className="transition hover:text-white">Ranking</Link>
                <Link href="/How-to-play" className="transition hover:text-white">Como jugar</Link>
                <Link href="/world" className="transition hover:text-white">Mundo</Link>
                <Link href="/profile" className="transition hover:text-white">Usuario</Link>
              </div>
            </div>

            <div>
              <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }} className="relative flex h-44 items-center justify-center overflow-hidden rounded-4xl border border-white/10 bg-white/3">
                <div className="relative text-center">
                  <Image src="/Grafico/Logo blanco.svg" alt="Speleum logo" width={100} height={50} />
                </div>
              </motion.div>
            </div>
          </div>

          <div className="relative mx-auto mt-12 flex max-w-7xl flex-col items-center justify-between gap-3 border-t border-white/5 pt-6 text-center text-sm text-zinc-500 sm:flex-row sm:text-left">
            <p>Speleum · supervivencia en cuevas</p>
            <p>Oscuridad, ecos y competencia subterranea</p>
          </div>
        </motion.footer>
      </div>
    </main>
  );
}
