import type { ActionKind, CharacterOption, PlayerPosition } from "./gameConfig";
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

export type MultiplayerPlayerStatus =
  | "waiting"
  | "playing"
  | "won"
  | "lost"
  | "spectating"
  | "left";

export type MultiplayerRoomStatus = "waiting" | "playing" | "finished";

export type PlayerCombatState = {
  health: number;
  maxHealth: number;
  sanity: number;
  maxSanity: number;
  isDefending: boolean;
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
  roomCode: string;
  status: MultiplayerRoomStatus;
  self: MultiplayerPlayerState;
  otherPlayers: MultiplayerPlayerState[];
  enemy: EnemyState | null;
  signals: RadarSignal[];
  winnerId: string | null;
  playerCount: number;
  aliveCount: number;
  minPlayers: number;
  maxPlayers: number;
  requiredPlayers: number;
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
  roomCode: string;
  playerId: string;
  playerName: string;
  characterId: string;
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
