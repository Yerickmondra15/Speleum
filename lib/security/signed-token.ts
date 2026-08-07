import { createHmac, timingSafeEqual } from "node:crypto";

function sign(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function createSignedToken(payload: unknown, secret: string) {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

export function readSignedToken(token: string, secret: string): unknown | null {
  const parts = token.split(".");

  if (parts.length !== 2) {
    return null;
  }

  const [encodedPayload, signature] = parts;

  if (!encodedPayload || !signature) {
    return null;
  }

  const expected = sign(encodedPayload, secret);
  const actualBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as unknown;
  } catch {
    return null;
  }
}
