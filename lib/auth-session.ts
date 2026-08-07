import "server-only";

import { cookies } from "next/headers";
import { z } from "zod";

import { getSessionSecret } from "@/lib/security/secrets";
import { createSignedToken, readSignedToken } from "@/lib/security/signed-token";

const SESSION_COOKIE_NAME = "speleum_session";
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

const sessionPayloadSchema = z
  .object({
    v: z.literal(1),
    sub: z.string().min(1).max(128),
    iat: z.number().int().nonnegative(),
    exp: z.number().int().positive(),
  })
  .strict();

export function encodeSession(userId: string, nowMs = Date.now()) {
  const iat = Math.floor(nowMs / 1_000);
  return createSignedToken(
    {
      v: 1,
      sub: userId,
      iat,
      exp: iat + SESSION_TTL_SECONDS,
    },
    getSessionSecret(),
  );
}

export function decodeSession(token: string | undefined, nowMs = Date.now()) {
  if (!token) {
    return null;
  }

  const parsed = sessionPayloadSchema.safeParse(readSignedToken(token, getSessionSecret()));

  if (!parsed.success) {
    return null;
  }

  const now = Math.floor(nowMs / 1_000);
  const payload = parsed.data;

  if (
    payload.exp <= now ||
    payload.iat > now + 5 ||
    payload.exp <= payload.iat ||
    payload.exp - payload.iat > SESSION_TTL_SECONDS
  ) {
    return null;
  }

  return payload.sub;
}

export async function createUserSession(userId: string) {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, encodeSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearUserSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSessionUserId() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return decodeSession(token);
}

export { SESSION_COOKIE_NAME };
