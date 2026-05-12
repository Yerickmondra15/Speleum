import type {
  ActionKind,
  CharacterOption,
  PlayerPosition,
  RadarSignalStrength,
} from "./gameConfig";
import type { EnemyState, ThreatLevel } from "./gameLogic";

export type SignalType = "move" | "attack" | "defend" | "danger";

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

export type MultiplayerRoomStatus = "waiting" | "playing" | "finished";

export type PlayerCombatState = {
  health: number;
  maxHealth: number;
  sanity: number;
  maxSanity: number;
  isDefending: boolean;
  threatLevel: ThreatLevel;
  idleMs: number;
  moveCooldownRemaining: number;
  attackCooldownRemaining: number;
  defenseCooldownRemaining: number;
  defenseDurationRemaining: number;
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
  matchId: string;
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
