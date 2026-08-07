import type { Server, Socket } from "socket.io";

import type { PlayerPosition } from "../app/play/gameConfig";
import type { EnemyState } from "../app/play/gameLogic";
import type { CaveLayout } from "../app/play/proceduralCave";
import type {
  MatchResultEntry,
  MultiplayerPlayerState,
  MultiplayerRoomStatus,
  MultiplayerStatePayload,
  NoiseEvent,
  RadarSignal,
} from "../app/play/types";
import type { TileLookup } from "../app/play/tileMap";
import type { ServerTimings } from "./config";
import type { RoomStore } from "./rooms/roomStore";

export type SocketData = {
  userId: string;
  username: string;
  ticketId: string;
};

export type ClientToServerEvents = {
  "create-room": (payload: unknown) => void;
  "join-room": (payload: unknown) => void;
  "resume-room": (payload: unknown) => void;
  "player-ready": (payload: unknown) => void;
  "player-move": (payload: unknown) => void;
  "player-attack": (payload: unknown) => void;
  "player-defend": (payload: unknown) => void;
  "leave-room": (payload: unknown) => void;
};

export type ServerToClientEvents = {
  "game-state": (payload: MultiplayerStatePayload) => void;
  "game-over": (payload: {
    winnerId: string | null;
    message: string;
    results: MatchResultEntry[];
  }) => void;
  "player-left": (payload: { roomCode: string; playerId: string; message: string }) => void;
  "error-message": (message: string) => void;
};

export type InterServerEvents = Record<string, never>;

export type GameServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export type GameSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export type ServerPlayerState = MultiplayerPlayerState & {
  userId: string;
  socketId: string | null;
  connectedAt: number;
  disconnectedAt: number | null;
  reconnectDeadline: number | null;
  intentionalLeave: boolean;
  lastAttackAt: number;
  lastMoveAt: number;
  lastParryAt: number;
  moveCooldownUntil: number;
  movementPath: PlayerPosition[];
  parryUntil: number;
  stunnedUntil: number;
  resultReceipt: string | null;
};

export type RoomCleanupStatus = "active" | "scheduled" | "deleting";

export type ServerRoomState = {
  matchId: string;
  code: string;
  cave: CaveLayout;
  tileLookup: TileLookup;
  status: MultiplayerRoomStatus;
  readyDeadline: number | null;
  startAt: number | null;
  createdAt: number;
  lastActivityAt: number;
  expiresAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  cleanupStatus: RoomCleanupStatus;
  enemies: EnemyState[];
  players: Map<string, ServerPlayerState>;
  signals: RadarSignal[];
  noises: NoiseEvent[];
  winnerId: string | null;
  message: string | null;
  results: MatchResultEntry[];
};

export type ServerContext = {
  io: GameServer;
  store: RoomStore;
  timings: ServerTimings;
  resultSecret: string;
};
