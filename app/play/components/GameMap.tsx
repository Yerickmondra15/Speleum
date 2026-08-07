"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import { getCreatureById } from "@/lib/creatures";
import type {
  ActionKind,
  GameStatus,
  PlayerPosition,
  Zone,
} from "../gameConfig";
import {
  CAVE_HEIGHT,
  CAVE_WIDTH,
  ENEMY_RADIUS,
  PLAYER_RADIUS,
  TILE_SIZE,
  VISION_RADIUS,
} from "../gameConfig";
import type { EnemyState } from "../gameLogic";
import type { MultiplayerPlayerState, RadarSignal } from "../types";
import type { TileCoordinate } from "../gameConfig";
import { isTileVisible, tileMap, type TileCell, worldToTile } from "../tileMap";

type GameMapProps = {
  player: PlayerPosition;
  playerCharacterId: string;
  enemy: EnemyState | null;
  enemies?: EnemyState[];
  signals: RadarSignal[];
  activeAction: ActionKind;
  isDefending: boolean;
  currentZone: Zone;
  gameStatus: GameStatus;
  otherPlayers?: MultiplayerPlayerState[];
  visionRadius?: number;
  reachableTiles?: Map<string, { tile: TileCoordinate; distance: number }>;
  attackableTiles?: Map<string, { tile: TileCoordinate; distance: number }>;
  selectedPath?: PlayerPosition[];
  isMoveReady?: boolean;
  tiles?: TileCell[];
  onChooseDestination: (position: PlayerPosition) => void;
};

function tileStyle(x: number, y: number): CSSProperties {
  return {
    left: x,
    top: y,
    width: TILE_SIZE,
    height: TILE_SIZE,
  };
}

function pointStyle(point: PlayerPosition): CSSProperties {
  return {
    left: point.x,
    top: point.y,
  };
}

function tileClass(type: string, visible: boolean) {
  if (!visible) {
    return "border-black/10 bg-black";
  }

  if (type === "wall") {
    return "border-white/5 bg-[linear-gradient(135deg,rgba(36,10,18,0.95),rgba(14,5,10,1))]";
  }

  if (type === "obstacle") {
    return "border-rose-200/5 bg-[linear-gradient(135deg,rgba(69,16,27,0.92),rgba(21,8,14,0.98))]";
  }

  if (type === "hazard") {
    return "border-rose-300/10 bg-[radial-gradient(circle,rgba(120,21,47,0.35),rgba(18,4,10,0.96))]";
  }

  if (type === "spawn") {
    return "border-cyan-200/8 bg-[radial-gradient(circle,rgba(103,232,249,0.12),rgba(12,16,20,0.94))]";
  }

  if (type === "goal") {
    return "border-zinc-100/15 bg-[radial-gradient(circle,rgba(244,244,245,0.18),rgba(20,20,24,0.95))]";
  }

  return "border-white/[0.03] bg-[linear-gradient(180deg,rgba(16,16,18,0.95),rgba(6,4,7,1))]";
}

function signalClass(type: RadarSignal["type"]) {
  if (type === "danger") {
    return "border-rose-200/70 bg-rose-300/12 shadow-[0_0_24px_rgba(251,113,133,0.3)]";
  }

  if (type === "attack") {
    return "border-red-300/80 bg-red-400/10 shadow-[0_0_24px_rgba(127,29,29,0.45)]";
  }

  if (type === "defend") {
    return "border-zinc-200/70 bg-zinc-200/10 shadow-[0_0_22px_rgba(212,212,216,0.2)]";
  }

  return "border-zinc-200/60 bg-white/5 shadow-[0_0_16px_rgba(255,255,255,0.18)]";
}

