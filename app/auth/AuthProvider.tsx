"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type AuthUser = {
  id: string;
  username: string;
  email: string;
  activeCreature: string;
  createdAt: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  status: "loading" | "signed-in" | "signed-out";
  register: (username: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  updateActiveCreature: (creatureId: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function parseResponse(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | { error?: string; user?: AuthUser | null }
    | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "No se pudo completar la solicitud.");
  }

  return payload;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");

  useEffect(() => {
    fetch("/api/auth/session", {
      method: "GET",
      cache: "no-store",
    })
      .then((response) => parseResponse(response))
      .then((payload) => {
        const sessionPayload = payload as { user?: AuthUser | null } | null;
        setUser(sessionPayload?.user ?? null);
        setStatus(sessionPayload?.user ? "signed-in" : "signed-out");
      })
      .catch(() => {
        setUser(null);
        setStatus("signed-out");
      });
  }, []);

  async function refreshSession() {
    const response = await fetch("/api/auth/session", {
      method: "GET",
      cache: "no-store",
    });
    const payload = (await parseResponse(response)) as { user?: AuthUser | null } | null;
    setUser(payload?.user ?? null);
    setStatus(payload?.user ? "signed-in" : "signed-out");
  }

  async function register(username: string, email: string, password: string) {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });
    const payload = (await parseResponse(response)) as { user?: AuthUser | null } | null;
    setUser(payload?.user ?? null);
    setStatus(payload?.user ? "signed-in" : "signed-out");
  }

  async function login(email: string, password: string) {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const payload = (await parseResponse(response)) as { user?: AuthUser | null } | null;
    setUser(payload?.user ?? null);
    setStatus(payload?.user ? "signed-in" : "signed-out");
  }

  async function logout() {
    await fetch("/api/auth/session", {
      method: "DELETE",
    });
    setUser(null);
    setStatus("signed-out");
  }

  async function updateActiveCreature(creatureId: string) {
    const response = await fetch("/api/users/me/active-creature", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activeCreature: creatureId }),
    });

    await parseResponse(response);
    setUser((current) =>
      current
        ? {
            ...current,
            activeCreature: creatureId,
          }
        : current,
    );
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      register,
      login,
      logout,
      refreshSession,
      updateActiveCreature,
    }),
    [status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return value;
}
