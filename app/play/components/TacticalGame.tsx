"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { CharacterOption, GameStatus, PlayerPosition } from "../gameConfig";
import {
  ATTACK_COOLDOWN,
  ENEMY_CLOSE_DANGER_TILES,
  ENEMY_MOVE_INTERVAL,
  MOVEMENT_STEP_INTERVAL_MS,
  PARRY_COOLDOWN_MS,
  PARRY_WINDOW_MS,
  PLAYER_ATTACK_DAMAGE,
  PLAYER_ATTACK_RANGE_TILES,
  PLAYER_MAX_HEALTH,
  PLAYER_MOVE_RANGE_TILES,
  RADAR_SIGNAL_PROFILES,
  RADAR_SIGNAL_RANGE_TILES,
  SCORE_PER_KILL_FALLBACK,
  SCORE_PER_LOCAL_VICTORY,
  TILE_SIZE,
} from "../gameConfig";
import {
  isAttackReachableByTiles,
  isStunned,
  planMovementPath,
  createEnemyState,
  distanceBetween,
  getZoneForPosition,
  resolveCombatHit,
  updateEnemyState,
} from "../gameLogic";
import type { EnemyState } from "../gameLogic";
import type { NoiseEvent, RadarSignal, SignalType } from "../types";
import { GameHud } from "./GameHud";
import { GameMap } from "./GameMap";
import { ActionControls } from "./ActionControls";
import { RadarPanel } from "./RadarPanel";
import { GameOverlay } from "./GameOverlay";
import { GameTopControls } from "./GameTopControls";
import { PauseOverlay } from "./PauseOverlay";
import { useAuth } from "../../auth/AuthProvider";
import {
  buildTileMap,
  createTileLookup,
  findReachableTiles,
  tileDistance,
  tileToWorld,
  worldToTile,
} from "../tileMap";
import { createCaveLayout, type CaveLayout } from "../proceduralCave";
import { createRadarSignal, upsertRadarSignal } from "../signalUtils";

type TacticalGameProps = {
  selectedCharacter: CharacterOption;
  onExitToMenu: () => void;
};

function createMatchId() {
  return globalThis.crypto.randomUUID();
}

function emptySignals() {
  return [] as RadarSignal[];
}

function emptyNoises() {
  return [] as NoiseEvent[];
}

type LocalCaveSession = {
  seed: string;
  layout: CaveLayout;
  tiles: ReturnType<typeof buildTileMap>;
  lookup: ReturnType<typeof createTileLookup>;
};

function createLocalSeed() {
  return `local-${Date.now()}-${Math.random()}`;
}

function createLocalCaveSession(seed = createLocalSeed()): LocalCaveSession {
  const layout = createCaveLayout(seed);
  const tiles = buildTileMap(layout);
  const lookup = createTileLookup(tiles);

  return {
    seed,
    layout,
    tiles,
    lookup,
  };
}

function initialEnemies(layout: CaveLayout) {
  return layout.enemyConfigs.map((config) => createEnemyState(config));
}

function dangerLabelFromDistance(distanceTiles: number | null, activeHostiles: number) {
  if (activeHostiles > 1 || (distanceTiles !== null && distanceTiles <= 2)) {
    return "alto";
  }

  if (activeHostiles === 1 || (distanceTiles !== null && distanceTiles <= ENEMY_CLOSE_DANGER_TILES)) {
    return "medio";
  }

  return distanceTiles !== null ? "latente" : "bajo";
}

