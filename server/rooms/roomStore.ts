import { randomInt } from "node:crypto";

import type { ServerPlayerState, ServerRoomState } from "../types";

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export class RoomStore {
  readonly rooms = new Map<string, ServerRoomState>();
  private readonly socketIndex = new Map<string, { roomCode: string; playerId: string }>();

  generateRoomCode() {
    for (let attempt = 0; attempt < 1_000; attempt += 1) {
      let code = "";

      while (code.length < 6) {
        code += ROOM_CODE_ALPHABET[randomInt(0, ROOM_CODE_ALPHABET.length)];
      }

      if (!this.rooms.has(code)) {
        return code;
      }
    }

    throw new Error("No se pudo generar un codigo de sala unico.");
  }

  add(room: ServerRoomState) {
    this.rooms.set(room.code, room);
  }

  get(roomCode: string) {
    return this.rooms.get(roomCode) ?? null;
  }

  bindSocket(room: ServerRoomState, player: ServerPlayerState, socketId: string) {
    if (player.socketId) {
      this.socketIndex.delete(player.socketId);
    }

    player.socketId = socketId;
    this.socketIndex.set(socketId, { roomCode: room.code, playerId: player.id });
  }

  unbindSocket(socketId: string) {
    this.socketIndex.delete(socketId);
  }

  getBySocket(socketId: string) {
    const indexed = this.socketIndex.get(socketId);

    if (!indexed) {
      return null;
    }

    const room = this.rooms.get(indexed.roomCode);
    const player = room?.players.get(indexed.playerId);

    if (!room || !player || player.socketId !== socketId) {
      this.socketIndex.delete(socketId);
      return null;
    }

    return { room, player };
  }

  findPlayerByUser(room: ServerRoomState, userId: string) {
    return [...room.players.values()].find((player) => player.userId === userId) ?? null;
  }

  delete(roomCode: string) {
    const room = this.rooms.get(roomCode);

    if (!room) {
      return false;
    }

    room.cleanupStatus = "deleting";

    for (const player of room.players.values()) {
      if (player.socketId) {
        this.socketIndex.delete(player.socketId);
      }
    }

    return this.rooms.delete(roomCode);
  }

  clear() {
    this.socketIndex.clear();
    this.rooms.clear();
  }
}
