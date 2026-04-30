"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { ArrowLeft, Shield } from "lucide-react";
import type {
  ActionKind,
  CharacterOption,
  GameStatus,
  PlayerPosition,
} from "../gameConfig";
import {
  ATTACK_COOLDOWN,
  DEFEND_COOLDOWN,
  DARKNESS_SANITY_DRAIN,
  MAX_HEALTH,
  MAX_SANITY,
  PLAYER_SPEED,
  caveZones,
  goalArea,
  hazardAreas,
  pointsOfInterest,
  stalkerConfig,
  startPosition,
} from "../gameConfig";
import {
  clampToMap,
  calculateMoveCooldown,
  createEnemyState,
  distanceBetween,
  getThreatLevel,
  getZoneForPosition,
  hitHazard,
  limitMoveDistance,
  moveTowardPosition,
  moveWithCollisions,
  reachedGoal,
  sanityHealthPenalty,
  shouldFinalizeMoveBurst,
  updateEnemyState,
  updateSanity,
} from "../gameLogic";
import type { RadarSignal, SignalType } from "../types";
import { ActionControls } from "./ActionControls";
import { GameHud } from "./GameHud";
import { GameMap } from "./GameMap";
import { GameOverlay } from "./GameOverlay";
import { RadarPanel } from "./RadarPanel";

type Outcome =
  | {
      status: Extract<GameStatus, "won" | "lost">;
      message: string;
    }
  | null;

type DirectionState = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
};

function actionLabel(action: ActionKind) {
  if (action === "move") return "Mover";
  if (action === "attack") return "Atacar";
  return "Defender";
}

function emptyDirectionState(): DirectionState {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
  };
}

type TacticalGameProps = {
  selectedCharacter: CharacterOption;
  onExitToMenu: () => void;
};

