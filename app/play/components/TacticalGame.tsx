"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Shield } from "lucide-react";
import type {
  ActionKind,
  CharacterOption,
  PlayerPosition,
  Rect,
} from "../gameConfig";
import {
  ATTACK_COOLDOWN,
  ATTACK_RADIUS,
  CAVE_HEIGHT,
  CAVE_WIDTH,
  DEFEND_COOLDOWN,
  MOVE_BASE_COOLDOWN,
  MOVE_DISTANCE_COOLDOWN,
  PLAYER_RADIUS,
  caveWalls,
  pointsOfInterest,
  startPosition,
} from "../gameConfig";
import { ActionControls } from "./ActionControls";
import { GameMap } from "./GameMap";
import { RadarPanel } from "./RadarPanel";

export type SignalType = "move" | "attack" | "defend";

export type RadarSignal = {
  id: number;
  type: SignalType;
  x: number;
  y: number;
  createdAt: number;
  duration: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function circleIntersectsRect(
  circle: PlayerPosition,
  radius: number,
  rect: Rect,
) {
  const closestX = clamp(circle.x, rect.x, rect.x + rect.width);
  const closestY = clamp(circle.y, rect.y, rect.y + rect.height);
  const distanceX = circle.x - closestX;
  const distanceY = circle.y - closestY;

  return distanceX * distanceX + distanceY * distanceY < radius * radius;
}

function canStandAt(position: PlayerPosition) {
  return !caveWalls.some((wall) =>
    circleIntersectsRect(position, PLAYER_RADIUS, wall),
  );
}

function canTravelBetween(from: PlayerPosition, to: PlayerPosition) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.ceil(distance / 18));

  for (let index = 1; index <= steps; index += 1) {
    const progress = index / steps;
    const sample = {
      x: from.x + (to.x - from.x) * progress,
      y: from.y + (to.y - from.y) * progress,
    };

    if (!canStandAt(sample)) {
      return false;
    }
  }

  return true;
}

function limitMoveDistance(
  from: PlayerPosition,
  target: PlayerPosition,
  maxDistance: number,
) {
  const distance = Math.hypot(target.x - from.x, target.y - from.y);

  if (distance <= maxDistance) {
    return target;
  }

  const scale = maxDistance / distance;

  return {
    x: from.x + (target.x - from.x) * scale,
    y: from.y + (target.y - from.y) * scale,
  };
}

