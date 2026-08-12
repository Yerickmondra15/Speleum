"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type AuthUser = {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
  isAdmin: boolean;
  activeCreature: string;
  createdAt: string;
};

export type PendingAuthState = {
  status: "pending_email_verification" | "pending_login_verification";
  challengeId: string;
  email: string;
  deliveryMode: "demo" | "email";
  expiresAt: string;
  expiresInSeconds: number;
  attemptsRemaining: number;
  resendAvailableAt: string;
  message: string;
  demoCode?: string;
};

export type AuthRequestError = Error & {
  retryAfterSeconds?: number;
  retryAt?: string;
  temporaryLock?: boolean;
  remainingAttempts?: number;
};

type AuthSuccessState = {
  status: "authenticated";
  user: AuthUser;
};

type AuthFlowResult = PendingAuthState | AuthSuccessState;

type AuthContextValue = {
  user: AuthUser | null;
  status: "loading" | "signed-in" | "signed-out";
  register: (
    username: string,
    email: string,
    password: string,
  ) => Promise<AuthFlowResult>;
  login: (email: string, password: string) => Promise<AuthFlowResult>;
  verifyEmailCode: (
    challengeId: string,
    email: string,
    code: string,
  ) => Promise<AuthSuccessState>;
  verifyLoginCode: (
    challengeId: string,
    email: string,
    code: string,
  ) => Promise<AuthSuccessState>;
  resendCode: (challengeId: string, email: string) => Promise<PendingAuthState>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  updateActiveCreature: (creatureId: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function parseResponse(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | (Partial<PendingAuthState> & Partial<AuthSuccessState> & {
        error?: string;
        retryAfterSeconds?: number;
        retryAt?: string;
        temporaryLock?: boolean;
        remainingAttempts?: number;
      })
    | null;

  if (!response.ok) {
    const error = new Error(
      payload?.error ?? "No se pudo completar la solicitud.",
    ) as AuthRequestError;

    if (typeof payload?.retryAfterSeconds === "number") {
      error.retryAfterSeconds = payload.retryAfterSeconds;
    }

    error.retryAt = payload?.retryAt;
    error.temporaryLock = payload?.temporaryLock;
    error.remainingAttempts = payload?.remainingAttempts;

    throw error;
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

    const payload = (await parseResponse(response)) as AuthFlowResult | null;

    if (payload?.status === "authenticated") {
      setUser(payload.user);
      setStatus("signed-in");
      return payload;
    }

    setUser(null);
    setStatus("signed-out");
    return payload as PendingAuthState;
  }

  async function login(email: string, password: string) {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const payload = (await parseResponse(response)) as AuthFlowResult | null;

    if (payload?.status === "authenticated") {
      setUser(payload.user);
      setStatus("signed-in");
      return payload;
    }

    setUser(null);
    setStatus("signed-out");
    return payload as PendingAuthState;
  }

  async function verifyEmailCode(challengeId: string, email: string, code: string) {
    const response = await fetch("/api/auth/verify-email-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeId, email, code }),
    });
    const payload = (await parseResponse(response)) as AuthSuccessState;
    setUser(payload.user);
    setStatus("signed-in");
    return payload;
  }

  async function verifyLoginCode(challengeId: string, email: string, code: string) {
    const response = await fetch("/api/auth/verify-login-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeId, email, code }),
    });
    const payload = (await parseResponse(response)) as AuthSuccessState;
    setUser(payload.user);
    setStatus("signed-in");
    return payload;
  }

  async function resendCode(challengeId: string, email: string) {
    const response = await fetch("/api/auth/resend-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeId, email }),
    });
    return (await parseResponse(response)) as PendingAuthState;
  }

  async function logout() {
    const response = await fetch("/api/auth/session", {
      method: "DELETE",
      cache: "no-store",
      credentials: "same-origin",
    });

    if (!response.ok) {
      throw new Error("No se pudo cerrar la sesion.");
    }

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

  const value: AuthContextValue = {
    user,
    status,
    register,
    login,
    verifyEmailCode,
    verifyLoginCode,
    resendCode,
    logout,
    refreshSession,
    updateActiveCreature,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return value;
}
