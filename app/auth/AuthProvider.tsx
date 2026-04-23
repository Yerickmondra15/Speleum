"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const USERS_KEY = "speleum.users.v1";
const SESSION_KEY = "speleum.session.v1";

export type SpeleumUser = {
  id: string;
  name: string;
  passwordHash: string;
  activeCreatureId: string;
  createdAt: string;
  profile: {
    runs: number;
    deepestSignal: string;
  };
};

type PublicUser = Omit<SpeleumUser, "passwordHash">;

type AuthContextValue = {
  user: PublicUser | null;
  status: "loading" | "signed-in" | "signed-out";
  register: (name: string, password: string) => Promise<void>;
  login: (name: string, password: string) => Promise<void>;
  logout: () => void;
  updateActiveCreature: (creatureId: string) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readUsers(): SpeleumUser[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as SpeleumUser[]) : [];
  } catch {
    return [];
  }
}

function writeUsers(users: SpeleumUser[]) {
  window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function publicUser(user: SpeleumUser): PublicUser {
  return {
    id: user.id,
    name: user.name,
    activeCreatureId: user.activeCreatureId,
    createdAt: user.createdAt,
    profile: user.profile,
  };
}

async function hashPassword(password: string) {
  const encoded = new TextEncoder().encode(password);
  const digest = await window.crypto.subtle.digest("SHA-256", encoded);
  const bytes = Array.from(new Uint8Array(digest));

  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(() => {
    if (typeof window === "undefined") return null;

    const sessionId = window.localStorage.getItem(SESSION_KEY);
    const matchedUser = readUsers().find((item) => item.id === sessionId);

    return matchedUser ? publicUser(matchedUser) : null;
  });
  const [status, setStatus] = useState<AuthContextValue["status"]>(() => {
    if (typeof window === "undefined") return "loading";

    return window.localStorage.getItem(SESSION_KEY) ? "signed-in" : "signed-out";
  });

  useEffect(() => {
    if (status === "loading") {
      window.setTimeout(() => {
        setStatus(user ? "signed-in" : "signed-out");
      }, 0);
    }
  }, [status, user]);

  const register = useCallback(async (name: string, password: string) => {
    const normalizedName = name.trim();

    if (normalizedName.length < 3) {
      throw new Error("El nombre debe tener al menos 3 caracteres.");
    }

    if (password.length < 6) {
      throw new Error("La contrasena debe tener al menos 6 caracteres.");
    }

    const users = readUsers();
    const exists = users.some(
      (item) => item.name.toLowerCase() === normalizedName.toLowerCase(),
    );

    if (exists) {
      throw new Error("Ese nombre ya existe.");
    }

    const createdUser: SpeleumUser = {
      id: crypto.randomUUID(),
      name: normalizedName,
      passwordHash: await hashPassword(password),
      activeCreatureId: "cave-axolotl",
      createdAt: new Date().toISOString(),
      profile: {
        runs: 0,
        deepestSignal: "nido",
      },
    };

    writeUsers([...users, createdUser]);
    window.localStorage.setItem(SESSION_KEY, createdUser.id);
    setUser(publicUser(createdUser));
    setStatus("signed-in");
  }, []);

  const login = useCallback(async (name: string, password: string) => {
    const normalizedName = name.trim().toLowerCase();
    const users = readUsers();
    const matchedUser = users.find(
      (item) => item.name.toLowerCase() === normalizedName,
    );

    if (!matchedUser || matchedUser.passwordHash !== (await hashPassword(password))) {
      throw new Error("Credenciales invalidas.");
    }

    window.localStorage.setItem(SESSION_KEY, matchedUser.id);
    setUser(publicUser(matchedUser));
    setStatus("signed-in");
  }, []);

  const logout = useCallback(() => {
    window.localStorage.removeItem(SESSION_KEY);
    setUser(null);
    setStatus("signed-out");
  }, []);

  const updateActiveCreature = useCallback((creatureId: string) => {
    const sessionId = window.localStorage.getItem(SESSION_KEY);

    if (!sessionId) {
      return;
    }

    const users = readUsers();
    const updatedUsers = users.map((item) =>
      item.id === sessionId ? { ...item, activeCreatureId: creatureId } : item,
    );
    const updatedUser = updatedUsers.find((item) => item.id === sessionId);

    writeUsers(updatedUsers);

    if (updatedUser) {
      setUser(publicUser(updatedUser));
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      register,
      login,
      logout,
      updateActiveCreature,
    }),
    [login, logout, register, status, updateActiveCreature, user],
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