export function TacticalGame({
  selectedCharacter,
  onExitToMenu,
}: TacticalGameProps) {
  const { user } = useAuth();
  const [caveSession, setCaveSession] = useState<LocalCaveSession>(() => createLocalCaveSession());
  const [matchId, setMatchId] = useState(() => createMatchId());
  const [matchStartedAt, setMatchStartedAt] = useState(() => new Date().toISOString());
  const [player, setPlayer] = useState<PlayerPosition>(() => caveSession.layout.startPosition);
  const [enemies, setEnemies] = useState<EnemyState[]>(() => initialEnemies(caveSession.layout));
  const [activeAction, setActiveAction] = useState<"move" | "attack" | "defend">("move");
  const [gameStatus, setGameStatus] = useState<GameStatus>("playing");
  const [isPaused, setIsPaused] = useState(false);
  const [isUiHidden, setIsUiHidden] = useState(false);
  const [health, setHealth] = useState(PLAYER_MAX_HEALTH);
  const [moveCooldownEndsAt, setMoveCooldownEndsAt] = useState(0);
  const [attackCooldownEndsAt, setAttackCooldownEndsAt] = useState(0);
  const [parryUntil, setParryUntil] = useState(0);
  const [parryCooldownEndsAt, setParryCooldownEndsAt] = useState(0);
  const [stunnedUntil, setStunnedUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [message, setMessage] = useState(
    "Marca una celda dentro de tu pulso visible y sobrevive a los ecos de la cueva.",
  );
  const [zoneMessage, setZoneMessage] = useState<string | null>(
    "Solo ves 8 bloques alrededor. Todo lo demas es oscuridad.",
  );
  const [score, setScore] = useState(0);
  const [kills, setKills] = useState(0);
  const [combatFlash, setCombatFlash] = useState<string | null>(null);
  const [signals, setSignals] = useState<RadarSignal[]>(() => emptySignals());
  const [noises, setNoises] = useState<NoiseEvent[]>(() => emptyNoises());
  const [pathPreview, setPathPreview] = useState<PlayerPosition[]>([]);
  const [movementPath, setMovementPath] = useState<PlayerPosition[]>([]);
  const [isTraversing, setIsTraversing] = useState(false);

  const healthRef = useRef(health);
  const playerRef = useRef(player);
  const enemiesRef = useRef(enemies);
  const noisesRef = useRef(noises);
  const gameStatusRef = useRef(gameStatus);
  const moveCooldownEndsAtRef = useRef(moveCooldownEndsAt);
  const attackCooldownEndsAtRef = useRef(attackCooldownEndsAt);
  const parryUntilRef = useRef(parryUntil);
  const stunnedUntilRef = useRef(stunnedUntil);
  const resultSavedRef = useRef(false);
  const lastZoneIdRef = useRef(getZoneForPosition(caveSession.layout.startPosition, caveSession.layout.zones).id);
  const combatFlashTimeoutRef = useRef<number | null>(null);
  const pausedAtRef = useRef<number | null>(null);

  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  useEffect(() => {
    healthRef.current = health;
  }, [health]);

  useEffect(() => {
    enemiesRef.current = enemies;
  }, [enemies]);

  useEffect(() => {
    noisesRef.current = noises;
  }, [noises]);

  useEffect(() => {
    gameStatusRef.current = gameStatus;
  }, [gameStatus]);

  useEffect(() => {
    moveCooldownEndsAtRef.current = moveCooldownEndsAt;
  }, [moveCooldownEndsAt]);

  useEffect(() => {
    attackCooldownEndsAtRef.current = attackCooldownEndsAt;
  }, [attackCooldownEndsAt]);

  useEffect(() => {
    parryUntilRef.current = parryUntil;
  }, [parryUntil]);

  useEffect(() => {
    stunnedUntilRef.current = stunnedUntil;
  }, [stunnedUntil]);

  useEffect(() => {
    if ((gameStatus !== "won" && gameStatus !== "lost") || resultSavedRef.current) {
      return;
    }

    resultSavedRef.current = true;

    void fetch("/api/matches/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId,
        mode: "local",
        status: "finished",
        winnerId: gameStatus === "won" ? user?.id ?? null : null,
        startedAt: matchStartedAt,
        endedAt: new Date().toISOString(),
        creature: selectedCharacter.id,
        result: gameStatus === "won" ? "win" : "loss",
        scoreEarned: score,
      }),
    }).catch(() => {
      resultSavedRef.current = false;
    });
  }, [gameStatus, matchId, matchStartedAt, score, selectedCharacter.id, user?.id]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (gameStatusRef.current !== "playing") {
        return;
      }

      const tickNow = Date.now();
      setNow(tickNow);
      setSignals((current) =>
        current.filter((signal) => tickNow - signal.createdAt < signal.duration),
      );
      setNoises((current) => current.filter((noise) => tickNow - noise.createdAt < 3200));
    }, 100);

    return () => window.clearInterval(interval);
  }, []);

  const aliveEnemies = useMemo(
    () => enemies.filter((enemy) => enemy.alive && enemy.state !== "dead"),
    [enemies],
  );
  const currentZone = useMemo(
    () => getZoneForPosition(player, caveSession.layout.zones),
    [caveSession.layout.zones, player],
  );
  const isParrying = parryUntil > now && gameStatus === "playing";
  const isPlayerStunned = stunnedUntil > now && gameStatus === "playing";
  const moveCooldownRemaining = Math.max(0, moveCooldownEndsAt - now);
  const attackCooldownRemaining = Math.max(0, attackCooldownEndsAt - now);
  const parryCooldownRemaining = Math.max(0, parryCooldownEndsAt - now);
  const reachableTiles = useMemo(
    () => findReachableTiles(worldToTile(player), PLAYER_MOVE_RANGE_TILES, caveSession.lookup),
    [caveSession.lookup, player],
  );

  useEffect(() => {
    if (lastZoneIdRef.current === currentZone.id) {
      return;
    }

    lastZoneIdRef.current = currentZone.id;
    setZoneMessage(currentZone.ambient);
  }, [currentZone]);

  useEffect(() => {
    const cave = caveSession.layout;
    console.log("CAVE SOURCE:", cave.source);
    console.log("CAVE SEED:", cave.seed);
    console.log("TEMPLATES:", cave.templatesUsed);

    if (cave.source === "fallback") {
      console.warn("[Speleum] Local cave is using fallback.", {
        seed: cave.seed,
        reason: cave.fallbackReason ?? "no reason provided",
      });
    }
  }, [caveSession]);

  function addSignal(type: SignalType, position: PlayerPosition, ownerId?: string) {
    const profile = RADAR_SIGNAL_PROFILES[type];
    const nextSignal = createRadarSignal({
      type,
      strength: profile.strength,
      position,
      duration: profile.duration,
      radarJitter: profile.radarJitter,
      ownerId,
    });

    setSignals((current) => upsertRadarSignal(current, nextSignal));
  }

  function addNoise(
    type: NoiseEvent["type"],
    position: PlayerPosition,
    radiusTiles: number,
    intensity: number,
    sourceId = "player",
  ) {
    setNoises((current) => [
      ...current.slice(-24),
      {
        id: `${sourceId}-${Date.now()}-${current.length}`,
        type,
        sourceId,
        position,
        radiusTiles,
        intensity,
        createdAt: Date.now(),
      },
    ]);
  }

  function showCombatFlash(text: string) {
    setCombatFlash(text);

    if (combatFlashTimeoutRef.current !== null) {
      window.clearTimeout(combatFlashTimeoutRef.current);
    }

    combatFlashTimeoutRef.current = window.setTimeout(() => {
      setCombatFlash(null);
    }, 950);
  }

  function endAsLoss(nextMessage: string) {
    setMessage(nextMessage);
    setGameStatus("lost");
  }

  function endAsWin(nextMessage: string) {
    setMessage(nextMessage);
    setGameStatus("won");
  }

  const enemyTurn = useEffectEvent(() => {
    if (gameStatusRef.current !== "playing") {
      return;
    }

    const turnNow = Date.now();
    let nextPlayerHealth = healthRef.current;
    let hostileCount = 0;
    let lastEnemyMessage: string | null = null;

    const updatedEnemies: EnemyState[] = enemiesRef.current.map((enemy): EnemyState => {
      const config = caveSession.layout.enemyConfigs.find((entry) => entry.id === enemy.id);

      if (!config) {
        return enemy;
      }

      const nextEnemy = updateEnemyState(
        enemy,
        [{ id: "player", position: playerRef.current }],
        config,
        ENEMY_MOVE_INTERVAL / 1000,
        gameStatusRef.current,
        noisesRef.current,
        turnNow,
        caveSession.lookup,
      );

      if (!nextEnemy.alive || nextEnemy.state === "dead") {
        return nextEnemy;
      }

      const enemyMoved = distanceBetween(enemy, nextEnemy) >= TILE_SIZE * 0.45;
      const stateChanged = enemy.state !== nextEnemy.state;

      if (
        nextEnemy.state === "chasing" ||
        nextEnemy.state === "investigating" ||
        nextEnemy.state === "attacking"
      ) {
        hostileCount += 1;
      }

      if (nextEnemy.state === "attacking") {
        addSignal("attack", nextEnemy, nextEnemy.id);
        addNoise("attack", nextEnemy, 8, 1.15, nextEnemy.id);
        if (turnNow - nextEnemy.lastAttackAt < ATTACK_COOLDOWN) {
          return nextEnemy;
        }

        const resolution = resolveCombatHit({
          targetHealth: nextPlayerHealth,
          damage: nextEnemy.damage,
          now: turnNow,
          targetParryUntil: parryUntilRef.current,
        });

        if (resolution.wasParried) {
          setParryUntil(resolution.nextParryUntil);
          lastEnemyMessage = `Parry perfecto: ${nextEnemy.name} queda aturdida.`;
          showCombatFlash("Parry");
          return {
            ...nextEnemy,
            lastAttackAt: turnNow,
            stunnedUntil: resolution.attackerStunnedUntil,
          };
        }

        nextPlayerHealth = resolution.nextHealth;
        lastEnemyMessage = `${nextEnemy.name} entra en rango y golpea.`;
        return {
          ...nextEnemy,
          lastAttackAt: turnNow,
        };
      }

      if (enemyMoved) {
        addSignal("move", nextEnemy, nextEnemy.id);
      }

      if (nextEnemy.state === "chasing" && stateChanged) {
        addSignal("danger", nextEnemy, nextEnemy.id);
        lastEnemyMessage = `${nextEnemy.name} confirma tu posicion y te persigue.`;
      } else if (nextEnemy.state === "investigating" && stateChanged) {
        addSignal("danger", nextEnemy, nextEnemy.id);
        lastEnemyMessage = `${nextEnemy.name} investiga el ultimo ruido que escucho.`;
      } else if (nextEnemy.state === "ambushing") {
        lastEnemyMessage = `${nextEnemy.name} se queda inmovil esperando una apertura.`;
      }

      return nextEnemy;
    });

    if (nextPlayerHealth !== healthRef.current) {
      setHealth(nextPlayerHealth);
      showCombatFlash(`-${Math.max(0, healthRef.current - nextPlayerHealth)} HP`);
      if (nextPlayerHealth <= 0) {
        setEnemies(updatedEnemies);
        endAsLoss("Tu vida llego a cero. La cueva cerro el combate a su favor.");
        return;
      }
    }

    if (updatedEnemies.every((enemy) => !enemy.alive || enemy.state === "dead")) {
      setEnemies(updatedEnemies);
      setScore((current) => current + SCORE_PER_LOCAL_VICTORY);
      endAsWin("Limpiaste la cueva. Ninguna criatura hostil quedo con vida.");
      return;
    }

    if (lastEnemyMessage) {
      setMessage(lastEnemyMessage);
    } else if (hostileCount > 0) {
      setMessage("Escuchas ecos agresivos. El radar sugiere peligro, no certezas.");
    }

    setEnemies(updatedEnemies);
  });

  useEffect(() => {
    const interval = window.setInterval(() => {
      void enemyTurn();
    }, ENEMY_MOVE_INTERVAL);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (movementPath.length === 0 || gameStatus !== "playing") {
      return;
    }

    const interval = window.setInterval(() => {
      if (isStunned(stunnedUntilRef.current, Date.now())) {
        window.clearInterval(interval);
        setMovementPath([]);
        setPathPreview([]);
        setIsTraversing(false);
        return;
      }

      setMovementPath((currentPath) => {
        const [nextStep, ...rest] = currentPath;

        if (!nextStep) {
          window.clearInterval(interval);
          setPathPreview([]);
          setIsTraversing(false);
          return currentPath;
        }

        setPlayer(nextStep);
        addSignal("move", nextStep, "player");
        addNoise(
          "move",
          nextStep,
          4 + Math.round(selectedCharacter.moveSignalMultiplier * 2),
          0.45 * selectedCharacter.moveSignalMultiplier,
          "player",
        );
        setPathPreview(rest);

        if (rest.length === 0) {
          window.clearInterval(interval);
          setIsTraversing(false);
        }

        return rest;
      });
    }, MOVEMENT_STEP_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [gameStatus, movementPath.length, selectedCharacter.moveSignalMultiplier]);

  function shiftGameplayTimeline(deltaMs: number) {
    if (deltaMs <= 0) {
      return;
    }

    setNow((current) => current + deltaMs);
    setMoveCooldownEndsAt((current) => (current > 0 ? current + deltaMs : current));
    setAttackCooldownEndsAt((current) => (current > 0 ? current + deltaMs : current));
    setParryUntil((current) => (current > 0 ? current + deltaMs : current));
    setParryCooldownEndsAt((current) => (current > 0 ? current + deltaMs : current));
    setStunnedUntil((current) => (current > 0 ? current + deltaMs : current));
    setSignals((current) =>
      current.map((signal) => ({
        ...signal,
        createdAt: signal.createdAt + deltaMs,
      })),
    );
    setNoises((current) =>
      current.map((noise) => ({
        ...noise,
        createdAt: noise.createdAt + deltaMs,
      })),
    );
    setEnemies((current) =>
      current.map((enemy) => ({
        ...enemy,
        stateSince: enemy.stateSince + deltaMs,
        lastAttackAt: enemy.lastAttackAt > 0 ? enemy.lastAttackAt + deltaMs : enemy.lastAttackAt,
        stunnedUntil: enemy.stunnedUntil > 0 ? enemy.stunnedUntil + deltaMs : enemy.stunnedUntil,
      })),
    );
  }

  function handleTogglePause() {
    if (gameStatus === "won" || gameStatus === "lost") {
      return;
    }

    if (isPaused) {
      const pausedAt = pausedAtRef.current;

      if (pausedAt) {
        shiftGameplayTimeline(Date.now() - pausedAt);
      }

      pausedAtRef.current = null;
      setIsPaused(false);
      setGameStatus("playing");
      return;
    }

    pausedAtRef.current = Date.now();
    setIsPaused(true);
    setGameStatus("paused");
  }

  function queueMovementTo(target: PlayerPosition) {
    if (gameStatus !== "playing") {
      return;
    }

    if (isStunned(stunnedUntilRef.current, Date.now())) {
      setMessage("Estas aturdido y no puedes moverte.");
      return;
    }

    if (moveCooldownEndsAtRef.current > Date.now() || isTraversing) {
      setMessage("Tu pulso aun no se estabiliza para otro desplazamiento.");
      return;
    }

    const movePlan = planMovementPath(
      playerRef.current,
      target,
      PLAYER_MOVE_RANGE_TILES,
      caveSession.lookup,
      selectedCharacter.moveCooldownMultiplier,
    );

    if (!movePlan) {
      setMessage("No hay una ruta caminable hacia esa celda.");
      setPathPreview([]);
      return;
    }

    setIsTraversing(true);
    setMovementPath(movePlan.worldPath);
    setPathPreview(movePlan.worldPath);
    setMoveCooldownEndsAt(Date.now() + movePlan.cooldownMs);
    setActiveAction("move");
    setMessage(
      movePlan.distanceTiles === 1
        ? "Avanzas con cuidado una casilla."
        : `Te deslizas ${movePlan.distanceTiles} casillas por la cueva.`,
    );
  }

  function handleMoveIntent(target: PlayerPosition) {
    queueMovementTo(target);
  }

  function handleAttack() {
    if (gameStatus !== "playing") {
      return;
    }

    if (isStunned(stunnedUntilRef.current, Date.now())) {
      setMessage("Estas aturdido y no puedes atacar.");
      return;
    }

    if (moveCooldownEndsAtRef.current > Date.now()) {
      setMessage("Tu pulso aun no se estabiliza para atacar.");
      return;
    }

    if (attackCooldownEndsAtRef.current > Date.now()) {
      setMessage("Tu embestida aun no recupera alcance.");
      return;
    }

    const playerTile = worldToTile(playerRef.current);
    const target = enemiesRef.current
      .filter((enemy) => enemy.alive && enemy.state !== "dead")
      .sort(
        (left, right) =>
          tileDistance(playerTile, worldToTile(left)) -
          tileDistance(playerTile, worldToTile(right)),
      )
      .find((enemy) =>
        isAttackReachableByTiles(playerRef.current, enemy, PLAYER_ATTACK_RANGE_TILES, caveSession.lookup),
      );

    setAttackCooldownEndsAt(Date.now() + ATTACK_COOLDOWN);
    setActiveAction("attack");
    addSignal("attack", playerRef.current, "player");
    addNoise("attack", playerRef.current, 9, 1.2, "player");

    if (!target) {
      setMessage("Golpeas la oscuridad, pero no hay enemigos dentro del rango.");
      showCombatFlash("Sin objetivo");
      return;
    }

    const updatedEnemies = enemiesRef.current.map((enemy) => {
      if (enemy.id !== target.id || !enemy.alive || enemy.state === "dead") {
        return enemy;
      }

      const nextHp = Math.max(0, enemy.hp - PLAYER_ATTACK_DAMAGE);

      if (nextHp <= 0) {
        const config = caveSession.layout.enemyConfigs.find((entry) => entry.id === enemy.id);
        const earnedScore = config?.scoreValue ?? SCORE_PER_KILL_FALLBACK;

        setScore((current) => current + earnedScore);
        setKills((current) => current + 1);
        setMessage(`${enemy.name} cae y desaparece entre los ecos de roca.`);
        showCombatFlash(`-${PLAYER_ATTACK_DAMAGE} HP · baja`);

        return {
          ...enemy,
          hp: 0,
          alive: false,
          state: "dead" as const,
        };
      }

      setMessage(`Impacto confirmado sobre ${enemy.name}.`);
      showCombatFlash(`-${PLAYER_ATTACK_DAMAGE} HP`);

      return {
        ...enemy,
        hp: nextHp,
        state: "chasing" as const,
      };
    });

    setEnemies(updatedEnemies);

    if (updatedEnemies.every((enemy) => !enemy.alive || enemy.state === "dead")) {
      endAsWin("Silenciaste todos los ecos hostiles de la cueva.");
    }
  }

  function handleDefend() {
    if (gameStatus !== "playing") {
      return;
    }

    if (isStunned(stunnedUntilRef.current, Date.now())) {
      setMessage("Estas aturdido y no puedes hacer parry.");
      return;
    }

    if (moveCooldownEndsAtRef.current > Date.now()) {
      setMessage("Tu pulso aun no se estabiliza para hacer parry.");
      return;
    }

    if (parryCooldownRemaining > 0) {
      setMessage("Tu parry aun no esta listo.");
      return;
    }

    const activatedAt = Date.now();
    setParryUntil(activatedAt + PARRY_WINDOW_MS);
    setParryCooldownEndsAt(activatedAt + PARRY_COOLDOWN_MS);
    setActiveAction("defend");
    addSignal("defend", playerRef.current, "player");
    addNoise("defend", playerRef.current, 6, 0.65, "player");
    setMessage("Abres una ventana corta de parry.");
    showCombatFlash("Parry activo");
  }

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.repeat || gameStatusRef.current !== "playing") {
      return;
    }

    const key = event.key.toLowerCase();

    if (key === "arrowup" || key === "w") {
      event.preventDefault();
      queueMovementTo(tileToWorld({ ...worldToTile(playerRef.current), row: worldToTile(playerRef.current).row - 1 }));
    } else if (key === "arrowdown" || key === "s") {
      event.preventDefault();
      queueMovementTo(tileToWorld({ ...worldToTile(playerRef.current), row: worldToTile(playerRef.current).row + 1 }));
    } else if (key === "arrowleft" || key === "a") {
      event.preventDefault();
      queueMovementTo(tileToWorld({ ...worldToTile(playerRef.current), col: worldToTile(playerRef.current).col - 1 }));
    } else if (key === "arrowright" || key === "d") {
      event.preventDefault();
      queueMovementTo(tileToWorld({ ...worldToTile(playerRef.current), col: worldToTile(playerRef.current).col + 1 }));
    } else if (key === " " || key === "e") {
      event.preventDefault();
      handleAttack();
    } else if (key === "shift" || key === "q") {
      event.preventDefault();
      handleDefend();
    }
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => onKeyDown(event);

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function restartGame() {
    resultSavedRef.current = false;
    pausedAtRef.current = null;
    const nextSession = createLocalCaveSession();
    setCaveSession(nextSession);
    setMatchId(createMatchId());
    setMatchStartedAt(new Date().toISOString());
    setPlayer(nextSession.layout.startPosition);
    setEnemies(initialEnemies(nextSession.layout));
    setActiveAction("move");
    setGameStatus("playing");
    setIsPaused(false);
    setIsUiHidden(false);
    setHealth(PLAYER_MAX_HEALTH);
    setMoveCooldownEndsAt(0);
    setAttackCooldownEndsAt(0);
    setParryUntil(0);
    setParryCooldownEndsAt(0);
    setStunnedUntil(0);
    setMessage("Marca una celda dentro de tu alcance y sobrevive a los ecos de la cueva.");
    setZoneMessage("Solo ves 8 bloques alrededor. Todo lo demas es oscuridad.");
    setScore(0);
    setKills(0);
    setCombatFlash(null);
    setSignals(emptySignals());
    setNoises(emptyNoises());
    setPathPreview([]);
    setMovementPath([]);
    setIsTraversing(false);
    lastZoneIdRef.current = getZoneForPosition(
      nextSession.layout.startPosition,
      nextSession.layout.zones,
    ).id;
  }

  const closestThreat = useMemo(() => {
    return aliveEnemies
      .map((enemy) => ({
        ...enemy,
        distance: distanceBetween(player, enemy),
      }))
      .sort((left, right) => left.distance - right.distance)[0] ?? null;
  }, [aliveEnemies, player]);

  const nearestThreatTiles = closestThreat
    ? Math.max(1, Math.round(closestThreat.distance / TILE_SIZE))
    : null;
  const detectedEnemies = aliveEnemies.filter(
    (enemy) =>
      tileDistance(worldToTile(player), worldToTile(enemy)) <= RADAR_SIGNAL_RANGE_TILES,
  ).length;
  const activeHostiles = aliveEnemies.filter(
    (enemy) =>
      enemy.state === "chasing" ||
      enemy.state === "investigating" ||
      enemy.state === "attacking",
  ).length;
  const nearbyDangerLabel = dangerLabelFromDistance(nearestThreatTiles, activeHostiles);
  const threatSummary =
    aliveEnemies.length === 0
      ? "ninguna amenaza viva"
      : `${aliveEnemies.length} eco${aliveEnemies.length === 1 ? "" : "s"} hostil${aliveEnemies.length === 1 ? "" : "es"} · ${activeHostiles} en alerta`;

  return (
    <section className="relative z-10 h-dvh min-h-dvh overflow-hidden overscroll-none">
      <header
        className="pointer-events-none absolute inset-x-0 top-0 z-70 flex items-start justify-between gap-1.5 px-2 pb-2 sm:gap-2 sm:px-4 sm:py-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.4rem)" }}
      >
        <button
          type="button"
          onClick={onExitToMenu}
          className="pointer-events-auto inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/10 bg-black/55 px-3 py-2 text-[0.72rem] text-zinc-300 backdrop-blur-md transition hover:text-white sm:min-h-11 sm:gap-2 sm:px-4 sm:text-sm"
          aria-label="Volver al menú"
        >
          <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Menu
        </button>

        {!isUiHidden && (
          <div className="min-w-0 max-w-[7.5rem] rounded-full border border-white/10 bg-black/45 px-2.5 py-1.5 text-center backdrop-blur-md sm:max-w-none sm:px-5 sm:py-2">
            <p className="truncate text-[0.52rem] tracking-[0.2em] text-zinc-500 sm:text-[0.65rem] sm:tracking-[0.34em]">SPELEUM</p>
            <h1 className="truncate text-[0.68rem] font-semibold tracking-[0.08em] text-white sm:text-sm sm:tracking-[0.28em]">Supervivencia</h1>
          </div>
        )}

        <div className="flex items-start gap-2">
          <GameTopControls
            isUiHidden={isUiHidden}
            showPause
            isPaused={isPaused}
            onTogglePause={handleTogglePause}
            onToggleUi={() => setIsUiHidden((current) => !current)}
          />
        </div>
      </header>

      <GameMap
        player={player}
        playerCharacterId={selectedCharacter.id}
        enemy={closestThreat}
        enemies={enemies}
        signals={signals}
        activeAction={activeAction}
        isDefending={isParrying}
        currentZone={currentZone}
        gameStatus={gameStatus}
        tiles={caveSession.tiles}
        reachableTiles={reachableTiles}
        selectedPath={pathPreview}
        isMoveReady={!isTraversing && moveCooldownRemaining <= 0}
        onChooseDestination={handleMoveIntent}
      />

      {!isUiHidden && (
        <GameHud
          selectedCharacter={selectedCharacter}
          zone={currentZone}
          objective="Marca una celda dentro de tu pulso visible, gestiona el riesgo y conviertete en la ultima criatura viva."
          message={message}
          zoneMessage={zoneMessage}
          health={health}
          maxHealth={PLAYER_MAX_HEALTH}
          aliveCount={aliveEnemies.length + (gameStatus === "lost" ? 0 : 1)}
          enemyStateLabel={threatSummary}
          isPaused={isPaused}
          score={score}
          kills={kills}
          parryActive={isParrying}
          isStunned={isPlayerStunned}
          moveCooldownRemaining={moveCooldownRemaining}
          attackCooldownRemaining={attackCooldownRemaining}
          parryCooldownRemaining={parryCooldownRemaining}
          parryWindowRemaining={Math.max(0, parryUntil - now)}
          stunRemaining={Math.max(0, stunnedUntil - now)}
          nearestThreatTiles={nearestThreatTiles}
          nearbyDangerLabel={nearbyDangerLabel}
          detectedEnemies={detectedEnemies}
          attackRangeLabel={`${PLAYER_ATTACK_RANGE_TILES} casillas`}
        />
      )}

      {!isUiHidden && (
        <div
          className="absolute bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] right-2 z-70 w-28 max-w-[calc(100vw-1rem)] sm:right-4 sm:top-24 sm:bottom-auto sm:w-52 sm:max-w-[calc(100vw-2rem)]"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.5rem)" }}
        >
          <RadarPanel
            player={player}
            signals={signals}
            moveCooldownRemaining={moveCooldownRemaining}
          />
        </div>
      )}

      {!isUiHidden && combatFlash && (
        <div className="pointer-events-none absolute left-1/2 top-[calc(env(safe-area-inset-top)+12rem)] z-85 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-full border border-rose-200/15 bg-black/70 px-3 py-1.5 text-center text-[0.68rem] tracking-[0.1em] text-rose-100 shadow-[0_0_28px_rgba(251,113,133,0.18)] sm:top-24 sm:px-5 sm:py-2 sm:text-sm sm:tracking-[0.18em]">
          {combatFlash}
        </div>
      )}

      {!isUiHidden && (
        <ActionControls
          activeAction={activeAction}
          cooldownRemaining={attackCooldownRemaining}
          moveCooldownRemaining={moveCooldownRemaining}
          parryCooldownRemaining={parryCooldownRemaining}
          isRecovering={attackCooldownRemaining > 0 || isPaused}
          isParrying={isParrying}
          onMove={() =>
            setMessage(
              moveCooldownRemaining > 0
                ? "Tu pulso de desplazamiento aun se recupera."
                : "Selecciona una celda dentro de tu rango visible para desplazarte.",
            )
          }
          onAttack={handleAttack}
          onDefend={handleDefend}
        />
      )}

      {isPaused && (
        <PauseOverlay
          onContinue={handleTogglePause}
          onExitToMenu={onExitToMenu}
        />
      )}

      <GameOverlay
        status={gameStatus}
        onRestart={restartGame}
        onExitToMenu={onExitToMenu}
        titleOverride={gameStatus === "won" ? "Dominaste la Cueva" : "Criatura Eliminada"}
        messageOverride={
          gameStatus === "won"
            ? "El mapa quedo limpio y Speleum te reconoce como la ultima presencia dominante."
            : "Tu HP llego a cero. La cueva se cerro sobre ti."
        }
      />
    </section>
  );
}
