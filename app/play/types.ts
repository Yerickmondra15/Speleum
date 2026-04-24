import type { ActionKind, PlayerPosition } from "./gameConfig";
import type { EnemyState } from "./gameLogic";

export type SignalType = "move" | "attack" | "defend";

export type RadarSignal = {
  id: number;
  type: SignalType;
  x: number;
  y: number;
  createdAt: number;
  duration: number;
  ownerId?: string;
};

export type MultiplayerPlayerStatus = "waiting" | "playing" | "won" | "lost" | "left";
export type MultiplayerRoomStatus = "waiting" | "playing" | "finished";

export type MultiplayerPlayerState = {
  id: string;
  name: string;
  characterId: string;
  position: PlayerPosition;
  status: MultiplayerPlayerStatus;
  isReady: boolean;
  connected: boolean;
  lastAction: ActionKind;
};

export type MultiplayerStatePayload = {
  roomCode: string;
  status: MultiplayerRoomStatus;
  self: MultiplayerPlayerState;
  otherPlayers: MultiplayerPlayerState[];
  enemy: EnemyState | null;
  signals: RadarSignal[];
  winnerId: string | null;
  playerCount: number;
  requiredPlayers: number;
  message: string | null;
};

