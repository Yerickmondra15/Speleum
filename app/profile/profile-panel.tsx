"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { ArrowLeft, LogOut, UserRound } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { characterOptions } from "../play/gameConfig";

type AuthMode = "login" | "register";

export function ProfilePanel() {
  const { user, status, login, logout, register, updateActiveCreature } =
    useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const activeCreature = useMemo(() => {
    return characterOptions.find((creature) => creature.id === user?.activeCreatureId);
  }, [user?.activeCreatureId]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    try {
      if (mode === "login") {
        await login(name, password);
      } else {
        await register(name, password);
      }

      setPassword("");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "No se pudo completar la accion.",
      );
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-24 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.08),transparent_70%)] blur-3xl" />
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
            {user ? user.name : "Entra a la cueva"}
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-7 text-zinc-400">
            Tu sesion mantiene la criatura activa y datos basicos del perfil
            para que la experiencia continue cuando vuelvas.
          </p>
        </div>

        {status === "loading" && (
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-6">
            <p className="text-sm text-zinc-400">Leyendo sesion...</p>
          </div>
        )}

        {status !== "loading" && !user && (
          <form
            onSubmit={handleSubmit}
            className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-6 backdrop-blur-md"
          >
            <div className="mb-6 flex gap-2">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  mode === "login"
                    ? "bg-white text-black"
                    : "border border-white/10 text-zinc-300 hover:bg-white/10"
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => setMode("register")}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  mode === "register"
                    ? "bg-white text-black"
                    : "border border-white/10 text-zinc-300 hover:bg-white/10"
                }`}
              >
                Registro
              </button>
            </div>

            <label className="block text-xs tracking-[0.22em] text-zinc-500">
              NOMBRE
            </label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-white outline-none transition focus:border-white/35"
              autoComplete="username"
            />

            <label className="mt-5 block text-xs tracking-[0.22em] text-zinc-500">
              CONTRASENA
            </label>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-white outline-none transition focus:border-white/35"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
            />

            {error && <p className="mt-4 text-sm text-red-200">{error}</p>}

            <button
              type="submit"
              className="mt-6 w-full rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
            >
              {mode === "login" ? "Iniciar sesion" : "Crear cuenta"}
            </button>
          </form>
        )}

        {status === "signed-in" && user && (
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-6 backdrop-blur-md">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-zinc-100/90">
                <UserRound className="h-7 w-7 text-black" />
              </div>
              <div>
                <p className="text-xs tracking-[0.24em] text-zinc-500">
                  SESION ACTIVA
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-white">
                  {user.name}
                </h2>
              </div>
            </div>

            <div className="mt-7 grid gap-3 text-sm">
              <div className="flex justify-between rounded-2xl border border-white/10 bg-black/35 px-4 py-3">
                <span className="text-zinc-500">Criatura activa</span>
                <span className="text-zinc-200">
                  {activeCreature?.name ?? "Sin seleccionar"}
                </span>
              </div>
              <div className="flex justify-between rounded-2xl border border-white/10 bg-black/35 px-4 py-3">
                <span className="text-zinc-500">Estado</span>
                <span className="text-zinc-200">sesion guardada</span>
              </div>
              <div className="flex justify-between rounded-2xl border border-white/10 bg-black/35 px-4 py-3">
                <span className="text-zinc-500">Ecos registrados</span>
                <span className="text-zinc-200">{user.profile.runs}</span>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-xs tracking-[0.22em] text-zinc-500">
                CAMBIAR CRIATURA
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {characterOptions
                  .filter((creature) => creature.status === "available")
                  .map((creature) => (
                    <button
                      key={creature.id}
                      type="button"
                      onClick={() => updateActiveCreature(creature.id)}
                      className={`rounded-full border px-4 py-2 text-sm transition ${
                        user.activeCreatureId === creature.id
                          ? "border-white/50 bg-white text-black"
                          : "border-white/10 bg-black/40 text-zinc-300 hover:bg-white/10"
                      }`}
                    >
                      {creature.name}
                    </button>
                  ))}
              </div>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/play"
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
              >
                Jugar
              </Link>
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-6 py-3 text-sm text-zinc-300 transition hover:text-white"
              >
                <LogOut className="h-4 w-4" />
                Cerrar sesion
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
