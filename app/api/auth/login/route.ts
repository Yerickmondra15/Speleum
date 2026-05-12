import { compare } from "bcryptjs";
import { NextResponse } from "next/server";

import { toSessionUser } from "@/lib/auth";
import { createUserSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

type LoginBody = {
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as LoginBody;
  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "Completa correo y contrasena." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || !(await compare(password, user.passwordHash))) {
    return NextResponse.json(
      { error: "Credenciales invalidas." },
      { status: 401 },
    );
  }

  await createUserSession(user.id);

  return NextResponse.json({ user: toSessionUser(user) });
}
