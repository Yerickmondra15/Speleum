"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { ActionKind, CharacterOption, GameStatus, PlayerPosition } from "../gameConfig";
import {
  PLAYER_ATTACK_RANGE_TILES,
  TILE_SIZE,
  VISION_RADIUS,
  characterOptions,
} from "../gameConfig";
import { distanceBetween, getZoneForPosition, planMovementPath } from "../gameLogic";
import type { MatchResultEntry, MultiplayerStatePayload } from "../types";
import { getSocket, isSocketMultiplayerAvailable } from "@/lib/socket";
import { appendLocalMatchSnapshot } from "@/lib/local-match-history";
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
import { terrainNameAt } from "@/lib/gameplay/survival";
import {
  saveMatchResultRequest,
  type MatchResultSaveStatus,
} from "@/lib/matches/client-result-persistence";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { formatMessage } from "@/lib/i18n/messages";
import { getLocalizedAbilityName, translateMultiplayerMessage } from "@/lib/i18n/content";
import { useAudio } from "@/lib/audio/AudioProvider";
import { SpeleumBrand } from "@/app/components/SpeleumBrand";

type MultiplayerGameProps = {
  matchId: string;
  roomCode: string;
  selectedCharacter: CharacterOption;
  onExitToMenu: () => void;
};

