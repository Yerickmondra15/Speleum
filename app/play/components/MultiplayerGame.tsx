"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { ArrowLeft, Radio, Skull, Users } from "lucide-react";
import type { CharacterOption, GameStatus, PlayerPosition } from "../gameConfig";
import {
  MAX_HEALTH,
  MAX_SANITY,
  PLAYER_ATTACK_RANGE_TILES,
  TILE_SIZE,
  VISION_RADIUS,
  characterOptions,
} from "../gameConfig";
import { distanceBetween, getZoneForPosition } from "../gameLogic";
import type { MatchResultEntry, MultiplayerStatePayload } from "../types";
import { getCharacterName } from "../types";
import { ensureSocketConnection, getSocket, isSocketMultiplayerAvailable } from "@/lib/socket";
import { appendLocalRanking } from "@/lib/ranking";
import { useAuth } from "../../auth/AuthProvider";
import { ActionControls } from "./ActionControls";
import { GameHud } from "./GameHud";
import { GameMap } from "./GameMap";
import { GameOverlay } from "./GameOverlay";
import { RadarPanel } from "./RadarPanel";
import { buildTileMap, tileToWorld, worldToTile } from "../tileMap";

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
  const { user } = useAuth();
  const [gameState, setGameState] = useState<MultiplayerStatePayload | null>(null);
  const [socketConnected, setSocketConnected] = useState(() => getSocket()?.connected ?? false);
  const [message, setMessage] = useState(() =>
    isSocketMultiplayerAvailable()
      ? "Conectando con la sala..."
      : "Multiplayer experimental no disponible. Si NEXT_PUBLIC_SOCKET_URL no esta configurado, el multiplayer queda deshabilitado sin afectar /play local.",
  );
  const [activeAction, setActiveAction] = useState<"move" | "attack" | "defend">("move");
  const [disconnectedMessage, setDisconnectedMessage] = useState<string | null>(null);
  const [pendingMoveTarget, setPendingMoveTarget] = useState<PlayerPosition | null>(null);
  const rankingStoredRef = useRef(false);
  const resultSavedRef = useRef(false);

  useEffect(() => {
    const socket = ensureSocketConnection();

    if (!socket) {
      return;
    }

    const handleConnect = () => {
      setSocketConnected(true);
      setMessage("Conexion restablecida. Reanudando sincronizacion...");
    };
    const handleDisconnect = () => {
      setSocketConnected(false);
      setDisconnectedMessage("Reconectando con el servidor...");
      setMessage("Reconectando con el servidor...");
    };
    const handleGameState = (state: MultiplayerStatePayload) => {
      if (state.roomCode !== roomCode) {
        return;
      }

      setSocketConnected(true);
      setGameState(state);
      setMessage(state.message ?? "La cueva escucha todos tus movimientos.");
      if (pendingMoveTarget && distanceBetween(state.self.position, pendingMoveTarget) <= TILE_SIZE * 0.35) {
        setPendingMoveTarget(null);
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

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.io.off("reconnect_attempt", handleReconnectAttempt);
      socket.off("game-state", handleGameState);
      socket.off("player-left", handlePlayerLeft);
      socket.off("game-over", handleGameOver);
      socket.off("error-message", handleError);
    };
  }, [pendingMoveTarget, roomCode]);

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

    const selfResult = gameState.results.find((entry) => entry.playerId === gameState.self.id);

    if (!selfResult) {
      return;
    }

    const didWin = gameState.winnerId === gameState.self.id;
    const scoreEarned = Math.max(
      didWin ? 120 : 35,
      didWin ? 120 + selfResult.kills * 20 : 20 + selfResult.kills * 10,
    );

    resultSavedRef.current = true;
    void fetch("/api/matches/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId,
        mode: "multiplayer",
        status: gameState.status,
        winnerId: didWin ? user?.id ?? null : null,
        startedAt: new Date(
          Date.now() - Math.max(...gameState.results.map((entry) => entry.survivedMs)),
        ).toISOString(),
        endedAt: new Date().toISOString(),
        creature: selectedCharacter.id,
        result: didWin ? "win" : "loss",
        scoreEarned,
      }),
    }).catch(() => {
      resultSavedRef.current = false;
    });
  }, [gameState, matchId, selectedCharacter.id, user?.id]);

  const self = gameState?.self ?? null;
  const player = useMemo(() => self?.position ?? { x: 0, y: 0 }, [self?.position]);
  const enemy = gameState?.enemy ?? null;
  const caveTiles = useMemo(() => (gameState ? buildTileMap(gameState.cave) : []), [gameState]);
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
        : "Sobrevive, conserva la cordura y conviertete en la ultima criatura viva.";

  const health = self?.combat.health ?? MAX_HEALTH;
  const sanity = self?.combat.sanity ?? MAX_SANITY;
  const moveCooldownRemaining = self?.combat.moveCooldownRemaining ?? 0;
  const attackCooldownRemaining = self?.combat.attackCooldownRemaining ?? 0;
  const parryCooldownRemaining = self?.combat.parryCooldownRemaining ?? 0;
  const isParrying = Boolean(self?.combat.isParrying);
  const isStunned = Boolean(self?.combat.isStunned);
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
    setPendingMoveTarget(target);
    setActiveAction("move");
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
    } else if (event.key === " ") {
      event.preventDefault();
      handleAttack();
    } else if (event.key.toLowerCase() === "shift") {
      event.preventDefault();
      handleDefend();
    }

    if (target) {
      emitMoveTarget(target);
    }
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => onKeyDown(event);
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleMoveIntent = (target: PlayerPosition) => {
    if (moveCooldownRemaining > 0 || isStunned) {
      setMessage(isStunned ? "Estas aturdido." : "Tu criatura aun recupera el impulso.");
      return;
    }

    emitMoveTarget(target);
    setMessage("Avanzas por tiles con el mismo pulso del modo local.");
  };

  function handleAttack() {
    if (gameStatus !== "playing" || attackCooldownRemaining > 0 || isStunned) {
      return;
    }

    const socket = getSocket();

    if (!socket) {
      setMessage("Multiplayer experimental no disponible. Si NEXT_PUBLIC_SOCKET_URL no esta configurado, el multiplayer queda deshabilitado sin afectar /play local.");
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
      setMessage("Multiplayer experimental no disponible. Si NEXT_PUBLIC_SOCKET_URL no esta configurado, el multiplayer queda deshabilitado sin afectar /play local.");
      return;
    }

    socket.emit("player-defend", { roomCode });
    setActiveAction("defend");
    setMessage("Abres una ventana corta de parry.");
  };

  const handleExit = () => {
    getSocket()?.emit("leave-room", { roomCode });
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
        <div className="rounded-[1.8rem] border border-white/10 bg-black/45 px-6 py-5 text-sm text-zinc-300 backdrop-blur-md">
          Conectando a la sala {roomCode}...
        </div>
      </section>
    );
  }

  return (
    <section className="relative z-10 min-h-screen overflow-hidden">
      <header className="pointer-events-none absolute inset-x-0 top-0 z-70 flex items-start justify-between gap-2 px-3 py-3 sm:px-4 sm:py-4">
        <button
          type="button"
          onClick={handleExit}
          className="pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-black/55 px-4 py-2 text-sm text-zinc-300 backdrop-blur-md transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Menu
        </button>

        <div className="rounded-full border border-white/10 bg-black/45 px-3 py-2 text-center backdrop-blur-md sm:px-5">
          <p className="text-[0.65rem] tracking-[0.34em] text-zinc-500">SALA</p>
          <h1 className="text-[0.8rem] font-semibold tracking-[0.16em] text-white sm:text-sm sm:tracking-[0.28em]">{roomCode}</h1>
        </div>

        <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-black/45 px-4 py-2 text-xs text-zinc-400 backdrop-blur-md sm:flex">
          <Users className="h-4 w-4" />
          {selectedCharacter.name}
        </div>
      </header>

      <GameMap
        player={player}
        playerCharacterId={selectedCharacter.id}
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
        onChooseDestination={handleMoveIntent}
      />

      <GameHud
        selectedCharacter={selectedCharacter}
        zone={currentZone}
        objective={objective}
        message={message}
        zoneMessage={disconnectedMessage}
        health={health}
        maxHealth={MAX_HEALTH}
        sanity={sanity}
        maxSanity={MAX_SANITY}
        aliveCount={gameState.aliveCount}
        enemyStateLabel={`rivales ${gameState.otherPlayers.length} · ecos ${gameState.enemies.length}`}
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

      <div className="absolute bottom-28 right-3 z-70 w-40 max-w-[calc(100vw-1.5rem)] sm:right-4 sm:top-24 sm:bottom-auto sm:w-64 sm:max-w-[calc(100vw-2rem)]">
        <RadarPanel
          player={player}
          signals={gameState.signals}
          moveCooldownRemaining={moveCooldownRemaining}
        />
      </div>

      <div className="pointer-events-none absolute right-4 top-88 z-70 hidden max-w-xs rounded-[1.25rem] border border-white/10 bg-black/45 p-4 text-sm text-zinc-300 backdrop-blur-md lg:block">
        <p className="text-xs tracking-[0.25em] text-zinc-500">CADENA DE VIDA</p>
        <p className="mt-2">Conexion: {socketConnected ? "estable" : "reconectando"}</p>
        <p className="mt-2">Criaturas en sala: {gameState.playerCount}/{gameState.maxPlayers}</p>
        <p className="mt-2">Ultimos vivos: {gameState.aliveCount}</p>
        <p className="mt-2">Punto cercano: {nearestPoint?.label ?? currentZone.name}</p>
        <p className="mt-2">Vision: 8 casillas alrededor.</p>
        <p className="mt-2">Quietud: {self.combat.threatLevel}</p>
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
