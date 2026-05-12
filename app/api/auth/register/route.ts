import { hash } from "bcryptjs";
import { NextResponse } from "next/server";

import { createUserSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { toSessionUser } from "@/lib/auth";

type RegisterBody = {
  username?: string;
  email?: string;
  password?: string;
};

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  const body = (await request.json()) as RegisterBody;
  const username = body.username?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";

  if (username.length < 3) {
    return NextResponse.json(
      { error: "El nombre debe tener al menos 3 caracteres." },
      { status: 400 },
    );
  }

  if (!validateEmail(email)) {
    return NextResponse.json(
      { error: "Ingresa un correo valido." },
      { status: 400 },
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: "La contrasena debe tener al menos 6 caracteres." },
      { status: 400 },
    );
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ username: { equals: username, mode: "insensitive" } }, { email }],
    },
  });

  if (existingUser) {
    return NextResponse.json(
      {
        error:
          existingUser.email === email
            ? "Ese correo ya existe."
            : "Ese nombre de usuario ya existe.",
      },
      { status: 409 },
    );
  }

  const passwordHash = await hash(password, 12);

  const user = await prisma.user.create({
    data: {
      username,
      email,
      passwordHash,
      stats: {
        create: {},
      },
    },
  });

  await createUserSession(user.id);

  return NextResponse.json({ user: toSessionUser(user) }, { status: 201 });
}
