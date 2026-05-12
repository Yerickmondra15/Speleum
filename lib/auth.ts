import "server-only";

import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth-session";

export type SessionUser = {
  id: string;
  username: string;
  email: string;
  activeCreature: string;
  createdAt: string;
};

export function toSessionUser(user: {
  id: string;
  username: string;
  email: string;
  activeCreature: string;
  createdAt: Date;
}): SessionUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    activeCreature: user.activeCreature,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function getCurrentUser() {
  const userId = await getSessionUserId();

  if (!userId) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: userId },
  });
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("UNAUTHORIZED");
  }

  return user;
}
