"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Trophy,
  CircleHelp,
  User,
  LogIn,
  Lightbulb,
  ChevronDown,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { LIGHTS_ON_KEY, creatures } from "@/lib/creatures";
import { useAuth } from "./auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { getLocalizedCreature } from "@/lib/i18n/content";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { ThemeSwitcher } from "@/app/components/ThemeSwitcher";

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

const mobileMenuVariants: Variants = {
  hidden: {
    opacity: 0,
    height: 0,
    y: -10,
  },
  visible: {
    opacity: 1,
    height: "auto",
    y: 0,
    transition: {
      duration: 0.22,
      ease: "easeOut",
      when: "beforeChildren",
      staggerChildren: 0.05,
    },
  },
  exit: {
    opacity: 0,
    height: 0,
    y: -8,
    transition: {
      duration: 0.18,
      ease: "easeInOut",
      when: "afterChildren",
      staggerChildren: 0.03,
      staggerDirection: -1,
    },
  },
};

const mobileMenuItemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: -8,
    filter: "blur(4px)",
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.18,
      ease: "easeOut",
    },
  },
  exit: {
    opacity: 0,
    y: -6,
    filter: "blur(4px)",
    transition: {
      duration: 0.12,
      ease: "easeInOut",
    },
  },
};

export default function Home() {
  const router = useRouter();
  const { status, logout } = useAuth();
  const { locale, messages } = useLanguage();
  const { theme } = useTheme();
  const [turnedOn, setTurnedOn] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const hasSession = status === "signed-in";
  const logoSrc = theme === "light" ? "/Grafico/Logo Speleum.svg" : "/Grafico/Logo blanco.svg";
  const wordmarkSrc = theme === "light" ? "/Grafico/Nombre.svg" : "/Grafico/Nombre-white.svg";

  useEffect(() => {
    const frame = window.setTimeout(() => {
      setTurnedOn(window.localStorage.getItem(LIGHTS_ON_KEY) === "true");
    }, 0);

    return () => window.clearTimeout(frame);
  }, []);

  const primaryHref = hasSession ? "/play" : "/login";
  const primaryLabel = hasSession ? messages.home.primaryPlay : messages.home.primaryLogin;

  const handleTurnOn = () => {
    setTurnedOn(true);
    window.localStorage.setItem(LIGHTS_ON_KEY, "true");
  };

  const handleLogout = async () => {
    await logout();
    setIsMobileMenuOpen(false);
    router.replace("/");
    router.refresh();
  };

  return (
    <main className="theme-page relative min-h-screen overflow-x-hidden">
      {!turnedOn && (
        <div className="theme-page fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--glow-main),transparent_45%)]" />
          <div className="flex flex-col items-center">
            <button
              onClick={handleTurnOn}
              className="group relative flex h-24 w-24 items-center justify-center rounded-full border border-(--border-soft) bg-(--surface-1) transition duration-300 hover:scale-105 hover:border-(--border-strong)"
            >
              <Lightbulb className="h-10 w-10 text-(--text-secondary) transition group-hover:text-yellow-200" />
              <span className="absolute -bottom-10 text-sm tracking-wide text-(--text-muted) group-hover:text-(--text-secondary)">
                {messages.home.turnOn}
              </span>
            </button>
          </div>
        </div>
      )}

      <div className={`transition-all duration-1000 ${turnedOn ? "opacity-100" : "opacity-0"}`}>
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-32 h-137.5 w-137.5 -translate-x-1/2 rounded-full theme-spotlight blur-2xl" />
          <div className="absolute bottom-0 left-0 right-0 h-64 theme-accent-fade" />
        </div>

        <header className="theme-header sticky top-0 z-40 border-b backdrop-blur-md">
          <nav className="mx-auto grid max-w-7xl gap-4 px-4 py-3 sm:px-6 lg:grid-cols-[auto_1fr] lg:items-center">
            <div className="flex min-w-0 items-center gap-3">
              <Image
                src={logoSrc}
                alt="Speleum logo"
                width={26}
                height={36}
                className="h-9 w-auto"
                style={{ width: "auto" }}
              />
              <Image
                src={wordmarkSrc}
                alt="Speleum"
                width={196}
                height={32}
                priority
                className="h-6 w-auto sm:h-7"
                style={{ width: "auto" }}
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen((current) => !current)}
                aria-label={isMobileMenuOpen ? messages.common.cancel : messages.common.menu}
                aria-expanded={isMobileMenuOpen}
                className="theme-button-secondary inline-flex h-11 w-11 items-center justify-center rounded-full p-2 transition sm:hidden"
              >
                {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>

              <div className="hidden flex-wrap items-center justify-start gap-2 sm:flex sm:justify-end sm:gap-3">
              <ThemeSwitcher compact />
              <Link href="/ranking" className="theme-button-secondary flex h-11 w-11 items-center justify-center rounded-full p-2 transition">
                <Trophy className="h-5 w-5" />
              </Link>
              <Link href="/How-to-play" className="theme-button-secondary flex h-11 w-11 items-center justify-center rounded-full p-2 transition">
                <CircleHelp className="h-5 w-5" />
              </Link>
              <Link href="/profile" className="theme-button-secondary flex h-11 w-11 items-center justify-center rounded-full p-2 transition">
                <User className="h-5 w-5" />
              </Link>
              {hasSession ? (
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="theme-button-secondary inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm transition"
                >
                  <LogOut className="h-4 w-4" />
                  {messages.common.logout}
                </button>
              ) : (
                <Link
                  href="/login"
                  className="theme-button-secondary inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm transition"
                >
                  <LogIn className="h-4 w-4" />
                  {messages.common.login}
                </Link>
              )}
              </div>
            </div>
          </nav>

          <AnimatePresence initial={false}>
            {isMobileMenuOpen && (
              <motion.div
                variants={mobileMenuVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="overflow-hidden border-t border-(--border-soft) sm:hidden"
              >
                <div className="px-4 pb-4 pt-3">
                  <div className="relative overflow-hidden rounded-3xl border border-(--border-soft) bg-(--surface-1) p-3 backdrop-blur-xl">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,var(--glow-main),transparent_65%)]" />
                    <motion.div className="relative grid gap-2">
                      <motion.div variants={mobileMenuItemVariants}>
                        <div className="rounded-2xl border border-(--border-soft) bg-(--surface-2) p-3">
                          <ThemeSwitcher compact />
                        </div>
                      </motion.div>
                      <motion.div variants={mobileMenuItemVariants}>
                        <Link
                          href="/ranking"
                          className="theme-button-secondary inline-flex min-h-11 w-full items-center justify-center rounded-full px-4 py-3 text-sm transition"
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          {messages.common.ranking}
                        </Link>
                      </motion.div>
                      <motion.div variants={mobileMenuItemVariants}>
                        <Link
                          href="/How-to-play"
                          className="theme-button-secondary inline-flex min-h-11 w-full items-center justify-center rounded-full px-4 py-3 text-sm transition"
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          {messages.common.howToPlay}
                        </Link>
                      </motion.div>
                      <motion.div variants={mobileMenuItemVariants}>
                        <Link
                          href="/profile"
                          className="theme-button-secondary inline-flex min-h-11 w-full items-center justify-center rounded-full px-4 py-3 text-sm transition"
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          {messages.common.profile}
                        </Link>
                      </motion.div>
                      <motion.div variants={mobileMenuItemVariants}>
                        {hasSession ? (
                          <button
                            type="button"
                            onClick={() => void handleLogout()}
                            className="theme-button-secondary inline-flex min-h-11 w-full items-center justify-center rounded-full px-4 py-3 text-sm transition"
                          >
                            {messages.common.logout}
                          </button>
                        ) : (
                          <Link
                            href="/login"
                            className="theme-button-secondary inline-flex min-h-11 w-full items-center justify-center rounded-full px-4 py-3 text-sm transition"
                            onClick={() => setIsMobileMenuOpen(false)}
                          >
                            {messages.common.login}
                          </Link>
                        )}
                      </motion.div>
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        <section className="relative mx-auto flex min-h-[88vh] max-w-7xl flex-col items-center justify-center px-4 pt-10 text-center sm:px-6">
          <div className="absolute inset-x-0 top-16 -z-10 h-80 bg-[radial-gradient(circle,var(--glow-main),transparent_60%)] blur-3xl" />

          <div className="theme-chip mb-4 inline-flex max-w-full items-center rounded-full px-4 py-1 text-center text-[0.65rem] tracking-[0.24em] sm:text-xs sm:tracking-[0.3em]">
            {messages.home.heroTag}
          </div>

          <h1 className="text-4xl font-serif font-semibold tracking-[0.22em] text-(--text-primary) sm:text-7xl sm:tracking-[0.35em]">
            SPELEUM
          </h1>

          <p className="mt-5 max-w-2xl text-sm leading-7 text-(--text-secondary) sm:text-base">
            {messages.home.heroDescription}
          </p>

          <div className="mt-14 flex w-full justify-center">
            <div className="relative flex w-full max-w-4xl items-center justify-center overflow-hidden sm:h-90">
              <div className="absolute inset-0 " />
              <div
                className="absolute bottom-0 left-0 right-0 h-32"
                style={{
                  background:
                    "linear-gradient(to top, var(--app-bg), var(--hero-creature-shadow), transparent)",
                }}
              />
              <div className="relative w-full px-3 sm:px-6">
                <pre className="overflow-visible pb-2 text-center text-[5px] leading-[0.36rem] text-(--text-secondary) sm:text-[11px] sm:leading-2.75">
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
                <p className="mt-4 text-center text-sm tracking-[0.25em] text-(--text-muted)">{messages.home.creatureCaption}</p>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center gap-4">
            <Link
              href={primaryHref}
              className={`min-h-11 rounded-full border px-7 py-3 text-sm font-semibold transition hover:scale-[1.02] ${
                hasSession
                  ? "theme-button-accent border-transparent"
                  : "theme-button-primary border-transparent"
              }`}
            >
              {primaryLabel}
            </Link>

            <div className="flex items-center gap-2 text-sm text-(--text-muted)">
              <ChevronDown className="h-4 w-4" />
              {messages.home.discover}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <div className="grid gap-8 md:grid-cols-2">
            <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.25 }} className="theme-card rounded-4xl p-8">
              <p className="mb-3 text-xs tracking-[0.25em] text-(--text-muted)">{messages.home.sectionWhatIs}</p>
              <h2 className="text-2xl font-semibold text-(--text-primary)">{messages.home.sectionWhatIsTitle}</h2>
              <p className="mt-4 leading-7 text-(--text-secondary)">
                {messages.home.sectionWhatIsText}
              </p>
            </motion.div>

            <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.25 }} transition={{ delay: 0.12 }} className="theme-card rounded-4xl p-8">
              <p className="mb-3 text-xs tracking-[0.25em] text-(--text-muted)">{messages.home.sectionCore}</p>
              <h2 className="text-2xl font-semibold text-(--text-primary)">{messages.home.sectionCoreTitle}</h2>
              <p className="mt-4 leading-7 text-(--text-secondary)">
                {messages.home.sectionCoreText}
              </p>
            </motion.div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 sm:pb-24">
          <div className="mb-10 max-w-2xl">
            <p className="text-xs tracking-[0.25em] text-(--text-muted)">{messages.home.creaturesLabel}</p>
            <h2 className="mt-3 text-3xl font-semibold text-(--text-primary)">{messages.home.creaturesTitle}</h2>
            <p className="mt-4 leading-7 text-(--text-secondary)">
              {messages.home.creaturesText}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {creatures.slice(0, 2).map((creature) => {
              const localizedCreature = getLocalizedCreature(locale, creature.id);

              return (
                <motion.div key={creature.id} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} className="theme-card rounded-4xl p-7">
                  <div className="theme-icon-shell mb-5 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full">
                    <Image src={creature.imagenJuego} alt={localizedCreature.nombre} width={40} height={40} className="h-10 w-10 object-contain" />
                  </div>
                  <h3 className="text-xl font-semibold text-(--text-primary)">{localizedCreature.nombre}</h3>
                  <p className="mt-3 leading-7 text-(--text-secondary)">{localizedCreature.descripcionCorta}</p>
                </motion.div>
              );
            })}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 sm:pb-24">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} className="theme-card relative overflow-hidden rounded-4xl p-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_right,var(--glow-main),transparent_55%)]" />
            <div className="relative grid gap-8 md:grid-cols-[1.2fr_0.8fr]">
              <div>
                <p className="text-xs tracking-[0.25em] text-(--text-muted)">{messages.home.worldLabel}</p>
                <h2 className="mt-3 text-3xl font-semibold text-(--text-primary)">{messages.home.worldTitle}</h2>
                <p className="mt-4 leading-7 text-(--text-secondary)">
                  {messages.home.worldText}
                </p>
              </div>
              <div className="flex items-end md:justify-end">
                <Link href="/world" className="theme-button-primary inline-flex min-h-11 items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition">
                  {messages.home.exploreWorld}
                </Link>
              </div>
            </div>
          </motion.div>
        </section>

        <motion.footer initial={{ opacity: 0, y: 25 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }} transition={{ duration: 0.7, ease: "easeOut" }} className="relative border-t border-(--border-soft) px-4 py-16 sm:px-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,var(--glow-main),transparent_55%)]" />
          <div className="relative mx-auto grid max-w-7xl gap-10 md:grid-cols-[1.2fr_1fr_1fr]">
            <div>
              <p className="text-xs tracking-[0.25em] text-(--text-muted)">{messages.home.footerLabel}</p>
              <h3 className="mt-3 text-3xl font-semibold text-(--text-primary)">{messages.home.footerTitle}</h3>
              <p className="mt-4 max-w-md leading-7 text-(--text-secondary)">
                {messages.home.footerText}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href={primaryHref} className="theme-button-primary inline-flex min-h-11 items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition">
                  {primaryLabel}
                </Link>
                {!hasSession && (
                  <Link href="/login" className="theme-button-secondary inline-flex min-h-11 items-center justify-center rounded-full px-6 py-3 text-sm transition">
                    {messages.home.footerLogin}
                  </Link>
                )}
                <Link href="/How-to-play" className="theme-button-secondary inline-flex min-h-11 items-center justify-center rounded-full px-6 py-3 text-sm transition">
                  {messages.home.footerHowToPlay}
                </Link>
              </div>
            </div>

            <div>
              <p className="mb-4 text-xs tracking-[0.25em] text-(--text-muted)">{messages.home.footerSections}</p>
              <div className="flex flex-col gap-3 text-sm text-(--text-secondary)">
                <Link href="/" className="transition hover:text-(--text-primary)">{messages.common.home}</Link>
                <Link href="/play" className="transition hover:text-(--text-primary)">{messages.common.play}</Link>
                {!hasSession && <Link href="/login" className="transition hover:text-(--text-primary)">{messages.common.login}</Link>}
                <Link href="/ranking" className="transition hover:text-(--text-primary)">{messages.common.ranking}</Link>
                <Link href="/How-to-play" className="transition hover:text-(--text-primary)">{messages.common.howToPlay}</Link>
                <Link href="/world" className="transition hover:text-(--text-primary)">{messages.common.world}</Link>
                <Link href="/profile" className="transition hover:text-(--text-primary)">{messages.common.profile}</Link>
              </div>
            </div>

            <div>
              <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }} className="theme-card relative flex h-44 items-center justify-center overflow-hidden rounded-4xl">
                <div className="relative text-center">
                  <Image
                    src={logoSrc}
                    alt="Speleum logo"
                    width={72}
                    height={100}
                    className="h-25 w-auto"
                    style={{ width: "auto" }}
                  />
                </div>
              </motion.div>
            </div>
          </div>

          <div className="relative mx-auto mt-12 flex max-w-7xl flex-col items-center justify-between gap-3 border-t border-(--border-soft) pt-6 text-center text-sm text-(--text-muted) sm:flex-row sm:text-left">
            <p>Speleum · 2026</p>
            <p>{messages.home.footerBuiltBy}</p>
          </div>
        </motion.footer>
      </div>
    </main>
  );
}
