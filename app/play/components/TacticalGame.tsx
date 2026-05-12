"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { ArrowLeft, Shield } from "lucide-react";
import type { CharacterOption, GameStatus, PlayerPosition } from "../gameConfig";
import {
  ATTACK_COOLDOWN,
  DEFEND_ACTIVE_DURATION,
  DEFEND_COOLDOWN,
  ENEMY_CLOSE_DANGER_TILES,
  ENEMY_MOVE_INTERVAL,
  PLAYER_ATTACK_DAMAGE,
  PLAYER_ATTACK_RANGE_TILES,
  PLAYER_MAX_HEALTH,
  PLAYER_MOVE_RANGE_TILES,
  RADAR_SIGNAL_PROFILES,
  RADAR_SIGNAL_RANGE_TILES,
  SCORE_PER_KILL_FALLBACK,
  SCORE_PER_LOCAL_VICTORY,
  TILE_SIZE,
  caveZones,
  stalkerConfigs,
  startPosition,
} from "../gameConfig";
import {
  applyDamage,
  calculateMoveCooldown,
  createEnemyState,
  distanceBetween,
  getZoneForPosition,
  updateEnemyState,
} from "../gameLogic";
import type { EnemyState } from "../gameLogic";
import type { RadarSignal, SignalType } from "../types";
import { GameHud } from "./GameHud";
import { GameMap } from "./GameMap";
import { ActionControls } from "./ActionControls";
import { RadarPanel } from "./RadarPanel";
import { GameOverlay } from "./GameOverlay";
import { useAuth } from "../../auth/AuthProvider";
import {
  buildPathToTile,
  findReachableTiles,
  tileDistance,
  tileToWorld,
  worldToTile,
} from "../tileMap";

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