function ResultsTable({ results }: { results: MatchResultEntry[] }) {
  const { messages } = useLanguage();
  if (results.length === 0) {
    return null;
  }

  return (
    <div className="theme-card overflow-hidden rounded-[1.2rem]">
      <div className="grid grid-cols-[4rem_1fr_4rem] gap-3 border-b border-(--border-soft) px-4 py-3 text-left text-[0.65rem] tracking-[0.18em] text-(--text-muted)">
        <span>{messages.ranking.rank}</span>
        <span>{messages.ranking.player}</span>
        <span>{messages.play.hud.kills.toUpperCase()}</span>
      </div>
      {results.map((entry) => (
        <div
          key={entry.playerId}
          className="grid grid-cols-[4rem_1fr_4rem] gap-3 px-4 py-3 text-sm text-(--text-secondary)"
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
  const { locale, messages } = useLanguage();
  const gameCopy = messages.play.game;
  const lobby = messages.play.lobby;
  const { unlock, setAmbientActive, playSfx } = useAudio();
  const [gameState, setGameState] = useState<MultiplayerStatePayload | null>(null);
  const authoritativeCharacter = useMemo(
    () =>
      characterOptions.find((character) => character.id === gameState?.self.characterId) ??
      selectedCharacter,
    [gameState?.self.characterId, selectedCharacter],
  );
  const creatureModifiers = getCreatureGameplayModifiers(authoritativeCharacter.id);
  const [, setSocketConnected] = useState(() => getSocket()?.connected ?? false);
  const [message, setMessage] = useState<string>(() =>
    isSocketMultiplayerAvailable()
      ? formatMessage(gameCopy.connectingRoom, { room: roomCode })
      : lobby.unavailable,
  );
  const [activeAction, setActiveAction] = useState<ActionKind>("move");
  const [isUiHidden, setIsUiHidden] = useState(false);
  const [disconnectedMessage, setDisconnectedMessage] = useState<string | null>(null);
  const [resumeFailure, setResumeFailure] = useState<{
    message: string;
    terminal: boolean;
  } | null>(null);
  const [, setPendingMoveTarget] = useState<PlayerPosition | null>(null);
  const [pathPreview, setPathPreview] = useState<PlayerPosition[]>([]);
  const pendingMoveTargetRef = useRef<PlayerPosition | null>(null);
  const resumeAttemptRef = useRef(0);
  const resumeTimeoutRef = useRef<number | null>(null);
  const rankingStoredRef = useRef(false);
  const savedResultReceiptRef = useRef<string | null>(null);
  const [resultSaveState, setResultSaveState] = useState<{
    status: MatchResultSaveStatus;
    attempt: number;
    maxAttempts: number;
  }>({ status: "idle", attempt: 0, maxAttempts: 3 });
  const previousHealthRef = useRef<number | null>(null);
  const announcedResultRef = useRef<"won" | "lost" | null>(null);

  useEffect(() => {
    unlock();
    setAmbientActive(true);
    playSfx("start");
    return () => setAmbientActive(false);
  }, [playSfx, setAmbientActive, unlock]);

  useEffect(() => {
    const health = gameState?.self.combat.health;
    if (
      health !== undefined &&
      previousHealthRef.current !== null &&
      health < previousHealthRef.current
    ) {
      playSfx("damage");
    }
    if (health !== undefined) previousHealthRef.current = health;

    const result = gameState?.self.status;
    if ((result === "won" || result === "lost") && announcedResultRef.current !== result) {
      announcedResultRef.current = result;
      playSfx(result === "won" ? "victory" : "defeat");
    }
  }, [gameState?.self.combat.health, gameState?.self.status, playSfx]);

  const requestResume = useCallback(() => {
    const socket = getSocket();

    if (!socket) {
      const nextMessage = gameCopy.noRestoreServer;
      setSocketConnected(false);
      setResumeFailure({ message: nextMessage, terminal: false });
      setDisconnectedMessage(nextMessage);
      setMessage(nextMessage);
      return;
    }

    if (!socket.connected) {
      setSocketConnected(false);
      setResumeFailure(null);
      setDisconnectedMessage(lobby.reconnecting);
      setMessage(lobby.reconnecting);
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
    setMessage(gameCopy.connectionRestored);

    resumeTimeoutRef.current = window.setTimeout(() => {
      if (resumeAttemptRef.current !== attempt) {
        return;
      }

      const nextMessage = gameCopy.restoreTimeout;
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
        const localizedMessage = translateMultiplayerMessage(locale, result.message);
        setResumeFailure({ message: localizedMessage, terminal: result.terminal });
        setDisconnectedMessage(localizedMessage);
        setMessage(localizedMessage);

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
        const nextMessage = gameCopy.sessionMismatch;
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
      setMessage(gameCopy.sessionRestored);
    });
  }, [gameCopy, lobby.reconnecting, locale, matchId, roomCode]);

  useEffect(() => {
    const socket = getSocket();
    let initialResumeTimer: number | null = null;

    if (!socket) {
      return;
    }

    const handleConnect = () => {
      setSocketConnected(true);
      setMessage(gameCopy.resumingSync);
      requestResume();
    };
    const handleDisconnect = () => {
      setSocketConnected(false);
      setDisconnectedMessage(lobby.reconnecting);
      setMessage(lobby.reconnecting);
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
      setMessage(
        state.message
          ? translateMultiplayerMessage(locale, state.message)
          : gameCopy.caveListening,
      );
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

      const localizedMessage = payload.message
        ? translateMultiplayerMessage(locale, payload.message)
        : gameCopy.creatureGone;
      setDisconnectedMessage(localizedMessage);
      setMessage(localizedMessage);
    };
    const handleGameOver = (payload: { message?: string }) => {
      setMessage(
        payload.message
          ? translateMultiplayerMessage(locale, payload.message)
          : gameCopy.matchEnded,
      );
    };
    const handleError = (nextMessage: string) => {
      pendingMoveTargetRef.current = null;
      setPendingMoveTarget(null);
      setPathPreview([]);
      setMessage(translateMultiplayerMessage(locale, nextMessage));
    };
    const handleConnectError = () => {
      setSocketConnected(false);
      setDisconnectedMessage(lobby.waking);
      setMessage(lobby.waking);
    };
    const handleReconnectAttempt = () => {
      setSocketConnected(false);
      setDisconnectedMessage(lobby.reconnecting);
      setMessage(lobby.reconnecting);
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
  }, [gameCopy, lobby.reconnecting, lobby.waking, locale, matchId, requestResume, roomCode]);

  useEffect(() => {
    if (!gameState || gameState.status !== "finished" || rankingStoredRef.current) {
      return;
    }

    const winner = gameState.results[0];

    if (!winner) {
      return;
    }

    appendLocalMatchSnapshot({
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

  const finishedResultReceipt =
    gameState?.status === "finished" ? gameState.resultReceipt : null;

  useEffect(() => {
    if (!finishedResultReceipt || savedResultReceiptRef.current === finishedResultReceipt) {
      return;
    }

    const controller = new AbortController();
    setResultSaveState({ status: "saving", attempt: 0, maxAttempts: 3 });

    void saveMatchResultRequest(
      { mode: "multiplayer", receipt: finishedResultReceipt },
      {
        signal: controller.signal,
        maxAttempts: 3,
        onAttempt: (attempt, maxAttempts) => {
          setResultSaveState({ status: "saving", attempt, maxAttempts });
        },
      },
    )
      .then(() => {
        savedResultReceiptRef.current = finishedResultReceipt;
        setResultSaveState((current) => ({ ...current, status: "saved" }));
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        setResultSaveState((current) => ({ ...current, status: "failed" }));
        setMessage(gameCopy.receiptFailed);
      });

    return () => controller.abort();
  }, [finishedResultReceipt, gameCopy.receiptFailed]);

  const self = gameState?.self ?? null;
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
      ? gameCopy.wonObjective
      : gameStatus === "lost"
        ? gameCopy.lostObjective
        : gameCopy.objectiveMulti;

  const health = self?.combat.health ?? creatureModifiers.maxHealth;
  const moveCooldownRemaining = self?.combat.moveCooldownRemaining ?? 0;
  const attackCooldownRemaining = self?.combat.attackCooldownRemaining ?? 0;
  const parryCooldownRemaining = self?.combat.parryCooldownRemaining ?? 0;
  const abilityCooldownRemaining = self?.combat.abilityCooldownRemaining ?? 0;
  const abilityIsActive = (self?.combat.abilityActiveRemaining ?? 0) > 0;
  const moveRangeBonus = authoritativeCharacter.id === "cave-shrimp" && abilityIsActive ? 2 : 0;
  const radarRangeBonus = authoritativeCharacter.id === "blind-fish" && abilityIsActive ? 10 : 0;
  const radarPrecision = authoritativeCharacter.id === "blind-fish" && abilityIsActive ? 0.35 : 1;
  const visionRangeBonus = authoritativeCharacter.id === "blind-fish" && abilityIsActive ? 6 : 0;
  const movementLocked = authoritativeCharacter.id === "cave-crab" && abilityIsActive;
  const isParrying = Boolean(self?.combat.isParrying);
  const isStunned = Boolean(self?.combat.isStunned);
  const reachableTiles = useMemo(
    () => (self ? findReachableTiles(worldToTile(self.position), creatureModifiers.moveRangeTiles + moveRangeBonus, tileLookup) : new Map()),
    [creatureModifiers.moveRangeTiles, moveRangeBonus, self, tileLookup],
  );
  const attackableTiles = useMemo(
    () => (self ? findReachableTiles(worldToTile(self.position), PLAYER_ATTACK_RANGE_TILES, tileLookup) : new Map()),
    [self, tileLookup],
  );
  const isMoveReady = gameStatus === "playing" && moveCooldownRemaining <= 0 && !isStunned && !movementLocked;
  const nearestThreatTiles = enemy
    ? Math.max(1, Math.round(distanceBetween(player, enemy) / TILE_SIZE))
    : null;

  const otherPlayersSummary = (gameState?.otherPlayers ?? []).map((otherPlayer) => ({
    id: otherPlayer.id,
    name: otherPlayer.name,
    health: otherPlayer.combat.health,
    maxHealth: otherPlayer.combat.maxHealth,
    isParrying: otherPlayer.combat.isParrying,
    isStunned: otherPlayer.combat.isStunned,
  }));

  const currentPlayerTile = worldToTile(player);
  const currentShelterKey = `${currentPlayerTile.col},${currentPlayerTile.row}`;
  const baseTerrainName = terrainNameAt(player, tileLookup);
  const currentTerrainName =
    baseTerrainName === "Refugio" && gameState?.exhaustedShelters.includes(currentShelterKey)
      ? "Refugio agotado"
      : baseTerrainName;

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
      setMessage(isStunned ? gameCopy.stunnedMove : gameCopy.movementRecovering);
      return;
    }

    const movePlan = planMovementPath(
      self.position,
      target,
      creatureModifiers.moveRangeTiles + moveRangeBonus,
      tileLookup,
      authoritativeCharacter.moveCooldownMultiplier,
    );

    if (!movePlan) {
      setPathPreview([]);
      setMessage(gameCopy.noPath);
      return;
    }

    setPathPreview(movePlan.worldPath);
    emitMoveTarget(tileToWorld(movePlan.targetTile));
    setMessage(
      movePlan.distanceTiles === 1
        ? gameCopy.moveOne
        : formatMessage(gameCopy.moveMany, { count: movePlan.distanceTiles }),
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
    } else if (event.key.toLowerCase() === "r" || event.key.toLowerCase() === "f") {
      event.preventDefault();
      handleAbility();
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
      setMessage(lobby.unavailable);
      return;
    }

    socket.emit("player-attack", { roomCode });
    setActiveAction("attack");
    setMessage(gameCopy.attackSent);
    playSfx("attack");
  }

  const handleDefend = () => {
    if (gameStatus !== "playing" || parryCooldownRemaining > 0 || isStunned) {
      return;
    }

    const socket = getSocket();

    if (!socket) {
      setMessage(lobby.unavailable);
      return;
    }

    socket.emit("player-defend", { roomCode });
    setActiveAction("defend");
    setMessage(gameCopy.parryActive);
    playSfx("defend");
  };

  function handleAbility() {
    if (!self || gameStatus !== "playing" || abilityCooldownRemaining > 0 || isStunned) return;
    const socket = getSocket();
    if (!socket) return;
    socket.emit("player-ability", { roomCode, target: self.position });
    setActiveAction("ability");
    setMessage(`${getLocalizedAbilityName(locale, authoritativeCharacter.id)}.`);
    playSfx("ready");
  }

  const handleExit = () => {
    getSocket()?.emit("leave-room", { roomCode });
    clearMultiplayerSession();
    onExitToMenu();
  };

  const overlaySummary = gameState ? (
    <div className="space-y-4">
      <div className="theme-card rounded-[1.1rem] px-4 py-3 text-left text-sm text-(--text-secondary)">
        <p>
          {gameCopy.room} <span className="text-(--text-primary)">{roomCode}</span>
        </p>
        <p className="mt-1">
          {gameCopy.finalSurvivors}: <span className="text-(--text-primary)">{gameState.aliveCount}</span>
        </p>
      </div>
      <ResultsTable results={gameState.results} />
      {gameState.status === "finished" && (
        <p className="text-left text-xs text-zinc-400">
          {resultSaveState.status === "saving"
            ? formatMessage(gameCopy.savingReceipt, { attempt: Math.max(1, resultSaveState.attempt), max: resultSaveState.maxAttempts })
            : resultSaveState.status === "saved"
              ? gameCopy.receiptSaved
              : resultSaveState.status === "failed"
                ? gameCopy.receiptFailed
                : gameCopy.officialProcessing}
        </p>
      )}
    </div>
  ) : null;

  if (!gameState || !self) {
    return (
      <section className="relative z-10 flex min-h-screen items-center justify-center px-5 text-(--text-primary)">
        <div className="theme-panel max-w-md rounded-[1.8rem] px-6 py-5 text-sm text-(--text-secondary) backdrop-blur-md">
          <p>{resumeFailure?.message ?? formatMessage(gameCopy.connectingRoom, { room: roomCode })}</p>
          {resumeFailure && (
            <div className="mt-4 flex flex-wrap gap-3">
              {!resumeFailure.terminal && (
                <button
                  type="button"
                  onClick={requestResume}
                  className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-cyan-100"
                >
                  {gameCopy.retry}
                </button>
              )}
              <button
                type="button"
                onClick={handleExit}
                className="rounded-full border border-white/15 px-4 py-2 text-zinc-200"
              >
                {gameCopy.backMenu}
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
        {!isUiHidden && <button
          type="button"
          onClick={handleExit}
          className="pointer-events-auto inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/10 bg-black/55 px-3 py-2 text-[0.72rem] text-zinc-300 backdrop-blur-md transition hover:text-white sm:min-h-11 sm:gap-2 sm:px-4 sm:text-sm"
          aria-label={gameCopy.backMenu}
        >
          <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          {gameCopy.backMenu}
        </button>}

        {!isUiHidden && (
          <div className="rounded-full border border-white/10 bg-black/45 px-3 py-2 backdrop-blur-md"><SpeleumBrand size="compact" /><span className="sr-only">{gameCopy.room}: {roomCode}</span></div>
        )}
        {isUiHidden && (
          <div className="fixed inset-x-2 bottom-[calc(env(safe-area-inset-bottom)+.5rem)] z-70 md:hidden">
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
              abilityName={getLocalizedAbilityName(locale, authoritativeCharacter.id)}
              abilityCooldownRemaining={abilityCooldownRemaining}
              abilityDisabled={isStunned}
              onAbility={handleAbility}
            />
          </div>
        )}

        <div className="flex items-start gap-2">
          <GameTopControls
            isUiHidden={isUiHidden}
            onToggleUi={() => setIsUiHidden((current) => !current)}
          />
        </div>
      </header>

      <div className={isUiHidden ? "h-full min-h-0 min-w-0" : "grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-1.5 p-2 pt-[calc(env(safe-area-inset-top)+3.8rem)] pb-[calc(env(safe-area-inset-bottom)+.5rem)] md:grid-cols-[minmax(15rem,18rem)_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)_auto] md:gap-2"}>
        {!isUiHidden && (
          <aside className="relative z-60 min-w-0 md:static md:row-span-2 md:max-h-none md:w-auto md:min-h-0">
            <div className="grid gap-2">
              <GameHud
                selectedCharacter={authoritativeCharacter}
                zone={currentZone}
                objective={objective}
                message={message}
                zoneMessage={disconnectedMessage}
                health={health}
                maxHealth={self.combat.maxHealth}
                aliveCount={gameState.aliveCount}
                enemyStateLabel={`${gameState.otherPlayers.length} ${messages.ranking.player.toLowerCase()} / ${gameState.enemies.length} ${messages.play.hud.echoes}`}
                isPaused={false}
                score={self.combat.damageDealt}
                kills={self.combat.kills}
                parryActive={isParrying}
                isStunned={isStunned}
                moveCooldownRemaining={moveCooldownRemaining}
                attackCooldownRemaining={attackCooldownRemaining}
                parryCooldownRemaining={parryCooldownRemaining}
                nearestThreatTiles={nearestThreatTiles}
                nearbyDangerLabel={enemy?.state === "attacking" ? "high" : enemy?.state === "chasing" || enemy?.state === "investigating" ? "medium" : "low"}
                detectedEnemies={gameState.enemies.length}
                terrainName={currentTerrainName}
                sanityStage={self.combat.sanityStage}
                idleDurationMs={self.combat.idleDurationMs}
                shelterProgress={self.combat.shelterProgress}
                abilityName={getLocalizedAbilityName(locale, authoritativeCharacter.id)}
                abilityCooldownRemaining={abilityCooldownRemaining}
                otherPlayersSummary={otherPlayersSummary}
              />
              <div className="hidden md:block [@media(max-height:600px)]:hidden">
                <RadarPanel player={player} signals={gameState.signals} ownerId={self.id} rangeTiles={creatureModifiers.radarRangeTiles + radarRangeBonus} precisionMultiplier={radarPrecision} />
              </div>
              <div className="absolute right-2 top-[calc(100%+0.5rem)] z-50 w-20 md:hidden">
                <RadarPanel player={player} signals={gameState.signals} ownerId={self.id} rangeTiles={creatureModifiers.radarRangeTiles + radarRangeBonus} precisionMultiplier={radarPrecision} compact />
              </div>
            </div>
          </aside>
        )}

        <main className={`${isUiHidden ? "absolute inset-0" : "min-h-0 min-w-0 md:col-start-2"} overflow-hidden rounded-[1.15rem] border border-white/5`}>
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
            visionRadius={VISION_RADIUS + visionRangeBonus * TILE_SIZE}
            tiles={caveTiles}
            traps={gameState.traps}
            sanityStage={self.combat.sanityStage}
            exhaustedShelters={gameState.exhaustedShelters}
            reachableTiles={reachableTiles}
            attackableTiles={attackableTiles}
            selectedPath={pathPreview}
            isMoveReady={isMoveReady}
            onChooseDestination={handleMoveIntent}
          />
        </main>

        {!isUiHidden && (
          <div className="min-w-0 md:col-start-2 md:row-start-2">
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
              abilityName={getLocalizedAbilityName(locale, authoritativeCharacter.id)}
              abilityCooldownRemaining={abilityCooldownRemaining}
              abilityDisabled={isStunned}
              onAbility={handleAbility}
            />
          </div>
        )}
      </div>

      <GameOverlay
        status={gameStatus}
        onRestart={() => window.location.reload()}
        onExitToMenu={handleExit}
        titleOverride={gameStatus === "won" ? gameCopy.multiWinTitle : gameCopy.multiLoseTitle}
        messageOverride={
          gameStatus === "won"
            ? messages.play.overlay.winMessage
            : messages.play.overlay.loseMessage
        }
        buttonLabelOverride={gameCopy.playAgain}
        summary={overlaySummary}
      />
    </section>
  );
}
