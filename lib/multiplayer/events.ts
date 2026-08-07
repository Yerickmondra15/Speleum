import type { MultiplayerRoomStatus } from "@/app/play/types";

export type ResumeRoomFailureReason =
  | "invalid-payload"
  | "membership-conflict"
  | "session-not-found"
  | "reconnect-expired";

export type ResumeRoomResult =
  | {
      ok: true;
      roomCode: string;
      matchId: string;
      playerId: string;
      status: MultiplayerRoomStatus;
      tookOverSocket: boolean;
    }
  | {
      ok: false;
      reason: ResumeRoomFailureReason;
      message: string;
      terminal: boolean;
    };

export type ResumeRoomAck = (result: ResumeRoomResult) => void;
