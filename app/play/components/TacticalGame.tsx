"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { ActionKind, CharacterOption, GameStatus, PlayerPosition } from "../gameConfig";
import {
  ATTACK_COOLDOWN,
  ENEMY_CLOSE_DANGER_TILES,
  ENEMY_MOVE_INTERVAL,
  MOVEMENT_STEP_INTERVAL_MS,
  PARRY_COOLDOWN_MS,
  PARRY_WINDOW_MS,
  PLAYER_ATTACK_DAMAGE,
  PLAYER_ATTACK_RANGE_TILES,
  RADAR_SIGNAL_PROFILES,
  SCORE_PER_KILL_FALLBACK,
  SCORE_PER_LOCAL_VICTORY,
  TILE_SIZE,
  VISION_RADIUS,
} from "../gameConfig";
import {
  isAttackReachableByTiles,
  isStunned,
  planMovementPath,
  createLocalEnemyTargets,
  createEnemyState,
  distanceBetween,
  getZoneForPosition,
  hitHazard,
  resolveCombatHit,
  resolveMissedParry,
  selectNearestReachableTarget,
  transitionEnemyToDead,
  updateEnemyState,
} from "../gameLogic";
import type { EnemyState } from "../gameLogic";
import type { NoiseEvent, RadarSignal, SignalType } from "../types";
import { GameHud } from "./GameHud";
import { GameMap } from "./GameMap";
import { ActionControls } from "./ActionControls";
import { SpeleumBrand } from "@/app/components/SpeleumBrand";
import { RadarPanel } from "./RadarPanel";
import { GameOverlay } from "./GameOverlay";
import { saveMatchResultRequest } from "@/lib/matches/client-result-persistence";
import { GameTopControls } from "./GameTopControls";
import { PauseOverlay } from "./PauseOverlay";
import {
  buildTileMap,
  createTileLookup,
  findReachableTiles,
  tileDistance,
  tileToWorld,
  worldToTile,
} from "../tileMap";
import { createCaveLayout, type CaveLayout } from "../proceduralCave";
import { createRadarSignal, pruneExpiredRadarSignals, upsertRadarSignal } from "../signalUtils";
import {
  applyCreatureIncomingDamage,
  applyCreatureNoise,
  applyCreatureOutgoingDamage,
  getCreatureGameplayModifiers,
} from "@/lib/creature-gameplay";
import { createGameplayEventId } from "@/lib/gameplay/event-ids";
import type { CreatureId } from "@/lib/creatures";
import {
  activateCreatureAbility,
  cancelRegenerationOnDamage,
  consumeAbilityEffects,
  createAbilityState,
  getAbilityModifiers,
  pruneAbilityState,
  type AbilityState,
  type SilkTrap,
} from "@/lib/gameplay/abilities";
import {
  createSanityState,
  shiftSanityTimeline,
  updateSanityForPosition,
  type SanityState,
} from "@/lib/gameplay/sanity";
import {
  clampHealing,
  noiseTerrainMultiplier,
  percentageHealing,
  terrainNameAt,
  updateShelterRecovery,
  type ShelterRecoveryState,
} from "@/lib/gameplay/survival";
import { SURVIVAL_RULES } from "@/lib/gameplay/rules";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import {
  getLocalizedAbilityName,
  localizeZone,
  translateGameplayMessage,
} from "@/lib/i18n/content";
import { useAudio } from "@/lib/audio/AudioProvider";
import { formatMessage } from "@/lib/i18n/messages";
import { useAuth } from "@/app/auth/AuthProvider";

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