function initialEnemies() {
  return stalkerConfigs.map((config) => createEnemyState(config));
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
  const [matchId, setMatchId] = useState(() => createMatchId());
  const [matchStartedAt, setMatchStartedAt] = useState(() => new Date().toISOString());
  const [player, setPlayer] = useState<PlayerPosition>(startPosition);
  const [enemies, setEnemies] = useState<EnemyState[]>(() => initialEnemies());
  const [activeAction, setActiveAction] = useState<"move" | "attack" | "defend">("move");
  const [gameStatus, setGameStatus] = useState<GameStatus>("playing");
  const [health, setHealth] = useState(PLAYER_MAX_HEALTH);
  const [moveCooldownEndsAt, setMoveCooldownEndsAt] = useState(0);
  const [attackCooldownEndsAt, setAttackCooldownEndsAt] = useState(0);
  const [defendingUntil, setDefendingUntil] = useState(0);
  const [defenseCooldownEndsAt, setDefenseCooldownEndsAt] = useState(0);
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
  const [pathPreview, setPathPreview] = useState<PlayerPosition[]>([]);
  const [movementPath, setMovementPath] = useState<PlayerPosition[]>([]);
  const [isTraversing, setIsTraversing] = useState(false);

  const playerRef = useRef(player);
  const enemiesRef = useRef(enemies);
  const gameStatusRef = useRef(gameStatus);
  const moveCooldownEndsAtRef = useRef(moveCooldownEndsAt);
  const attackCooldownEndsAtRef = useRef(attackCooldownEndsAt);
  const defendingUntilRef = useRef(defendingUntil);
  const resultSavedRef = useRef(false);
  const lastZoneIdRef = useRef(getZoneForPosition(startPosition, caveZones).id);
  const combatFlashTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  useEffect(() => {
    enemiesRef.current = enemies;
  }, [enemies]);

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
    defendingUntilRef.current = defendingUntil;
  }, [defendingUntil]);

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
    }, 100);

    return () => window.clearInterval(interval);
  }, []);

  const aliveEnemies = useMemo(
    () => enemies.filter((enemy) => enemy.alive && enemy.state !== "dead"),
    [enemies],
  );
  const currentZone = useMemo(() => getZoneForPosition(player, caveZones), [player]);
  const isDefending = defendingUntil > now && gameStatus === "playing";
  const moveCooldownRemaining = Math.max(0, moveCooldownEndsAt - now);
  const attackCooldownRemaining = Math.max(0, attackCooldownEndsAt - now);
  const defenseCooldownRemaining = Math.max(0, defenseCooldownEndsAt - now);
  const reachableTiles = useMemo(
    () => findReachableTiles(worldToTile(player), PLAYER_MOVE_RANGE_TILES),
    [player],
  );

  useEffect(() => {
    if (lastZoneIdRef.current === currentZone.id) {
      return;
    }

    lastZoneIdRef.current = currentZone.id;
    setZoneMessage(currentZone.ambient);
  }, [currentZone]);

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

    let pendingDamage = 0;
    let hostileCount = 0;
    let lastEnemyMessage: string | null = null;

    const updatedEnemies: EnemyState[] = enemiesRef.current.map((enemy): EnemyState => {
      const config = stalkerConfigs.find((entry) => entry.id === enemy.id);

      if (!config) {
        return enemy;
      }

      const nextEnemy = updateEnemyState(
        enemy,
        playerRef.current,
        config,
        ENEMY_MOVE_INTERVAL / 1000,
        gameStatusRef.current,
      );

      if (!nextEnemy.alive || nextEnemy.state === "dead") {
        return nextEnemy;
      }

      if (nextEnemy.state === "alerted" || nextEnemy.state === "attacking") {
        hostileCount += 1;
      }

      if (nextEnemy.state === "attacking") {
        pendingDamage += nextEnemy.damage;
        addSignal("attack", nextEnemy, nextEnemy.id);
        lastEnemyMessage = `${nextEnemy.name} entra en rango y golpea.`;
        return nextEnemy;
      }

      if (nextEnemy.state === "alerted") {
        addSignal("danger", nextEnemy, nextEnemy.id);
        lastEnemyMessage = `${nextEnemy.name} detecto tu rastro en la cueva.`;
      } else if (tileDistance(worldToTile(playerRef.current), worldToTile(nextEnemy)) <= 5) {
        addSignal("danger", nextEnemy, nextEnemy.id);
      }

      return nextEnemy;
    });

    if (pendingDamage > 0) {
      const blocked = Date.now() < defendingUntilRef.current;
      const nextHealth = applyDamage(health, pendingDamage, blocked);
      setHealth(nextHealth);
      showCombatFlash(blocked ? `Bloqueaste ${pendingDamage}` : `-${pendingDamage} HP`);

      if (nextHealth <= 0) {
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

      setPlayer(nextStep);
      addSignal("move", nextStep, "player");
      stepIndex += 1;

      if (stepIndex >= movementPath.length) {
        window.clearInterval(interval);
        setMovementPath([]);
        setPathPreview([]);
        setIsTraversing(false);
      }
    }, 78);

    return () => window.clearInterval(interval);
  }, [gameStatus, movementPath]);

  function queueMovementTo(target: PlayerPosition) {
    if (gameStatus !== "playing") {
      return;
    }

    if (moveCooldownEndsAtRef.current > Date.now() || isTraversing) {
      setMessage("Tu pulso aun no se estabiliza para otro desplazamiento.");
      return;
    }

    const originTile = worldToTile(playerRef.current);
    const targetTile = worldToTile(target);
    const reachable = reachableTiles.get(`${targetTile.col},${targetTile.row}`);

    if (
      !reachable ||
      (targetTile.col === originTile.col && targetTile.row === originTile.row)
    ) {
      setMessage("Esa celda no esta disponible dentro de tu alcance.");
      setPathPreview([]);
      return;
    }

    const path = buildPathToTile(originTile, targetTile, PLAYER_MOVE_RANGE_TILES);

    if (!path || path.length <= 1) {
      setMessage("No hay una ruta caminable hacia esa celda.");
      setPathPreview([]);
      return;
    }

    const worldPath = path.slice(1).map(tileToWorld);
    const travelDistanceTiles = path.length - 1;
    const moveCooldown = calculateMoveCooldown(travelDistanceTiles);

    setIsTraversing(true);
    setMovementPath(worldPath);
    setPathPreview(worldPath);
    setMoveCooldownEndsAt(Date.now() + moveCooldown);
    setActiveAction("move");
    setMessage(
      travelDistanceTiles === 1
        ? "Avanzas con cuidado una casilla."
        : `Te deslizas ${travelDistanceTiles} casillas por la cueva.`,
    );
  }

  function handleMoveIntent(target: PlayerPosition) {
    queueMovementTo(target);
  }

  function handleAttack() {
    if (gameStatus !== "playing") {
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
      .find((enemy) => tileDistance(playerTile, worldToTile(enemy)) <= PLAYER_ATTACK_RANGE_TILES);

    setAttackCooldownEndsAt(Date.now() + ATTACK_COOLDOWN);
    setActiveAction("attack");
    addSignal("attack", playerRef.current, "player");

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
        const config = stalkerConfigs.find((entry) => entry.id === enemy.id);
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
        state: "alerted" as const,
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

    if (defenseCooldownRemaining > 0) {
      setMessage("Tu coraza aun no esta lista para otro bloqueo.");
      return;
    }

    const activatedAt = Date.now();
    setDefendingUntil(activatedAt + DEFEND_ACTIVE_DURATION);
    setDefenseCooldownEndsAt(activatedAt + DEFEND_COOLDOWN);
    setActiveAction("defend");
    addSignal("defend", playerRef.current, "player");
    setMessage("Endureces el cuerpo y amortiguas el siguiente intercambio.");
    showCombatFlash("Defensa activa");
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
    setMatchId(createMatchId());
    setMatchStartedAt(new Date().toISOString());
    setPlayer(startPosition);
    setEnemies(initialEnemies());
    setActiveAction("move");
    setGameStatus("playing");
    setHealth(PLAYER_MAX_HEALTH);
    setMoveCooldownEndsAt(0);
    setAttackCooldownEndsAt(0);
    setDefendingUntil(0);
    setDefenseCooldownEndsAt(0);
    setMessage("Marca una celda dentro de tu alcance y sobrevive a los ecos de la cueva.");
    setZoneMessage("Solo ves 8 bloques alrededor. Todo lo demas es oscuridad.");
    setScore(0);
    setKills(0);
    setCombatFlash(null);
    setSignals(emptySignals());
    setPathPreview([]);
    setMovementPath([]);
    setIsTraversing(false);
    lastZoneIdRef.current = getZoneForPosition(startPosition, caveZones).id;
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
    (enemy) => enemy.state === "alerted" || enemy.state === "attacking",
  ).length;
  const nearbyDangerLabel = dangerLabelFromDistance(nearestThreatTiles, activeHostiles);
  const threatSummary =
    aliveEnemies.length === 0
      ? "ninguna amenaza viva"
      : `${aliveEnemies.length} eco${aliveEnemies.length === 1 ? "" : "s"} hostil${aliveEnemies.length === 1 ? "" : "es"} · ${activeHostiles} en alerta`;

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
          <p className="text-[0.65rem] tracking-[0.34em] text-zinc-500">SPELEUM</p>
          <h1 className="text-sm font-semibold tracking-[0.28em] text-white">Supervivencia</h1>
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
        isDefending={isDefending}
        currentZone={currentZone}
        gameStatus={gameStatus}
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
        defenseActive={isDefending}
        moveCooldownRemaining={moveCooldownRemaining}
        attackCooldownRemaining={attackCooldownRemaining}
        defenseCooldownRemaining={defenseCooldownRemaining}
        defenseDurationRemaining={Math.max(0, defendingUntil - now)}
        nearestThreatTiles={nearestThreatTiles}
        nearbyDangerLabel={nearbyDangerLabel}
        detectedEnemies={detectedEnemies}
        attackRangeLabel={`${PLAYER_ATTACK_RANGE_TILES} casillas`}
      />

      <div className="absolute right-4 top-24 z-70 w-52 max-w-[calc(100vw-2rem)]">
        <RadarPanel
          player={player}
          enemy={closestThreat}
          enemies={enemies}
          signals={signals}
          moveCooldownRemaining={moveCooldownRemaining}
        />
      </div>

      {combatFlash && (
        <div className="pointer-events-none absolute left-1/2 top-24 z-[85] -translate-x-1/2 rounded-full border border-rose-200/15 bg-black/70 px-5 py-2 text-sm tracking-[0.18em] text-rose-100 shadow-[0_0_28px_rgba(251,113,133,0.18)]">
          {combatFlash}
        </div>
      )}

      <ActionControls
        activeAction={activeAction}
        cooldownRemaining={attackCooldownRemaining}
        moveCooldownRemaining={moveCooldownRemaining}
        defenseCooldownRemaining={defenseCooldownRemaining}
        isRecovering={attackCooldownRemaining > 0}
        isDefending={isDefending}
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
