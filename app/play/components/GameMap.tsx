"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent, WheelEvent } from "react";
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
import type { SilkTrap } from "@/lib/gameplay/abilities";
import type { SanityStage } from "@/lib/gameplay/sanity";
import { getSanityEffects } from "@/lib/gameplay/sanity";

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
  traps?: SilkTrap[];
  sanityStage?: SanityStage;
  exhaustedShelters?: string[];
  revealAll?: boolean;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
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

const TILE_ATLAS_COLUMNS = 4;
const tileAtlasIndex: Record<TileCell["type"], number[]> = {
  floor: [0, 1, 2],
  wall: [3, 4],
  obstacle: [4],
  hazard: [5, 6],
  water: [7],
  shelter: [8],
  nest: [9],
  spawn: [10],
  goal: [11],
  dark: [0],
};

function tileVisualStyle(tile: TileCell, visible: boolean): CSSProperties {
  if (!visible) return {};

  const variants = tileAtlasIndex[tile.type];
  const stableIndex = Math.abs(tile.col * 31 + tile.row * 17) % variants.length;
  const atlasIndex = variants[stableIndex];

  return {
    backgroundImage: "url('/tiles/speleum-tiles.svg')",
    backgroundPosition: `${-(atlasIndex % TILE_ATLAS_COLUMNS) * TILE_SIZE}px ${-Math.floor(atlasIndex / TILE_ATLAS_COLUMNS) * TILE_SIZE}px`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${TILE_ATLAS_COLUMNS * TILE_SIZE}px ${3 * TILE_SIZE}px`,
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
    return "border-red-300/25 bg-[radial-gradient(circle,rgba(170,24,42,0.52),rgba(35,3,8,0.98))]";
  }

  if (type === "water") {
    return "border-zinc-300/8 bg-[radial-gradient(ellipse,rgba(38,45,58,0.48),rgba(4,7,12,0.98))]";
  }

  if (type === "shelter") {
    return "border-rose-100/12 bg-[radial-gradient(circle,rgba(190,115,140,0.18),rgba(19,10,15,0.96))]";
  }

  if (type === "nest") {
    return "border-zinc-400/10 bg-[repeating-radial-gradient(circle,rgba(90,75,84,0.16)_0_3px,rgba(9,7,9,0.98)_4px_10px)]";
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
  traps = [],
  sanityStage = "stable",
  exhaustedShelters = [],
  revealAll = false,
  zoom = 1,
  onZoomChange,
  onChooseDestination,
}: GameMapProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 1200, height: 760 });
  const playerCreature = getCreatureById(playerCharacterId);
  const playerTile = useMemo(() => worldToTile(player), [player]);
  const visionRadiusTiles = visionRadius / TILE_SIZE;
  const worldViewport = {
    width: viewportSize.width / zoom,
    height: viewportSize.height / zoom,
  };

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
        Math.max(player.x - worldViewport.width / 2, 0),
        Math.max(CAVE_WIDTH - worldViewport.width, 0),
      ),
      y: Math.min(
        Math.max(player.y - worldViewport.height / 2, 0),
        Math.max(CAVE_HEIGHT - worldViewport.height, 0),
      ),
    }),
    [player, worldViewport.height, worldViewport.width],
  );

  const handleMapClick = (event: MouseEvent<HTMLDivElement>) => {
    if (gameStatus !== "playing") {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / zoom + camera.x;
    const y = (event.clientY - rect.top) / zoom + camera.y;

    onChooseDestination({ x, y });
  };

  const handleMapWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!onZoomChange) return;
    event.preventDefault();
    const step = event.deltaY < 0 ? 0.1 : -0.1;
    onZoomChange(Math.min(1.5, Math.max(0.5, Number((zoom + step).toFixed(1)))));
  };

  const playerViewportPosition = {
    x: (player.x - camera.x) * zoom,
    y: (player.y - camera.y) * zoom,
  };
  const lightPosition = {
    left: `${playerViewportPosition.x}px`,
    top: `${playerViewportPosition.y}px`,
  };

  const visibleTiles = useMemo(
    () =>
      tiles.filter((tile) =>
        tile.x + TILE_SIZE >= camera.x &&
        tile.x <= camera.x + worldViewport.width &&
        tile.y + TILE_SIZE >= camera.y &&
        tile.y <= camera.y + worldViewport.height,
      ),
    [camera, tiles, worldViewport.height, worldViewport.width],
  );

  const threatEntries = enemies.length > 0 ? enemies : enemy ? [enemy] : [];
  const visibleEnemies = threatEntries.filter(
    (entry) =>
      entry.alive !== false &&
      (revealAll || isTileVisible(playerTile, worldToTile(entry), visionRadiusTiles)),
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
        onWheel={handleMapWheel}
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
            transform: `translate3d(${-camera.x * zoom}px, ${-camera.y * zoom}px, 0) scale(${zoom})`,
            transformOrigin: "top left",
          }}
        >
          {visibleTiles.map((tile) => {
            const visible = revealAll || isTileVisible(
              playerTile,
              { col: tile.col, row: tile.row },
              visionRadiusTiles,
            );
            const tileKey = `${tile.col},${tile.row}`;
            const reachable = isMoveReady && reachableTiles.has(tileKey) && visible;
            const attackable =
              activeAction === "attack" && attackableTiles.has(tileKey) && visible;
            const inPath = selectedPathKeys.has(tileKey);
            const shelterExhausted =
              tile.type === "shelter" && exhaustedShelters.includes(tileKey);

            return (
              <div
                key={`${tile.col}-${tile.row}`}
                className={`absolute border ${tileClass(tile.type, visible)}`}
                style={{ ...tileStyle(tile.x, tile.y), ...tileVisualStyle(tile, visible) }}
              >
                {reachable && tile.type !== "wall" && tile.type !== "obstacle" && (
                  <div className="absolute inset-1.5 rounded-[0.9rem] border border-zinc-100/8 shadow-[0_0_12px_rgba(255,255,255,0.06)] transition hover:border-rose-200/18 hover:bg-white/3" />
                )}
                {attackable && tile.type !== "wall" && tile.type !== "obstacle" && (
                  <div className="absolute inset-1 rounded-[0.9rem] border border-red-300/25 bg-red-400/5 shadow-[inset_0_0_14px_rgba(248,113,113,0.08)]" />
                )}
                {inPath && (
                  <div className="absolute inset-2 rounded-[0.8rem] border border-rose-200/18 bg-rose-200/3 shadow-[0_0_16px_rgba(251,113,133,0.08)]" />
                )}
                {shelterExhausted && (
                  <div className="absolute inset-2 flex items-center justify-center rounded-full border border-zinc-500/20 bg-black/45 text-lg text-zinc-600">×</div>
                )}
              </div>
            );
          })}

          {signals
            .filter((signal) =>
              revealAll || isTileVisible(playerTile, worldToTile(signal), visionRadiusTiles),
            )
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
            .filter((otherPlayer) =>
              revealAll || isTileVisible(playerTile, worldToTile(otherPlayer.position), visionRadiusTiles),
            )
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

          {traps
            .filter((trap) =>
              revealAll || isTileVisible(playerTile, worldToTile(trap.position), visionRadiusTiles),
            )
            .map((trap) => (
              <div
                key={trap.id}
                className="pointer-events-none absolute z-25 -translate-x-1/2 -translate-y-1/2"
                style={pointStyle(trap.position)}
              >
                <div className="h-9 w-9 rounded-full border border-zinc-200/30 bg-[repeating-radial-gradient(circle,rgba(244,244,245,0.28)_0_1px,transparent_2px_5px)] shadow-[0_0_16px_rgba(244,244,245,0.12)]" />
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

        {!revealAll && <div
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
        />}
        {!revealAll && <div className="pointer-events-none absolute inset-0 z-50 shadow-[inset_0_0_140px_rgba(0,0,0,0.96)]" />}
        {!revealAll && sanityStage !== "stable" && (() => {
          const effects = getSanityEffects(sanityStage);
          return (
            <div
              className={`pointer-events-none absolute inset-0 z-55 ${sanityStage === "damaging" ? "animate-pulse" : ""}`}
              style={{
                background: `rgba(0,0,0,${effects.darkness})`,
                boxShadow: `inset 0 0 ${120 + effects.vignette * 180}px rgba(28,0,12,${effects.vignette})`,
              }}
            />
          );
        })()}
      </div>
    </div>
  );
}