export function TacticalGame({
  selectedCharacter,
  onExitToMenu,
}: TacticalGameProps) {
  const [player, setPlayer] = useState<PlayerPosition>(startPosition);
  const [enemy, setEnemy] = useState(() => createEnemyState(stalkerConfig));
  const [activeAction, setActiveAction] = useState<ActionKind>("move");
  const [gameStatus, setGameStatus] = useState<GameStatus>("playing");
  const [cooldownEndsAt, setCooldownEndsAt] = useState(0);
  const [defendingUntil, setDefendingUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [health, setHealth] = useState(MAX_HEALTH);
  const [sanity, setSanity] = useState(MAX_SANITY);
  const [threatLevel, setThreatLevel] = useState<ReturnType<typeof getThreatLevel>>("calm");
  const [signals, setSignals] = useState<RadarSignal[]>([]);
  const [message, setMessage] = useState(
    "Sobrevive a la cueva y mantente fuera del alcance del acechante.",
  );
  const [zoneMessage, setZoneMessage] = useState<string | null>(
    caveZones[0]?.ambient ?? null,
  );

  const zoneMessageTimeoutRef = useRef<number | null>(null);
  const previousTimeRef = useRef<number | null>(null);
  const playerRef = useRef(player);
  const enemyRef = useRef(enemy);
  const gameStatusRef = useRef(gameStatus);
  const defendingUntilRef = useRef(defendingUntil);
  const healthRef = useRef(MAX_HEALTH);
  const sanityRef = useRef(MAX_SANITY);
  const pointerTargetRef = useRef<PlayerPosition | null>(null);
  const keyStateRef = useRef<DirectionState>(emptyDirectionState());
  const lastZoneIdRef = useRef(caveZones[0]?.id ?? "");
  const lastMoveAtRef = useRef(0);
  const movementBurstDistanceRef = useRef(0);
  const lastThreatLevelRef = useRef(getThreatLevel(0));

  const currentZone = useMemo(
    () => getZoneForPosition(player, caveZones),
    [player],
  );

  const playerSpeed = useMemo(() => {
    return PLAYER_SPEED / selectedCharacter.moveCooldownMultiplier;
  }, [selectedCharacter.moveCooldownMultiplier]);

  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  useEffect(() => {
    if (lastMoveAtRef.current === 0) {
      lastMoveAtRef.current = Date.now();
    }
  }, []);

  useEffect(() => {
    enemyRef.current = enemy;
  }, [enemy]);

  useEffect(() => {
    healthRef.current = health;
  }, [health]);

  useEffect(() => {
    sanityRef.current = sanity;
  }, [sanity]);

  useEffect(() => {
    gameStatusRef.current = gameStatus;
  }, [gameStatus]);

  useEffect(() => {
    defendingUntilRef.current = defendingUntil;
  }, [defendingUntil]);

  useEffect(() => {
    return () => {
      if (zoneMessageTimeoutRef.current !== null) {
        window.clearTimeout(zoneMessageTimeoutRef.current);
      }
    };
  }, []);

  const showZoneMessage = (nextMessage: string) => {
    setZoneMessage(nextMessage);

    if (zoneMessageTimeoutRef.current !== null) {
      window.clearTimeout(zoneMessageTimeoutRef.current);
    }

    zoneMessageTimeoutRef.current = window.setTimeout(() => {
      setZoneMessage(null);
    }, 3200);
  };

  useEffect(() => {
    if (lastZoneIdRef.current === currentZone.id) {
      return;
    }

    lastZoneIdRef.current = currentZone.id;
    showZoneMessage(currentZone.ambient);
  }, [currentZone]);

  const addSignal = (type: SignalType, position: PlayerPosition) => {
    const baseDuration =
      type === "attack"
        ? 1900
        : type === "move"
          ? 1300
          : type === "danger"
            ? 1200
            : 950;
    const duration =
      type === "move"
        ? Math.round(baseDuration * selectedCharacter.moveSignalMultiplier)
        : baseDuration;

    setSignals((current) => [
      ...current.slice(-8),
      {
        id: now + current.length,
        type,
        x: position.x,
        y: position.y,
        createdAt: Date.now(),
        duration,
      },
    ]);
  };

  const getOutcome = (
    nextPlayer: PlayerPosition,
    nextEnemy: PlayerPosition,
  ): Outcome => {
    if (distanceBetween(nextPlayer, nextEnemy) <= stalkerConfig.touchRange) {
      return {
        status: "lost",
        message: "El acechante te alcanzo antes de consolidar tu dominio.",
      };
    }

    if (hitHazard(nextPlayer, hazardAreas)) {
      return {
        status: "lost",
        message: "Pisaste una grieta peligrosa y la cueva te devoro.",
      };
    }

    if (reachedGoal(nextPlayer, goalArea)) {
      return {
        status: "won",
        message: "Tomaste la camara umbral y saliste con ventaja.",
      };
    }

    return null;
  };

  const applyOutcome = (outcome: Outcome) => {
    if (!outcome) {
      return;
    }

    pointerTargetRef.current = null;
    keyStateRef.current = emptyDirectionState();
    setHealth(outcome.status === "lost" ? 0 : MAX_HEALTH);
    setMessage(outcome.message);
    gameStatusRef.current = outcome.status;
    setGameStatus(outcome.status);
  };

  const clearPointerTarget = () => {
    pointerTargetRef.current = null;
  };

  const movePlayerTowardTarget = (
    currentPlayer: PlayerPosition,
    deltaSeconds: number,
  ) => {
    const keys = keyStateRef.current;
    const vectorX = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const vectorY = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    const stepDistance = playerSpeed * deltaSeconds;

    if (vectorX !== 0 || vectorY !== 0) {
      clearPointerTarget();

      const magnitude = Math.hypot(vectorX, vectorY);
      return moveWithCollisions(currentPlayer, {
        x: (vectorX / magnitude) * stepDistance,
        y: (vectorY / magnitude) * stepDistance,
      });
    }

    if (!pointerTargetRef.current) {
      return currentPlayer;
    }

    const nextPlayer = moveTowardPosition(
      currentPlayer,
      pointerTargetRef.current,
      stepDistance,
    );

    if (
      distanceBetween(nextPlayer, pointerTargetRef.current) < 8 ||
      distanceBetween(nextPlayer, currentPlayer) < 0.5
    ) {
      clearPointerTarget();
    }

    return nextPlayer;
  };

  const onTick = useEffectEvent(() => {
    const time = Date.now();
    const previousTime = previousTimeRef.current ?? time;
    const deltaSeconds = Math.min((time - previousTime) / 1000, 0.05);
    previousTimeRef.current = time;

    setNow(time);
    setSignals((current) =>
      current.filter((signal) => time - signal.createdAt < signal.duration),
    );

    let nextPlayer = playerRef.current;
    let movedDistance = 0;

    if (
      gameStatusRef.current === "playing" &&
      time >= defendingUntilRef.current &&
      time >= cooldownEndsAt
    ) {
      nextPlayer = movePlayerTowardTarget(playerRef.current, deltaSeconds);
      movedDistance = distanceBetween(nextPlayer, playerRef.current);

      if (movedDistance > 0.1) {
        playerRef.current = nextPlayer;
        setPlayer(nextPlayer);
        lastMoveAtRef.current = time;
        movementBurstDistanceRef.current += movedDistance;
      }
    }

    if (
      movementBurstDistanceRef.current > 0 &&
      shouldFinalizeMoveBurst(lastMoveAtRef.current, time) &&
      time >= cooldownEndsAt
    ) {
      setCooldownEndsAt(
        time +
          calculateMoveCooldown(
            movementBurstDistanceRef.current,
            selectedCharacter.moveCooldownMultiplier,
          ),
      );
      movementBurstDistanceRef.current = 0;
    }

    const idleMs = time - lastMoveAtRef.current;
    const threatLevel = getThreatLevel(idleMs);
    setThreatLevel(threatLevel);

    if (
      threatLevel !== lastThreatLevelRef.current &&
      threatLevel !== "calm" &&
      gameStatusRef.current === "playing"
    ) {
      addSignal("danger", playerRef.current);
      setMessage(
        threatLevel === "uneasy"
          ? "La quietud se vuelve peligrosa. Muevete."
          : "Algo responde a tu inmovilidad. Rompe el silencio.",
      );
      lastThreatLevelRef.current = threatLevel;
    } else if (threatLevel === "calm") {
      lastThreatLevelRef.current = "calm";
    }

    if (threatLevel === "doomed" && gameStatusRef.current === "playing") {
      applyOutcome({
        status: "lost",
        message: "Te quedaste quieto demasiado tiempo y la cueva te encontro.",
      });
      return;
    }

    const nextEnemy = updateEnemyState(
      enemyRef.current,
      nextPlayer,
      stalkerConfig,
      deltaSeconds,
      gameStatusRef.current,
    );

    enemyRef.current = nextEnemy;
    setEnemy(nextEnemy);

    const zone = getZoneForPosition(nextPlayer, caveZones);
    const nextSanity = updateSanity(
      sanityRef.current,
      deltaSeconds,
      zone,
      movedDistance > 0.1,
      threatLevel,
      nextEnemy.mode,
      DARKNESS_SANITY_DRAIN,
    );
    setSanity(nextSanity);

    const sanityDamage = sanityHealthPenalty(nextSanity, deltaSeconds);

    if (sanityDamage > 0 && gameStatusRef.current === "playing") {
      const nextHealth = Math.max(0, healthRef.current - sanityDamage);
      healthRef.current = nextHealth;
      setHealth(nextHealth);
    }

    if (gameStatusRef.current === "playing") {
      if (sanityDamage > 0 && healthRef.current <= 0) {
        applyOutcome({
          status: "lost",
          message: "El miedo te vacio por completo. La cueva te reclamo.",
        });
        return;
      }

      applyOutcome(
        getOutcome(nextPlayer, {
          x: nextEnemy.x,
          y: nextEnemy.y,
        }),
      );
    }
  });

  useEffect(() => {
    const interval = window.setInterval(() => {
      onTick();
    }, 16);

    return () => window.clearInterval(interval);
  }, [playerSpeed]);

  const cooldownRemaining = Math.max(0, cooldownEndsAt - now);
  const isRecovering = cooldownRemaining > 0;
  const isDefending = defendingUntil > now && gameStatus === "playing";

  const nearestPoint = useMemo(() => {
    return pointsOfInterest
      .map((point) => ({
        ...point,
        distance: Math.round(Math.hypot(player.x - point.x, player.y - point.y)),
      }))
      .sort((a, b) => a.distance - b.distance)[0];
  }, [player]);

  const objective =
    gameStatus === "won"
      ? "Camara dominante asegurada."
      : gameStatus === "lost"
        ? "Vuelve a intentarlo y adapta tu ruta en la oscuridad."
        : "Avanza hacia la camara umbral sin caer ante la cueva.";

  const enemyStateLabel = enemy.mode === "chase" ? "amenaza activa" : "patrulla";

  const handleMoveIntent = (target: PlayerPosition) => {
    if (gameStatus !== "playing") {
      return;
    }

    if (cooldownRemaining > 0) {
      setMessage("Tu criatura aun recupera el impulso anterior.");
      return;
    }

    setActiveAction("move");
    pointerTargetRef.current = limitMoveDistance(
      playerRef.current,
      clampToMap(target),
      selectedCharacter.moveRange,
    );
    addSignal("move", playerRef.current);
    setMessage("Te deslizas hacia la zona marcada. Mantente lejos del acechante.");
  };

  const handleAttack = () => {
    if (gameStatus !== "playing") {
      return;
    }

    if (isRecovering) {
      setMessage("Aun no puedes atacar otra vez.");
      return;
    }

    clearPointerTarget();
    setActiveAction("attack");
    setCooldownEndsAt(Date.now() + ATTACK_COOLDOWN);
    addSignal("attack", playerRef.current);
    setMessage("Ataque emitido. Tu posicion resuena en la cueva.");
  };

  const handleDefend = () => {
    if (gameStatus !== "playing") {
      return;
    }

    if (isRecovering) {
      setMessage("Aun no puedes defenderte otra vez.");
      return;
    }

    clearPointerTarget();
    const endsAt = Date.now() + DEFEND_COOLDOWN;
    setActiveAction("defend");
    setDefendingUntil(endsAt);
    setCooldownEndsAt(endsAt);
    addSignal("defend", playerRef.current);
    setMessage("Defensa activa. Te mantienes inmovil un instante.");
  };

  const handleSelectMove = () => {
    if (gameStatus !== "playing") {
      return;
    }

    if (cooldownRemaining > 0) {
      setMessage("Aun no puedes volver a moverte.");
      return;
    }

    setActiveAction("move");
    setMessage("Usa clic o teclado para moverte con suavidad por la cueva.");
  };

  const togglePause = () => {
    if (gameStatus === "playing") {
      clearPointerTarget();
      setGameStatus("paused");
      setMessage("Partida en pausa. Reanuda cuando quieras seguir.");
    } else if (gameStatus === "paused") {
      setGameStatus("playing");
      setMessage("La expedicion continua. Mantente vivo en la oscuridad.");
    }
  };

  const setDirectionState = (
    direction: keyof DirectionState,
    value: boolean,
  ) => {
    keyStateRef.current = {
      ...keyStateRef.current,
      [direction]: value,
    };
  };

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.repeat) {
      return;
    }

    if (event.key.toLowerCase() === "p") {
      togglePause();
      return;
    }

    if (gameStatusRef.current !== "playing") {
      return;
    }

    if (cooldownEndsAt > Date.now()) {
      return;
    }

    if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") {
      event.preventDefault();
      setActiveAction("move");
      setDirectionState("up", true);
      addSignal("move", playerRef.current);
      setMessage("Te desplazas por la cueva. Busca una ruta segura.");
    } else if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") {
      event.preventDefault();
      setActiveAction("move");
      setDirectionState("down", true);
      addSignal("move", playerRef.current);
      setMessage("Te desplazas por la cueva. Busca una ruta segura.");
    } else if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
      event.preventDefault();
      setActiveAction("move");
      setDirectionState("left", true);
      addSignal("move", playerRef.current);
      setMessage("Te desplazas por la cueva. Busca una ruta segura.");
    } else if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
      event.preventDefault();
      setActiveAction("move");
      setDirectionState("right", true);
      addSignal("move", playerRef.current);
      setMessage("Te desplazas por la cueva. Busca una ruta segura.");
    }
  });

  const onKeyUp = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") {
      setDirectionState("up", false);
    } else if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") {
      setDirectionState("down", false);
    } else if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
      setDirectionState("left", false);
    } else if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
      setDirectionState("right", false);
    }
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      onKeyDown(event);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      onKeyUp(event);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const restartGame = () => {
    keyStateRef.current = emptyDirectionState();
    clearPointerTarget();
    setPlayer(startPosition);
    playerRef.current = startPosition;
    const resetEnemy = createEnemyState(stalkerConfig);
    enemyRef.current = resetEnemy;
    setEnemy(resetEnemy);
    setActiveAction("move");
    gameStatusRef.current = "playing";
    setGameStatus("playing");
    setCooldownEndsAt(0);
    setDefendingUntil(0);
    defendingUntilRef.current = 0;
    setHealth(MAX_HEALTH);
    healthRef.current = MAX_HEALTH;
    setSanity(MAX_SANITY);
    sanityRef.current = MAX_SANITY;
    setSignals([]);
    setMessage("Sobrevive a la cueva y mantente fuera del alcance del acechante.");
    showZoneMessage(caveZones[0]?.ambient ?? "");
    lastZoneIdRef.current = caveZones[0]?.id ?? "";
    previousTimeRef.current = null;
    lastMoveAtRef.current = Date.now();
    movementBurstDistanceRef.current = 0;
    lastThreatLevelRef.current = "calm";
    setThreatLevel("calm");
  };

  return (
    <section className="relative z-10 min-h-screen overflow-hidden">
      <header className="pointer-events-none absolute inset-x-0 top-0 z-70 flex items-center justify-between px-4 py-4">
        <button
          type="button"
          onClick={onExitToMenu}
          className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/55 px-4 py-2 text-sm text-zinc-300 backdrop-blur-md transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Menu
        </button>

        <div className="rounded-full border border-white/10 bg-black/45 px-5 py-2 text-center backdrop-blur-md">
          <p className="text-[0.65rem] tracking-[0.34em] text-zinc-500">
            SPELEUM
          </p>
          <h1 className="text-sm font-semibold tracking-[0.28em] text-white">
            {actionLabel(activeAction)}
          </h1>
        </div>

        <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-black/45 px-4 py-2 text-xs text-zinc-400 backdrop-blur-md sm:flex">
          <Shield className="h-4 w-4" />
          {selectedCharacter.name}
        </div>
      </header>

      <GameMap
        player={player}
        playerCharacterId={selectedCharacter.id}
        enemy={enemy}
        signals={signals}
        activeAction={activeAction}
        isDefending={isDefending}
        currentZone={currentZone}
        gameStatus={gameStatus}
        onChooseDestination={handleMoveIntent}
      />

      <GameHud
        selectedCharacter={selectedCharacter}
        zone={currentZone}
        objective={objective}
        message={message}
        zoneMessage={zoneMessage}
        health={health}
        maxHealth={MAX_HEALTH}
        sanity={sanity}
        maxSanity={MAX_SANITY}
        enemyStateLabel={enemyStateLabel}
        isPaused={gameStatus === "paused"}
        onTogglePause={togglePause}
      />

      <div className="absolute right-4 top-24 z-70 w-64 max-w-[calc(100vw-2rem)]">
        <RadarPanel
          player={player}
          enemy={enemy}
          signals={signals}
          cooldownRemaining={cooldownRemaining}
        />
      </div>

      <div className="pointer-events-none absolute right-4 top-88 z-70 hidden max-w-xs rounded-[1.25rem] border border-white/10 bg-black/45 p-4 text-sm text-zinc-300 backdrop-blur-md lg:block">
        <p className="text-xs tracking-[0.25em] text-zinc-500">REFERENCIA</p>
        <p className="mt-2">Objetivo: {objective}</p>
        <p className="mt-2">Zona cercana: {nearestPoint?.label ?? currentZone.name}</p>
        <p className="mt-2">Quietud: {threatLevel}</p>
      </div>

      <ActionControls
        activeAction={activeAction}
        cooldownRemaining={cooldownRemaining}
        isRecovering={isRecovering}
        isDefending={isDefending}
        onMove={handleSelectMove}
        onAttack={handleAttack}
        onDefend={handleDefend}
      />

      <GameOverlay
        status={gameStatus}
        onRestart={restartGame}
        onExitToMenu={onExitToMenu}
      />
    </section>
  );
}
