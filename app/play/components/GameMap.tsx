"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import type {
  ActionKind,
  GameStatus,
  HazardArea,
  PlayerPosition,
  Rect,
  Zone,
} from "../gameConfig";
import {
  ATTACK_RADIUS,
  CAVE_HEIGHT,
  CAVE_WIDTH,
  ENEMY_RADIUS,
  PLAYER_RADIUS,
  VISION_RADIUS,
  caveWalls,
  caveZones,
  goalArea,
  hazardAreas,
  pointsOfInterest,
} from "../gameConfig";
import type { EnemyState } from "../gameLogic";
import type { MultiplayerPlayerState, RadarSignal } from "../types";

type GameMapProps = {
  player: PlayerPosition;
  enemy: EnemyState | null;
  signals: RadarSignal[];
  activeAction: ActionKind;
  isDefending: boolean;
  currentZone: Zone;
  gameStatus: GameStatus;
  otherPlayers?: MultiplayerPlayerState[];
  visionRadius?: number;
  onChooseDestination: (position: PlayerPosition) => void;
};

function rectStyle(rect: Rect): CSSProperties {
  return {
    left: rect.x,
    top: rect.y,
    width: rect.width,
    height: rect.height,
  };
}

function pointStyle(point: PlayerPosition): CSSProperties {
  return {
    left: point.x,
    top: point.y,
  };
}

function signalClass(type: RadarSignal["type"]) {
  if (type === "attack") {
    return "border-red-300/80 bg-red-400/10 shadow-[0_0_34px_rgba(127,29,29,0.45)]";
  }

  if (type === "defend") {
    return "border-zinc-200/70 bg-zinc-200/10 shadow-[0_0_24px_rgba(212,212,216,0.2)]";
  }

  return "border-zinc-200/60 bg-white/5 shadow-[0_0_20px_rgba(255,255,255,0.18)]";
}

function zoneClass(tone: Zone["tone"]) {
  if (tone === "safe") {
    return "bg-[radial-gradient(circle_at_30%_45%,rgba(212,212,216,0.12),transparent_32%),linear-gradient(140deg,rgba(16,16,20,0.9),rgba(28,28,34,0.75))]";
  }

  if (tone === "tunnels") {
    return "bg-[linear-gradient(90deg,rgba(20,20,24,0.92),rgba(45,45,52,0.66)_48%,rgba(20,20,24,0.92))]";
  }

  if (tone === "open") {
    return "bg-[radial-gradient(circle_at_52%_48%,rgba(255,255,255,0.05),transparent_22%),radial-gradient(circle_at_70%_72%,rgba(91,33,54,0.16),transparent_28%),linear-gradient(180deg,rgba(16,16,18,0.85),rgba(34,10,18,0.58))]";
  }

  if (tone === "danger") {
    return "bg-[radial-gradient(circle_at_62%_28%,rgba(76,5,25,0.2),transparent_18%),linear-gradient(145deg,rgba(18,5,10,0.94),rgba(65,10,28,0.72))]";
  }

  if (tone === "goal") {
    return "bg-[radial-gradient(circle_at_50%_45%,rgba(244,244,245,0.2),transparent_24%),linear-gradient(180deg,rgba(40,40,48,0.85),rgba(16,16,20,0.9))]";
  }

  return "bg-[linear-gradient(180deg,rgba(24,18,24,0.84),rgba(18,10,16,0.88))]";
}

function hazardClass(hazard: HazardArea) {
  return hazard.id === "abyss-pool"
    ? "bg-[radial-gradient(circle,rgba(68,13,31,0.44),rgba(15,4,12,0.9))]"
    : "bg-[radial-gradient(circle,rgba(79,10,25,0.34),rgba(5,2,6,0.95))]";
}

