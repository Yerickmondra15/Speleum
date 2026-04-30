"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, LogOut, Play, UserRound } from "lucide-react";
import { getCreatureById, SELECTED_CREATURE_KEY } from "@/lib/creatures";
import { clearSession, readSession, type SpeleumSession } from "@/lib/session";

export function ProfilePanel() {
  const router = useRouter();
  const [session] = useState<SpeleumSession | null>(() => readSession());
  const [activeCreatureId] = useState(() => {
    if (typeof window === "undefined") {
      return "cave-axolotl";
    }

    return window.localStorage.getItem(SELECTED_CREATURE_KEY) ?? "cave-axolotl";
  });
  const activeCreature = getCreatureById(activeCreatureId);

  useEffect(() => {
    if (!session) {
      router.replace("/login");
    }
  }, [router, session]);

  const handleLogout = () => {
    clearSession();
    router.replace("/");
  };

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-zinc-400">
        Cargando perfil...
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-24 h-128 w-lg -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.08),transparent_70%)] blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-[linear-gradient(to_top,rgba(82,9,20,0.22),transparent)]" />
      </div>

      <header className="relative z-10 mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-zinc-300 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Inicio
        </Link>
        <p className="text-xs tracking-[0.34em] text-zinc-500">PERFIL</p>
      </header>

      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl content-center gap-8 px-6 py-12 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-xs tracking-[0.35em] text-zinc-500">SPELEUM ID</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[0.18em] text-white sm:text-5xl">
            {session.username}
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-7 text-zinc-400">
            Tu sesion local mantiene tu identidad base para entrar a Speleum
            sin depender aun de backend.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-zinc-100/90">
              <Image
                src={activeCreature.imagenJuego}
                alt={activeCreature.nombre}
                width={44}
                height={44}
                className="h-11 w-11 object-contain"
              />
            </div>
            <div>
              <p className="text-xs tracking-[0.24em] text-zinc-500">
                SESION ACTIVA
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-white">
                {session.username}
              </h2>
            </div>
          </div>

          <div className="mt-7 grid gap-3 text-sm">
            <div className="flex justify-between rounded-2xl border border-white/10 bg-black/35 px-4 py-3">
              <span className="text-zinc-500">Nombre de usuario</span>
              <span className="text-zinc-200">{session.username}</span>
            </div>
            <div className="flex justify-between rounded-2xl border border-white/10 bg-black/35 px-4 py-3">
              <span className="text-zinc-500">Correo</span>
              <span className="text-zinc-200">{session.email}</span>
            </div>
            <div className="flex justify-between rounded-2xl border border-white/10 bg-black/35 px-4 py-3">
              <span className="text-zinc-500">Estado</span>
              <span className="text-zinc-200">sesion guardada</span>
            </div>
            <div className="flex justify-between rounded-2xl border border-white/10 bg-black/35 px-4 py-3">
              <span className="text-zinc-500">Criatura activa</span>
              <span className="text-zinc-200">{activeCreature.nombre}</span>
            </div>
            <div className="flex justify-between rounded-2xl border border-white/10 bg-black/35 px-4 py-3">
              <span className="text-zinc-500">Habilidad</span>
              <span className="max-w-52 text-right text-zinc-200">{activeCreature.habilidad}</span>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/play"
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
            >
              <Play className="h-4 w-4 fill-black" />
              Ir a jugar
            </Link>
            <Link
              href="/play"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-6 py-3 text-sm text-zinc-300 transition hover:text-white"
            >
              <UserRound className="h-4 w-4" />
              Cambiar criatura
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-6 py-3 text-sm text-zinc-300 transition hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesion
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
