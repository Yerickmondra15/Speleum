import type {
  ActionKind,
  CharacterOption,
  PlayerPosition,
  RadarSignalStrength,
} from "./gameConfig";
import type { EnemyState } from "./gameLogic";
import type { CaveLayout } from "./proceduralCave";

export type SignalType = "move" | "attack" | "defend" | "danger";

export type NoiseType = "move" | "attack" | "defend";

export type NoiseEvent = {
  id: string;
  type: NoiseType;
  sourceId: string;
  position: PlayerPosition;
  radiusTiles: number;
  intensity: number;
  createdAt: number;
};

export type RadarSignal = {
  id: number;
  type: SignalType;
  strength: RadarSignalStrength;
  x: number;
  y: number;
  createdAt: number;
  duration: number;
  radarJitter: number;
  ownerId?: string;
};

export type MultiplayerPlayerStatus =
  | "waiting"
  | "playing"
  | "won"
  | "lost"
  | "spectating"
  | "left";

export type MultiplayerRoomStatus =
  | "waiting"
  | "ready-check"
  | "starting"
  | "playing"
  | "finished";

export type PlayerCombatState = {
  health: number;
  maxHealth: number;
  isParrying: boolean;
  isStunned: boolean;
  moveCooldownRemaining: number;
  attackCooldownRemaining: number;
  parryCooldownRemaining: number;
  parryWindowRemaining: number;
  stunRemaining: number;
  kills: number;
  damageDealt: number;
  eliminatedAt: number | null;
};

export type MultiplayerPlayerState = {
  id: string;
  name: string;
  characterId: string;
  position: PlayerPosition;
  status: MultiplayerPlayerStatus;
  isReady: boolean;
  connected: boolean;
  lastAction: ActionKind;
  combat: PlayerCombatState;
};

export type MatchResultEntry = {
  playerId: string;
  name: string;
  characterId: string;
  placement: number;
  status: MultiplayerPlayerStatus;
  kills: number;
  damageDealt: number;
  survivedMs: number;
};

export type MultiplayerStatePayload = {
  matchId: string;
  roomCode: string;
  status: MultiplayerRoomStatus;
  readyDeadline: number | null;
  startAt: number | null;
  cave: CaveLayout;
  self: MultiplayerPlayerState;
  otherPlayers: MultiplayerPlayerState[];
  enemy: EnemyState | null;
  enemies: EnemyState[];
  signals: RadarSignal[];
  noises: NoiseEvent[];
  winnerId: string | null;
  playerCount: number;
  aliveCount: number;
  minPlayers: number;
  maxPlayers: number;
  requiredPlayers: number;
  readyCount: number;
  results: MatchResultEntry[];
  message: string | null;
};

export type LocalRankingEntry = {
  id: string;
  recordedAt: string;
  winnerName: string;
  winnerCharacterId: string;
  roomCode: string;
  totalPlayers: number;
  durationMs: number;
  standings: MatchResultEntry[];
};

export type MultiplayerSession = {
  matchId: string;
  roomCode: string;
  playerId: string;
  playerName: string;
  characterId: string;
};

export type MultiplayerRoomSyncState = {
  roomCode: string;
  seed: string;
  status: MultiplayerRoomStatus;
  cave: CaveLayout;
  players: MultiplayerPlayerState[];
  enemy: EnemyState | null;
  enemies: EnemyState[];
  signals: RadarSignal[];
  noises: NoiseEvent[];
  winnerId: string | null;
  updatedAt: string;
};

export function getCharacterName(
  characters: CharacterOption[],
  characterId: string,
) {
  return (
    characters.find((character) => character.id === characterId)?.name ??
    characterId
  );
}