export function GameMap({
  player,
  enemy,
  signals,
  activeAction,
  isDefending,
  currentZone,
  gameStatus,
  otherPlayers = [],
  visionRadius = VISION_RADIUS,
  onChooseDestination,
}: GameMapProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 1200, height: 760 });

  useEffect(() => {
    const node = viewportRef.current;

    if (!node) {
      return;
    }

    const updateSize = () => {
      setViewportSize({
        width: node.clientWidth,
        height: node.clientHeight,
      });
    };
    const observer = new ResizeObserver(updateSize);

    updateSize();
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  const camera = useMemo(() => {
    return {
      x: Math.min(
        Math.max(player.x - viewportSize.width / 2, 0),
        Math.max(CAVE_WIDTH - viewportSize.width, 0),
      ),
      y: Math.min(
        Math.max(player.y - viewportSize.height / 2, 0),
        Math.max(CAVE_HEIGHT - viewportSize.height, 0),
      ),
    };
  }, [player, viewportSize]);

  const handleMapClick = (event: MouseEvent<HTMLDivElement>) => {
    if (gameStatus !== "playing") {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left + camera.x;
    const y = event.clientY - rect.top + camera.y;

    onChooseDestination({ x, y });
  };

  const playerViewportPosition = {
    x: player.x - camera.x,
    y: player.y - camera.y,
  };
  const lightPosition = {
    left: `${playerViewportPosition.x}px`,
    top: `${playerViewportPosition.y}px`,
  };

  return (
    <div className="relative h-full min-h-screen w-full">
      <div
        ref={viewportRef}
        role="presentation"
        onClick={handleMapClick}
        className={`absolute inset-0 overflow-hidden ${
          activeAction === "move" && gameStatus === "playing"
            ? "cursor-crosshair"
            : "cursor-default"
        }`}
      >
        <div className="absolute inset-0 bg-[#050202]" />
        <div
          className="absolute left-0 top-0 transition-transform duration-500 ease-out"
          style={{
            width: CAVE_WIDTH,
            height: CAVE_HEIGHT,
            transform: `translate3d(${-camera.x}px, ${-camera.y}px, 0)`,
          }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_86%,rgba(72,13,24,0.24),transparent_16%),radial-gradient(circle_at_78%_18%,rgba(56,16,36,0.19),transparent_20%),radial-gradient(circle_at_56%_52%,rgba(255,255,255,0.032),transparent_22%),linear-gradient(135deg,#050202,#110509_50%,#030101)]" />
          <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] [background-size:88px_88px]" />

          {caveZones.map((zone) => (
            <div
              key={zone.id}
              className={`absolute rounded-[2rem] border ${
                zone.id === currentZone.id
                  ? "border-zinc-200/15"
                  : "border-white/5"
              } ${zoneClass(zone.tone)}`}
              style={rectStyle(zone)}
            >
              <div className="absolute left-6 top-5 text-[0.68rem] tracking-[0.26em] text-zinc-500">
                {zone.subtitle}
              </div>
            </div>
          ))}

          {hazardAreas.map((hazard) => (
            <div
              key={hazard.id}
              className={`absolute rounded-[999px] border border-rose-300/10 shadow-[inset_0_0_28px_rgba(0,0,0,0.6)] ${hazardClass(
                hazard,
              )}`}
              style={rectStyle(hazard)}
            />
          ))}

          <div
            className="absolute rounded-[2rem] border border-zinc-100/20 bg-[radial-gradient(circle,rgba(255,255,255,0.22),rgba(255,255,255,0.05)_40%,rgba(20,20,24,0.2)_75%)] shadow-[0_0_58px_rgba(255,255,255,0.16)]"
            style={rectStyle(goalArea)}
          >
            <div className="absolute inset-0 animate-pulse rounded-[2rem] bg-white/5" />
          </div>

          {pointsOfInterest.map((point) => (
            <div
              key={point.id}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
              style={pointStyle(point)}
            >
              <div className="h-2.5 w-2.5 rounded-full border border-zinc-300/40 bg-white/20 shadow-[0_0_18px_rgba(255,255,255,0.18)]" />
            </div>
          ))}

          {caveWalls.map((wall) => (
            <div
              key={wall.id}
              className="absolute z-10 rounded-[1.25rem] border border-white/5 bg-[linear-gradient(135deg,rgba(64,14,24,0.9),rgba(33,8,18,0.95)_58%,rgba(6,4,7,0.98))] shadow-[inset_0_0_28px_rgba(0,0,0,0.72),0_16px_38px_rgba(0,0,0,0.48)]"
              style={rectStyle(wall)}
            />
          ))}

          {signals.map((signal) => (
            <div
              key={signal.id}
              className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2"
              style={pointStyle(signal)}
            >
              <div
                className={`h-14 w-14 animate-ping rounded-full border ${signalClass(
                  signal.type,
                )}`}
              />
            </div>
          ))}

          {activeAction === "attack" && gameStatus === "playing" && (
            <div
              className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-red-300/30 bg-red-500/5"
              style={{
                ...pointStyle(player),
                width: ATTACK_RADIUS * 2,
                height: ATTACK_RADIUS * 2,
              }}
            />
          )}

          {enemy && (
            <div
              className="absolute z-30 -translate-x-1/2 -translate-y-1/2"
              style={pointStyle({
                x: enemy.x,
                y: enemy.y,
              })}
            >
              <div
                className={`relative rounded-full border ${
                  enemy.mode === "chase"
                    ? "border-rose-200/80 bg-rose-300/30 shadow-[0_0_32px_rgba(127,29,29,0.55)]"
                    : "border-violet-200/40 bg-violet-300/10 shadow-[0_0_20px_rgba(91,33,182,0.25)]"
                }`}
                style={{ width: ENEMY_RADIUS * 2, height: ENEMY_RADIUS * 2 }}
              >
                <div className="absolute inset-3 rounded-full bg-zinc-950" />
              </div>
            </div>
          )}

          {otherPlayers.map((otherPlayer) => (
            <div
              key={otherPlayer.id}
              className="absolute z-30 -translate-x-1/2 -translate-y-1/2"
              style={pointStyle(otherPlayer.position)}
            >
              <div
                className="relative rounded-full border border-cyan-200/70 bg-cyan-300/25 shadow-[0_0_22px_rgba(103,232,249,0.35)]"
                style={{ width: PLAYER_RADIUS * 2, height: PLAYER_RADIUS * 2 }}
              >
                <div className="absolute inset-3 rounded-full bg-cyan-950" />
              </div>
              <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/75 px-2 py-1 text-[0.65rem] tracking-[0.18em] text-cyan-100">
                {otherPlayer.name}
              </div>
            </div>
          ))}

          <div
            className="absolute z-30 -translate-x-1/2 -translate-y-1/2"
            style={pointStyle(player)}
          >
            <div
              className="relative rounded-full border border-white/50 bg-zinc-100 shadow-[0_0_28px_rgba(255,255,255,0.48)]"
              style={{ width: PLAYER_RADIUS * 2, height: PLAYER_RADIUS * 2 }}
            >
              <div className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-300 shadow-[0_0_16px_rgba(253,164,175,0.95)]" />
              {isDefending && (
                <div className="absolute -inset-2 rounded-full border border-zinc-100/65 shadow-[0_0_22px_rgba(228,228,231,0.3)]" />
              )}
            </div>
          </div>
        </div>

        <div
          className="pointer-events-none absolute inset-0 z-40"
          style={{
            background: `radial-gradient(circle at ${lightPosition.left} ${lightPosition.top}, rgba(255,255,255,0.02) 0 ${Math.round(
              visionRadius * 0.18,
            )}px, rgba(255,255,255,0.03) ${Math.round(
              visionRadius * 0.28,
            )}px, rgba(0,0,0,0.48) ${Math.round(
              visionRadius * 0.48,
            )}px, rgba(0,0,0,0.9) ${Math.round(
              visionRadius * 0.76,
            )}px, rgba(0,0,0,0.985) ${visionRadius}px)`,
          }}
        />
        <div className="pointer-events-none absolute inset-0 z-50 shadow-[inset_0_0_140px_rgba(0,0,0,0.96)]" />
      </div>
    </div>
  );
}
