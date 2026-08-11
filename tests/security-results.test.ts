import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  SOCKET_TICKET_TTL_SECONDS,
  createResultReceipt,
  createSocketTicket,
  verifySocketTicket,
} from "@/lib/multiplayer/tickets";
import {
  MatchResultPolicyError,
  matchResultRequestSchema,
  verifyMatchResultRequest,
} from "@/lib/matches/result-contract";

const secret = "test-secret-with-at-least-thirty-two-chars";

describe("tickets firmados", () => {
  it("firma y verifica identidad del socket", () => {
    const token = createSocketTicket({ userId: "user-1", username: "Lumen" }, secret, 1_000_000);
    expect(verifySocketTicket(token, secret, 1_000_000)).toMatchObject({
      sub: "user-1",
      username: "Lumen",
      purpose: "socket-auth",
    });
  });

  it("rechaza firma modificada o secreto incorrecto", () => {
    const token = createSocketTicket({ userId: "user-1", username: "Lumen" }, secret);
    expect(verifySocketTicket(`${token.slice(0, -1)}x`, secret)).toBeNull();
    expect(verifySocketTicket(token, "another-long-test-secret-123456789")).toBeNull();
  });

  it("rechaza tickets vencidos", () => {
    const now = 2_000_000;
    const token = createSocketTicket({ userId: "user-1", username: "Lumen" }, secret, now);
    expect(verifySocketTicket(token, secret, now + (SOCKET_TICKET_TTL_SECONDS + 1) * 1_000)).toBeNull();
  });
});

describe("contrato de resultados", () => {
  it("rechaza campos desconocidos y criaturas inventadas", () => {
    expect(matchResultRequestSchema.safeParse({
      mode: "local",
      matchId: randomUUID(),
      status: "finished",
      startedAt: new Date(1_000).toISOString(),
      endedAt: new Date(3_000).toISOString(),
      creature: "dragon",
      result: "win",
      scoreEarned: 999,
    }).success).toBe(false);
  });

  it("marca resultados locales como no competitivos y fuerza score cero", () => {
    const clientMatchId = randomUUID();
    const request = matchResultRequestSchema.parse({
      mode: "local",
      matchId: clientMatchId,
      status: "finished",
      startedAt: new Date(1_000).toISOString(),
      endedAt: new Date(3_000).toISOString(),
      creature: "cave-axolotl",
      result: "win",
    });
    expect(verifyMatchResultRequest({ request, currentUserId: "user-1", resultSecret: secret, nowMs: 4_000 })).toMatchObject({
      matchId: `local:user-1:${clientMatchId}`,
      scoreEarned: 0,
      competitive: false,
      verificationLevel: "local_unverified",
      winnerId: null,
    });
  });

  it("separa los IDs locales del namespace autoritativo multijugador", () => {
    const publicMultiplayerId = randomUUID();
    const request = matchResultRequestSchema.parse({
      mode: "local",
      matchId: publicMultiplayerId,
      status: "finished",
      startedAt: new Date(1_000).toISOString(),
      endedAt: new Date(3_000).toISOString(),
      creature: "cave-axolotl",
      result: "loss",
    });

    const verified = verifyMatchResultRequest({
      request,
      currentUserId: "attacker",
      resultSecret: secret,
      nowMs: 4_000,
    });

    expect(verified.matchId).toBe(`local:attacker:${publicMultiplayerId}`);
    expect(verified.matchId).not.toBe(publicMultiplayerId);
  });

  it("rechaza duraciones imposibles", () => {
    const request = matchResultRequestSchema.parse({
      mode: "local",
      matchId: randomUUID(),
      status: "finished",
      startedAt: new Date(2_000).toISOString(),
      endedAt: new Date(2_100).toISOString(),
      creature: "cave-axolotl",
      result: "loss",
    });
    expect(() => verifyMatchResultRequest({ request, currentUserId: "user-1", resultSecret: secret, nowMs: 3_000 })).toThrow(MatchResultPolicyError);
  });

  it("acepta solo el resultado multijugador emitido para el usuario autenticado", () => {
    const now = 5_000_000;
    const receipt = createResultReceipt({
      matchId: randomUUID(),
      userId: "user-1",
      winnerUserId: "user-2",
      creature: "cave-spider",
      result: "loss",
      scoreEarned: 42,
      startedAt: new Date(now - 5_000).toISOString(),
      endedAt: new Date(now).toISOString(),
    }, secret, now);
    const request = matchResultRequestSchema.parse({ mode: "multiplayer", receipt });
    expect(verifyMatchResultRequest({ request, currentUserId: "user-1", resultSecret: secret, nowMs: now })).toMatchObject({
      result: "loss",
      scoreEarned: 42,
      competitive: true,
      verificationLevel: "server_verified",
    });
    expect(() => verifyMatchResultRequest({ request, currentUserId: "user-2", resultSecret: secret, nowMs: now })).toThrowError(/otro usuario/);
  });
});
