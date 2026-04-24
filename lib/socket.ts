import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket() {
  if (socket) {
    return socket;
  }

  socket = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4001", {
    autoConnect: false,
    transports: ["websocket"],
  });

  return socket;
}

export function ensureSocketConnection() {
  const client = getSocket();

  if (!client.connected) {
    client.connect();
  }

  return client;
}
