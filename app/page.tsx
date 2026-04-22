"use client";

import { useState } from "react";
import {
  Trophy,
  CircleHelp,
  User,
  Play,
  Lightbulb,
  ChevronDown,
} from "lucide-react";

export default function Home() {
  const [turnedOn, setTurnedOn] = useState(false);

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      {!turnedOn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.04),transparent_45%)]" />

          <div className="flex flex-col items-center">

            <button
              onClick={() => setTurnedOn(true)}
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

      <div
        className={`transition-all duration-1000 ${
          turnedOn ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-32 h-137.5 w-137.5 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,220,0.12),rgba(255,255,255,0.03),transparent_70%)] blur-2xl" />
          <div className="absolute bottom-0 left-0 right-0 h-64 bg-[linear-gradient(to_top,rgba(255,255,255,0.05),transparent)]" />
        </div>

        <header className="sticky top-0 z-40 border-b border-white/5 bg-black/40 backdrop-blur-md">
          <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
            <div className="text-lg font-semibold tracking-[0.25em] text-zinc-100">
              SPELEUM
            </div>

            <button className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-medium tracking-wide text-white transition hover:bg-white/10">
              <Play className="h-4 w-4 fill-white" />
              Play
            </button>

            <div className="flex items-center gap-3">
              <button className="rounded-full border border-white/10 bg-white/5 p-2 transition hover:bg-white/10">
                <Trophy className="h-5 w-5 text-zinc-200" />
              </button>

              <button className="rounded-full border border-white/10 bg-white/5 p-2 transition hover:bg-white/10">
                <CircleHelp className="h-5 w-5 text-zinc-200" />
              </button>

              <button className="rounded-full border border-white/10 bg-white/5 p-2 transition hover:bg-white/10">
                <User className="h-5 w-5 text-zinc-200" />
              </button>
            </div>
          </nav>
        </header>

        <section className="relative mx-auto flex min-h-[88vh] max-w-7xl flex-col items-center justify-center px-6 pt-10 text-center">
          <div className="absolute inset-x-0 top-16 -z-10 h-80 bg-[radial-gradient(circle,rgba(255,255,255,0.06),transparent_60%)] blur-3xl" />

          <div className="mb-4 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs tracking-[0.3em] text-zinc-300">
            Oscuridad · Exploración · Supervivencia
          </div>

          <h1 className="text-5xl font-semibold tracking-[0.35em] text-white sm:text-7xl">
            SPELEUM
          </h1>

          <p className="mt-5 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">
            Un juego web inspirado en criaturas cavernícolas, exploración en
            oscuridad y visión limitada. Entra a la cueva, encuentra a otros
            jugadores y sobrevive antes de ser encontrado.
          </p>

          <div className="mt-14 flex w-full justify-center">
            <div className="relative flex h-90 w-full max-w-4xl items-center justify-center overflow-hidden rounded-4xl  shadow-[0_0_120px_rgba(255,255,255,0.05)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.07),transparent_85%)]" />
              <div className="absolute bottom-0 left-0 right-0 h-32 bg-linear-to-t from-black via-black/70 to-transparent" />

              <div className="relative px-6">
                <pre className="overflow-x-auto text-center text-[8px] leading-2 text-zinc-300 sm:text-[11px] sm:leading-2.75">
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

                <p className="mt-4 text-center text-sm tracking-[0.25em] text-zinc-500">
                  ajolote de cueva
                </p>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center gap-4">
            <button className="rounded-full border border-white/10 bg-white px-7 py-3 text-sm font-semibold text-black transition hover:scale-[1.02] hover:bg-zinc-200">
              Entrar a jugar
            </button>

            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <ChevronDown className="h-4 w-4" />
              Conoce más del proyecto
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-24">
          <div className="grid gap-8 md:grid-cols-2">
            <div className="rounded-4xl border border-white/10 bg-white/3 p-8">
              <p className="mb-3 text-xs tracking-[0.25em] text-zinc-500">
                ¿QUÉ ES SPELEUM?
              </p>
              <h2 className="text-2xl font-semibold text-white">
                Explora un mundo subterráneo con visión limitada
              </h2>
              <p className="mt-4 leading-7 text-zinc-400">
                Speleum es un juego web de exploración y supervivencia inspirado
                en criaturas de cueva (Troglobios). Cada partida pone al jugador dentro de un
                entorno oscuro donde la información es limitada y el peligro
                puede aparecer en cualquier momento.
              </p>
            </div>

            <div className="rounded-4xl border border-white/10 bg-white/3 p-8">
              <p className="mb-3 text-xs tracking-[0.25em] text-zinc-500">
                IDEA PRINCIPAL
              </p>
              <h2 className="text-2xl font-semibold text-white">
                Jugar, explorar y sobrevivir antes que los demás
              </h2>
              <p className="mt-4 leading-7 text-zinc-400">
                El proyecto combina una identidad visual oscura con mecánicas de
                descubrimiento, tensión y competencia. La criatura principal es
                un ajolote de cueva, acompañado después por otras especies
                subterráneas como cangrejos, peces ciegos, camarones y arañas.
              </p>
            </div>
          </div>
        </section>

        <footer className="border-t border-white/5 px-6 py-8">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 text-sm text-zinc-500 sm:flex-row">
            <p>Speleum · proyecto académico</p>
            <p>Diseño inspirado en la oscuridad de las cuevas y la exploración</p>
          </div>
        </footer>
      </div>
    </main>
  );
}