function actionLabel(action: ActionKind) {
  if (action === "move") return "Mover";
  if (action === "attack") return "Atacar";
  return "Defender";
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
  const [activeAction, setActiveAction] = useState<ActionKind>("move");
  const [cooldownEndsAt, setCooldownEndsAt] = useState(0);
  const [defendingUntil, setDefendingUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [signals, setSignals] = useState<RadarSignal[]>([]);
  const [message, setMessage] = useState(
    "Elige Mover y marca un destino dentro de la cueva.",
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      const time = Date.now();
      setNow(time);
      setSignals((current) =>
        current.filter((signal) => time - signal.createdAt < signal.duration),
      );
    }, 80);

    return () => window.clearInterval(interval);
  }, []);

  const cooldownRemaining = Math.max(0, cooldownEndsAt - now);
  const isRecovering = cooldownRemaining > 0;
  const isDefending = defendingUntil > now;

  const nearestPoint = useMemo(() => {
    return pointsOfInterest
      .map((point) => ({
        ...point,
        distance: Math.round(Math.hypot(player.x - point.x, player.y - point.y)),
      }))
      .sort((a, b) => a.distance - b.distance)[0];
  }, [player]);

  const addSignal = (type: SignalType, position: PlayerPosition) => {
    const baseDuration =
      type === "attack" ? 1900 : type === "move" ? 1300 : 950;
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

  const startCooldown = (duration: number) => {
    setCooldownEndsAt(Date.now() + duration);
  };

  const handleMoveIntent = (target: PlayerPosition) => {
    if (isRecovering) {
      setMessage("Aun estas recuperandote. Espera antes de actuar.");
      return;
    }

    if (activeAction !== "move") {
      setMessage("Selecciona Mover antes de marcar un destino.");
      return;
    }

    const boundedTarget = limitMoveDistance(
      player,
      {
        x: clamp(target.x, PLAYER_RADIUS, CAVE_WIDTH - PLAYER_RADIUS),
        y: clamp(target.y, PLAYER_RADIUS, CAVE_HEIGHT - PLAYER_RADIUS),
      },
      selectedCharacter.moveRange,
    );
    const distance = Math.hypot(boundedTarget.x - player.x, boundedTarget.y - player.y);

    if (distance < 10) {
      setMessage("Destino demasiado cercano.");
      return;
    }

    if (!canTravelBetween(player, boundedTarget)) {
      setMessage("La pared bloquea ese movimiento.");
      return;
    }

    const cooldown = Math.round(
      (MOVE_BASE_COOLDOWN + distance * MOVE_DISTANCE_COOLDOWN) *
        selectedCharacter.moveCooldownMultiplier,
    );

    setPlayer(boundedTarget);
    startCooldown(cooldown);
    addSignal("move", boundedTarget);
    setMessage(
      `Movimiento de ${Math.round(distance)} unidades. Recuperacion: ${(
        cooldown / 1000
      ).toFixed(1)}s.`,
    );
  };

  const handleAttack = () => {
    if (isRecovering) {
      setMessage("No puedes atacar durante la recuperacion.");
      return;
    }

    setActiveAction("attack");
    startCooldown(ATTACK_COOLDOWN);
    addSignal("attack", player);
    setMessage("Ataque emitido. La senal aparece fuerte en el radar.");
  };

  const handleDefend = () => {
    if (isRecovering) {
      setMessage("No puedes defenderte durante la recuperacion.");
      return;
    }

    const endsAt = Date.now() + DEFEND_COOLDOWN;
    setActiveAction("defend");
    setDefendingUntil(endsAt);
    setCooldownEndsAt(endsAt);
    addSignal("defend", player);
    setMessage("Defensa activa. No puedes moverte hasta recuperar postura.");
  };

  const handleSelectMove = () => {
    if (!isRecovering) {
      setActiveAction("move");
      setMessage("Marca un destino en el mapa. Mas distancia, mas cooldown.");
    }
  };

  return (
    <section className="relative z-10 min-h-screen overflow-hidden">
      <header className="pointer-events-none absolute inset-x-0 top-0 z-[70] flex items-center justify-between px-4 py-4">
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
            TURNO
          </h1>
        </div>

        <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-black/45 px-4 py-2 text-xs text-zinc-400 backdrop-blur-md sm:flex">
          <Shield className="h-4 w-4" />
          {selectedCharacter.name}
        </div>
      </header>

      <GameMap
        player={player}
        signals={signals}
        activeAction={activeAction}
        isDefending={isDefending}
        attackRadius={ATTACK_RADIUS}
        onChooseDestination={handleMoveIntent}
      />

      <div className="pointer-events-none absolute left-4 top-24 z-[70] max-w-sm rounded-[1.25rem] border border-white/10 bg-black/50 p-4 backdrop-blur-md">
        <p className="text-xs tracking-[0.25em] text-zinc-500">
          {actionLabel(activeAction)}
        </p>
        <p className="mt-2 text-sm leading-6 text-zinc-300">{message}</p>
        <div className="mt-3 flex gap-3 text-xs text-zinc-500">
          <span>{nearestPoint?.label}</span>
          <span>{selectedCharacter.moveRange}u</span>
          <span>
            {isDefending ? "defensa" : isRecovering ? "recuperando" : "listo"}
          </span>
        </div>
      </div>

      <div className="absolute right-4 top-24 z-[70] w-64 max-w-[calc(100vw-2rem)]">
        <RadarPanel
          player={player}
          signals={signals}
          cooldownRemaining={cooldownRemaining}
        />
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
    </section>
  );
}