function initialEnemies(layout: CaveLayout, now = Date.now()) {
  return layout.enemyConfigs.map((config) => createEnemyState(config, now));
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
  const { locale, messages } = useLanguage();
  const { user } = useAuth();
  const isAdmin = user?.isAdmin === true;
  const gameCopy = messages.play.game;
  const { unlock, setAmbientActive, playSfx } = useAudio();
  const creatureModifiers = getCreatureGameplayModifiers(selectedCharacter.id);
  const [caveSession, setCaveSession] = useState<LocalCaveSession>(() => createLocalCaveSession());
  const [matchId, setMatchId] = useState(() => createMatchId());
  const [matchStartedAt, setMatchStartedAt] = useState(() => new Date().toISOString());
  const [player, setPlayer] = useState<PlayerPosition>(() => caveSession.layout.startPosition);
  const [enemies, setEnemies] = useState<EnemyState[]>(() => initialEnemies(caveSession.layout));
  const [activeAction, setActiveAction] = useState<ActionKind>("move");
  const [gameStatus, setGameStatus] = useState<GameStatus>("playing");
  const [isPaused, setIsPaused] = useState(false);
  const [isUiHidden, setIsUiHidden] = useState(false);
  const [isAdminDemoEnabled, setIsAdminDemoEnabled] = useState(false);
  const [demoZoom, setDemoZoom] = useState(1);
  const adminDemoEnabled = isAdmin && isAdminDemoEnabled;
  const [health, setHealth] = useState(creatureModifiers.maxHealth);
  const [moveCooldownEndsAt, setMoveCooldownEndsAt] = useState(0);
  const [attackCooldownEndsAt, setAttackCooldownEndsAt] = useState(0);
  const [parryUntil, setParryUntil] = useState(0);
  const [parryCooldownEndsAt, setParryCooldownEndsAt] = useState(0);
  const [stunnedUntil, setStunnedUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [message, setMessage] = useState<string>(gameCopy.initialMessage);
  const [zoneMessage, setZoneMessage] = useState<string | null>(gameCopy.initialZone);
  const [score, setScore] = useState(0);
  const [kills, setKills] = useState(0);
  const [combatFlash, setCombatFlash] = useState<string | null>(null);
  const [signals, setSignals] = useState<RadarSignal[]>(() => emptySignals());
  const [noises, setNoises] = useState<NoiseEvent[]>(() => emptyNoises());
  const [pathPreview, setPathPreview] = useState<PlayerPosition[]>([]);
  const [movementPath, setMovementPath] = useState<PlayerPosition[]>([]);
  const [isTraversing, setIsTraversing] = useState(false);
  const [abilityState, setAbilityState] = useState<AbilityState>(() => createAbilityState());
  const [traps, setTraps] = useState<SilkTrap[]>([]);
  const [sanityState, setSanityState] = useState<SanityState>(() => {
    const tile = worldToTile(caveSession.layout.startPosition);
    return createSanityState(Date.now(), `${tile.col},${tile.row}`);
  });
  const [shelterState, setShelterState] = useState<ShelterRecoveryState>({
    shelterKey: null,
    enteredAt: null,
    progress: 0,
  });
  const [exhaustedShelters, setExhaustedShelters] = useState<Set<string>>(() => new Set());

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
  const abilityStateRef = useRef(abilityState);
  const sanityStateRef = useRef(sanityState);
  const shelterStateRef = useRef(shelterState);
  const exhaustedSheltersRef = useRef(exhaustedShelters);
  const lastAbilityTickAtRef = useRef(Date.now());
  const moveNoiseMultiplierRef = useRef(1);

  const endAsLoss = useCallback((nextMessage: string) => {
    setMessage(nextMessage);
    gameStatusRef.current = "lost";
    setGameStatus("lost");
    playSfx("defeat");
  }, [playSfx]);

  const endAsWin = useCallback((nextMessage: string) => {
    setMessage(nextMessage);
    gameStatusRef.current = "won";
    setGameStatus("won");
    playSfx("victory");
  }, [playSfx]);

  useEffect(() => {
    unlock();
    setAmbientActive(true);
    playSfx("start");
    return () => setAmbientActive(false);
  }, [playSfx, setAmbientActive, unlock]);

  useEffect(() => {
    const updateCopy = window.setTimeout(() => {
      setMessage(gameCopy.initialMessage);
      setZoneMessage(gameCopy.initialZone);
    }, 0);
    return () => window.clearTimeout(updateCopy);
  }, [gameCopy.initialMessage, gameCopy.initialZone]);

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
    abilityStateRef.current = abilityState;
  }, [abilityState]);

  useEffect(() => {
    if ((gameStatus !== "won" && gameStatus !== "lost") || resultSavedRef.current) {
      return;
    }

    resultSavedRef.current = true;

    void saveMatchResultRequest(
      {
        matchId,
        mode: "local",
        status: "finished",
        startedAt: matchStartedAt,
        endedAt: new Date().toISOString(),
        creature: selectedCharacter.id,
        result: gameStatus === "won" ? "win" : "loss",
      },
      { maxAttempts: 3 },
    ).catch(() => {
      resultSavedRef.current = false;
      setMessage(gameCopy.localSaveFailed);
    });
  }, [gameCopy.localSaveFailed, gameStatus, matchId, matchStartedAt, selectedCharacter.id]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (gameStatusRef.current !== "playing") {
        return;
      }

      const tickNow = Date.now();
      setNow(tickNow);
      const missedParry = resolveMissedParry({
        parryUntil: parryUntilRef.current,
        stunnedUntil: stunnedUntilRef.current,
        now: tickNow,
      });
      if (missedParry.missed) {
        parryUntilRef.current = missedParry.nextParryUntil;
        stunnedUntilRef.current = missedParry.nextStunnedUntil;
        setParryUntil(missedParry.nextParryUntil);
        setStunnedUntil(missedParry.nextStunnedUntil);
        setMessage("Bloqueaste demasiado pronto: la apertura te deja aturdido.");
        showCombatFlash("Parry fallido · stun");
      }
      const regeneration = abilityStateRef.current.activeEffects.find(
        (effect) =>
          effect.kind === "health-regeneration" &&
          effect.expiresAt > lastAbilityTickAtRef.current,
      );
      if (regeneration) {
        const overlapEnd = Math.min(tickNow, regeneration.expiresAt);
        const elapsed = Math.max(
          0,
          overlapEnd - Math.max(lastAbilityTickAtRef.current, regeneration.startedAt),
        );
        const duration = Math.max(1, regeneration.expiresAt - regeneration.startedAt);
        const healed = clampHealing(
          healthRef.current,
          creatureModifiers.maxHealth,
          creatureModifiers.maxHealth * regeneration.value * (elapsed / duration),
        );
        healthRef.current = healed;
        setHealth(healed);
      }
      lastAbilityTickAtRef.current = tickNow;
      const prunedAbility = pruneAbilityState(abilityStateRef.current, tickNow);
      abilityStateRef.current = prunedAbility;
      setAbilityState(prunedAbility);

      const tile = worldToTile(playerRef.current);
      const sanity = updateSanityForPosition({
        state: sanityStateRef.current,
        positionKey: `${tile.col},${tile.row}`,
        now: tickNow,
        maxHealth: creatureModifiers.maxHealth,
      });
      sanityStateRef.current = sanity.state;
      setSanityState(sanity.state);
      if (sanity.damage > 0) {
        const nextHealth = Math.max(0, healthRef.current - sanity.damage);
        healthRef.current = nextHealth;
        setHealth(nextHealth);
        setMessage("La oscuridad te alcanza. Muévete al menos una celda.");
        showCombatFlash(`-${sanity.damage} HP · encierro`);
        if (nextHealth <= 0) {
          endAsLoss("Permaneciste inmóvil demasiado tiempo y la cueva te consumió.");
          return;
        }
      }

      if (healthRef.current < creatureModifiers.maxHealth) {
        const recovery = updateShelterRecovery({
          state: shelterStateRef.current,
          position: playerRef.current,
          lookup: caveSession.lookup,
          now: tickNow,
          exhaustedShelters: exhaustedSheltersRef.current,
        });
        shelterStateRef.current = recovery.state;
        setShelterState(recovery.state);
        if (recovery.ready && recovery.state.shelterKey) {
          const nextHealth = clampHealing(
            healthRef.current,
            creatureModifiers.maxHealth,
            percentageHealing(
              creatureModifiers.maxHealth,
              SURVIVAL_RULES.shelter.healFraction,
            ),
          );
          healthRef.current = nextHealth;
          setHealth(nextHealth);
          const nextExhausted = new Set(exhaustedSheltersRef.current);
          nextExhausted.add(recovery.state.shelterKey);
          exhaustedSheltersRef.current = nextExhausted;
          setExhaustedShelters(nextExhausted);
          shelterStateRef.current = { ...recovery.state, enteredAt: null, progress: 0 };
          setShelterState(shelterStateRef.current);
          setMessage("El refugio cede su última reserva y queda agotado.");
          showCombatFlash("Refugio +22% HP");
        }
      } else if (shelterStateRef.current.progress > 0) {
        shelterStateRef.current = { shelterKey: null, enteredAt: null, progress: 0 };
        setShelterState(shelterStateRef.current);
      }

      setTraps((current) => current.filter((trap) => trap.expiresAt > tickNow));
      setSignals((current) => pruneExpiredRadarSignals(current, tickNow));
      setNoises((current) => {
        const activeNoises = current.filter((noise) => tickNow - noise.createdAt < 3200);
        noisesRef.current = activeNoises;
        return activeNoises;
      });
    }, 100);

    return () => window.clearInterval(interval);
  }, [caveSession.lookup, creatureModifiers.maxHealth, endAsLoss]);

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
  const abilityModifiers = getAbilityModifiers(abilityState, now);
  const abilityCooldownRemaining = Math.max(0, abilityState.cooldownUntil - now);
  const effectiveRadarRange =
    creatureModifiers.radarRangeTiles + abilityModifiers.radarRangeBonusTiles;
  const reachableTiles = useMemo(
    () => findReachableTiles(
      worldToTile(player),
      creatureModifiers.moveRangeTiles + abilityModifiers.moveRangeBonusTiles,
      caveSession.lookup,
    ),
    [abilityModifiers.moveRangeBonusTiles, caveSession.lookup, creatureModifiers.moveRangeTiles, player],
  );
  const attackableTiles = useMemo(
    () => findReachableTiles(worldToTile(player), PLAYER_ATTACK_RANGE_TILES, caveSession.lookup),
    [caveSession.lookup, player],
  );

  useEffect(() => {
    if (lastZoneIdRef.current === currentZone.id) {
      return;
    }

    lastZoneIdRef.current = currentZone.id;
    setZoneMessage(localizeZone(locale, currentZone).ambient);
  }, [currentZone, locale]);

  useEffect(() => {
    const cave = caveSession.layout;
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
    const createdAt = Date.now();
    const nextNoises = [
      ...noisesRef.current.slice(-24),
      {
        id: createGameplayEventId("noise", sourceId, createdAt),
        type,
        sourceId,
        position,
        radiusTiles,
        intensity,
        createdAt,
      },
    ];
    noisesRef.current = nextNoises;
    setNoises(nextNoises);
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

  const enemyTurn = useEffectEvent(() => {
    if (gameStatusRef.current !== "playing") {
      return;
    }

    const turnNow = Date.now();
    let nextPlayerHealth = healthRef.current;
    let hostileCount = 0;
    let lastEnemyMessage: string | null = null;
    let activeTraps = traps.filter((trap) => trap.expiresAt > turnNow);

    const updatedEnemies: EnemyState[] = enemiesRef.current.map((enemy): EnemyState => {
      const config = caveSession.layout.enemyConfigs.find((entry) => entry.id === enemy.id);

      if (!config) {
        return enemy;
      }

      let nextEnemy = updateEnemyState(
        enemy,
        createLocalEnemyTargets(playerRef.current),
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
      if (enemyMoved) {
        const enemyTile = worldToTile(nextEnemy);
        const trap = activeTraps.find((entry) => {
          const trapTile = worldToTile(entry.position);
          return trapTile.col === enemyTile.col && trapTile.row === enemyTile.row;
        });
        if (trap) {
          nextEnemy = { ...nextEnemy, stunnedUntil: turnNow + trap.stunMs, state: "stunned" };
          activeTraps = activeTraps.filter((entry) => entry.id !== trap.id);
          lastEnemyMessage = `${nextEnemy.name} queda inmovilizada por la seda.`;
        }
      }
      const stateChanged = enemy.state !== nextEnemy.state;

      if (
        nextEnemy.state === "chasing" ||
        nextEnemy.state === "investigating" ||
        nextEnemy.state === "attacking"
      ) {
        hostileCount += 1;
      }

      if (nextEnemy.state === "attacking") {
        const canHitPlayer = isAttackReachableByTiles(
          nextEnemy,
          playerRef.current,
          nextEnemy.attackRangeTiles,
          caveSession.lookup,
        );

        if (!canHitPlayer || turnNow < nextEnemy.nextAttackAt) {
          return nextEnemy;
        }

        const resolution = resolveCombatHit({
          targetHealth: nextPlayerHealth,
          damage: Math.max(
            0,
            Math.round(
              applyCreatureIncomingDamage(nextEnemy.damage, selectedCharacter.id) *
                getAbilityModifiers(abilityStateRef.current, turnNow).incomingDamageMultiplier,
            ),
          ),
          now: turnNow,
          targetParryUntil: parryUntilRef.current,
        });
        addSignal("attack", nextEnemy, nextEnemy.id);
        addNoise("attack", nextEnemy, 8, 1.1, nextEnemy.id);

        if (resolution.wasParried) {
          parryUntilRef.current = resolution.nextParryUntil;
          setParryUntil(resolution.nextParryUntil);
          lastEnemyMessage = `Parry perfecto: ${nextEnemy.name} queda aturdida.`;
          showCombatFlash("Parry");
          return {
            ...nextEnemy,
            lastAttackAt: turnNow,
            nextAttackAt: turnNow + ATTACK_COOLDOWN,
            stunnedUntil: resolution.attackerStunnedUntil,
          };
        }

        nextPlayerHealth = resolution.nextHealth;
        lastEnemyMessage = `${nextEnemy.name} entra en rango y golpea.`;
        return {
          ...nextEnemy,
          lastAttackAt: turnNow,
          nextAttackAt: turnNow + ATTACK_COOLDOWN,
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
    setTraps(activeTraps);

    if (nextPlayerHealth !== healthRef.current) {
      const damageTaken = Math.max(0, healthRef.current - nextPlayerHealth);
      healthRef.current = nextPlayerHealth;
      setHealth(nextPlayerHealth);
      abilityStateRef.current = cancelRegenerationOnDamage(
        abilityStateRef.current,
        damageTaken,
        creatureModifiers.maxHealth,
      );
      setAbilityState(abilityStateRef.current);
      showCombatFlash(`-${damageTaken} HP`);
      playSfx("damage");
      if (nextPlayerHealth <= 0) {
        enemiesRef.current = updatedEnemies;
        setEnemies(updatedEnemies);
        endAsLoss("Tu vida llego a cero. La cueva cerro el combate a su favor.");
        return;
      }
    }

    if (updatedEnemies.every((enemy) => !enemy.alive || enemy.state === "dead")) {
      enemiesRef.current = updatedEnemies;
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

    enemiesRef.current = updatedEnemies;
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

        playerRef.current = nextStep;
        setPlayer(nextStep);
        addSignal("move", nextStep, "player");
        const noise = applyCreatureNoise(6, 0.45, selectedCharacter.id);
        const terrainNoise = noiseTerrainMultiplier(nextStep, caveSession.lookup);
        addNoise(
          "move",
          nextStep,
          Math.max(
            1,
            Math.round(noise.radiusTiles * terrainNoise * moveNoiseMultiplierRef.current),
          ),
          noise.intensity * terrainNoise * moveNoiseMultiplierRef.current,
          "player",
        );

        if (hitHazard(nextStep, caveSession.layout.hazardAreas)) {
          window.clearInterval(interval);
          healthRef.current = 0;
          setHealth(0);
          setPathPreview([]);
          setIsTraversing(false);
          endAsLoss("La cueva te atrapo en una zona letal.");
          return [];
        }

        setPathPreview(rest);

        if (rest.length === 0) {
          window.clearInterval(interval);
          setIsTraversing(false);
        }

        return rest;
      });
    }, MOVEMENT_STEP_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [caveSession.layout.hazardAreas, caveSession.lookup, endAsLoss, gameStatus, movementPath.length, selectedCharacter.id]);

  function shiftGameplayTimeline(deltaMs: number) {
    if (deltaMs <= 0) {
      return;
    }

    setNow((current) => current + deltaMs);
    setMoveCooldownEndsAt((current) => {
      const shiftedMoveCooldown = current > 0 ? current + deltaMs : current;
      moveCooldownEndsAtRef.current = shiftedMoveCooldown;
      return shiftedMoveCooldown;
    });
    setAttackCooldownEndsAt((current) => {
      const shiftedAttackCooldown = current > 0 ? current + deltaMs : current;
      attackCooldownEndsAtRef.current = shiftedAttackCooldown;
      return shiftedAttackCooldown;
    });
    setParryUntil((current) => {
      const shiftedParryUntil = current > 0 ? current + deltaMs : current;
      parryUntilRef.current = shiftedParryUntil;
      return shiftedParryUntil;
    });
    setParryCooldownEndsAt((current) => (current > 0 ? current + deltaMs : current));
    setStunnedUntil((current) => {
      const shiftedStunnedUntil = current > 0 ? current + deltaMs : current;
      stunnedUntilRef.current = shiftedStunnedUntil;
      return shiftedStunnedUntil;
    });
    setSignals((current) =>
      current.map((signal) => ({
        ...signal,
        createdAt: signal.createdAt + deltaMs,
      })),
    );
    setNoises((current) => {
      const shiftedNoises = current.map((noise) => ({
        ...noise,
        createdAt: noise.createdAt + deltaMs,
      }));
      noisesRef.current = shiftedNoises;
      return shiftedNoises;
    });
    setEnemies((current) => {
      const shiftedEnemies = current.map((enemy) => ({
        ...enemy,
        stateSince: enemy.stateSince + deltaMs,
        lastMoveAt: enemy.lastMoveAt > 0 ? enemy.lastMoveAt + deltaMs : enemy.lastMoveAt,
        nextMoveAt: enemy.nextMoveAt > 0 ? enemy.nextMoveAt + deltaMs : enemy.nextMoveAt,
        lastAttackAt: enemy.lastAttackAt > 0 ? enemy.lastAttackAt + deltaMs : enemy.lastAttackAt,
        nextAttackAt: enemy.nextAttackAt > 0 ? enemy.nextAttackAt + deltaMs : enemy.nextAttackAt,
        stunnedUntil: enemy.stunnedUntil > 0 ? enemy.stunnedUntil + deltaMs : enemy.stunnedUntil,
      }));
      enemiesRef.current = shiftedEnemies;
      return shiftedEnemies;
    });
    const shiftedAbility: AbilityState = {
      cooldownUntil:
        abilityStateRef.current.cooldownUntil > 0
          ? abilityStateRef.current.cooldownUntil + deltaMs
          : 0,
      activeEffects: abilityStateRef.current.activeEffects.map((effect) => ({
        ...effect,
        startedAt: effect.startedAt + deltaMs,
        expiresAt: effect.expiresAt + deltaMs,
      })),
    };
    abilityStateRef.current = shiftedAbility;
    setAbilityState(shiftedAbility);
    sanityStateRef.current = shiftSanityTimeline(sanityStateRef.current, deltaMs);
    setSanityState(sanityStateRef.current);
    if (shelterStateRef.current.enteredAt !== null) {
      shelterStateRef.current = {
        ...shelterStateRef.current,
        enteredAt: shelterStateRef.current.enteredAt + deltaMs,
      };
      setShelterState(shelterStateRef.current);
    }
    setTraps((current) =>
      current.map((trap) => ({
        ...trap,
        createdAt: trap.createdAt + deltaMs,
        expiresAt: trap.expiresAt + deltaMs,
      })),
    );
    lastAbilityTickAtRef.current += deltaMs;
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
      gameStatusRef.current = "playing";
      setGameStatus("playing");
      return;
    }

    pausedAtRef.current = Date.now();
    setIsPaused(true);
    gameStatusRef.current = "paused";
    setGameStatus("paused");
  }

  function queueMovementTo(target: PlayerPosition) {
    if (gameStatus !== "playing") {
      return;
    }

    if (isStunned(stunnedUntilRef.current, Date.now())) {
      setMessage(gameCopy.stunnedMove);
      return;
    }

    if ((!adminDemoEnabled && moveCooldownEndsAtRef.current > Date.now()) || isTraversing) {
      setMessage(gameCopy.movementRecovering);
      return;
    }

    const actionNow = Date.now();
    const currentAbilityModifiers = getAbilityModifiers(abilityStateRef.current, actionNow);
    if (currentAbilityModifiers.movementLocked) {
      setMessage(gameCopy.shellLocked);
      return;
    }

    const movePlan = planMovementPath(
      playerRef.current,
      target,
      creatureModifiers.moveRangeTiles + currentAbilityModifiers.moveRangeBonusTiles,
      caveSession.lookup,
      selectedCharacter.moveCooldownMultiplier,
    );

    if (!movePlan) {
      setMessage(gameCopy.noPath);
      setPathPreview([]);
      return;
    }

    setIsTraversing(true);
    moveNoiseMultiplierRef.current = currentAbilityModifiers.noiseMultiplier;
    abilityStateRef.current = consumeAbilityEffects(
      abilityStateRef.current,
      "move",
      actionNow,
    );
    setAbilityState(abilityStateRef.current);
    setMovementPath(movePlan.worldPath);
    setPathPreview(movePlan.worldPath);
    const nextMoveCooldownEndsAt = adminDemoEnabled ? 0 : Date.now() + movePlan.cooldownMs;
    moveCooldownEndsAtRef.current = nextMoveCooldownEndsAt;
    setMoveCooldownEndsAt(nextMoveCooldownEndsAt);
    setActiveAction("move");
    setMessage(
      movePlan.distanceTiles === 1
        ? gameCopy.moveOne
        : formatMessage(gameCopy.moveMany, { count: movePlan.distanceTiles }),
    );
  }

  function handleMoveIntent(target: PlayerPosition) {
    queueMovementTo(target);
  }

  function handleAttack() {
    if (gameStatus !== "playing") {
      return;
    }

    const actionNow = Date.now();

    if (isStunned(stunnedUntilRef.current, actionNow)) {
      setMessage(gameCopy.stunnedAttack);
      return;
    }

    if (moveCooldownEndsAtRef.current > actionNow) {
      setMessage(gameCopy.attackRecovering);
      return;
    }

    if (attackCooldownEndsAtRef.current > actionNow) {
      setMessage(gameCopy.attackCooldown);
      return;
    }

    const selectedTarget = selectNearestReachableTarget(
      playerRef.current,
      enemiesRef.current
        .filter((enemy) => enemy.alive && enemy.state !== "dead")
        .map((enemy) => ({ id: enemy.id, position: { x: enemy.x, y: enemy.y } })),
      PLAYER_ATTACK_RANGE_TILES,
      caveSession.lookup,
    );
    const target = selectedTarget
      ? enemiesRef.current.find((enemy) => enemy.id === selectedTarget.id) ?? null
      : null;

    const nextAttackCooldownEndsAt = actionNow + ATTACK_COOLDOWN;
    attackCooldownEndsAtRef.current = nextAttackCooldownEndsAt;
    setAttackCooldownEndsAt(nextAttackCooldownEndsAt);
    setActiveAction("attack");
    addSignal("attack", playerRef.current, "player");
    const attackNoise = applyCreatureNoise(9, 1.2, selectedCharacter.id);
    addNoise("attack", playerRef.current, attackNoise.radiusTiles, attackNoise.intensity, "player");
    playSfx("attack");

    if (!target) {
      setMessage(gameCopy.attackMiss);
      showCombatFlash(gameCopy.noTarget);
      return;
    }

    const updatedEnemies = enemiesRef.current.map((enemy) => {
      if (enemy.id !== target.id || !enemy.alive || enemy.state === "dead") {
        return enemy;
      }

      const damage = applyCreatureOutgoingDamage(PLAYER_ATTACK_DAMAGE, selectedCharacter.id);
      const nextHp = Math.max(0, enemy.hp - damage);

      if (nextHp <= 0) {
        const config = caveSession.layout.enemyConfigs.find((entry) => entry.id === enemy.id);
        const earnedScore = config?.scoreValue ?? SCORE_PER_KILL_FALLBACK;

        setScore((current) => current + earnedScore);
        setKills((current) => current + 1);
        setMessage(`${enemy.name} cae y desaparece entre los ecos de roca.`);
        showCombatFlash(`-${damage} HP · baja`);

        return transitionEnemyToDead(enemy, actionNow);
      }

      setMessage(`Impacto confirmado sobre ${enemy.name}.`);
      showCombatFlash(`-${damage} HP`);

      return {
        ...enemy,
        hp: nextHp,
        state: "chasing" as const,
      };
    });

    enemiesRef.current = updatedEnemies;
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
      setMessage(gameCopy.stunnedDefend);
      return;
    }

    if (moveCooldownEndsAtRef.current > Date.now()) {
      setMessage(gameCopy.defendRecovering);
      return;
    }

    if (parryCooldownRemaining > 0) {
      setMessage(gameCopy.parryRecovering);
      return;
    }

    const activatedAt = Date.now();
    const nextParryUntil = activatedAt + PARRY_WINDOW_MS;
    parryUntilRef.current = nextParryUntil;
    setParryUntil(nextParryUntil);
    setParryCooldownEndsAt(activatedAt + PARRY_COOLDOWN_MS);
    setActiveAction("defend");
    addSignal("defend", playerRef.current, "player");
    const defendNoise = applyCreatureNoise(6, 0.65, selectedCharacter.id);
    addNoise("defend", playerRef.current, defendNoise.radiusTiles, defendNoise.intensity, "player");
    setMessage(gameCopy.parryActive);
    showCombatFlash("Parry activo");
    playSfx("defend");
  }

  function handleAbility() {
    if (gameStatusRef.current !== "playing") return;
    const actionNow = Date.now();
    const result = activateCreatureAbility({
      creatureId: selectedCharacter.id as CreatureId,
      state: abilityStateRef.current,
      now: actionNow,
      alive: healthRef.current > 0,
      stunned: isStunned(stunnedUntilRef.current, actionNow),
      actorPosition: playerRef.current,
      targetPosition: playerRef.current,
    });
    if (!result.ok) {
      setMessage(
        result.reason === "cooldown"
          ? gameCopy.abilityCooldown
          : gameCopy.abilityUnavailable,
      );
      return;
    }

    abilityStateRef.current = result.state;
    lastAbilityTickAtRef.current = actionNow;
    setAbilityState(result.state);
    setActiveAction("ability");
    playSfx("ready");
    for (const event of result.events) {
      setTraps((current) => [
        ...current,
        {
          id: createGameplayEventId("trap", "player", actionNow),
          ownerId: "player",
          position: event.position,
          createdAt: actionNow,
          expiresAt: actionNow + event.durationMs,
          stunMs: event.stunMs,
        },
      ]);
    }
    const abilityName = getLocalizedAbilityName(locale, selectedCharacter.id);
    setMessage(abilityName);
    showCombatFlash(abilityName);
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
    } else if (key === "r" || key === "f") {
      event.preventDefault();
      handleAbility();
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
    const restartNow = Date.now();
    const nextEnemies = initialEnemies(nextSession.layout, restartNow);
    setCaveSession(nextSession);
    setMatchId(createMatchId());
    setMatchStartedAt(new Date().toISOString());
    playerRef.current = nextSession.layout.startPosition;
    setPlayer(nextSession.layout.startPosition);
    enemiesRef.current = nextEnemies;
    setEnemies(nextEnemies);
    setActiveAction("move");
    gameStatusRef.current = "playing";
    setGameStatus("playing");
    setIsPaused(false);
    setIsUiHidden(false);
    setIsAdminDemoEnabled(false);
    setDemoZoom(1);
    healthRef.current = creatureModifiers.maxHealth;
    setHealth(creatureModifiers.maxHealth);
    moveCooldownEndsAtRef.current = 0;
    setMoveCooldownEndsAt(0);
    attackCooldownEndsAtRef.current = 0;
    setAttackCooldownEndsAt(0);
    parryUntilRef.current = 0;
    setParryUntil(0);
    setParryCooldownEndsAt(0);
    stunnedUntilRef.current = 0;
    setStunnedUntil(0);
    setMessage(gameCopy.initialMessage);
    setZoneMessage("Solo ves 8 bloques alrededor. Todo lo demas es oscuridad.");
    setScore(0);
    setKills(0);
    setCombatFlash(null);
    setSignals(emptySignals());
    noisesRef.current = emptyNoises();
    setNoises(emptyNoises());
    setPathPreview([]);
    setMovementPath([]);
    setIsTraversing(false);
    abilityStateRef.current = createAbilityState();
    setAbilityState(abilityStateRef.current);
    lastAbilityTickAtRef.current = restartNow;
    setTraps([]);
    const restartTile = worldToTile(nextSession.layout.startPosition);
    sanityStateRef.current = createSanityState(
      restartNow,
      `${restartTile.col},${restartTile.row}`,
    );
    setSanityState(sanityStateRef.current);
    shelterStateRef.current = { shelterKey: null, enteredAt: null, progress: 0 };
    setShelterState(shelterStateRef.current);
    exhaustedSheltersRef.current = new Set();
    setExhaustedShelters(exhaustedSheltersRef.current);
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
      tileDistance(worldToTile(player), worldToTile(enemy)) <= effectiveRadarRange,
  ).length;
  const activeHostiles = aliveEnemies.filter(
    (enemy) =>
      enemy.state === "chasing" ||
      enemy.state === "investigating" ||
      enemy.state === "attacking",
  ).length;
  const nearbyDangerLabel = dangerLabelFromDistance(nearestThreatTiles, activeHostiles);
  const currentPlayerTile = worldToTile(player);
  const currentShelterKey = `${currentPlayerTile.col},${currentPlayerTile.row}`;
  const baseTerrainName = terrainNameAt(player, caveSession.lookup);
  const currentTerrainName =
    baseTerrainName === "Refugio" && exhaustedShelters.has(currentShelterKey)
      ? "Refugio agotado"
      : baseTerrainName;
  const threatSummary =
    aliveEnemies.length === 0
      ? messages.play.hud.noLivingThreat
      : `${aliveEnemies.length} ${aliveEnemies.length === 1 ? messages.play.hud.hostileEcho : messages.play.hud.hostileEchoes} · ${activeHostiles} ${messages.play.hud.alerted}`;

  return (
    <section className="relative z-10 h-dvh min-h-dvh overflow-hidden overscroll-none">
      <header
        className="pointer-events-none absolute inset-x-0 top-0 z-70 flex items-start justify-between gap-1.5 px-2 pb-2 sm:gap-2 sm:px-4 sm:py-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.4rem)" }}
      >
        {!isUiHidden && <button
          type="button"
          onClick={onExitToMenu}
          className="pointer-events-auto inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/10 bg-black/55 px-3 py-2 text-[0.72rem] text-zinc-300 backdrop-blur-md transition hover:text-white sm:min-h-11 sm:gap-2 sm:px-4 sm:text-sm"
          aria-label={gameCopy.backMenu}
        >
          <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          {gameCopy.backMenu}
        </button>}

        {!isUiHidden && (
          <div className="rounded-full border border-white/10 bg-black/45 px-3 py-2 backdrop-blur-md"><SpeleumBrand size="compact" /></div>
        )}
        {isUiHidden && (
          <div className="fixed inset-x-2 bottom-[calc(env(safe-area-inset-bottom)+.5rem)] z-70 md:hidden">
            <ActionControls
              activeAction={activeAction}
              cooldownRemaining={attackCooldownRemaining}
              moveCooldownRemaining={moveCooldownRemaining}
              parryCooldownRemaining={parryCooldownRemaining}
              isRecovering={attackCooldownRemaining > 0 || isPaused}
              isParrying={isParrying}
              onMove={() => setActiveAction("move")}
              onAttack={handleAttack}
              onDefend={handleDefend}
              abilityName={getLocalizedAbilityName(locale, selectedCharacter.id)}
              abilityCooldownRemaining={abilityCooldownRemaining}
              abilityDisabled={isPlayerStunned}
              onAbility={handleAbility}
            />
          </div>
        )}

        <div className="flex items-start gap-2">
          {isAdmin && !isUiHidden && (
            <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-cyan-200/15 bg-black/60 p-1 text-[0.6rem] text-cyan-100 backdrop-blur-md">
              <button
                type="button"
                aria-pressed={adminDemoEnabled}
                onClick={() => {
                  const next = !adminDemoEnabled;
                  setIsAdminDemoEnabled(next);
                  setDemoZoom(1);
                  if (next) {
                    moveCooldownEndsAtRef.current = 0;
                    setMoveCooldownEndsAt(0);
                  }
                }}
                className="rounded-full px-2 py-1.5"
              >
                ADMIN · DEMO {adminDemoEnabled ? "ON" : "OFF"}
              </button>
              {adminDemoEnabled && (
                <button type="button" onClick={() => setDemoZoom(1)} className="rounded-full border border-white/10 px-2 py-1.5" aria-label="Restablecer zoom">
                  {Math.round(demoZoom * 100)}%
                </button>
              )}
            </div>
          )}
          <GameTopControls
            isUiHidden={isUiHidden}
            showPause
            isPaused={isPaused}
            onTogglePause={handleTogglePause}
            onToggleUi={() => setIsUiHidden((current) => !current)}
          />
        </div>
      </header>

      <div
        className={
          isUiHidden
            ? "h-full min-h-0 min-w-0"
            : "grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-1.5 p-2 pt-[calc(env(safe-area-inset-top)+3.8rem)] pb-[calc(env(safe-area-inset-bottom)+.5rem)] md:grid-cols-[minmax(15rem,18rem)_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)_auto] md:gap-2"
        }
      >
        {!isUiHidden && (
          <aside className="relative z-60 min-w-0 md:static md:row-span-2 md:max-h-none md:w-auto md:min-h-0">
            <div className="grid gap-2">
              <GameHud
                selectedCharacter={selectedCharacter}
                zone={currentZone}
                objective={gameCopy.objectiveLocal}
                message={message}
                zoneMessage={zoneMessage}
                health={health}
                maxHealth={creatureModifiers.maxHealth}
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
                nearestThreatTiles={nearestThreatTiles}
                nearbyDangerLabel={nearbyDangerLabel}
                detectedEnemies={detectedEnemies}
                terrainName={currentTerrainName}
                sanityStage={sanityState.stage}
                idleDurationMs={sanityState.idleDurationMs}
                shelterProgress={shelterState.progress}
                abilityName={getLocalizedAbilityName(locale, selectedCharacter.id)}
                abilityCooldownRemaining={abilityCooldownRemaining}
              />
              <div className="hidden min-h-0 md:block [@media(max-height:600px)]:hidden">
                <RadarPanel
                  player={player}
                  signals={signals}
                  ownerId="player"
                  rangeTiles={effectiveRadarRange}
                  precisionMultiplier={abilityModifiers.radarPrecisionMultiplier}
                />
              </div>
              <div className="absolute right-2 top-[calc(100%+0.5rem)] z-50 w-20 md:hidden">
                <RadarPanel
                  player={player}
                  signals={signals}
                  ownerId="player"
                  rangeTiles={effectiveRadarRange}
                  precisionMultiplier={abilityModifiers.radarPrecisionMultiplier}
                  compact
                />
              </div>
            </div>
          </aside>
        )}

        <main className={`${isUiHidden ? "absolute inset-0" : "min-h-0 min-w-0 md:col-start-2"} overflow-hidden rounded-[1.15rem] border border-white/5`}>
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
            visionRadius={
              VISION_RADIUS + abilityModifiers.visionRangeBonusTiles * TILE_SIZE
            }
            revealAll={adminDemoEnabled}
            zoom={adminDemoEnabled ? demoZoom : 1}
            onZoomChange={adminDemoEnabled ? setDemoZoom : undefined}
            tiles={caveSession.tiles}
            traps={traps}
            sanityStage={sanityState.stage}
            exhaustedShelters={[...exhaustedShelters]}
            reachableTiles={reachableTiles}
            attackableTiles={attackableTiles}
            selectedPath={pathPreview}
            isMoveReady={!isTraversing && (adminDemoEnabled || moveCooldownRemaining <= 0)}
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
              isRecovering={attackCooldownRemaining > 0 || isPaused}
              isParrying={isParrying}
              onMove={() => setActiveAction("move")}
              onAttack={handleAttack}
              onDefend={handleDefend}
              abilityName={getLocalizedAbilityName(locale, selectedCharacter.id)}
              abilityCooldownRemaining={abilityCooldownRemaining}
              abilityDisabled={isPlayerStunned}
              onAbility={handleAbility}
            />
          </div>
        )}
      </div>

      {!isUiHidden && combatFlash && (
        <div className="pointer-events-none absolute left-1/2 top-[calc(env(safe-area-inset-top)+12rem)] z-85 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-full border border-rose-200/15 bg-black/70 px-3 py-1.5 text-center text-[0.68rem] tracking-[0.1em] text-rose-100 shadow-[0_0_28px_rgba(251,113,133,0.18)] sm:top-24 sm:px-5 sm:py-2 sm:text-sm sm:tracking-[0.18em]">
          {translateGameplayMessage(locale, combatFlash)}
        </div>
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
        titleOverride={gameStatus === "won" ? gameCopy.localWinTitle : gameCopy.localLoseTitle}
        messageOverride={
          gameStatus === "won"
            ? messages.play.overlay.winMessage
            : messages.play.overlay.loseMessage
        }
      />
    </section>
  );
}
