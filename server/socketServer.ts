import { createSocketGameServer } from "./createSocketServer";

const port = Number.parseInt(process.env.PORT ?? "4001", 10);
const host = "0.0.0.0";
const server = createSocketGameServer();

async function shutdown() {
  await server.close();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());

server
  .listen(Number.isFinite(port) ? port : 4001, host)
  .then((address) => {
    console.info(`[Speleum] Socket.IO escuchando en http://${address.address}:${address.port}`);
  })
  .catch((error: unknown) => {
    console.error("[Speleum] No se pudo iniciar Socket.IO.", error);
    process.exit(1);
  });
