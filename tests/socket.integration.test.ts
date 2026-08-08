import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { io as createClient, type Socket } from "socket.io-client";

import type { MultiplayerStatePayload } from "@/app/play/types";
import { findReachableTiles, tileToWorld, worldToTile } from "@/app/play/tileMap";
import type { ResumeRoomResult } from "@/lib/multiplayer/events";
import { createSocketTicket } from "@/lib/multiplayer/tickets";
import { createSocketGameServer } from "@/server/createSocketServer";
import {
  eliminatePlayer,
  evaluateRoom,
  finishRoom,
  processRoomLifecycle,
} from "@/server/rooms/roomLifecycle";

const authSecret = "socket-integration-auth-secret-32-characters";
const resultSecret = "socket-integration-result-secret-32-chars";

type TestServer = ReturnType<typeof createSocketGameServer>;

function waitForEvent<T>(
  socket: Socket,
  event: string,
  predicate: (payload: T) => boolean = () => true,
  timeoutMs = 4_000,
) {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timeout esperando ${event}`));
    }, timeoutMs);
    const handler = (payload: T) => {
      if (!predicate(payload)) {
        return;
      }
      clearTimeout(timeout);
      socket.off(event, handler);
      resolve(payload);
    };
    socket.on(event, handler);
  });
}

async function waitUntil(predicate: () => boolean, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("La condicion esperada no se cumplio.");
}

describe("integracion Socket.IO autoritativa", () => {
  let server: TestServer;
  let url: string;
  let userSequence = 0;
  const clients = new Set<Socket>();

  beforeAll(async () => {
    server = createSocketGameServer({
      socketAuthSecret: authSecret,
      resultSecret,
      timings: {
        moveTickMs: 10,
        lobbyTickMs: 10,
        lifecycleTickMs: 10,
        readyWindowMs: 500,
        startCountdownMs: 20,
        reconnectGraceMs: 80,
        lobbyIdleMs: 500,
        finishedRetentionMs: 80,
      },
    });
    const address = await server.listen();
    url = `http://127.0.0.1:${address.port}`;
  });

  afterEach(() => {
    for (const client of clients) {
      client.disconnect();
    }
    clients.clear();
    server.store.clear();
  });

  afterAll(async () => {
    await server.close();
  });

  async function connect(userId?: string, username?: string) {
    userSequence += 1;
    const identity = {
      userId: userId ?? `user-${userSequence}`,
      username: username ?? `Player ${userSequence}`,
    };
    const client = createClient(url, {
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
      auth: { ticket: createSocketTicket(identity, authSecret) },
    });
    clients.add(client);
    await Promise.race([
      waitForEvent(client, "connect"),
      waitForEvent<Error>(client, "connect_error").then((error) => Promise.reject(error)),
    ]);
    return { client, ...identity };
  }

  async function createRoom(client: Socket, characterId = "cave-axolotl") {
    const statePromise = waitForEvent<MultiplayerStatePayload>(client, "game-state");
    client.emit("create-room", { name: "Host", characterId });
    return statePromise;
  }

  async function joinRoom(client: Socket, roomCode: string, characterId = "cave-shrimp") {
    const statePromise = waitForEvent<MultiplayerStatePayload>(client, "game-state");
    client.emit("join-room", { roomCode, name: "Guest", characterId });
    return statePromise;
  }

  function resumeRoom(client: Socket, roomCode: string) {
    return new Promise<ResumeRoomResult>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Timeout esperando ack de resume-room")),
        4_000,
      );
      client.emit("resume-room", { roomCode }, (result: ResumeRoomResult) => {
        clearTimeout(timeout);
        resolve(result);
      });
    });
  }

  async function setupLobby() {
    const first = await connect();
    const initial = await createRoom(first.client);
    const second = await connect();
    const joined = await joinRoom(second.client, initial.roomCode);
    return { first, second, roomCode: initial.roomCode, initial, joined };
  }

  async function setupPlayingRoom() {
    const lobby = await setupLobby();
    const playingPromise = waitForEvent<MultiplayerStatePayload>(
      lobby.first.client,
      "game-state",
      (state) => state.status === "playing",
    );
    lobby.first.client.emit("player-ready", { roomCode: lobby.roomCode });
    lobby.second.client.emit("player-ready", { roomCode: lobby.roomCode });
    const playing = await playingPromise;
    return { ...lobby, playing };
  }

  it("1. acepta una conexion autenticada y consume el ticket una sola vez", async () => {
    const identity = { userId: "authenticated-user", username: "Auth User" };
    const ticket = createSocketTicket(identity, authSecret);
    const first = createClient(url, { transports: ["websocket"], forceNew: true, auth: { ticket } });
    clients.add(first);
    await waitForEvent(first, "connect");
    const replay = createClient(url, { transports: ["websocket"], forceNew: true, reconnection: false, auth: { ticket } });
    clients.add(replay);
    const error = await waitForEvent<Error>(replay, "connect_error");
    expect(error.message).toBe("AUTH_INVALID_TICKET");
  });

  it("2. rechaza una conexion no autenticada", async () => {
    const client = createClient(url, { transports: ["websocket"], forceNew: true, reconnection: false });
    clients.add(client);
    const error = await waitForEvent<Error>(client, "connect_error");
    expect(error.message).toBe("AUTH_INVALID_TICKET");
  });

  it("3. crea una sala para el usuario autenticado", async () => {
    const { client, userId } = await connect();
    const state = await createRoom(client);
    expect(state.roomCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    const player = server.store.get(state.roomCode)?.players.get(state.self.id);
    expect(player?.userId).toBe(userId);
  });

  it("4. permite unirse mediante un codigo valido", async () => {
    const lobby = await setupLobby();
    expect(lobby.joined.roomCode).toBe(lobby.roomCode);
    expect(lobby.joined.playerCount).toBe(2);
  });

  it("5. informa una sala inexistente", async () => {
    const { client } = await connect();
    const errorPromise = waitForEvent<string>(client, "error-message");
    client.emit("join-room", { roomCode: "ABC234", name: "Lost", characterId: "blind-fish" });
    expect(await errorPromise).toMatch(/no existe/i);
  });

  it("6. rechaza al septimo jugador de una sala llena", async () => {
    const host = await connect();
    const state = await createRoom(host.client);
    for (let index = 0; index < 5; index += 1) {
      const entrant = await connect();
      await joinRoom(entrant.client, state.roomCode);
    }
    const overflow = await connect();
    const errorPromise = waitForEvent<string>(overflow.client, "error-message");
    overflow.client.emit("join-room", { roomCode: state.roomCode, name: "Overflow", characterId: "cave-crab" });
    expect(await errorPromise).toMatch(/completa/i);
  });

  it("7. activa el ready check con dos jugadores", async () => {
    const lobby = await setupLobby();
    expect(lobby.joined.status).toBe("ready-check");
    expect(lobby.joined.readyCount).toBe(0);
  });

  it("8. inicia la partida solo tras confirmar todos", async () => {
    const game = await setupPlayingRoom();
    expect(game.playing.status).toBe("playing");
    expect(game.playing.aliveCount).toBe(2);
  });

  it("9. procesa movimiento valido en el bucle del servidor", async () => {
    const game = await setupPlayingRoom();
    const room = server.store.get(game.roomCode)!;
    const player = server.store.findPlayerByUser(room, game.first.userId)!;
    const reachable = [...findReachableTiles(worldToTile(player.position), 1, room.tileLookup).values()]
      .find((entry) => entry.distance === 1);
    expect(reachable).toBeDefined();
    const target = tileToWorld(reachable!.tile);
    const movedPromise = waitForEvent<MultiplayerStatePayload>(
      game.first.client,
      "game-state",
      (state) => state.self.position.x === target.x && state.self.position.y === target.y,
    );
    game.first.client.emit("player-move", { roomCode: game.roomCode, target });
    expect((await movedPromise).self.position).toEqual(target);
  });

  it("10. rechaza movimiento no finito o fuera del mapa", async () => {
    const game = await setupPlayingRoom();
    const errorPromise = waitForEvent<string>(game.first.client, "error-message");
    game.first.client.emit("player-move", { roomCode: game.roomCode, target: { x: Number.POSITIVE_INFINITY, y: -1 } });
    expect(await errorPromise).toMatch(/no es valido/i);
  });

  it("11. aplica un ataque desde estado autoritativo", async () => {
    const game = await setupPlayingRoom();
    const room = server.store.get(game.roomCode)!;
    const attacker = server.store.findPlayerByUser(room, game.first.userId)!;
    const target = server.store.findPlayerByUser(room, game.second.userId)!;
    room.enemies = [];
    target.position = { ...attacker.position };
    const initialHealth = target.combat.health;
    const damagedPromise = waitForEvent<MultiplayerStatePayload>(
      game.second.client,
      "game-state",
      (state) => state.self.combat.health < initialHealth,
    );
    game.first.client.emit("player-attack", { roomCode: game.roomCode });
    expect((await damagedPromise).self.combat.health).toBeLessThan(initialHealth);
  });

  it("12. un parry evita dano y aturde al atacante", async () => {
    const game = await setupPlayingRoom();
    const room = server.store.get(game.roomCode)!;
    const attacker = server.store.findPlayerByUser(room, game.first.userId)!;
    const target = server.store.findPlayerByUser(room, game.second.userId)!;
    room.enemies = [];
    target.position = { ...attacker.position };
    const defendedPromise = waitForEvent<MultiplayerStatePayload>(game.second.client, "game-state", (state) => state.self.combat.isParrying);
    game.second.client.emit("player-defend", { roomCode: game.roomCode });
    await defendedPromise;
    const initialHealth = target.combat.health;
    const stunnedPromise = waitForEvent<MultiplayerStatePayload>(game.first.client, "game-state", (state) => state.self.combat.isStunned);
    game.first.client.emit("player-attack", { roomCode: game.roomCode });
    expect((await stunnedPromise).self.combat.isStunned).toBe(true);
    expect(target.combat.health).toBe(initialHealth);
  });

  it("13. conserva al jugador durante una desconexion breve", async () => {
    const game = await setupPlayingRoom();
    const room = server.store.get(game.roomCode)!;
    const player = server.store.findPlayerByUser(room, game.first.userId)!;
    game.first.client.disconnect();
    await waitUntil(() => !player.connected);
    expect(player.status).toBe("playing");
    expect(player.reconnectDeadline).toBeGreaterThan(Date.now());
  });

  it("14. recupera identidad, posicion, vida y kills al reconectar", async () => {
    const game = await setupPlayingRoom();
    const room = server.store.get(game.roomCode)!;
    const player = server.store.findPlayerByUser(room, game.first.userId)!;
    const originalId = player.id;
    player.combat.health = 55;
    player.combat.kills = 3;
    const originalPosition = { ...player.position };
    game.first.client.disconnect();
    await waitUntil(() => !player.connected);
    player.reconnectDeadline = Date.now() + 1_000;
    const resumedClient = await connect(game.first.userId, "Player resumed");
    const statePromise = waitForEvent<MultiplayerStatePayload>(resumedClient.client, "game-state");
    const resumeResultPromise = resumeRoom(resumedClient.client, game.roomCode);
    const state = await statePromise;
    await expect(resumeResultPromise).resolves.toMatchObject({
      ok: true,
      matchId: room.matchId,
      playerId: originalId,
    });
    expect(state.self).toMatchObject({ id: originalId, position: originalPosition });
    expect(state.self.combat).toMatchObject({ health: 55, kills: 3 });
  });

  it("14a. permite takeover autenticado antes del disconnect y neutraliza el evento tardio", async () => {
    const game = await setupPlayingRoom();
    const room = server.store.get(game.roomCode)!;
    const player = server.store.findPlayerByUser(room, game.first.userId)!;
    const originalSocketId = player.socketId!;
    const originalId = player.id;
    const originalPosition = { ...player.position };
    player.combat.health = 47;
    player.combat.kills = 4;

    const oldDisconnectPromise = waitForEvent<string>(game.first.client, "disconnect");
    const replacement = await connect(game.first.userId, "Host replacement");
    const statePromise = waitForEvent<MultiplayerStatePayload>(
      replacement.client,
      "game-state",
      (state) => state.self.id === originalId,
    );
    const resultPromise = resumeRoom(replacement.client, game.roomCode);
    const [result, state] = await Promise.all([resultPromise, statePromise]);

    expect(result).toMatchObject({
      ok: true,
      playerId: originalId,
      tookOverSocket: true,
    });
    expect(state.self).toMatchObject({
      id: originalId,
      position: originalPosition,
      combat: expect.objectContaining({ health: 47, kills: 4 }),
    });
    await oldDisconnectPromise;
    await new Promise((resolve) => setTimeout(resolve, 25));

    expect(server.store.getBySocket(originalSocketId)).toBeNull();
    expect(server.store.getBySocket(replacement.client.id!)?.player.id).toBe(originalId);
    expect(player).toMatchObject({
      connected: true,
      socketId: replacement.client.id,
      disconnectedAt: null,
      reconnectDeadline: null,
    });
    expect(room.players.size).toBe(2);
    expect(new Set(room.players.keys()).size).toBe(room.players.size);
  });

  it("14b. restaura a ambos usuarios sin duplicar IDs ni perder su estado", async () => {
    const game = await setupPlayingRoom();
    const room = server.store.get(game.roomCode)!;
    const firstPlayer = server.store.findPlayerByUser(room, game.first.userId)!;
    const secondPlayer = server.store.findPlayerByUser(room, game.second.userId)!;
    const firstId = firstPlayer.id;
    const secondId = secondPlayer.id;
    const firstPosition = { ...firstPlayer.position };
    const secondPosition = { ...secondPlayer.position };

    game.first.client.disconnect();
    game.second.client.disconnect();
    await waitUntil(() => !firstPlayer.connected && !secondPlayer.connected);
    firstPlayer.reconnectDeadline = Date.now() + 1_000;
    secondPlayer.reconnectDeadline = Date.now() + 1_000;
    firstPlayer.combat.health = 63;
    firstPlayer.combat.kills = 2;
    secondPlayer.combat.health = 71;
    secondPlayer.combat.kills = 1;

    const firstReplacement = await connect(game.first.userId, "Host resumed");
    const secondReplacement = await connect(game.second.userId, "Guest resumed");
    const firstStatePromise = waitForEvent<MultiplayerStatePayload>(
      firstReplacement.client,
      "game-state",
      (state) => state.self.id === firstId,
    );
    const secondStatePromise = waitForEvent<MultiplayerStatePayload>(
      secondReplacement.client,
      "game-state",
      (state) => state.self.id === secondId,
    );

    const [firstResult, secondResult, firstState, secondState] = await Promise.all([
      resumeRoom(firstReplacement.client, game.roomCode),
      resumeRoom(secondReplacement.client, game.roomCode),
      firstStatePromise,
      secondStatePromise,
    ]);

    expect(firstResult).toMatchObject({ ok: true, playerId: firstId });
    expect(secondResult).toMatchObject({ ok: true, playerId: secondId });
    expect(firstState.self).toMatchObject({
      id: firstId,
      position: firstPosition,
      combat: expect.objectContaining({ health: 63, kills: 2 }),
    });
    expect(secondState.self).toMatchObject({
      id: secondId,
      position: secondPosition,
      combat: expect.objectContaining({ health: 71, kills: 1 }),
    });
    expect(room.players.size).toBe(2);
    expect(new Set(room.players.keys())).toEqual(new Set([firstId, secondId]));
    expect([...room.players.values()].every((entry) => entry.connected)).toBe(true);
  });

  it("14c. responde con ack terminal cuando la ventana de reconexion expiro", async () => {
    const game = await setupPlayingRoom();
    const room = server.store.get(game.roomCode)!;
    const player = server.store.findPlayerByUser(room, game.first.userId)!;
    game.first.client.disconnect();
    await waitUntil(() => !player.connected);

    // Conserva el registro durante esta asercion para probar el motivo preciso
    // del handler, antes de que el recolector del ciclo de vida lo elimine.
    player.connected = true;
    player.reconnectDeadline = Date.now() - 1;
    const replacement = await connect(game.first.userId, "Expired player");
    const result = await resumeRoom(replacement.client, game.roomCode);

    expect(result).toEqual({
      ok: false,
      reason: "reconnect-expired",
      message: "La ventana de reconexion ya termino.",
      terminal: true,
    });
    expect(server.store.getBySocket(replacement.client.id!)).toBeNull();
  });

  it("15. convierte en derrota una desconexion que supera la gracia", async () => {
    const game = await setupPlayingRoom();
    const room = server.store.get(game.roomCode)!;
    const player = server.store.findPlayerByUser(room, game.first.userId)!;
    game.first.client.disconnect();
    await waitUntil(() => player.status === "lost" || room.status === "finished");
    expect(player.status).toBe("lost");
  });

  it("16. procesa salida intencional sin ventana de reconexion", async () => {
    const game = await setupPlayingRoom();
    const room = server.store.get(game.roomCode)!;
    const player = server.store.findPlayerByUser(room, game.first.userId)!;
    const leftPromise = waitForEvent<{ playerId: string }>(game.second.client, "player-left");
    game.first.client.emit("leave-room", { roomCode: game.roomCode });
    expect((await leftPromise).playerId).toBe(player.id);
    expect(player.intentionalLeave).toBe(true);
    expect(player.reconnectDeadline).toBeNull();
  });

  it("17. finaliza con resultados y comprobante firmado por jugador", async () => {
    const game = await setupPlayingRoom();
    const room = server.store.get(game.roomCode)!;
    const winner = server.store.findPlayerByUser(room, game.first.userId)!;
    const gameOverPromise = waitForEvent<{ winnerId: string | null }>(game.first.client, "game-over");
    const finishedPromise = waitForEvent<MultiplayerStatePayload>(game.first.client, "game-state", (state) => state.status === "finished");
    finishRoom(room, server.context, winner.id, "Fin de prueba", Date.now());
    expect((await gameOverPromise).winnerId).toBe(winner.id);
    const state = await finishedPromise;
    expect(state.resultReceipt).toBeTruthy();
    expect(state.results).toHaveLength(2);
  });

  it("18. limpia salas expiradas y sus referencias", async () => {
    const { client } = await connect();
    const state = await createRoom(client);
    const room = server.store.get(state.roomCode)!;
    room.lastActivityAt = 0;
    processRoomLifecycle(server.context, 10_000);
    expect(server.store.get(state.roomCode)).toBeNull();
    expect(server.store.getBySocket(client.id!)).toBeNull();
  });

  it("19. impide que otro usuario recupere una sesion ajena", async () => {
    const lobby = await setupLobby();
    lobby.first.client.disconnect();
    const intruder = await connect("intruder", "Intruder");
    const errorPromise = waitForEvent<string>(intruder.client, "error-message");
    intruder.client.emit("resume-room", { roomCode: lobby.roomCode });
    expect(await errorPromise).toMatch(/no existe una sesion recuperable/i);
  });

  it("20. rechaza payloads con campos, longitudes o criaturas invalidas", async () => {
    const { client } = await connect();
    const errorPromise = waitForEvent<string>(client, "error-message");
    client.emit("create-room", {
      name: "x".repeat(200),
      characterId: "dragon",
      userId: "forged-user",
    });
    expect(await errorPromise).toMatch(/no son validos/i);
  });

  it("21. valida y resuelve habilidades en el servidor con cooldown autoritativo", async () => {
    const game = await setupPlayingRoom();
    const abilityState = waitForEvent<MultiplayerStatePayload>(
      game.first.client,
      "game-state",
      (state) => state.self.combat.abilityCooldownRemaining > 0,
    );
    game.first.client.emit("player-ability", {
      roomCode: game.roomCode,
      target: game.playing.self.position,
    });
    const activated = await abilityState;
    expect(activated.self.combat.abilityCooldownRemaining).toBeGreaterThan(30_000);

    const errorPromise = waitForEvent<string>(game.first.client, "error-message");
    game.first.client.emit("player-ability", {
      roomCode: game.roomCode,
      target: { x: -100, y: Number.NaN },
    });
    expect(await errorPromise).toMatch(/habilidad enviada no es válida/i);
  });

  it("22. una baja cura 20% sin superar maxHealth y desconectarse pausa la sanidad", async () => {
    const game = await setupPlayingRoom();
    const room = server.store.get(game.roomCode)!;
    const attacker = server.store.findPlayerByUser(room, game.first.userId)!;
    const victim = server.store.findPlayerByUser(room, game.second.userId)!;
    attacker.combat.health = attacker.combat.maxHealth - 5;
    eliminatePlayer(room, victim, "Baja de prueba", attacker, Date.now());
    expect(attacker.combat.health).toBe(attacker.combat.maxHealth);

    attacker.connected = false;
    attacker.sanityState.lastMeaningfulMoveAt = 0;
    const healthBefore = attacker.combat.health;
    evaluateRoom(room, server.context, 60_000);
    expect(attacker.combat.health).toBe(healthBefore);
  });

  it("23. penaliza en servidor un parry que vence sin recibir ataque", async () => {
    const game = await setupPlayingRoom();
    const room = server.store.get(game.roomCode)!;
    const player = server.store.findPlayerByUser(room, game.first.userId)!;
    const now = Date.now();
    player.parryUntil = now - 1;
    player.stunnedUntil = 0;
    evaluateRoom(room, server.context, now);
    expect(player.parryUntil).toBe(0);
    expect(player.stunnedUntil).toBe(now + 1_400);
    expect(room.message).toMatch(/bloqueó en falso/i);
  });
});
