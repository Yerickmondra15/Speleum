"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { ArrowLeft, Shield } from "lucide-react";
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

    setSignals((current) => [
      ...current.slice(-20),
      {
        id: Date.now() + current.length,
        type,
        strength: profile.strength,
        x: position.x,
        y: position.y,
        createdAt: Date.now(),
        duration: profile.duration,
        radarJitter: profile.radarJitter,
        ownerId,
      },
    ]);
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

    let stepIndex = 0;
    const interval = window.setInterval(() => {
      const nextStep = movementPath[stepIndex];

      if (!nextStep) {
        window.clearInterval(interval);
        setMovementPath([]);
        setPathPreview([]);
        setIsTraversing(false);
        return;
      }

      if (isStunned(stunnedUntilRef.current, Date.now())) {
        window.clearInterval(interval);
        setMovementPath([]);
        setPathPreview([]);
        setIsTraversing(false);
        return;
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
      stepIndex += 1;

      if (stepIndex >= movementPath.length) {
        window.clearInterval(interval);
        setMovementPath([]);
        setPathPreview([]);
        setIsTraversing(false);
      }
    }, MOVEMENT_STEP_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [gameStatus, movementPath, selectedCharacter.moveSignalMultiplier]);

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
    } else if (key === " ") {
      event.preventDefault();
      handleAttack();
    } else if (key === "shift") {
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
    const nextSession = createLocalCaveSession();
    setCaveSession(nextSession);
    setMatchId(createMatchId());
    setMatchStartedAt(new Date().toISOString());
    setPlayer(nextSession.layout.startPosition);
    setEnemies(initialEnemies(nextSession.layout));
    setActiveAction("move");
    setGameStatus("playing");
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
    <section className="relative z-10 min-h-screen overflow-hidden">
      <header className="pointer-events-none absolute inset-x-0 top-0 z-70 flex items-start justify-between gap-2 px-3 py-3 sm:px-4 sm:py-4">
        <button
          type="button"
          onClick={onExitToMenu}
          className="pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-black/55 px-4 py-2 text-sm text-zinc-300 backdrop-blur-md transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Menu
        </button>

        <div className="rounded-full border border-white/10 bg-black/45 px-3 py-2 text-center backdrop-blur-md sm:px-5">
          <p className="text-[0.65rem] tracking-[0.34em] text-zinc-500">SPELEUM</p>
          <h1 className="text-[0.8rem] font-semibold tracking-[0.16em] text-white sm:text-sm sm:tracking-[0.28em]">Supervivencia</h1>
        </div>

        <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-black/45 px-4 py-2 text-xs text-zinc-400 backdrop-blur-md sm:flex">
          <Shield className="h-4 w-4" />
          {selectedCharacter.name}
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
        isPaused={false}
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

      <div className="absolute bottom-28 right-3 z-70 w-36 max-w-[calc(100vw-1.5rem)] sm:right-4 sm:top-24 sm:bottom-auto sm:w-52 sm:max-w-[calc(100vw-2rem)]">
        <RadarPanel
          player={player}
          signals={signals}
          moveCooldownRemaining={moveCooldownRemaining}
        />
      </div>

      {combatFlash && (
        <div className="pointer-events-none absolute left-1/2 top-[12.75rem] z-[85] w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-full border border-rose-200/15 bg-black/70 px-4 py-2 text-center text-xs tracking-[0.12em] text-rose-100 shadow-[0_0_28px_rgba(251,113,133,0.18)] sm:top-24 sm:px-5 sm:text-sm sm:tracking-[0.18em]">
          {combatFlash}
        </div>
      )}

      <ActionControls
        activeAction={activeAction}
        cooldownRemaining={attackCooldownRemaining}
        moveCooldownRemaining={moveCooldownRemaining}
        parryCooldownRemaining={parryCooldownRemaining}
        isRecovering={attackCooldownRemaining > 0}
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
