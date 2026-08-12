import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Server } from "socket.io";

import { persistMatchResults } from "../lib/matches/result-persistence";
import { getMultiplayerResultSecret, getSocketAuthSecret } from "../lib/security/secrets";
import { installSocketAuthentication } from "./auth/socketAuth";
import {
  defaultServerTimings,
  isOriginAllowed,
  resolveCorsPolicy,
  type ServerTimings,
} from "./config";
import { registerConnectionHandlers } from "./handlers/connectionHandlers";
import { evaluateRoom, processRoomLifecycle, startRoom, syncLobbyState } from "./rooms/roomLifecycle";
import { emitState } from "./rooms/roomSerialization";
import { RoomStore } from "./rooms/roomStore";
import type { OfficialResultPersister } from "./results/officialResultPersistence";
import type {
  ClientToServerEvents,
  GameServer,
  InterServerEvents,
  ServerContext,
  ServerToClientEvents,
  SocketData,
} from "./types";

type CreateSocketServerOptions = {
  socketAuthSecret?: string;
  resultSecret?: string;
  timings?: Partial<ServerTimings>;
  allowedOrigins?: Set<string>;
  allowVercelPreviews?: boolean;
  persistOfficialResults?: OfficialResultPersister;
  resultPersistenceRetryDelaysMs?: readonly number[];
};

export function createSocketGameServer(options: CreateSocketServerOptions = {}) {
  const configuredPolicy = resolveCorsPolicy();
  const corsPolicy = {
    allowedOrigins: options.allowedOrigins ?? configuredPolicy.allowedOrigins,
    allowVercelPreviews:
      options.allowVercelPreviews ?? configuredPolicy.allowVercelPreviews,
  };
  let ready = false;
  const httpServer: HttpServer = createServer((request, response) => {
    const pathname = new URL(request.url ?? "/", "http://socket.local").pathname;
    const origin = request.headers.origin;

    if (origin && isOriginAllowed(origin, corsPolicy)) {
      response.setHeader("Access-Control-Allow-Origin", origin);
      response.setHeader("Vary", "Origin");
    }

    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Type", "application/json; charset=utf-8");

    if (request.method === "OPTIONS") {
      if (!isOriginAllowed(origin, corsPolicy)) {
        response.writeHead(403).end(JSON.stringify({ status: "forbidden" }));
        return;
      }
      response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      response.setHeader("Access-Control-Allow-Headers", "Content-Type");
      response.writeHead(204).end();
      return;
    }

    if (request.method === "GET" && pathname === "/health") {
      response.writeHead(200).end(JSON.stringify({ status: "ok", service: "speleum-socket" }));
      return;
    }

    if (request.method === "GET" && pathname === "/ready") {
      response
        .writeHead(ready ? 200 : 503)
        .end(JSON.stringify({ status: ready ? "ready" : "starting", service: "speleum-socket" }));
      return;
    }

    response.writeHead(404).end(JSON.stringify({ status: "not_found" }));
  });
  const timings = { ...defaultServerTimings, ...options.timings };
  const io: GameServer = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    maxHttpBufferSize: 16 * 1_024,
    cors: {
      origin(origin, callback) {
        if (!origin) {
          callback(null, true);
          return;
        }

        const isAllowed = isOriginAllowed(origin, corsPolicy);
        callback(
          isAllowed ? null : new Error(`Origin not allowed by Socket.IO CORS: ${origin}`),
          isAllowed,
        );
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
  });
  const store = new RoomStore();
  const context: ServerContext = {
    io,
    store,
    timings,
    resultSecret: options.resultSecret ?? getMultiplayerResultSecret(),
    persistOfficialResults: options.persistOfficialResults ?? persistMatchResults,
    resultPersistenceRetryDelaysMs:
      options.resultPersistenceRetryDelaysMs ?? [250, 1_000],
    pendingResultPersistences: new Set(),
  };
  const replayStore = installSocketAuthentication(
    io,
    options.socketAuthSecret ?? getSocketAuthSecret(),
  );

  io.on("connection", (socket) => registerConnectionHandlers(socket, context));

  const gameInterval = setInterval(() => {
    for (const room of [...store.rooms.values()]) {
      evaluateRoom(room, context);
    }
  }, timings.moveTickMs);
  const lobbyInterval = setInterval(() => {
    const now = Date.now();

    for (const room of [...store.rooms.values()]) {
      if (room.status === "finished" || room.status === "playing") {
        continue;
      }

      const changed = syncLobbyState(room, context, now);
      if (room.status === "starting" && room.startAt !== null && room.startAt <= now) {
        startRoom(room, context, now);
        emitState(room, context);
      } else if (changed) {
        emitState(room, context);
      }
    }
  }, timings.lobbyTickMs);
  const lifecycleInterval = setInterval(() => {
    processRoomLifecycle(context);
    replayStore.cleanup();
  }, timings.lifecycleTickMs);

  gameInterval.unref();
  lobbyInterval.unref();
  lifecycleInterval.unref();

  let closed = false;

  async function listen(port = 0, host = "127.0.0.1") {
    await new Promise<void>((resolve, reject) => {
      httpServer.once("error", reject);
      httpServer.listen(port, host, () => {
        httpServer.off("error", reject);
        ready = true;
        resolve();
      });
    });

    return httpServer.address() as AddressInfo;
  }

  async function close() {
    if (closed) {
      return;
    }

    closed = true;
    ready = false;
    clearInterval(gameInterval);
    clearInterval(lobbyInterval);
    clearInterval(lifecycleInterval);
    replayStore.clear();
    await new Promise<void>((resolve) => io.close(() => resolve()));
    await Promise.allSettled([...context.pendingResultPersistences]);
    store.clear();
  }

  return { httpServer, io, store, context, listen, close };
}
