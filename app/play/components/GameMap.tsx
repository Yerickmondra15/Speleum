"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import type { ActionKind, PlayerPosition, Rect } from "../gameConfig";
import {
  CAVE_HEIGHT,
  CAVE_WIDTH,
  PLAYER_RADIUS,
  caveWalls,
  pointsOfInterest,
} from "../gameConfig";
import type { RadarSignal } from "./TacticalGame";

type GameMapProps = {
  player: PlayerPosition;
  signals: RadarSignal[];
  activeAction: ActionKind;
  isDefending: boolean;
  attackRadius: number;
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
    return "border-red-300/80 bg-red-400/10 shadow-[0_0_34px_rgba(248,113,113,0.34)]";
  }

  if (type === "defend") {
    return "border-amber-200/70 bg-amber-200/10 shadow-[0_0_24px_rgba(253,230,138,0.22)]";
  }

  return "border-zinc-200/60 bg-white/5 shadow-[0_0_20px_rgba(255,255,255,0.18)]";
}

export function GameMap({
  player,
  signals,
  activeAction,
  isDefending,
  attackRadius,
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
        className={`absolute inset-0 cursor-crosshair overflow-hidden ${
          activeAction === "move" ? "" : "cursor-default"
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
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_86%,rgba(116,19,36,0.24),transparent_16%),radial-gradient(circle_at_78%_18%,rgba(93,11,24,0.23),transparent_18%),radial-gradient(circle_at_56%_52%,rgba(255,255,255,0.035),transparent_22%),linear-gradient(135deg,#070202,#120407_50%,#030101)]" />
          <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,0.028)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] [background-size:72px_72px]" />

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
              className="absolute z-10 rounded-[1.25rem] border border-red-200/5 bg-[linear-gradient(135deg,rgba(100,12,30,0.9),rgba(35,3,10,0.95)_58%,rgba(8,1,3,0.98))] shadow-[inset_0_0_28px_rgba(0,0,0,0.72),0_16px_38px_rgba(0,0,0,0.48)]"
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

          {activeAction === "attack" && (
            <div
              className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-red-300/30 bg-red-500/5"
              style={{
                ...pointStyle(player),
                width: attackRadius * 2,
                height: attackRadius * 2,
              }}
            />
          )}

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
                <div className="absolute -inset-2 rounded-full border border-amber-100/70 shadow-[0_0_22px_rgba(253,230,138,0.35)]" />
              )}
            </div>
          </div>
        </div>

        <div
          className="pointer-events-none absolute inset-0 z-40"
          style={{
            background: `radial-gradient(circle at ${lightPosition.left} ${lightPosition.top}, transparent 0 8%, rgba(255,255,255,0.03) 13%, rgba(0,0,0,0.46) 24%, rgba(0,0,0,0.9) 48%, rgba(0,0,0,0.985) 76%)`,
          }}
        />
        <div className="pointer-events-none absolute inset-0 z-50 shadow-[inset_0_0_120px_rgba(0,0,0,0.96)]" />
      </div>
    </div>
  );
}
