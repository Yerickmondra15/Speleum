"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Copy, Radio, Users } from "lucide-react";
import {
  MAX_ROOM_PLAYERS,
  MIN_ROOM_PLAYERS,
  type CharacterOption,
} from "../gameConfig";
import type { MultiplayerStatePayload } from "../types";
import {
  clearMultiplayerSession,
  multiplayerSessionFromState,
  writeMultiplayerSession,
} from "@/lib/multiplayer/client-session";
import type { ResumeRoomResult } from "@/lib/multiplayer/events";
import {
  ensureSocketConnection,
  getSocket,
  getSocketServiceUrl,
  isSocketMultiplayerAvailable,
} from "@/lib/socket";
import {
  warmSocketService,
  type SocketServiceState,
} from "@/lib/multiplayer/service-health";
import { localizeCharacterOption, translateMultiplayerMessage } from "@/lib/i18n/content";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { formatMessage } from "@/lib/i18n/messages";
import { useAudio } from "@/lib/audio/AudioProvider";

type MultiplayerMenuProps = {
  selectedCharacter: CharacterOption;
  defaultPlayerName: string;
  onBack: () => void;
  onGameStart: (session: {
    matchId: string;
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
  const { locale, messages } = useLanguage();
  const lobby = messages.play.lobby;
  const localizedCharacter = localizeCharacterOption(locale, selectedCharacter);
  const { unlock, playSfx } = useAudio();
  const multiplayerAvailable = isSocketMultiplayerAvailable();
  const [playerName, setPlayerName] = useState(defaultPlayerName);
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [roomState, setRoomState] = useState<MultiplayerStatePayload | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [errorMessage, setErrorMessage] = useState<string | null>(() =>
    multiplayerAvailable
      ? null
      : lobby.unavailable,
  );
  const [socketConnected, setSocketConnected] = useState(() => getSocket()?.connected ?? false);
  const [serviceState, setServiceState] = useState<SocketServiceState>(() =>
    multiplayerAvailable ? "connecting" : "error",
  );
  const [copied, setCopied] = useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [isSendingReady, setIsSendingReady] = useState(false);
  const roomStateRef = useRef(roomState);
  const previousRoomStatusRef = useRef(roomState?.status);

  const warmService = useCallback(async (signal?: AbortSignal) => {
    const socketUrl = getSocketServiceUrl();
    if (!socketUrl) {
      setServiceState("error");
      return;
    }

    const ready = await warmSocketService(socketUrl, {
      signal,
      onState: setServiceState,
    }).catch(() => false);
    if (ready) setErrorMessage(null);
    else if (!signal?.aborted) setErrorMessage(lobby.multiplayerUnavailable);
  }, [lobby.multiplayerUnavailable]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => void warmService(controller.signal));
    return () => controller.abort();
  }, [warmService]);

  useEffect(() => {
    const status = roomState?.status;
    if (status && status !== previousRoomStatusRef.current) {
      if (status === "ready-check") playSfx("ready");
      if (status === "starting") playSfx("start");
    }
    previousRoomStatusRef.current = status;
  }, [playSfx, roomState?.status]);

  useEffect(() => {
    roomStateRef.current = roomState;
  }, [roomState]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 500);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const socket = getSocket();

    if (!socket) {
      return;
    }

    const handleConnect = () => {
      setSocketConnected(true);
      setServiceState("ready");
      setErrorMessage(null);
      const currentRoom = roomStateRef.current;

      if (currentRoom) {
        socket.emit(
          "resume-room",
          { roomCode: currentRoom.roomCode },
          (result: ResumeRoomResult) => {
            if (result.ok) {
              setErrorMessage(null);
              return;
            }

            setErrorMessage(translateMultiplayerMessage(locale, result.message));
            if (result.terminal) {
              clearMultiplayerSession();
              setRoomState(null);
            }
          },
        );
      }
    };
    const handleDisconnect = () => {
      setSocketConnected(false);
      setServiceState("retrying");
      setErrorMessage(lobby.reconnecting);
    };
    const handleError = (message: string) => {
      setIsCreatingRoom(false);
      setIsJoiningRoom(false);
      setIsSendingReady(false);
      setErrorMessage(translateMultiplayerMessage(locale, message));
    };
    const handleGameState = (state: MultiplayerStatePayload) => {
      writeMultiplayerSession(multiplayerSessionFromState(state));
      setRoomState(state);
      setIsCreatingRoom(false);
      setIsJoiningRoom(false);
      setIsSendingReady(false);
      setErrorMessage(null);

      if (state.status === "playing") {
        onGameStart({
          matchId: state.matchId,
          roomCode: state.roomCode,
          playerId: state.self.id,
          playerName: state.self.name,
          characterId: state.self.characterId,
        });
      }
    };
    const handlePlayerLeft = ({ message }: { message?: string }) => {
      setIsSendingReady(false);
      setErrorMessage(
        message ? translateMultiplayerMessage(locale, message) : lobby.creatureLeft,
      );
    };
    const handleConnectError = () => {
      setSocketConnected(false);
      setServiceState("waking");
      setIsCreatingRoom(false);
      setIsJoiningRoom(false);
      setErrorMessage(lobby.waking);
    };
    const handleReconnectAttempt = () => {
      setSocketConnected(false);
      setServiceState("retrying");
      setErrorMessage(lobby.reconnecting);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.io.on("reconnect_attempt", handleReconnectAttempt);
    socket.on("error-message", handleError);
    socket.on("game-state", handleGameState);
    socket.on("player-left", handlePlayerLeft);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.io.off("reconnect_attempt", handleReconnectAttempt);
      socket.off("error-message", handleError);
      socket.off("game-state", handleGameState);
      socket.off("player-left", handlePlayerLeft);
    };
  }, [lobby.creatureLeft, lobby.reconnecting, lobby.waking, locale, onGameStart]);

  const roomCode = roomState?.roomCode ?? normalizeRoomCode(roomCodeInput);
  const isInRoom = Boolean(roomState);
  const minPlayers = roomState?.minPlayers ?? MIN_ROOM_PLAYERS;
  const requiredPlayers = roomState?.requiredPlayers ?? minPlayers;
  const maxPlayers = roomState?.maxPlayers ?? MAX_ROOM_PLAYERS;

  const statusLabel = useMemo(() => {
    if (serviceState === "connecting") return lobby.connecting;
    if (serviceState === "waking") return lobby.waking;
    if (serviceState === "retrying") return lobby.reconnecting;
    if (serviceState === "error") return lobby.connectionError;

    if (!socketConnected) {
      return lobby.connectedServer;
    }

    if (!roomState) {
      return lobby.waking;
    }

    if (roomState.status === "starting") {
      return lobby.starting;
    }

    if (roomState.connectedCount < requiredPlayers || roomState.status === "waiting") {
      return formatMessage(lobby.waitingPlayers, { count: requiredPlayers });
    }

    if (roomState.status === "ready-check") {
      return roomState.self.isReady
        ? lobby.waitingReady
        : lobby.waitingReady;
    }

    if (roomState.status === "playing") {
      return lobby.playing;
    }

    return lobby.synchronized;
  }, [lobby, requiredPlayers, roomState, serviceState, socketConnected]);

  const readyCountdownSeconds =
    roomState?.readyDeadline && roomState.status === "ready-check"
      ? Math.max(0, Math.ceil((roomState.readyDeadline - now) / 1000))
      : null;
  const startCountdownSeconds =
    roomState?.startAt && roomState.status === "starting"
      ? Math.max(0, Math.ceil((roomState.startAt - now) / 1000))
      : null;

  const submitCreate = () => {
    if (isCreatingRoom || isJoiningRoom || isSendingReady) {
      return;
    }

    const socket = ensureSocketConnection();
    if (!socket) {
      setErrorMessage(lobby.noCreateServer);
      return;
    }
    setIsCreatingRoom(true);
    unlock();
    playSfx("ui");
    setErrorMessage(null);
    socket.emit("create-room", {
      name: playerName,
      characterId: selectedCharacter.id,
    });
  };

  const submitJoin = () => {
    if (isCreatingRoom || isJoiningRoom || isSendingReady) {
      return;
    }

    const normalizedCode = normalizeRoomCode(roomCodeInput);

    if (normalizedCode.length !== 6) {
      setErrorMessage(lobby.invalidCode);
      return;
    }

    const socket = ensureSocketConnection();
    if (!socket) {
      setErrorMessage(lobby.noJoinServer);
      return;
    }
    setIsJoiningRoom(true);
    unlock();
    playSfx("ui");
    setErrorMessage(null);
    socket.emit("join-room", {
      roomCode: normalizedCode,
      name: playerName,
      characterId: selectedCharacter.id,
    });
  };

  const markReady = () => {
    if (!roomState || isSendingReady || roomState.self.isReady) {
      return;
    }

    const socket = ensureSocketConnection();

    if (!socket) {
      setErrorMessage(lobby.multiplayerUnavailable);
      return;
    }

    setIsSendingReady(true);
    unlock();
    playSfx("ready");
    socket.emit("player-ready", {
      roomCode: roomState.roomCode,
    });
  };

  const leaveRoom = () => {
    if (roomState) {
      getSocket()?.emit("leave-room", { roomCode: roomState.roomCode });
    }

    setRoomState(null);
    clearMultiplayerSession();
    setErrorMessage(null);
    setCopied(false);
    setIsCreatingRoom(false);
    setIsJoiningRoom(false);
    setIsSendingReady(false);
  };

  const copyRoomCode = async () => {
    if (!roomCode) {
      return;
    }

    await navigator.clipboard.writeText(roomCode);
    playSfx("ui");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <section className="relative z-10 min-h-screen overflow-x-hidden px-4 py-6 sm:px-5 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
        <div className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="theme-panel rounded-4xl p-5 backdrop-blur-md sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={isInRoom ? leaveRoom : onBack}
                className="theme-button-secondary inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm transition"
              >
                <ArrowLeft className="h-4 w-4" />
                {isInRoom ? lobby.leave : lobby.menu}
              </button>
              <div className="theme-chip inline-flex max-w-full items-center gap-2 rounded-full px-4 py-2 text-[0.65rem] tracking-[0.16em] sm:text-xs sm:tracking-[0.22em]">
                <Radio className="h-4 w-4" />
                {statusLabel}
              </div>
            </div>

            <p className="mt-8 text-xs tracking-[0.35em] text-(--text-muted)">SPELEUM</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-widest text-(--text-primary) sm:text-4xl sm:tracking-[0.12em]">
              {lobby.title}
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-(--text-secondary)">
              {formatMessage(lobby.description, { min: MIN_ROOM_PLAYERS, max: MAX_ROOM_PLAYERS })}
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <label className="theme-card block rounded-[1.4rem] p-4">
                <span className="text-xs tracking-[0.22em] text-(--text-muted)">{lobby.temporaryName}</span>
                <input
                  value={playerName}
                  onChange={(event) => setPlayerName(event.target.value)}
                  maxLength={18}
                  className="mt-3 w-full bg-transparent text-lg text-(--text-primary) outline-none"
                  placeholder={lobby.explorer}
                />
              </label>

              <div className="theme-card rounded-[1.4rem] p-4">
                <span className="text-xs tracking-[0.22em] text-(--text-muted)">{lobby.creature}</span>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-zinc-100/90">
                    <Image
                      src={selectedCharacter.imageGame}
                      alt={localizedCharacter.name}
                      width={36}
                      height={36}
                      className="h-9 w-9 object-contain"
                    />
                  </div>
                  <div>
                    <p className="text-lg text-(--text-primary)">{localizedCharacter.name}</p>
                    <p className="mt-1 text-sm text-(--text-muted)">{localizedCharacter.role}</p>
                  </div>
                </div>
              </div>
            </div>

            {!isInRoom && (
              <div className="mt-8 grid gap-4 lg:grid-cols-2">
                <button
                  type="button"
                  onClick={submitCreate}
                  disabled={!multiplayerAvailable || serviceState !== "ready" || isCreatingRoom || isJoiningRoom}
                  className="theme-button-primary min-h-32 rounded-3xl px-6 py-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <p className="text-xs tracking-[0.24em] opacity-60">{lobby.create}</p>
                  <p className="mt-2 text-lg font-semibold">
                    {isCreatingRoom ? lobby.creating : lobby.openPrivate}
                  </p>
                </button>

                <div className="theme-card rounded-3xl p-4">
                  <p className="text-xs tracking-[0.24em] text-(--text-muted)">{lobby.join}</p>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                    <input
                      value={roomCodeInput}
                      onChange={(event) => setRoomCodeInput(normalizeRoomCode(event.target.value))}
                      aria-label={lobby.roomCode}
                      className="theme-input min-h-12 min-w-0 flex-1 rounded-full px-4 py-3 text-sm tracking-[0.3em]"
                      placeholder="ABC123"
                    />
                    <button
                      type="button"
                      onClick={submitJoin}
                      disabled={!multiplayerAvailable || serviceState !== "ready" || isCreatingRoom || isJoiningRoom}
                      className="theme-button-secondary min-h-12 rounded-full px-5 py-3 text-sm transition disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isJoiningRoom ? lobby.joining : lobby.enter}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {isInRoom && roomState && (
              <div className="theme-card-accent mt-8 rounded-[1.6rem] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs tracking-[0.24em] text-(--text-muted)">{lobby.roomCode}</p>
                    <p className="mt-2 break-all text-2xl font-semibold tracking-[0.24em] text-(--text-primary) sm:text-3xl sm:tracking-[0.34em]">
                      {roomCode}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={copyRoomCode}
                    className="theme-button-secondary inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm transition"
                  >
                    <Copy className="h-4 w-4" />
                    {copied ? lobby.copied : lobby.copy}
                  </button>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="theme-card rounded-[1.2rem] p-4">
                    <p className="text-xs tracking-[0.22em] text-(--text-muted)">{lobby.status}</p>
                    <p className="mt-2 text-sm text-(--text-secondary)">{statusLabel}</p>
                    {readyCountdownSeconds !== null && (
                      <p className="mt-2 text-xs text-(--text-muted)">
                        {formatMessage(lobby.readyWindow, { seconds: readyCountdownSeconds })}
                      </p>
                    )}
                    {startCountdownSeconds !== null && (
                      <p className="mt-2 text-xs text-(--text-muted)">
                        {formatMessage(lobby.startsIn, { seconds: startCountdownSeconds })}
                      </p>
                    )}
                  </div>
                  <div className="theme-card rounded-[1.2rem] p-4">
                    <p className="text-xs tracking-[0.22em] text-(--text-muted)">{lobby.players}</p>
                    <p className="mt-2 text-sm text-(--text-secondary)">
                      {formatMessage(lobby.connected, { current: roomState.connectedCount, max: maxPlayers })}
                    </p>
                    <p className="mt-2 text-xs text-(--text-muted)">
                      {formatMessage(lobby.confirmed, { ready: roomState.readyCount, connected: roomState.connectedCount })}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={markReady}
                  disabled={
                    roomState.self.isReady ||
                    roomState.connectedCount < requiredPlayers ||
                    isSendingReady ||
                    roomState.status === "starting" ||
                    roomState.status === "playing"
                  }
                  className="theme-button-primary mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  <Users className="h-4 w-4" />
                  {roomState.self.isReady
                    ? lobby.ready
                    : isSendingReady
                      ? lobby.confirming
                      : lobby.markReady}
                </button>
              </div>
            )}
          </div>

          <aside className="theme-panel rounded-4xl p-5 backdrop-blur-md sm:p-7">
            <p className="text-xs tracking-[0.3em] text-(--text-muted)">{lobby.summary}</p>
            <div className="mt-5 space-y-4 text-sm leading-7 text-(--text-secondary)">
              <p>{lobby.summaryVision}</p>
              <p>{lobby.summaryVisibility}</p>
              <p>{lobby.summaryMemory}</p>
              <p>{formatMessage(lobby.summaryCapacity, { min: MIN_ROOM_PLAYERS, max: MAX_ROOM_PLAYERS })}</p>
              <p>{lobby.summaryRealtime}</p>
              <p>{lobby.summaryWake}</p>
              <p>{lobby.summaryConfig}</p>
            </div>

            {errorMessage && (
              <div role="alert" className="theme-error mt-6 rounded-[1.4rem] p-4 text-sm">
                <p>{errorMessage}</p>
                {serviceState === "error" && multiplayerAvailable && (
                  <button
                    type="button"
                    onClick={() => void warmService()}
                    className="theme-button-secondary mt-3 min-h-10 rounded-full px-4 py-2"
                  >
                    {lobby.retry}
                  </button>
                )}
              </div>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}
