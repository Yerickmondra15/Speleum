import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

async function fetchSocketTicket() {
  const response = await fetch("/api/socket/ticket", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error(response.status === 401 ? "AUTH_REQUIRED" : "TICKET_UNAVAILABLE");
  }

  const payload = (await response.json()) as { ticket?: unknown };

  if (typeof payload.ticket !== "string" || payload.ticket.length > 8_192) {
    throw new Error("TICKET_INVALID_RESPONSE");
  }

  return payload.ticket;
}

export function getSocketServiceUrl() {
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
  const socketUrl = getSocketServiceUrl();

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
    auth(callback) {
      void fetchSocketTicket()
        .then((ticket) => callback({ ticket }))
        .catch(() => callback({ ticket: "" }));
    },
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
  return Boolean(getSocketServiceUrl());
}
