import { NextResponse } from "next/server";

import { clearUserSession } from "@/lib/auth-session";
import { getCurrentUser, toSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();

  return NextResponse.json({
    user: user ? toSessionUser(user) : null,
  });
}

export async function DELETE() {
  await clearUserSession();
  return new NextResponse(null, { status: 204 });
}