export function GameMap({
  player,
  playerCharacterId,
  enemy,
  enemies = [],
  signals,
  activeAction,
  isDefending,
  gameStatus,
  otherPlayers = [],
  visionRadius = VISION_RADIUS,
  reachableTiles = new Map(),
  attackableTiles = new Map(),
  selectedPath = [],
  isMoveReady = false,
  tiles = tileMap,
  onChooseDestination,
}: GameMapProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 1200, height: 760 });
  const playerCreature = getCreatureById(playerCharacterId);
  const playerTile = useMemo(() => worldToTile(player), [player]);

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

  const camera = useMemo(
    () => ({
      x: Math.min(
        Math.max(player.x - viewportSize.width / 2, 0),
        Math.max(CAVE_WIDTH - viewportSize.width, 0),
      ),
      y: Math.min(
        Math.max(player.y - viewportSize.height / 2, 0),
        Math.max(CAVE_HEIGHT - viewportSize.height, 0),
      ),
    }),
    [player, viewportSize],
  );

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

  const visibleTiles = useMemo(
    () =>
      tiles.filter((tile) =>
        tile.x + TILE_SIZE >= camera.x &&
        tile.x <= camera.x + viewportSize.width &&
        tile.y + TILE_SIZE >= camera.y &&
        tile.y <= camera.y + viewportSize.height,
      ),
    [camera, tiles, viewportSize],
  );

  const threatEntries = enemies.length > 0 ? enemies : enemy ? [enemy] : [];
  const visibleEnemies = threatEntries.filter(
    (entry) => entry.alive !== false && isTileVisible(playerTile, worldToTile(entry)),
  );
  const selectedPathKeys = new Set(
    selectedPath.map((step) => {
      const tile = worldToTile(step);
      return `${tile.col},${tile.row}`;
    }),
  );

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden">
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
          className="absolute left-0 top-0"
          style={{
            width: CAVE_WIDTH,
            height: CAVE_HEIGHT,
            transform: `translate3d(${-camera.x}px, ${-camera.y}px, 0)`,
          }}
        >
          {visibleTiles.map((tile) => {
            const visible = isTileVisible(playerTile, { col: tile.col, row: tile.row });
            const tileKey = `${tile.col},${tile.row}`;
            const reachable = isMoveReady && reachableTiles.has(tileKey) && visible;
            const attackable =
              activeAction === "attack" && attackableTiles.has(tileKey) && visible;
            const inPath = selectedPathKeys.has(tileKey);

            return (
              <div
                key={`${tile.col}-${tile.row}`}
                className={`absolute border ${tileClass(tile.type, visible)}`}
                style={tileStyle(tile.x, tile.y)}
              >
                {visible && tile.type === "floor" && (
                  <div className="absolute inset-0 opacity-14 bg-[radial-gradient(rgba(255,255,255,0.09)_1px,transparent_1px)] bg-size-[clamp(12px,2vw,18px)_clamp(12px,2vw,18px)]" />
                )}
                {reachable && tile.type !== "wall" && tile.type !== "obstacle" && (
                  <div className="absolute inset-1.5 rounded-[0.9rem] border border-zinc-100/8 shadow-[0_0_12px_rgba(255,255,255,0.06)] transition hover:border-rose-200/18 hover:bg-white/3" />
                )}
                {attackable && tile.type !== "wall" && tile.type !== "obstacle" && (
                  <div className="absolute inset-1 rounded-[0.9rem] border border-red-300/25 bg-red-400/5 shadow-[inset_0_0_14px_rgba(248,113,113,0.08)]" />
                )}
                {inPath && (
                  <div className="absolute inset-2 rounded-[0.8rem] border border-rose-200/18 bg-rose-200/3 shadow-[0_0_16px_rgba(251,113,133,0.08)]" />
                )}
              </div>
            );
          })}

          {signals
            .filter((signal) => isTileVisible(playerTile, worldToTile(signal)))
            .map((signal) => (
              <div
                key={signal.id}
                className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2"
                style={pointStyle(signal)}
              >
                <div
                  className={`rounded-full border ${signalClass(signal.type)} ${
                    signal.strength === "high"
                      ? "h-14 w-14 animate-ping"
                      : signal.strength === "medium"
                        ? "h-11 w-11 animate-ping"
                        : "h-9 w-9 animate-ping"
                  }`}
                />
              </div>
            ))}

          {visibleEnemies.map((entry) => (
            <div
              key={entry.id}
              className="absolute z-30 -translate-x-1/2 -translate-y-1/2"
              style={pointStyle(entry)}
            >
              <div
                className={`relative rounded-full border ${
                  entry.state === "stunned"
                    ? "border-amber-100/80 bg-amber-200/20 shadow-[0_0_26px_rgba(251,191,36,0.35)]"
                    : 
                  entry.state === "attacking" ||
                  entry.state === "chasing" ||
                  entry.state === "investigating"
                    ? "border-rose-200/80 bg-rose-300/30 shadow-[0_0_30px_rgba(127,29,29,0.55)]"
                    : entry.state === "dead"
                      ? "border-zinc-500/40 bg-zinc-900/40"
                      : "border-violet-200/40 bg-violet-300/10 shadow-[0_0_18px_rgba(91,33,182,0.25)]"
                }`}
                style={{ width: ENEMY_RADIUS * 2, height: ENEMY_RADIUS * 2 }}
              >
                <div className="absolute inset-1 flex items-center justify-center overflow-hidden rounded-full bg-zinc-950/75">
                  <Image
                    src={getCreatureById(entry.spriteCharacterId).imagenJuego}
                    alt={entry.name}
                    width={34}
                    height={34}
                    className={`h-8.5 w-8.5 object-contain ${
                      entry.state === "attacking" ||
                      entry.state === "chasing" ||
                      entry.state === "investigating"
                        ? "animate-pulse"
                        : ""
                    }`}
                  />
                </div>
              </div>
              <div className="absolute left-1/2 top-full mt-2 min-w-24 -translate-x-1/2 rounded-2xl border border-white/10 bg-black/85 px-2 py-1.5 text-center text-[0.58rem] tracking-[0.14em] text-rose-100">
                <p>{entry.name}</p>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,rgba(251,113,133,0.85),rgba(255,255,255,0.95))]"
                    style={{ width: `${Math.max(0, (entry.hp / entry.maxHp) * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-zinc-300">{entry.state}</p>
              </div>
            </div>
          ))}

          {otherPlayers
            .filter((otherPlayer) => isTileVisible(playerTile, worldToTile(otherPlayer.position)))
            .map((otherPlayer) => (
              <div
                key={otherPlayer.id}
                className="absolute z-30 -translate-x-1/2 -translate-y-1/2"
                style={pointStyle(otherPlayer.position)}
              >
                <div
                  className={`relative rounded-full border ${
                    otherPlayer.combat.isStunned
                      ? "border-amber-100/80 bg-amber-200/25 shadow-[0_0_22px_rgba(251,191,36,0.35)]"
                      : otherPlayer.combat.isParrying
                        ? "border-zinc-100/80 bg-zinc-200/20 shadow-[0_0_22px_rgba(228,228,231,0.28)]"
                        : "border-cyan-200/70 bg-cyan-300/25 shadow-[0_0_22px_rgba(103,232,249,0.35)]"
                  }`}
                  style={{ width: PLAYER_RADIUS * 2, height: PLAYER_RADIUS * 2 }}
                >
                  <div className="absolute inset-1 flex items-center justify-center overflow-hidden rounded-full bg-cyan-950/70">
                    <Image
                      src={getCreatureById(otherPlayer.characterId).imagenJuego}
                      alt={otherPlayer.name}
                      width={34}
                      height={34}
                      className="h-8.5 w-8.5 object-contain"
                    />
                  </div>
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
              <div className="absolute inset-1 flex items-center justify-center overflow-hidden rounded-full bg-white/70">
                <Image
                  src={playerCreature.imagenJuego}
                  alt={playerCreature.nombre}
                  width={40}
                  height={40}
                  className="h-10 w-10 object-contain"
                />
              </div>
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
              visionRadius * 0.16,
            )}px, rgba(255,255,255,0.02) ${Math.round(
              visionRadius * 0.28,
            )}px, rgba(0,0,0,0.4) ${Math.round(
              visionRadius * 0.44,
            )}px, rgba(0,0,0,0.92) ${Math.round(
              visionRadius * 0.82,
            )}px, rgba(0,0,0,0.995) ${visionRadius}px)`,
          }}
        />
        <div className="pointer-events-none absolute inset-0 z-50 shadow-[inset_0_0_140px_rgba(0,0,0,0.96)]" />
      </div>
    </div>
  );
}
