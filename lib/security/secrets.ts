import { randomBytes } from "node:crypto";

const MIN_SECRET_LENGTH = 32;
const generatedDevelopmentSecrets = new Map<string, string>();
const warnedSecrets = new Set<string>();

type SecretOptions = {
  fallbackNames?: string[];
  minimumLength?: number;
};

export function getServerSecret(name: string, options: SecretOptions = {}) {
  const minimumLength = options.minimumLength ?? MIN_SECRET_LENGTH;
  const candidates = [name, ...(options.fallbackNames ?? [])];

  for (const candidate of candidates) {
    const value = process.env[candidate]?.trim();

    if (!value) {
      continue;
    }

    if (value.length < minimumLength) {
      throw new Error(`${candidate} debe tener al menos ${minimumLength} caracteres.`);
    }

    return value;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(`${name} es obligatorio en produccion.`);
  }

  let generated = generatedDevelopmentSecrets.get(name);

  if (!generated) {
    generated = randomBytes(48).toString("base64url");
    generatedDevelopmentSecrets.set(name, generated);
  }

  if (process.env.NODE_ENV !== "test" && !warnedSecrets.has(name)) {
    warnedSecrets.add(name);
    console.warn(
      `[Speleum] ${name} no esta configurado; se usa un secreto efimero solo para este proceso de desarrollo.`,
    );
  }

  return generated;
}

export function getSessionSecret() {
  return getServerSecret("SESSION_SECRET");
}

export function getAuthCodeSecret() {
  return getServerSecret("AUTH_CODE_SECRET", {
    fallbackNames: process.env.NODE_ENV === "production" ? [] : ["SESSION_SECRET"],
  });
}

export function getSocketAuthSecret() {
  return getServerSecret("SOCKET_AUTH_SECRET", {
    fallbackNames: process.env.NODE_ENV === "production" ? [] : ["SESSION_SECRET"],
  });
}

export function getMultiplayerResultSecret() {
  return getServerSecret("MULTIPLAYER_RESULT_SECRET", {
    fallbackNames:
      process.env.NODE_ENV === "production"
        ? []
        : ["SOCKET_AUTH_SECRET", "SESSION_SECRET"],
  });
}
