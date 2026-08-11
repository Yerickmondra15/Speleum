import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { io as createClient, type Socket } from "socket.io-client";

import type { MultiplayerStatePayload } from "@/app/play/types";
import { findReachableTiles, tileToWorld, worldToTile } from "@/app/play/tileMap";
import type { ResumeRoomResult } from "@/lib/multiplayer/events";
import { createSocketTicket } from "@/lib/multiplayer/tickets";
import type {
  MatchResultPersistenceInput,
  PersistedMatchResult,
} from "@/lib/matches/result-persistence";
import { createSocketGameServer } from "@/server/createSocketServer";
import type { OfficialResultPersister } from "@/server/results/officialResultPersistence";
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
  const persistedBatches: MatchResultPersistenceInput[][] = [];
  let persistenceSequence = 0;
  const successfulPersistence: OfficialResultPersister = async (input) => {
    persistedBatches.push(input.map((entry) => ({
      userId: entry.userId,
      result: { ...entry.result },
    })));

    return input.map<PersistedMatchResult>((entry) => ({
      userId: entry.userId,
      id: `persisted-${++persistenceSequence}`,
      created: true,
    }));
  };
  let persistenceImplementation: OfficialResultPersister = successfulPersistence;

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
      persistOfficialResults: (input) => persistenceImplementation(input),
      resultPersistenceRetryDelaysMs: [0, 0],
    });
    const address = await server.listen();
    url = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    for (const client of clients) {
      client.disconnect();
    }
    clients.clear();
    server.store.clear();
    await Promise.allSettled([...server.context.pendingResultPersistences]);
    persistedBatches.length = 0;
    persistenceSequence = 0;
    persistenceImplementation = successfulPersistence;
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

  async function setupPlayingRoomWithPlayers(playerCount: number) {
    const host = await connect();
    const initial = await createRoom(host.client);
    const participants = [host];

    for (let index = 1; index < playerCount; index += 1) {
      const participant = await connect();
      await joinRoom(participant.client, initial.roomCode);
      participants.push(participant);
    }

    const playingPromise = waitForEvent<MultiplayerStatePayload>(
      host.client,
      "game-state",
      (state) => state.status === "playing",
    );
    for (const participant of participants) {
      participant.client.emit("player-ready", { roomCode: initial.roomCode });
    }

    return {
      participants,
      roomCode: initial.roomCode,
      playing: await playingPromise,
    };
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

  it("24. conserva en standings al eliminado que sale antes del final", async () => {
    const game = await setupPlayingRoomWithPlayers(3);
    const room = server.store.get(game.roomCode)!;
    const [first, second, third] = game.participants.map((participant) =>
      server.store.findPlayerByUser(room, participant.userId)!,
    );
    const now = Date.now();

    eliminatePlayer(room, first, "Primera eliminacion", null, now);
    const leftPromise = waitForEvent<{ playerId: string }>(
      game.participants[1].client,
      "player-left",
      (payload) => payload.playerId === first.id,
    );
    game.participants[0].client.emit("leave-room", { roomCode: game.roomCode });
    await leftPromise;

    expect(room.players.get(first.id)).toBe(first);
    expect(first).toMatchObject({ status: "lost", intentionalLeave: true });

    eliminatePlayer(room, second, "Segunda eliminacion", null, now + 1);
    finishRoom(room, server.context, third.id, "Final ordenado", now + 2);

    expect(room.results.map(({ playerId, placement }) => ({ playerId, placement }))).toEqual([
      { playerId: third.id, placement: 1 },
      { playerId: second.id, placement: 2 },
      { playerId: first.id, placement: 3 },
    ]);
  });

  it("25. conserva al eliminado que cierra la conexion antes del final", async () => {
    const game = await setupPlayingRoomWithPlayers(3);
    const room = server.store.get(game.roomCode)!;
    const [first, second, third] = game.participants.map((participant) =>
      server.store.findPlayerByUser(room, participant.userId)!,
    );

    eliminatePlayer(room, first, "Eliminado antes de cerrar", null, Date.now());
    game.participants[0].client.disconnect();
    await waitUntil(() => !first.connected);
    first.reconnectDeadline = Date.now() - 1;
    processRoomLifecycle(server.context, Date.now());

    expect(room.players.get(first.id)).toBe(first);
    expect(first.status).toBe("lost");

    eliminatePlayer(room, second, "Segundo eliminado", null, Date.now());
    finishRoom(room, server.context, third.id, "Final con navegador cerrado", Date.now());

    expect(room.results).toHaveLength(3);
    expect(room.results.find((entry) => entry.playerId === first.id)).toMatchObject({
      placement: 3,
      status: "lost",
    });
  });

  it("26. convierte el abandono vivo en derrota historica coherente", async () => {
    const game = await setupPlayingRoomWithPlayers(3);
    const room = server.store.get(game.roomCode)!;
    const [abandoning, second, winner] = game.participants.map((participant) =>
      server.store.findPlayerByUser(room, participant.userId)!,
    );
    const leftPromise = waitForEvent<{ playerId: string }>(
      game.participants[1].client,
      "player-left",
      (payload) => payload.playerId === abandoning.id,
    );

    game.participants[0].client.emit("leave-room", { roomCode: game.roomCode });
    await leftPromise;

    expect(abandoning).toMatchObject({
      status: "lost",
      intentionalLeave: true,
      connected: false,
    });
    expect(room.players.has(abandoning.id)).toBe(true);

    eliminatePlayer(room, second, "Finalista eliminado", null, Date.now());
    finishRoom(room, server.context, winner.id, "Final tras abandono", Date.now());
    expect(room.results.find((entry) => entry.playerId === abandoning.id)).toMatchObject({
      placement: 3,
      status: "lost",
    });
  });

  it("27. el timeout de reconexion elimina del juego pero no del resultado", async () => {
    const game = await setupPlayingRoomWithPlayers(3);
    const room = server.store.get(game.roomCode)!;
    const [timedOut, second, winner] = game.participants.map((participant) =>
      server.store.findPlayerByUser(room, participant.userId)!,
    );

    game.participants[0].client.disconnect();
    await waitUntil(() => !timedOut.connected);
    timedOut.reconnectDeadline = Date.now() - 1;
    processRoomLifecycle(server.context, Date.now());

    expect(timedOut).toMatchObject({ status: "lost", reconnectDeadline: null });
    expect(room.players.has(timedOut.id)).toBe(true);

    eliminatePlayer(room, second, "Segundo eliminado", null, Date.now());
    finishRoom(room, server.context, winner.id, "Final tras timeout", Date.now());
    expect(room.results.map((entry) => entry.playerId)).toContain(timedOut.id);
  });

  it("28. bloquea el inicio por un lobby desconectado y lo inicia playing tras resume y ready", async () => {
    const host = await connect();
    const initial = await createRoom(host.client);
    const second = await connect();
    await joinRoom(second.client, initial.roomCode);
    const third = await connect();
    await joinRoom(third.client, initial.roomCode);
    const room = server.store.get(initial.roomCode)!;
    const thirdPlayer = server.store.findPlayerByUser(room, third.userId)!;

    third.client.disconnect();
    await waitUntil(() => !thirdPlayer.connected);
    thirdPlayer.reconnectDeadline = Date.now() + 1_000;
    host.client.emit("player-ready", { roomCode: initial.roomCode });
    second.client.emit("player-ready", { roomCode: initial.roomCode });
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(room.status).toBe("waiting");
    expect(thirdPlayer.status).toBe("waiting");

    const replacement = await connect(third.userId, "Third resumed");
    await expect(resumeRoom(replacement.client, initial.roomCode)).resolves.toMatchObject({
      ok: true,
      playerId: thirdPlayer.id,
    });
    const playingPromise = waitForEvent<MultiplayerStatePayload>(
      replacement.client,
      "game-state",
      (state) => state.status === "playing" && state.self.status === "playing",
    );
    replacement.client.emit("player-ready", { roomCode: initial.roomCode });
    const playing = await playingPromise;

    expect(playing.self.status).toBe("playing");
    const actionPromise = waitForEvent<MultiplayerStatePayload>(
      replacement.client,
      "game-state",
      (state) => state.self.combat.isParrying,
    );
    replacement.client.emit("player-defend", { roomCode: initial.roomCode });
    expect((await actionPromise).self.combat.isParrying).toBe(true);
  });

  it("29. reconecta a un eliminado como eliminado y rechaza al que abandono", async () => {
    const game = await setupPlayingRoomWithPlayers(3);
    const room = server.store.get(game.roomCode)!;
    const eliminated = server.store.findPlayerByUser(room, game.participants[0].userId)!;
    const abandoned = server.store.findPlayerByUser(room, game.participants[1].userId)!;

    eliminatePlayer(room, eliminated, "Eliminado reconectable", null, Date.now());
    game.participants[0].client.disconnect();
    await waitUntil(() => !eliminated.connected);
    eliminated.reconnectDeadline = Date.now() + 1_000;
    const replacement = await connect(game.participants[0].userId, "Eliminated resumed");
    const lostStatePromise = waitForEvent<MultiplayerStatePayload>(
      replacement.client,
      "game-state",
      (state) => state.self.id === eliminated.id,
    );
    await expect(resumeRoom(replacement.client, game.roomCode)).resolves.toMatchObject({ ok: true });
    expect((await lostStatePromise).self.status).toBe("lost");
    const actionError = waitForEvent<string>(replacement.client, "error-message");
    replacement.client.emit("player-defend", { roomCode: game.roomCode });
    expect(await actionError).toMatch(/estado actual/i);

    const leftPromise = waitForEvent<{ playerId: string }>(
      game.participants[2].client,
      "player-left",
      (payload) => payload.playerId === abandoned.id,
    );
    game.participants[1].client.emit("leave-room", { roomCode: game.roomCode });
    await leftPromise;
    const abandonedReplacement = await connect(
      game.participants[1].userId,
      "Abandoned resume",
    );
    await expect(resumeRoom(abandonedReplacement.client, game.roomCode)).resolves.toMatchObject({
      ok: false,
      reason: "session-not-found",
      terminal: true,
    });
  });

  it("30. permite resume repetido y recupera una partida ya terminada", async () => {
    const game = await setupPlayingRoom();
    const room = server.store.get(game.roomCode)!;
    const winner = server.store.findPlayerByUser(room, game.first.userId)!;
    finishRoom(room, server.context, winner.id, "Final antes de reconectar", Date.now());
    room.expiresAt = Date.now() + 2_000;

    game.first.client.disconnect();
    await waitUntil(() => !winner.connected);
    winner.reconnectDeadline = Date.now() + 1_000;
    room.expiresAt = Date.now() + 2_000;
    const replacement = await connect(game.first.userId, "Finished resumed");
    const statePromise = waitForEvent<MultiplayerStatePayload>(
      replacement.client,
      "game-state",
      (state) => state.status === "finished",
    );

    await expect(resumeRoom(replacement.client, game.roomCode)).resolves.toMatchObject({
      ok: true,
      status: "finished",
    });
    const finishedState = await statePromise;
    expect(finishedState.resultReceipt).toBeTruthy();
    await expect(resumeRoom(replacement.client, game.roomCode)).resolves.toMatchObject({
      ok: true,
      playerId: winner.id,
    });
  });

  it("31. finishRoom es idempotente y agenda un unico lote oficial de dos resultados", async () => {
    const game = await setupPlayingRoom();
    const room = server.store.get(game.roomCode)!;
    const winner = server.store.findPlayerByUser(room, game.first.userId)!;

    finishRoom(room, server.context, winner.id, "Primer final", Date.now());
    const firstResults = room.results.map((entry) => ({ ...entry }));
    finishRoom(room, server.context, null, "Segundo final invalido", Date.now() + 1);
    await waitUntil(() => room.resultPersistence.status === "persisted");

    expect(room.results).toEqual(firstResults);
    expect(room.winnerId).toBe(winner.id);
    expect(persistedBatches).toHaveLength(1);
    expect(persistedBatches[0]).toHaveLength(2);
    expect(persistedBatches[0].filter((entry) => entry.result.result === "win")).toHaveLength(1);
    expect(persistedBatches[0].filter((entry) => entry.result.result === "loss")).toHaveLength(1);
    expect(new Set(persistedBatches[0].map((entry) => entry.userId)).size).toBe(2);
  });

  it("32. reintenta persistencia oficial transitoria sin depender de otro snapshot", async () => {
    const game = await setupPlayingRoom();
    const room = server.store.get(game.roomCode)!;
    const winner = server.store.findPlayerByUser(room, game.first.userId)!;
    let attempts = 0;
    persistenceImplementation = async (input) => {
      attempts += 1;
      if (attempts < 3) {
        throw Object.assign(new Error("database temporarily unavailable"), {
          retryable: true,
        });
      }
      return successfulPersistence(input);
    };

    finishRoom(room, server.context, winner.id, "Final con retry", Date.now());
    await waitUntil(() => room.resultPersistence.status === "persisted");

    expect(attempts).toBe(3);
    expect(room.resultPersistence).toMatchObject({ status: "persisted", attempts: 3 });
    expect(persistedBatches).toHaveLength(1);
  });

  it("33. cerrar ambos clientes no cancela la persistencia oficial ya determinada", async () => {
    const game = await setupPlayingRoom();
    const room = server.store.get(game.roomCode)!;
    const winner = server.store.findPlayerByUser(room, game.first.userId)!;
    let releasePersistence!: () => void;
    let reportStarted!: () => void;
    const persistenceStarted = new Promise<void>((resolve) => {
      reportStarted = resolve;
    });
    const persistenceGate = new Promise<void>((resolve) => {
      releasePersistence = resolve;
    });
    persistenceImplementation = async (input) => {
      persistedBatches.push(input.map((entry) => ({
        userId: entry.userId,
        result: { ...entry.result },
      })));
      reportStarted();
      await persistenceGate;
      return input.map((entry, index) => ({
        userId: entry.userId,
        id: `closed-client-result-${index}`,
        created: true,
      }));
    };

    try {
      finishRoom(room, server.context, winner.id, "Final independiente del cliente", Date.now());
      await persistenceStarted;
      game.first.client.disconnect();
      game.second.client.disconnect();
      releasePersistence();
      await waitUntil(() => room.resultPersistence.status === "persisted");

      expect(persistedBatches).toHaveLength(1);
      expect(persistedBatches[0]).toHaveLength(2);
      expect(room.resultPersistence.status).toBe("persisted");
    } finally {
      releasePersistence();
    }
  });

  it("34. dos eliminaciones en el mismo milisegundo conservan placements unicos", async () => {
    const game = await setupPlayingRoomWithPlayers(3);
    const room = server.store.get(game.roomCode)!;
    const [first, second, winner] = game.participants.map((participant) =>
      server.store.findPlayerByUser(room, participant.userId)!,
    );
    const sameTick = Date.now();

    eliminatePlayer(room, first, "Primera del tick", null, sameTick);
    eliminatePlayer(room, second, "Segunda del tick", null, sameTick);
    finishRoom(room, server.context, winner.id, "Final del mismo tick", sameTick);

    expect(first.eliminationOrder).not.toBe(second.eliminationOrder);
    expect(room.results.map((entry) => entry.placement)).toEqual([1, 2, 3]);
    expect(room.results.find((entry) => entry.playerId === second.id)?.placement).toBe(2);
    expect(room.results.find((entry) => entry.playerId === first.id)?.placement).toBe(3);
  });

  it("35. una partida de seis conserva seis participantes y un lote oficial completo", async () => {
    const game = await setupPlayingRoomWithPlayers(6);
    const room = server.store.get(game.roomCode)!;
    const players = game.participants.map((participant) =>
      server.store.findPlayerByUser(room, participant.userId)!,
    );
    const winner = players[5];
    const sameTick = Date.now();

    for (const player of players.slice(0, -1)) {
      eliminatePlayer(room, player, `${player.name} eliminado`, null, sameTick);
    }
    finishRoom(room, server.context, winner.id, "Final de seis", sameTick);
    await waitUntil(() => room.resultPersistence.status === "persisted");

    expect(room.players).toHaveLength(6);
    expect(room.results).toHaveLength(6);
    expect(new Set(room.results.map((entry) => entry.playerId))).toHaveLength(6);
    expect(room.results.map((entry) => entry.placement)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(room.results.filter((entry) => entry.status === "won")).toHaveLength(1);
    expect(persistedBatches).toHaveLength(1);
    expect(persistedBatches[0]).toHaveLength(6);
  });

  it("36. limpiar la sala no cancela un lote oficial que ya esta en vuelo", async () => {
    const game = await setupPlayingRoom();
    const room = server.store.get(game.roomCode)!;
    const winner = server.store.findPlayerByUser(room, game.first.userId)!;
    let releasePersistence!: () => void;
    let reportStarted!: () => void;
    const persistenceStarted = new Promise<void>((resolve) => {
      reportStarted = resolve;
    });
    const persistenceGate = new Promise<void>((resolve) => {
      releasePersistence = resolve;
    });
    persistenceImplementation = async (input) => {
      reportStarted();
      await persistenceGate;
      return successfulPersistence(input);
    };

    try {
      finishRoom(room, server.context, winner.id, "Final antes del cleanup", Date.now());
      await persistenceStarted;
      expect(server.store.delete(room.code)).toBe(true);
      expect(server.store.get(room.code)).toBeNull();

      releasePersistence();
      await Promise.allSettled([...server.context.pendingResultPersistences]);
      expect(room.resultPersistence.status).toBe("persisted");
      expect(persistedBatches).toHaveLength(1);
      expect(persistedBatches[0]).toHaveLength(2);
    } finally {
      releasePersistence();
    }
  });
});
