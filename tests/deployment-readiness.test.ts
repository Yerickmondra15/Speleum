import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  getPublicClientEnvironment,
  validateEnvironment,
} from "@/lib/config/environment";
import { runDemoChecks } from "@/lib/demo/smoke-check";
import { warmSocketService } from "@/lib/multiplayer/service-health";
import { creatures } from "@/lib/creatures";
import { createSocketGameServer } from "@/server/createSocketServer";
import { isOriginAllowed, resolveCorsPolicy } from "@/server/config";

const socketSecret = "socket-secret-that-is-at-least-32-characters";
const resultSecret = "result-secret-that-is-at-least-32-characters";

function productionNextEnvironment() {
  return {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://database.invalid/speleum",
    DIRECT_URL: "postgresql://database.invalid/speleum",
    SESSION_SECRET: "session-secret-that-is-at-least-32-characters",
    AUTH_CODE_SECRET: "auth-code-secret-that-is-at-least-32-characters",
    SOCKET_AUTH_SECRET: socketSecret,
    MULTIPLAYER_RESULT_SECRET: resultSecret,
    AUTH_DELIVERY_MODE: "demo",
    ALLOW_PUBLIC_DEMO_AUTH: "true",
    NEXT_PUBLIC_APP_URL: "https://speleum.example",
    NEXT_PUBLIC_SOCKET_URL: "https://socket.speleum.example",
  };
}

describe("preparacion de deployment", () => {
  it("rechaza una variable obligatoria ausente", () => {
    const environment = productionNextEnvironment();
    delete (environment as Partial<typeof environment>).DATABASE_URL;
    expect(validateEnvironment("next", environment, "production")).toMatchObject({
      ok: false,
      missing: expect.arrayContaining(["DATABASE_URL"]),
    });
  });

  it("la configuracion cliente contiene solo variables NEXT_PUBLIC permitidas", () => {
    const client = getPublicClientEnvironment({
      ...productionNextEnvironment(),
      RESEND_API_KEY: "private",
      DATABASE_URL: "private",
    });
    expect(client).toEqual({
      NEXT_PUBLIC_APP_URL: "https://speleum.example",
      NEXT_PUBLIC_SOCKET_URL: "https://socket.speleum.example",
    });
    expect(JSON.stringify(client)).not.toContain("private");
  });

  it("health y ready responden sin exponer secretos", async () => {
    const server = createSocketGameServer({
      socketAuthSecret: socketSecret,
      resultSecret,
      allowedOrigins: new Set(["https://speleum.example"]),
      persistOfficialResults: async () => [],
    });
    const address = await server.listen();
    try {
      for (const path of ["health", "ready"]) {
        const response = await fetch(`http://127.0.0.1:${address.port}/${path}`);
        expect(response.status).toBe(200);
        const body = await response.text();
        expect(body).toContain("speleum-socket");
        expect(body).not.toContain(socketSecret);
        expect(body).not.toContain(resultSecret);
      }
    } finally {
      await server.close();
    }
  });

  it("CORS permite produccion explicita", () => {
    const policy = resolveCorsPolicy({
      NODE_ENV: "production",
      FRONTEND_URL: "https://speleum.vercel.app",
    });
    expect(isOriginAllowed("https://speleum.vercel.app", policy)).toBe(true);
  });

  it("CORS permite localhost en desarrollo", () => {
    const policy = resolveCorsPolicy({ NODE_ENV: "development" });
    expect(isOriginAllowed("http://localhost:3000", policy)).toBe(true);
    expect(isOriginAllowed("http://127.0.0.1:3000", policy)).toBe(true);
  });

  it("CORS rechaza origen no configurado y previews por defecto", () => {
    const policy = resolveCorsPolicy({
      NODE_ENV: "production",
      FRONTEND_URL: "https://speleum.vercel.app",
    });
    expect(isOriginAllowed("https://evil.example", policy)).toBe(false);
    expect(isOriginAllowed("https://otro-proyecto.vercel.app", policy)).toBe(false);
  });

  it("el preflight de cold start reintenta y recupera", async () => {
    const states: string[] = [];
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("bad gateway", { status: 502 }))
      .mockResolvedValueOnce(Response.json({ status: "ready" }));
    await expect(
      warmSocketService("https://socket.example", {
        fetchImpl,
        retryDelaysMs: [0, 0],
        wait: async () => undefined,
        onState: (state) => states.push(state),
      }),
    ).resolves.toBe(true);
    expect(states).toEqual(["connecting", "waking", "ready"]);
  });

  it("un timeout termina en estado de error visible", async () => {
    const states: string[] = [];
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation((_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      }),
    );
    await expect(
      warmSocketService("https://socket.example", {
        fetchImpl,
        timeoutMs: 1,
        retryDelaysMs: [0],
        onState: (state) => states.push(state),
      }),
    ).resolves.toBe(false);
    expect(states).toEqual(["connecting", "error"]);
  });

  it("smoke check falla si Next no responde", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("offline"));
    const checks = await runDemoChecks({
      nextUrl: "https://next.example",
      socketUrl: "https://socket.example",
      fetchImpl,
      timeoutMs: 5,
    });
    expect(checks.find((check) => check.name === "Next landing")?.ok).toBe(false);
  });

  it("smoke check falla si Socket no responde", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("https://socket.example")) throw new TypeError("offline");
      return new Response("ok");
    });
    const checks = await runDemoChecks({
      nextUrl: "https://next.example",
      socketUrl: "https://socket.example",
      fetchImpl,
    });
    expect(checks.find((check) => check.name === "Socket readiness")?.ok).toBe(false);
  });

  it("smoke check pasa con servicios saludables", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/ready")) return Response.json({ status: "ready" });
      if (url.includes("/socket.io/")) return new Response('0{"sid":"test"}');
      return new Response("ok");
    });
    const checks = await runDemoChecks({
      nextUrl: "https://next.example",
      socketUrl: "https://socket.example",
      fetchImpl,
    });
    expect(checks).toHaveLength(6);
    expect(checks.every((check) => check.ok)).toBe(true);
  });

  it("los scripts locales y el smoke check existen", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(packageJson.scripts).toMatchObject({
      dev: expect.any(String),
      socket: expect.any(String),
      "dev:full": expect.any(String),
      build: expect.any(String),
      start: expect.any(String),
      "demo:check": expect.any(String),
    });
  });

  it("metadata no referencia los iconos criticos inexistentes", async () => {
    const layout = await readFile("app/layout.tsx", "utf8");
    for (const missing of ["icon-light-32x32.png", "icon-dark-32x32.png", "icon.svg", "apple-icon.png"]) {
      expect(layout).not.toContain(missing);
    }

    await access("app/favicon.ico");
    const criticalAssets = [
      ...creatures.flatMap((creature) => [creature.imagenJuego, creature.imagenIlustracion]),
      "/Grafico/Logo Speleum.svg",
      "/Grafico/Logo blanco.svg",
      "/Grafico/Nombre.svg",
      "/Grafico/Nombre-white.svg",
    ];
    await Promise.all(
      criticalAssets.map((asset) => access(join("public", asset.replace(/^\//, "")))),
    );
  });
});
