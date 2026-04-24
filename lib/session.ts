export const SPELEUM_USER_KEY = "speleum-user";

export type SpeleumSession = {
  username: string;
  email: string;
  isLoggedIn: true;
};

export function readSession(): SpeleumSession | null {
  if (typeof window === "undefined") {
      return null;
  }

  try {
    const raw = window.localStorage.getItem(SPELEUM_USER_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<SpeleumSession>;

    if (
      typeof parsed.username !== "string" ||
      typeof parsed.email !== "string" ||
      parsed.isLoggedIn !== true
    ) {
      return null;
    }

    return {
      username: parsed.username,
      email: parsed.email,
      isLoggedIn: true,
    };
  } catch {
    return null;
  }
}

export function writeSession(session: SpeleumSession) {
  window.localStorage.setItem(SPELEUM_USER_KEY, JSON.stringify(session));
}

export function clearSession() {
  window.localStorage.removeItem(SPELEUM_USER_KEY);
}
