"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Copy, Radio, Users } from "lucide-react";
import type { CharacterOption } from "../gameConfig";
import type { MultiplayerStatePayload } from "../types";
import { ensureSocketConnection, getSocket } from "@/lib/socket";

type MultiplayerMenuProps = {
  selectedCharacter: CharacterOption;
  defaultPlayerName: string;
  onBack: () => void;
  onGameStart: (session: {
    roomCode: string;
    playerId: string;
    playerName: string;
    characterId: string;
  }) => void;
};

function normalizeRoomCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

export function MultiplayerMenu({
  selectedCharacter,
  defaultPlayerName,
  onBack,
  onGameStart,
}: MultiplayerMenuProps) {
  const [playerName, setPlayerName] = useState(defaultPlayerName);
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [roomState, setRoomState] = useState<MultiplayerStatePayload | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(() => getSocket().connected);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    const handleConnect = () => setSocketConnected(true);
    const handleDisconnect = () => setSocketConnected(false);
    const handleError = (message: string) => setErrorMessage(message);
    const handleGameState = (state: MultiplayerStatePayload) => {
      setRoomState(state);
      setErrorMessage(state.message);

      if (state.status === "playing") {
        onGameStart({
          roomCode: state.roomCode,
          playerId: state.self.id,
          playerName: state.self.name,
          characterId: state.self.characterId,
        });
      }
    };
    const handlePlayerLeft = ({ message }: { message?: string }) => {
      setErrorMessage(message ?? "El otro jugador abandono la sala.");
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("error-message", handleError);
    socket.on("game-state", handleGameState);
    socket.on("player-left", handlePlayerLeft);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("error-message", handleError);
      socket.off("game-state", handleGameState);
      socket.off("player-left", handlePlayerLeft);
    };
  }, [onGameStart]);

  const roomCode = roomState?.roomCode ?? normalizeRoomCode(roomCodeInput);
  const isInRoom = Boolean(roomState);

  const statusLabel = useMemo(() => {
    if (!roomState) {
      return socketConnected ? "Conectado al servidor" : "Sin conexion";
    }

    if (roomState.playerCount < roomState.requiredPlayers) {
      return "Esperando a otro jugador";
    }

    if (!roomState.self.isReady) {
      return "Sala completa, falta que te marques listo";
    }

    return "Esperando confirmacion del otro jugador";
  }, [roomState, socketConnected]);

  const submitCreate = () => {
    const socket = ensureSocketConnection();
    setErrorMessage(null);
    socket.emit("create-room", {
      name: playerName,
      characterId: selectedCharacter.id,
    });
  };

  const submitJoin = () => {
    const normalizedCode = normalizeRoomCode(roomCodeInput);

    if (normalizedCode.length !== 6) {
      setErrorMessage("El codigo de sala debe tener 6 caracteres.");
      return;
    }

    const socket = ensureSocketConnection();
    setErrorMessage(null);
    socket.emit("join-room", {
      roomCode: normalizedCode,
      name: playerName,
      characterId: selectedCharacter.id,
    });
  };

  const markReady = () => {
    if (!roomState) {
      return;
    }

    ensureSocketConnection().emit("player-ready", {
      roomCode: roomState.roomCode,
    });
  };

  const leaveRoom = () => {
    if (roomState) {
      getSocket().emit("leave-room", { roomCode: roomState.roomCode });
    }

    setRoomState(null);
    setErrorMessage(null);
    setCopied(false);
  };

  const copyRoomCode = async () => {
    if (!roomCode) {
      return;
    }

    await navigator.clipboard.writeText(roomCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <section className="relative z-10 min-h-screen overflow-hidden px-5 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
        <div className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-4xl border border-white/10 bg-black/40 p-7 backdrop-blur-md">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={isInRoom ? leaveRoom : onBack}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-4 py-2 text-sm text-zinc-300 transition hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                {isInRoom ? "Salir de la sala" : "Menu"}
              </button>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/15 bg-cyan-950/40 px-4 py-2 text-xs tracking-[0.22em] text-cyan-100">
                <Radio className="h-4 w-4" />
                {statusLabel}
              </div>
            </div>

            <p className="mt-8 text-xs tracking-[0.35em] text-zinc-500">SPELEUM</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[0.12em] text-white">
              SALA PRIVADA
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-400">
              Crea una sala por codigo para 2 a 4 criaturas. El servidor valida
              movimiento, combate y solo envia el estado que entra en tu vision.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <label className="block rounded-[1.4rem] border border-white/10 bg-black/35 p-4">
                <span className="text-xs tracking-[0.22em] text-zinc-500">NOMBRE TEMPORAL</span>
                <input
                  value={playerName}
                  onChange={(event) => setPlayerName(event.target.value)}
                  maxLength={18}
                  className="mt-3 w-full bg-transparent text-lg text-white outline-none"
                  placeholder="Explorador"
                />
              </label>

              <div className="rounded-[1.4rem] border border-white/10 bg-black/35 p-4">
                <span className="text-xs tracking-[0.22em] text-zinc-500">CRIATURA</span>
                <p className="mt-3 text-lg text-white">{selectedCharacter.name}</p>
                <p className="mt-1 text-sm text-zinc-500">{selectedCharacter.role}</p>
              </div>
            </div>

            {!isInRoom && (
              <div className="mt-8 grid gap-4 lg:grid-cols-2">
                <button
                  type="button"
                  onClick={submitCreate}
                  className="rounded-3xl bg-white px-6 py-4 text-left text-black transition hover:bg-zinc-200"
                >
                  <p className="text-xs tracking-[0.24em] text-zinc-500">CREAR</p>
                  <p className="mt-2 text-lg font-semibold">Abrir sala privada</p>
                </button>

                <div className="rounded-3xl border border-white/10 bg-black/35 p-4">
                  <p className="text-xs tracking-[0.24em] text-zinc-500">UNIRSE</p>
                  <div className="mt-3 flex gap-3">
                    <input
                      value={roomCodeInput}
                      onChange={(event) => setRoomCodeInput(normalizeRoomCode(event.target.value))}
                      className="min-w-0 flex-1 rounded-full border border-white/10 bg-black/40 px-4 py-3 text-sm tracking-[0.3em] text-white outline-none"
                      placeholder="ABC123"
                    />
                    <button
                      type="button"
                      onClick={submitJoin}
                      className="rounded-full border border-cyan-200/20 bg-cyan-950/50 px-5 py-3 text-sm text-cyan-100 transition hover:bg-cyan-900/60"
                    >
                      Entrar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {isInRoom && roomState && (
              <div className="mt-8 rounded-[1.6rem] border border-cyan-200/15 bg-cyan-950/20 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs tracking-[0.24em] text-zinc-500">CODIGO DE SALA</p>
                    <p className="mt-2 text-3xl font-semibold tracking-[0.34em] text-white">
                      {roomCode}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={copyRoomCode}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-4 py-2 text-sm text-zinc-200 transition hover:text-white"
                  >
                    <Copy className="h-4 w-4" />
                    {copied ? "Copiado" : "Copiar"}
                  </button>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.2rem] border border-white/10 bg-black/35 p-4">
                    <p className="text-xs tracking-[0.22em] text-zinc-500">ESTADO</p>
                    <p className="mt-2 text-sm text-zinc-200">{statusLabel}</p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/10 bg-black/35 p-4">
                    <p className="text-xs tracking-[0.22em] text-zinc-500">JUGADORES</p>
                    <p className="mt-2 text-sm text-zinc-200">
                      {roomState.playerCount}/{roomState.requiredPlayers} conectados
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={markReady}
                  disabled={roomState.self.isReady || roomState.playerCount < roomState.requiredPlayers}
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Users className="h-4 w-4" />
                  {roomState.self.isReady ? "Listo" : "Marcarme listo"}
                </button>
              </div>
            )}
          </div>

          <aside className="rounded-4xl border border-white/10 bg-black/30 p-7 backdrop-blur-md">
            <p className="text-xs tracking-[0.3em] text-zinc-500">RESUMEN</p>
            <div className="mt-5 space-y-4 text-sm leading-7 text-zinc-300">
              <p>Vision limitada a 8 casillas alrededor del jugador.</p>
              <p>Las otras criaturas solo aparecen si entran en tu rango visible.</p>
              <p>La sala vive en memoria y se pierde al reiniciar el servidor.</p>
              <p>La partida inicia con 2 jugadores y soporta hasta 4.</p>
            </div>

            {errorMessage && (
              <div className="mt-6 rounded-[1.4rem] border border-rose-200/10 bg-rose-950/30 p-4 text-sm text-rose-100/85">
                {errorMessage}
              </div>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}
