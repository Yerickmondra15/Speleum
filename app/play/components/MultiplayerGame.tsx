"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { ArrowLeft, Radio, Skull } from "lucide-react";
import type { CharacterOption, GameStatus, PlayerPosition } from "../gameConfig";
import {
  MAX_ROOM_PLAYERS,
  PLAYER_ATTACK_RANGE_TILES,
  TILE_SIZE,
  VISION_RADIUS,
  characterOptions,
} from "../gameConfig";
import { distanceBetween, getZoneForPosition, planMovementPath } from "../gameLogic";
import type { MatchResultEntry, MultiplayerStatePayload } from "../types";
import { getCharacterName } from "../types";
import { getSocket, isSocketMultiplayerAvailable } from "@/lib/socket";
import { appendLocalRanking } from "@/lib/ranking";
import {
  clearMultiplayerSession,
  multiplayerSessionFromState,
  writeMultiplayerSession,
} from "@/lib/multiplayer/client-session";
import type { ResumeRoomResult } from "@/lib/multiplayer/events";
import { ActionControls } from "./ActionControls";
import { GameHud } from "./GameHud";
import { GameMap } from "./GameMap";
import { GameOverlay } from "./GameOverlay";
import { GameTopControls } from "./GameTopControls";
import { RadarPanel } from "./RadarPanel";
import { buildTileMap, createTileLookup, findReachableTiles, tileToWorld, worldToTile } from "../tileMap";
import { getCreatureGameplayModifiers } from "@/lib/creature-gameplay";

type MultiplayerGameProps = {
  matchId: string;
  roomCode: string;
  selectedCharacter: CharacterOption;
  onExitToMenu: () => void;
};

function ResultsTable({ results }: { results: MatchResultEntry[] }) {
  if (results.length === 0) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-[1.2rem] border border-white/10 bg-black/35">
      <div className="grid grid-cols-[4rem_1fr_4rem] gap-3 border-b border-white/10 px-4 py-3 text-left text-[0.65rem] tracking-[0.24em] text-zinc-500">
        <span>PUESTO</span>
        <span>CRIATURA</span>
        <span>KILLS</span>
      </div>
      {results.map((entry) => (
        <div
          key={entry.playerId}
          className="grid grid-cols-[4rem_1fr_4rem] gap-3 px-4 py-3 text-sm text-zinc-200"
        >
          <span>#{entry.placement}</span>
          <span>{entry.name}</span>
          <span>{entry.kills}</span>
        </div>
      ))}
    </div>
  );
}

