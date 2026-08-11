import { randomUUID } from "node:crypto";
import { z } from "zod";

import { createSignedToken, readSignedToken } from "@/lib/security/signed-token";

export const SOCKET_TICKET_TTL_SECONDS = 60;
export const RESULT_RECEIPT_TTL_SECONDS = 30 * 60;

const unixSecondsSchema = z.number().int().nonnegative();

const socketTicketPayloadSchema = z
  .object({
    v: z.literal(1),
    purpose: z.literal("socket-auth"),
    sub: z.string().min(1).max(128),
    username: z.string().min(1).max(64),
    jti: z.string().uuid(),
    iat: unixSecondsSchema,
    exp: unixSecondsSchema,
  })
  .strict();

const resultReceiptPayloadSchema = z
  .object({
    v: z.literal(1),
    purpose: z.literal("multiplayer-result"),
    jti: z.string().uuid(),
    iat: unixSecondsSchema,
    exp: unixSecondsSchema,
    matchId: z.string().uuid(),
    userId: z.string().min(1).max(128),
    winnerUserId: z.string().min(1).max(128).nullable(),
    participantCount: z.number().int().min(2).max(6).optional(),
    creature: z.string().min(1).max(32),
    result: z.enum(["win", "loss"]),
    scoreEarned: z.number().int().min(0).max(1_000),
    startedAt: z.string().datetime({ offset: true }),
    endedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type SocketTicketPayload = z.infer<typeof socketTicketPayloadSchema>;
export type ResultReceiptPayload = z.infer<typeof resultReceiptPayloadSchema>;

function toUnixSeconds(nowMs: number) {
  return Math.floor(nowMs / 1000);
}

function tokenIsCurrent(
  payload: { iat: number; exp: number },
  nowMs: number,
  maximumTtlSeconds: number,
) {
  const now = toUnixSeconds(nowMs);
  return (
    payload.exp > now &&
    payload.iat <= now + 5 &&
    payload.exp > payload.iat &&
    payload.exp - payload.iat <= maximumTtlSeconds
  );
}

export function createSocketTicket(
  input: { userId: string; username: string },
  secret: string,
  nowMs = Date.now(),
) {
  const iat = toUnixSeconds(nowMs);
  const payload: SocketTicketPayload = {
    v: 1,
    purpose: "socket-auth",
    sub: input.userId,
    username: input.username,
    jti: randomUUID(),
    iat,
    exp: iat + SOCKET_TICKET_TTL_SECONDS,
  };

  return createSignedToken(payload, secret);
}

export function verifySocketTicket(token: string, secret: string, nowMs = Date.now()) {
  const parsed = socketTicketPayloadSchema.safeParse(readSignedToken(token, secret));

  if (!parsed.success || !tokenIsCurrent(parsed.data, nowMs, SOCKET_TICKET_TTL_SECONDS)) {
    return null;
  }

  return parsed.data;
}

export function createResultReceipt(
  input: Omit<ResultReceiptPayload, "v" | "purpose" | "jti" | "iat" | "exp">,
  secret: string,
  nowMs = Date.now(),
) {
  const iat = toUnixSeconds(nowMs);
  const payload: ResultReceiptPayload = {
    v: 1,
    purpose: "multiplayer-result",
    jti: randomUUID(),
    iat,
    exp: iat + RESULT_RECEIPT_TTL_SECONDS,
    ...input,
  };

  return createSignedToken(payload, secret);
}

export function verifyResultReceipt(token: string, secret: string, nowMs = Date.now()) {
  const parsed = resultReceiptPayloadSchema.safeParse(readSignedToken(token, secret));

  if (!parsed.success || !tokenIsCurrent(parsed.data, nowMs, RESULT_RECEIPT_TTL_SECONDS)) {
    return null;
  }

  return parsed.data;
}
