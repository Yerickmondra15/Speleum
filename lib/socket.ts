import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

function resolveSocketUrl() {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_SOCKET_URL ?? null;
  }

  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL;
  }

  const { hostname } = window.location;

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://localhost:4001";
  }

  return null;
}

export function getSocket() {
  const socketUrl = resolveSocketUrl();

  if (!socketUrl) {
    return null;
  }

  if (socket) {
    return socket;
  }

  socket = io(socketUrl, {
    autoConnect: false,
    transports: ["websocket", "polling"],
    timeout: 20000,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  return socket;
}

export function ensureSocketConnection() {
  const client = getSocket();

  if (!client) {
    return null;
  }

  if (!client.connected) {
    client.connect();
  }

  return client;
}

export function isSocketMultiplayerAvailable() {
  return Boolean(resolveSocketUrl());
}