export function MultiplayerGame({
  matchId,
  roomCode,
  selectedCharacter,
  onExitToMenu,
}: MultiplayerGameProps) {
  const [gameState, setGameState] = useState<MultiplayerStatePayload | null>(null);
  const authoritativeCharacter = useMemo(
    () =>
      characterOptions.find((character) => character.id === gameState?.self.characterId) ??
      selectedCharacter,
    [gameState?.self.characterId, selectedCharacter],
  );
  const creatureModifiers = getCreatureGameplayModifiers(authoritativeCharacter.id);
  const [socketConnected, setSocketConnected] = useState(() => getSocket()?.connected ?? false);
  const [message, setMessage] = useState(() =>
    isSocketMultiplayerAvailable()
      ? "Conectando con la sala..."
      : "El modo multijugador necesita una URL de Socket.IO para habilitar salas en tiempo real.",
  );
  const [activeAction, setActiveAction] = useState<"move" | "attack" | "defend">("move");
  const [isUiHidden, setIsUiHidden] = useState(false);
  const [disconnectedMessage, setDisconnectedMessage] = useState<string | null>(null);
  const [resumeFailure, setResumeFailure] = useState<{
    message: string;
    terminal: boolean;
  } | null>(null);
  const [pendingMoveTarget, setPendingMoveTarget] = useState<PlayerPosition | null>(null);
  const [pathPreview, setPathPreview] = useState<PlayerPosition[]>([]);
  const pendingMoveTargetRef = useRef<PlayerPosition | null>(null);
  const resumeAttemptRef = useRef(0);
  const resumeTimeoutRef = useRef<number | null>(null);
  const rankingStoredRef = useRef(false);
  const resultSavedRef = useRef(false);

  const requestResume = useCallback(() => {
    const socket = getSocket();

    if (!socket) {
      const nextMessage = "No hay un servidor multijugador disponible para restaurar la sesion.";
      setSocketConnected(false);
      setResumeFailure({ message: nextMessage, terminal: false });
      setDisconnectedMessage(nextMessage);
      setMessage(nextMessage);
      return;
    }

    if (!socket.connected) {
      setSocketConnected(false);
      setResumeFailure(null);
      setDisconnectedMessage("Reconectando con el servidor...");
      setMessage("Reconectando con el servidor...");
      if (!socket.active) {
        socket.connect();
      }
      return;
    }

    if (resumeTimeoutRef.current !== null) {
      window.clearTimeout(resumeTimeoutRef.current);
    }

    const attempt = resumeAttemptRef.current + 1;
    resumeAttemptRef.current = attempt;
    setResumeFailure(null);
    setMessage("Conexion restablecida. Validando tu sesion...");

    resumeTimeoutRef.current = window.setTimeout(() => {
      if (resumeAttemptRef.current !== attempt) {
        return;
      }

      const nextMessage = "El servidor no confirmo la restauracion. Puedes intentarlo de nuevo.";
      setResumeFailure({ message: nextMessage, terminal: false });
      setDisconnectedMessage(nextMessage);
      setMessage(nextMessage);
    }, 5_000);

    socket.emit("resume-room", { roomCode }, (result: ResumeRoomResult) => {
      if (resumeAttemptRef.current !== attempt) {
        return;
      }

      if (resumeTimeoutRef.current !== null) {
        window.clearTimeout(resumeTimeoutRef.current);
        resumeTimeoutRef.current = null;
      }

      if (!result.ok) {
        setResumeFailure({ message: result.message, terminal: result.terminal });
        setDisconnectedMessage(result.message);
        setMessage(result.message);

        if (result.terminal) {
          clearMultiplayerSession();
          pendingMoveTargetRef.current = null;
          setPendingMoveTarget(null);
          setPathPreview([]);
          setGameState(null);
        }
        return;
      }

      if (result.roomCode !== roomCode || result.matchId !== matchId) {
        const nextMessage = "La sesion guardada ya no corresponde a esta partida.";
        clearMultiplayerSession();
        setResumeFailure({ message: nextMessage, terminal: true });
        setDisconnectedMessage(nextMessage);
        setMessage(nextMessage);
        setGameState(null);
        return;
      }

      setSocketConnected(true);
      setResumeFailure(null);
      setDisconnectedMessage(null);
      setMessage("Sesion restaurada. Sincronizando el estado de la cueva...");
    });
  }, [matchId, roomCode]);

  useEffect(() => {
    const socket = getSocket();
    let initialResumeTimer: number | null = null;

    if (!socket) {
      return;
    }

    const handleConnect = () => {
      setSocketConnected(true);
      setMessage("Conexion restablecida. Reanudando sincronizacion...");
      requestResume();
    };
    const handleDisconnect = () => {
      setSocketConnected(false);
      setDisconnectedMessage("Reconectando con el servidor...");
      setMessage("Reconectando con el servidor...");
    };
    const handleGameState = (state: MultiplayerStatePayload) => {
      if (state.roomCode !== roomCode || state.matchId !== matchId) {
        return;
      }

      setSocketConnected(true);
      writeMultiplayerSession(multiplayerSessionFromState(state));
      setGameState(state);
      setResumeFailure(null);
      setDisconnectedMessage(null);
      setMessage(state.message ?? "La cueva escucha todos tus movimientos.");
      const pendingMoveTarget = pendingMoveTargetRef.current;
      if (pendingMoveTarget && distanceBetween(state.self.position, pendingMoveTarget) <= TILE_SIZE * 0.35) {
        pendingMoveTargetRef.current = null;
        setPendingMoveTarget(null);
        setPathPreview([]);
      }
    };
    const handlePlayerLeft = (payload: { roomCode?: string; message?: string }) => {
      if (payload.roomCode !== roomCode) {
        return;
      }

      setDisconnectedMessage(payload.message ?? "Una criatura desaparecio en la oscuridad.");
      setMessage(payload.message ?? "Una criatura desaparecio en la oscuridad.");
    };
    const handleGameOver = (payload: { message?: string }) => {
      setMessage(payload.message ?? "La partida termino.");
    };
    const handleError = (nextMessage: string) => {
      pendingMoveTargetRef.current = null;
      setPendingMoveTarget(null);
      setPathPreview([]);
      setMessage(nextMessage);
    };
    const handleConnectError = () => {
      setSocketConnected(false);
      setDisconnectedMessage("El servidor puede tardar unos segundos en despertar.");
      setMessage("El servidor puede tardar unos segundos en despertar.");
    };
    const handleReconnectAttempt = () => {
      setSocketConnected(false);
      setDisconnectedMessage("Reconectando con el servidor...");
      setMessage("Reconectando con el servidor...");
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.io.on("reconnect_attempt", handleReconnectAttempt);
    socket.on("game-state", handleGameState);
    socket.on("player-left", handlePlayerLeft);
    socket.on("game-over", handleGameOver);
    socket.on("error-message", handleError);

    if (socket.connected) {
      initialResumeTimer = window.setTimeout(requestResume, 0);
    } else {
      socket.connect();
    }

    return () => {
      if (initialResumeTimer !== null) {
        window.clearTimeout(initialResumeTimer);
      }
      resumeAttemptRef.current += 1;
      if (resumeTimeoutRef.current !== null) {
        window.clearTimeout(resumeTimeoutRef.current);
        resumeTimeoutRef.current = null;
      }
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.io.off("reconnect_attempt", handleReconnectAttempt);
      socket.off("game-state", handleGameState);
      socket.off("player-left", handlePlayerLeft);
      socket.off("game-over", handleGameOver);
      socket.off("error-message", handleError);
    };
  }, [matchId, requestResume, roomCode]);

  useEffect(() => {
    if (!gameState || gameState.status !== "finished" || rankingStoredRef.current) {
      return;
    }

    const winner = gameState.results[0];

    if (!winner) {
      return;
    }

    appendLocalRanking({
      id: `${gameState.roomCode}-${Date.now()}`,
      recordedAt: new Date().toISOString(),
      winnerName: winner.name,
      winnerCharacterId: winner.characterId,
      roomCode: gameState.roomCode,
      totalPlayers: gameState.results.length,
      durationMs: Math.max(...gameState.results.map((entry) => entry.survivedMs)),
      standings: gameState.results,
    });
    rankingStoredRef.current = true;
  }, [gameState]);

  useEffect(() => {
    if (!gameState || gameState.status !== "finished" || resultSavedRef.current) {
      return;
    }

    if (!gameState.resultReceipt) {
      return;
    }

    resultSavedRef.current = true;
    void fetch("/api/matches/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "multiplayer", receipt: gameState.resultReceipt }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("RESULT_NOT_SAVED");
        }
      })
      .catch(() => {
        resultSavedRef.current = false;
        setMessage("La partida termino, pero el resultado aun no pudo guardarse.");
      });
  }, [gameState]);

  const self = gameState?.self ?? null;
  const maxPlayers = gameState?.maxPlayers ?? MAX_ROOM_PLAYERS;
  const player = useMemo(() => self?.position ?? { x: 0, y: 0 }, [self?.position]);
  const enemy = gameState?.enemy ?? null;
  const caveTiles = useMemo(() => (gameState ? buildTileMap(gameState.cave) : []), [gameState]);
  const tileLookup = useMemo(() => createTileLookup(caveTiles), [caveTiles]);
  const currentZone = useMemo(() => {
    if (!gameState) {
      return {
        id: "loading-zone",
        name: "Cargando cueva",
        subtitle: "Sincronizando",
        tone: "safe" as const,
        x: 0,
        y: 0,
        width: TILE_SIZE,
        height: TILE_SIZE,
        ambient: "Esperando datos de la sala.",
        pressure: 0,
      };
    }

    return getZoneForPosition(player, gameState.cave.zones);
  }, [gameState, player]);

  const gameStatus: GameStatus =
    self?.status === "won"
      ? "won"
      : self?.status === "lost" || self?.status === "left"
        ? "lost"
        : "playing";

  const objective =
    gameStatus === "won"
      ? "Eres la ultima criatura viva."
      : gameStatus === "lost"
        ? "La cadena de la vida continuo sin ti."
        : "Sobrevive y conviertete en la ultima criatura viva.";

  const health = self?.combat.health ?? creatureModifiers.maxHealth;
  const moveCooldownRemaining = self?.combat.moveCooldownRemaining ?? 0;
  const attackCooldownRemaining = self?.combat.attackCooldownRemaining ?? 0;
  const parryCooldownRemaining = self?.combat.parryCooldownRemaining ?? 0;
  const isParrying = Boolean(self?.combat.isParrying);
  const isStunned = Boolean(self?.combat.isStunned);
  const reachableTiles = useMemo(
    () => (self ? findReachableTiles(worldToTile(self.position), creatureModifiers.moveRangeTiles, tileLookup) : new Map()),
    [creatureModifiers.moveRangeTiles, self, tileLookup],
  );
  const attackableTiles = useMemo(
    () => (self ? findReachableTiles(worldToTile(self.position), PLAYER_ATTACK_RANGE_TILES, tileLookup) : new Map()),
    [self, tileLookup],
  );
  const isMoveReady = gameStatus === "playing" && moveCooldownRemaining <= 0 && !isStunned;
  const nearestThreatTiles = enemy
    ? Math.max(1, Math.round(distanceBetween(player, enemy) / TILE_SIZE))
    : null;

  const nearestPoint = useMemo(() => {
    return (gameState?.cave.pointsOfInterest ?? [])
      .map((point) => ({
        ...point,
        distance: Math.round(Math.hypot(player.x - point.x, player.y - point.y)),
      }))
      .sort((a, b) => a.distance - b.distance)[0];
  }, [gameState?.cave.pointsOfInterest, player]);

  const otherPlayersSummary = (gameState?.otherPlayers ?? []).map((otherPlayer) => ({
    id: otherPlayer.id,
    name: otherPlayer.name,
    health: otherPlayer.combat.health,
    maxHealth: otherPlayer.combat.maxHealth,
    isParrying: otherPlayer.combat.isParrying,
    isStunned: otherPlayer.combat.isStunned,
  }));

  const emitMoveTarget = (target: PlayerPosition) => {
    const socket = getSocket();

    if (!socket || !socket.connected) {
      return;
    }

    socket.emit("player-move", { roomCode, target });
    pendingMoveTargetRef.current = target;
    setPendingMoveTarget(target);
    setActiveAction("move");
  };

  const queueMovementTo = (target: PlayerPosition) => {
    if (!self || !isMoveReady) {
      setMessage(isStunned ? "Estas aturdido." : "Tu criatura aun recupera el impulso.");
      return;
    }

    const movePlan = planMovementPath(
      self.position,
      target,
      creatureModifiers.moveRangeTiles,
      tileLookup,
      authoritativeCharacter.moveCooldownMultiplier,
    );

    if (!movePlan) {
      setPathPreview([]);
      setMessage("No hay una ruta caminable hacia esa celda.");
      return;
    }

    setPathPreview(movePlan.worldPath);
    emitMoveTarget(tileToWorld(movePlan.targetTile));
    setMessage(
      movePlan.distanceTiles === 1
        ? "Avanzas con cuidado una casilla."
        : `Te deslizas ${movePlan.distanceTiles} casillas por la cueva.`,
    );
  };

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.repeat || !self || gameStatus !== "playing" || moveCooldownRemaining > 0 || isStunned) {
      return;
    }

    const tile = worldToTile(self.position);
    let target: PlayerPosition | null = null;

    if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") {
      event.preventDefault();
      target = tileToWorld({ ...tile, row: tile.row - 1 });
    } else if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") {
      event.preventDefault();
      target = tileToWorld({ ...tile, row: tile.row + 1 });
    } else if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
      event.preventDefault();
      target = tileToWorld({ ...tile, col: tile.col - 1 });
    } else if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
      event.preventDefault();
      target = tileToWorld({ ...tile, col: tile.col + 1 });
    } else if (event.key === " " || event.key.toLowerCase() === "e") {
      event.preventDefault();
      handleAttack();
    } else if (event.key.toLowerCase() === "shift" || event.key.toLowerCase() === "q") {
      event.preventDefault();
      handleDefend();
    }

    if (target) {
      queueMovementTo(target);
    }
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => onKeyDown(event);
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleMoveIntent = (target: PlayerPosition) => {
    queueMovementTo(target);
  };

  function handleAttack() {
    if (gameStatus !== "playing" || attackCooldownRemaining > 0 || isStunned) {
      return;
    }

    const socket = getSocket();

    if (!socket) {
      setMessage("El modo multijugador necesita una URL de Socket.IO para enviar ataques en tiempo real.");
      return;
    }

    socket.emit("player-attack", { roomCode });
    setActiveAction("attack");
    setMessage("Lanzas un ataque tactico dentro del rango valido.");
  }

  const handleDefend = () => {
    if (gameStatus !== "playing" || parryCooldownRemaining > 0 || isStunned) {
      return;
    }

    const socket = getSocket();

    if (!socket) {
      setMessage("El modo multijugador necesita una URL de Socket.IO para activar defensa en tiempo real.");
      return;
    }

    socket.emit("player-defend", { roomCode });
    setActiveAction("defend");
    setMessage("Abres una ventana corta de parry.");
  };

  const handleExit = () => {
    getSocket()?.emit("leave-room", { roomCode });
    clearMultiplayerSession();
    onExitToMenu();
  };

  const overlaySummary = gameState ? (
    <div className="space-y-4">
      <div className="rounded-[1.1rem] border border-white/10 bg-black/35 px-4 py-3 text-left text-sm text-zinc-300">
        <p>
          Sala <span className="text-white">{roomCode}</span>
        </p>
        <p className="mt-1">
          Supervivientes finales: <span className="text-white">{gameState.aliveCount}</span>
        </p>
      </div>
      <ResultsTable results={gameState.results} />
    </div>
  ) : null;

  if (!gameState || !self) {
    return (
      <section className="relative z-10 flex min-h-screen items-center justify-center px-5 text-white">
        <div className="max-w-md rounded-[1.8rem] border border-white/10 bg-black/45 px-6 py-5 text-sm text-zinc-300 backdrop-blur-md">
          <p>{resumeFailure?.message ?? `Conectando a la sala ${roomCode}...`}</p>
          {resumeFailure && (
            <div className="mt-4 flex flex-wrap gap-3">
              {!resumeFailure.terminal && (
                <button
                  type="button"
                  onClick={requestResume}
                  className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-cyan-100"
                >
                  Reintentar
                </button>
              )}
              <button
                type="button"
                onClick={handleExit}
                className="rounded-full border border-white/15 px-4 py-2 text-zinc-200"
              >
                Volver al menu
              </button>
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="relative z-10 h-dvh min-h-dvh overflow-hidden overscroll-none">
      <header
        className="pointer-events-none absolute inset-x-0 top-0 z-70 flex items-start justify-between gap-1.5 px-2 pb-2 sm:gap-2 sm:px-4 sm:py-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.4rem)" }}
      >
        <button
          type="button"
          onClick={handleExit}
          className="pointer-events-auto inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/10 bg-black/55 px-3 py-2 text-[0.72rem] text-zinc-300 backdrop-blur-md transition hover:text-white sm:min-h-11 sm:gap-2 sm:px-4 sm:text-sm"
          aria-label="Volver al menú"
        >
          <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Menu
        </button>

        {!isUiHidden && (
          <div className="min-w-0 max-w-[7.5rem] rounded-full border border-white/10 bg-black/45 px-2.5 py-1.5 text-center backdrop-blur-md sm:max-w-none sm:px-5 sm:py-2">
            <p className="truncate text-[0.52rem] tracking-[0.2em] text-zinc-500 sm:text-[0.65rem] sm:tracking-[0.34em]">SALA</p>
            <h1 className="truncate text-[0.68rem] font-semibold tracking-[0.08em] text-white sm:text-sm sm:tracking-[0.28em]">{roomCode}</h1>
          </div>
        )}

        <div className="flex items-start gap-2">
          <GameTopControls
            isUiHidden={isUiHidden}
            onToggleUi={() => setIsUiHidden((current) => !current)}
          />
        </div>
      </header>

      <GameMap
        player={player}
        playerCharacterId={authoritativeCharacter.id}
        enemy={enemy}
        enemies={gameState.enemies}
        otherPlayers={gameState.otherPlayers}
        signals={gameState.signals}
        activeAction={activeAction}
        isDefending={isParrying}
        currentZone={currentZone}
        gameStatus={gameStatus}
        visionRadius={VISION_RADIUS}
        tiles={caveTiles}
        reachableTiles={reachableTiles}
        attackableTiles={attackableTiles}
        selectedPath={pathPreview}
        isMoveReady={isMoveReady}
        onChooseDestination={handleMoveIntent}
      />

      {!isUiHidden && (
        <GameHud
          selectedCharacter={authoritativeCharacter}
          zone={currentZone}
          objective={objective}
          message={message}
          zoneMessage={disconnectedMessage}
          health={health}
          maxHealth={self.combat.maxHealth}
          aliveCount={gameState.aliveCount}
          enemyStateLabel={`rivales ${gameState.otherPlayers.length} / ecos ${gameState.enemies.length}`}
          isPaused={false}
          parryActive={isParrying}
          isStunned={isStunned}
          moveCooldownRemaining={moveCooldownRemaining}
          attackCooldownRemaining={attackCooldownRemaining}
          parryCooldownRemaining={parryCooldownRemaining}
          parryWindowRemaining={self.combat.parryWindowRemaining}
          stunRemaining={self.combat.stunRemaining}
          nearestThreatTiles={nearestThreatTiles}
          nearbyDangerLabel={
            enemy?.state === "attacking"
              ? "alto"
              : enemy?.state === "chasing" || enemy?.state === "investigating"
                ? "medio"
                : "bajo"
          }
          detectedEnemies={gameState.enemies.length}
          attackRangeLabel={`${PLAYER_ATTACK_RANGE_TILES} casillas`}
          otherPlayersSummary={otherPlayersSummary}
        />
      )}

      {!isUiHidden && (
        <div
          className="absolute bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] right-2 z-70 w-28 max-w-[calc(100vw-1rem)] sm:right-4 sm:top-24 sm:bottom-auto sm:w-64 sm:max-w-[calc(100vw-2rem)]"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.5rem)" }}
        >
          <RadarPanel
            player={player}
            signals={gameState.signals}
            moveCooldownRemaining={moveCooldownRemaining}
            rangeTiles={creatureModifiers.radarRangeTiles}
          />
        </div>
      )}

      {!isUiHidden && (
        <div className="pointer-events-none absolute right-4 top-88 z-70 hidden max-w-xs rounded-[1.25rem] border border-white/10 bg-black/45 p-4 text-sm text-zinc-300 backdrop-blur-md lg:block">
          <p className="text-xs tracking-[0.25em] text-zinc-500">CADENA DE VIDA</p>
          <p className="mt-2">Conexion: {socketConnected ? "estable" : "reconectando"}</p>
          <p className="mt-2">Criaturas en sala: {gameState.playerCount}/{maxPlayers}</p>
          <p className="mt-2">Ultimos vivos: {gameState.aliveCount}</p>
          <p className="mt-2">Punto cercano: {nearestPoint?.label ?? currentZone.name}</p>
          <p className="mt-2">Vision: 8 casillas alrededor.</p>
          <div className="mt-3 inline-flex items-center gap-2 text-xs tracking-[0.2em] text-cyan-100">
            <Radio className="h-4 w-4" />
            {self.combat.kills} bajas
          </div>
          {pendingMoveTarget && (
            <p className="mt-2 text-xs text-zinc-500">
              Trayecto pendiente hacia {worldToTile(pendingMoveTarget).col},{worldToTile(pendingMoveTarget).row}
            </p>
          )}
        </div>
      )}

      {!isUiHidden && (
        <div className="absolute bottom-28 left-4 z-70 hidden w-88 rounded-[1.25rem] border border-white/10 bg-black/45 p-4 text-sm text-zinc-300 backdrop-blur-md xl:block">
          <div className="flex items-center justify-between">
            <p className="text-xs tracking-[0.25em] text-zinc-500">RESULTADOS PARCIALES</p>
            <Skull className="h-4 w-4 text-zinc-500" />
          </div>
          <div className="mt-4 space-y-3">
            {gameState.results.slice(0, 4).map((entry) => (
              <div
                key={entry.playerId}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-black/35 px-3 py-2"
              >
                <div>
                  <p className="text-sm text-white">
                    #{entry.placement} {entry.name}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {getCharacterName(characterOptions, entry.characterId)}
                  </p>
                </div>
                <div className="text-right text-xs text-zinc-400">
                  <p>{entry.kills} kills</p>
                  <p>{entry.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isUiHidden && (
        <ActionControls
          activeAction={activeAction}
          cooldownRemaining={attackCooldownRemaining}
          moveCooldownRemaining={moveCooldownRemaining}
          parryCooldownRemaining={parryCooldownRemaining}
          isRecovering={attackCooldownRemaining > 0 || isStunned}
          isParrying={isParrying}
          onMove={() => setActiveAction("move")}
          onAttack={handleAttack}
          onDefend={handleDefend}
        />
      )}

      <GameOverlay
        status={gameStatus}
        onRestart={() => window.location.reload()}
        onExitToMenu={handleExit}
        titleOverride={gameStatus === "won" ? "Ultima Criatura Viva" : "Eliminado"}
        messageOverride={
          gameStatus === "won"
            ? "Dominaste la cueva y cerraste la cadena de la vida a tu favor."
            : "Tu criatura cayo. La oscuridad sigue reclamando al resto."
        }
        buttonLabelOverride="Volver a jugar"
        summary={overlaySummary}
      />
    </section>
  );
}
